# Junailijat_ako_coreproto — Agent & Architecture Rules

## 1. Architecture-as-Code First (PlantUML & Mermaid)
- **Single Source of Truth:** Before proposing or editing any code, always read:
  1. `docs/arkkitehtuuri_localhost.puml` (system, runtime, API routes, Docker/PostgreSQL, and external feeds)
  2. `docs/arkkitehtuuri_shellproto.puml` (component and hook modularity inside `shellproto/`)
  3. `docs/arkkitehtuuri_vercel.puml` (Vercel demo instance, CD pipeline from GitHub, environment variable layers)
- **Plan Before Acting:** In `Plan` mode, verify how the requested change maps to existing components, API routes, and the Docker/PostgreSQL persistence layer shown in `docs/arkkitehtuuri_localhost.puml`.
- **Keep Diagrams Synchronized:**
  - Whenever you add, rename, or rewire API routes, database persistence, authentication, or external event feeds, update `docs/arkkitehtuuri_localhost.puml` AND the corresponding Mermaid diagram (Section 1) in `docs/ARKKITEHTUURI.md`.
  - Whenever you extract, split, or rewire UI panels or custom hooks inside `src/app/(frontend)/akotestaa/shellproto/`, update `docs/arkkitehtuuri_shellproto.puml` (changing stereotype `<<target>>` to `<<extracted>>` and dashed arrows `..>` to solid `-->`) AND update the corresponding Mermaid diagram (Section 2, moving nodes from `TargetPanels`/`TargetHooks` to `ExtractedPanels`/`ExtractedHooks` with `:::extracted`) in `docs/ARKKITEHTUURI.md` in the same task.
  - Whenever deployment or environment configuration changes (Vercel env vars, `.vercelignore`, `.gitattributes`, build scripts, DB env reading in `src/payload.config.ts`), update `docs/arkkitehtuuri_vercel.puml`, the environment section of `docs/ARKKITEHTUURI.md`, the `Ympäristöt ja deploy` section of `README.md`, and the `Vercel deployment` section of `AGENTS.md` in the same task.

## 2. Tech Stack & Runtime Boundaries
- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Payload CMS 4 + `@payloadcms/db-postgres` running against PostgreSQL 17 in a local Docker Compose container, and Auth.js / NextAuth Google OAuth 2.0.
- **Deployment:** The demo instance runs on Vercel (project `junailijat-ako-coreproto`, https://junailijat-ako-coreproto-junailijat.vercel.app) via CD from GitHub (`main` → Production, PRs → Preview). Prefer `git push` over the `vercel` CLI on Windows (CRLF breaks CLI uploads; `.gitattributes` forces `eol=lf`). Vercel env vars (`DATABASE_URL`/`POSTGRES_URL` from the Neon integration, `PAYLOAD_SECRET`, `AUTH_SECRET`, `AUTH_GOOGLE_*`, `NEXT_PUBLIC_SITE_URL`) are managed in Vercel and never committed. Local Docker PostgreSQL and the Vercel Neon database are separate instances.
- **No Regression to Legacy Storage:** Never reintroduce old Figma Make static JSON-blob persistence (`data/demo-store.json` is strictly for one-time legacy import) where PostgreSQL/Payload API routes are already wired.
- **Storage Separation:** Keep `localStorage` strictly limited to transient prototype UI state (`akotestaa` views and read receipts), never for PII or persistent family profile records.
- **Protected Paths:** Never read, modify, or expose `.env`, `.env.local`, `.npmrc`, or credentials. Keep `data/` and local artifacts ignored per `.gitignore`.

## 3. Modularity & Refactoring Discipline (`shellproto`)
- **Target Area:** `src/app/(frontend)/akotestaa/shellproto/`
- **Keep `page.tsx` Thin:** `page.tsx` is a top-level coordinator. Place self-contained UI sections into dedicated `*Panel.tsx` / `*View.tsx` components and side effects/data fetching into `use*.ts` hooks.
- **Incremental Changes:** Make one focused, atomic change per task. Do not combine UI extraction, filtering logic rewrites, and state-sync hook refactors in a single step.
- **Preserve Existing Behavior:** Keep existing prop contracts, `recordDemoSelection` telemetry calls, multi-stage event filtering (geo -> default preset -> quick age/search), and Finnish UI copy intact unless explicitly asked to change them or unless required by approved UI/product rules in `docs/UI_DESIGN_PRINCIPLES.md` and `.clinerules/01-ui-principles.md`.

## 4. Token & Context Efficiency
- Read only `docs/arkkitehtuuri_localhost.puml`, `docs/arkkitehtuuri_shellproto.puml`, `docs/ARKKITEHTUURI.md` (when updating diagrams), `docs/UI_DESIGN_PRINCIPLES.md` / `docs/UI_ACCESSIBILITY_CHANGELOG.md` (for UI tasks), and explicitly referenced target files (`@file`). Never scan `node_modules/`, `.next/`, or `.git/`.
- Before finishing a task, run `npx tsc --noEmit` to verify zero TypeScript errors.
- Summarize modified files and diagram updates (`*.puml` + `docs/ARKKITEHTUURI.md`) concisely in Finnish at the end of the response.