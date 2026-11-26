# Junailijat

## Stack

- Next.js 16 App Router, React 19, TypeScript, and pnpm.
- Payload CMS 4 uses PostgreSQL through `@payloadcms/db-postgres`.
- Google sign-in uses Auth.js; application API writes must derive the account from the server session.

## Local development

1. Copy `.env.example` to `.env.local`, generate distinct values for `AUTH_SECRET` and `PAYLOAD_SECRET`, and configure Google OAuth credentials.
2. Start the local database with `pnpm db:up`.
3. Run the application with `pnpm dev`.

The local PostgreSQL container listens only on `127.0.0.1`. Do not reuse its example credentials in a public deployment.

## Vercel deployment (demo)

- The demo instance runs on Vercel: project `junailijat-ako-coreproto`, production URL https://junailijat-ako-coreproto-junailijat.vercel.app.
- Deployment is CD from GitHub: `git push origin main` → Production, pull requests → Preview. Do not deploy with the `vercel` CLI from Windows (CRLF line endings break the build; `.gitattributes` enforces `eol=lf`, but git push is the primary path).
- Environment variables live in Vercel project settings (Production/Preview/Development): `DATABASE_URL`, `POSTGRES_URL` (Neon integration), `PAYLOAD_SECRET`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_SITE_URL`. Never commit them; `.env*` is gitignored and `.vercelignore` keeps them out of uploads.
- `src/payload.config.ts` reads the DB as `process.env.DATABASE_URL || process.env.POSTGRES_URL`, so the same code works locally (Docker PG via `.env.local`) and on Vercel (Neon via Vercel env).
- The local Docker PostgreSQL and the Vercel Neon database are separate instances. Payload runs with `push: false`; apply schema migrations to the hosted DB deliberately (`payload migrate` with the hosted env), never implicitly during build.
- Build on Vercel is `pnpm run build` (`next build`); there is no `vercel.json`.

## Database and data

- The database connection is read as `process.env.DATABASE_URL || process.env.POSTGRES_URL` in `src/payload.config.ts`. Locally `DATABASE_URL` (from `.env.local`) points to the Docker PostgreSQL; on Vercel, `DATABASE_URL`/`POSTGRES_URL` come from Vercel env (Neon). Local Docker and hosted PostgreSQL use the same application configuration, but they are separate database instances.
- Payload schema changes belong in Payload migrations; run `pnpm db:migrate:create` to create a migration and `pnpm db:migrate` to apply it locally.
- Persist user profiles, matches, participation, and chat data in PostgreSQL. Do not add process-memory or filesystem-backed server stores.
- `data/demo-store.json` may be retained as a legacy import source until the idempotent importer has been run and verified.
- Never commit `.env.local`, OAuth credentials, database credentials, or generated secrets.

## Validation

- Run the narrowest relevant check first, then `pnpm exec tsc --noEmit` and `pnpm build` for data-layer or configuration changes.
- Keep generated Payload types and the Admin import map synchronized with `src/payload.config.ts`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
