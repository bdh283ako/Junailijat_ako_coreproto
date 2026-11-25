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

## Database and data

- `DATABASE_URL` is the only database connection setting. Local Docker and hosted PostgreSQL use the same application configuration.
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
