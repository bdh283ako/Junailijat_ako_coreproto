#!/usr/bin/env bash
set -euo pipefail

# Käyttö:
#   ./scripts/release-prod.sh "Julkaisuviesti" --yes
#   ./scripts/release-prod.sh "Testausvaihe" --major 3 --yes
#   ./scripts/release-prod.sh "Kuivaharjoitus" --dry-run
#   ./scripts/release-prod.sh "Ilman buildia" --skip-build --yes
#   ./scripts/release-prod.sh "Ilman --webpack-lippua" --no-webpack --yes

MESSAGE=""
MAJOR=2
SKIP_BUILD=false
USE_WEBPACK=true
DRY_RUN=false
AUTO_YES=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --major) MAJOR="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --no-webpack) USE_WEBPACK=false; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --yes|-y) AUTO_YES=true; shift ;;
    -*) echo "Tuntematon lippu: $1" >&2; exit 1 ;;
    *) MESSAGE="${MESSAGE:+$MESSAGE }$1"; shift ;;
  esac
done

if [[ -z "$MESSAGE" ]]; then
  echo "Virhe: Anna julkaisuviesti. Esim: ./scripts/release-prod.sh \"Karttasivun viilaukset\" --yes" >&2
  exit 1
fi

# Siirry git-juureen
GIT_ROOT=$(git rev-parse --show-toplevel)
cd "$GIT_ROOT"

PKG_PATH="package.json"
if [[ ! -f "$PKG_PATH" && -f "shellproto/package.json" ]]; then
  PKG_PATH="shellproto/package.json"
fi

if [[ ! -f "$PKG_PATH" ]]; then
  echo "Virhe: package.json ei löydy juuresta eikä shellproto/-kansiosta." >&2
  exit 1
fi

# 1. Laske MINOR (päiväerotus 2026-11-17) ja PATCH
START_EPOCH=$(date -u -d "2026-11-17 00:00:00" +%s)
TODAY_STR=$(date -u +%Y-%m-%d)
TODAY_EPOCH=$(date -u -d "${TODAY_STR} 00:00:00" +%s)
MINOR=$(( (TODAY_EPOCH - START_EPOCH) / 86400 ))

echo "[1/6] Haetaan etätagit..."
git fetch origin --tags

MAX_PATCH=-1
while IFS= read -r tag; do
  tag="${tag//$'\r'/}"
  if [[ "$tag" =~ ^v${MAJOR}\.${MINOR}\.([0-9]+)$ ]]; then
    p="${BASH_REMATCH[1]}"
    (( p > MAX_PATCH )) && MAX_PATCH=$p
  fi
done < <(git tag -l "v${MAJOR}.${MINOR}.*")

PATCH=$(( MAX_PATCH + 1 ))
VERSION="${MAJOR}.${MINOR}.${PATCH}"
GIT_TAG="v${VERSION}"

echo "=== Tuotantojulkaisu: ${VERSION} (${GIT_TAG}) | ${TODAY_STR} (+${MINOR} pv) ==="

# 2. Haaratarkistus
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD | tr -d '\r')
echo "[2/6] Nykyinen haara: ${CURRENT_BRANCH}"

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Varoitus: Olet haarassa '${CURRENT_BRANCH}', et 'main'-haarassa!"
  if [[ "$AUTO_YES" == false ]]; then
    read -r -p "Jatketaanko silti nykyisestä haarasta? (k/e) " BRANCH_CONFIRM
    BRANCH_CONFIRM="${BRANCH_CONFIRM//$'\r'/}"
    if [[ "$BRANCH_CONFIRM" != "k" ]]; then
      echo "Keskeytetty. Aja ensin: git checkout main"
      exit 1
    fi
  fi
fi

BEHIND_COUNT=$(git rev-list --count "HEAD..origin/${CURRENT_BRANCH}" 2>/dev/null || echo "0")
if (( BEHIND_COUNT > 0 )); then
  echo "Synkronoidaan etähaara (git pull --rebase)..."
  git pull --rebase origin "$CURRENT_BRANCH"
fi

# 3. Tarkista muutokset ja estä .env / paikallinen data/*.json
STATUS_LINES=$(git status --porcelain)
if [[ -z "$STATUS_LINES" ]]; then
  echo "Ei muuttuneita tiedostoja commitoitavaksi (git status on puhdas)."
  exit 0
fi

while IFS= read -r line; do
  FILE_PATH="${line:3}"
  if [[ "$FILE_PATH" =~ ^\.env || "$FILE_PATH" =~ (^|/)data/.*\.json$ ]]; then
    echo "ESTETTY: '${FILE_PATH}' ei saa mennä tuotantoon!" >&2
    exit 1
  fi
done <<< "$STATUS_LINES"

# 4. Varmista LF-rivinvaihdot skripteissä
if [[ -d "scripts" ]]; then
  find scripts -type f \( -name "*.sh" -o -name "*.mjs" -o -name "*.js" \) -exec sed -i 's/\r$//' {} +
fi

# Nosta Node-heapia buildia ja tyyppitarkistusta varten
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

# 5. TypeScript ja Build
APP_DIR=$(dirname "$PKG_PATH")
echo "[3/6] Ajetaan TypeScript-tarkistus (${APP_DIR})..."
(cd "$APP_DIR" && npx tsc --noEmit)

if [[ "$SKIP_BUILD" == false ]]; then
  echo "[4/6] Ajetaan tuotantobuild (${APP_DIR}, webpack=${USE_WEBPACK})..."
  if command -v pnpm >/dev/null 2>&1; then
    if [[ "$USE_WEBPACK" == true ]]; then
      (cd "$APP_DIR" && pnpm exec next build --webpack)
    else
      (cd "$APP_DIR" && pnpm build)
    fi
  else
    if [[ "$USE_WEBPACK" == true ]]; then
      (cd "$APP_DIR" && npx next build --webpack)
    else
      (cd "$APP_DIR" && npm run build)
    fi
  fi
else
  echo "Varoitus: Tuotantobuild ohitettu (--skip-build)."
fi

# 6. Päivitä versionumero package.jsoniin
echo "[5/6] Päivitetään ${PKG_PATH} -> ${VERSION}..."
node -e '
  const fs = require("fs");
  const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  pkg.version = process.argv[2];
  fs.writeFileSync(process.argv[1], JSON.stringify(pkg, null, 2) + "\n", "utf8");
' "$PKG_PATH" "$VERSION"

echo ""
git status -s
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo "[DryRun] Valmis — ei tehty committia tai pushia."
  exit 0
fi

if [[ "$AUTO_YES" == false ]]; then
  read -r -p "Julkaistaanko ${GIT_TAG} -> origin/${CURRENT_BRANCH}? (k/e) " CONFIRM
  CONFIRM="${CONFIRM//$'\r'/}"
  if [[ "$CONFIRM" != "k" ]]; then
    echo "Julkaisu peruttu."
    exit 0
  fi
fi

echo "[6/6] Tehdään commit, tagi ja push..."
git add -A
git commit -m "release(${GIT_TAG}): ${MESSAGE}"
git tag -a "$GIT_TAG" -m "Tuotantojulkaisu ${GIT_TAG} - ${MESSAGE}"
git push origin "$CURRENT_BRANCH"
git push origin "$GIT_TAG"

echo "VALMIS! ${GIT_TAG} on pusketty haaraan ${CURRENT_BRANCH}."