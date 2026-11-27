import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const SECRETS = ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "AUTH_SECRET"];
const TARGETS = ["production", "preview"];

const args = process.argv.slice(2);
const writeLocal = args.includes("--write-local");
const skipVercel = args.includes("--skip-vercel");
const dryRun = args.includes("--dry-run");
const forceYes = args.includes("--yes") || args.includes("--force");
const projectArg = args.find((a) => a.startsWith("--project="));
const cliProjectId = projectArg ? projectArg.split("=").slice(1).join("=") : null;

const isWin = process.platform === "win32";
const gcloudBin = isWin ? "gcloud.cmd" : "gcloud";
const vercelBin = isWin ? "vercel.cmd" : "vercel";

function quoteForCmd(arg) {
  const s = String(arg);
  if (!/[\s"&|<>^()]/.test(s) && s.length > 0) {
    return s;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function run(cmd, cmdArgs, options = {}) {
  if (isWin && (cmd.endsWith(".cmd") || cmd.endsWith(".bat"))) {
    const commandLine = [quoteForCmd(cmd), ...cmdArgs.map(quoteForCmd)].join(" ");
    return execFileSync("cmd.exe", ["/d", "/s", "/c", commandLine], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...options,
    });
  }

  return execFileSync(cmd, cmdArgs, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function listAvailableProjects() {
  console.log("\nHaetaan käytettävissä olevat GCP-projektit...");
  try {
    const out = run(gcloudBin, [
      "projects",
      "list",
      "--format=table(projectId,name,projectNumber)",
    ]).trim();
    console.log(out || "(Ei projekteja)");
  } catch (err) {
    const msg = err?.stderr?.toString()?.trim() || err?.message || String(err);
    console.log(`Projektien listaus ei onnistunut: ${msg}`);
  }
  console.log("");
}

async function resolveProjectId() {
  if (cliProjectId?.trim()) {
    return cliProjectId.trim();
  }
  if (process.env.GCP_PROJECT_ID?.trim()) {
    return process.env.GCP_PROJECT_ID.trim();
  }

  listAvailableProjects();

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question("Anna GCP PROJECT_ID: ");
    const cleaned = answer.trim();
    if (!cleaned) {
      throw new Error("PROJECT_ID ei voi olla tyhjä.");
    }
    return cleaned;
  } finally {
    rl.close();
  }
}

function cleanSecretValue(raw) {
  let val = raw.replace(/\r?\n$/, "");
  if (
    (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
    (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
  ) {
    val = val.slice(1, -1);
  }
  return val;
}

function fetchSecret(projectId, name) {
  try {
    const out = run(gcloudBin, [
      "secrets",
      "versions",
      "access",
      "latest",
      `--secret=${name}`,
      `--project=${projectId}`,
    ]);
    return cleanSecretValue(out);
  } catch (err) {
    const msg = err?.stderr?.toString()?.trim() || err?.message || String(err);
    throw new Error(`Salaisuuden '${name}' haku epäonnistui projektista '${projectId}': ${msg}`);
  }
}

async function confirmProductionSync(projectId, target, keys) {
  if (dryRun || forceYes || target !== "production") {
    return true;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `VAROITUS: Päivitetään Vercelin PRODUCTION-ympäristö (${keys.join(", ")}) GCP-projektista '${projectId}'. Jatka? [k/E]: `
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === "k" || normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}

function syncVercelEnv(key, value, target) {
  if (dryRun) {
    console.log(`[DRY-RUN] ${key} -> ${target} (len=${value.length})`);
    return;
  }

  try {
    run(vercelBin, ["env", "rm", key, target, "--yes"]);
  } catch {
    // Ohitetaan, jos muuttujaa ei ollut ennestään tässä ympäristössä
  }

  run(vercelBin, ["env", "add", key, target], {
    input: `${value}\n`,
  });
}

function updateLocalEnvFile(entries) {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const lines = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8").replace(/\r\n/g, "\n").split("\n")
    : [];

  const managedKeys = new Set(entries.map(([k]) => k));
  const kept = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return true;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) return true;
    const key = line.slice(0, eqIdx).trim();
    return !managedKeys.has(key);
  });

  while (kept.length > 0 && kept[kept.length - 1] === "") {
    kept.pop();
  }

  for (const [key, value] of entries) {
    kept.push(`${key}=${value}`);
  }

  const content = `${kept.join("\n")}\n`;
  if (dryRun) {
    console.log(`[DRY-RUN] Päivittäisi tiedoston .env.local (${entries.length} avainta, LF)`);
    return;
  }

  fs.writeFileSync(envPath, content, { encoding: "utf8" });
  console.log("OK: updated .env.local (LF)");
}

async function main() {
  const projectId = await resolveProjectId();
  console.log(`Käytetään GCP-projektia: ${projectId}`);

  const loaded = [];
  for (const name of SECRETS) {
    const value = fetchSecret(projectId, name);
    loaded.push([name, value]);
  }

  const keys = loaded.map(([k]) => k);

  if (skipVercel) {
    console.log("Ohitettiin Vercel-päivitys (--skip-vercel).");
  } else {
    for (const target of TARGETS) {
      const allowed = await confirmProductionSync(projectId, target, keys);
      if (!allowed) {
        console.log(`Ohitettiin kohde '${target}' käyttäjän pyynnöstä.`);
        continue;
      }

      for (const [key, value] of loaded) {
        syncVercelEnv(key, value, target);
      }
      console.log(`OK: ${keys.join(", ")} -> ${target}`);
    }
  }

  if (writeLocal) {
    updateLocalEnvFile(loaded);
  } else if (skipVercel) {
    console.log("Huom: --skip-vercel on päällä eikä --write-local ole asetettu, joten mitään ei kirjoitettu.");
  }
}

main().catch((err) => {
  console.error(`VIRHE: ${err.message}`);
  process.exit(1);
});