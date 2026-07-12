---
name: verify
description: Build, run and drive Bucket UI (Next.js bucket file viewer) end-to-end with Playwright
---

# Verifying Bucket UI (this repo)

## Build & launch

```bash
pnpm build          # production build (Turbopack)
pnpm start          # serves on http://localhost:3000 (run in background)
```

`.env` must exist with ENCRYPTION_KEY (see .env.example). There is NO built-in
auth anymore — the app is meant to sit behind an authenticating reverse proxy
(nginx/traefik basic auth); every page is reachable directly in dev.

## Drive it

Playwright (chromium) works headless. Install it in a scratch dir, not in the repo:
`npm i playwright && npx playwright install chromium`.

Flows worth driving (wait on error **text**, NOT `[role=alert]` — Next's route
announcer is an empty `role=alert` div and matches first):
- Add source with bogus creds → "Connection failed" after the connection test
  (allow up to 90s timeout). Provider select swaps field labels (R2 vs Azure).
- To exercise `/source/[id]` without real R2 credentials: insert a row directly in
  `data/app.db` with secrets encrypted using ENCRYPTION_KEY (aes-256-gcm,
  base64(iv12‖tag16‖ciphertext)) — the page then renders its "Couldn't load this
  folder" error state. Real browsing/download needs a real R2 bucket + token.
- IMPORTANT: the user tests UI changes himself — stop at tsc/lint/build unless he
  explicitly asks for a driven verification.
- Remove flow: hover sidebar item → `[data-sidebar="menu-action"]` → Remove →
  alertdialog confirm → toast "Source removed".

## Gotchas

- Forms are TanStack Form (client state + per-field validation), submitting via
  server actions called from `onSubmit` — field values survive a failed submit.
  Empty submit shows "<Label> is required." per field without any POST.
  Field ids equal the field name (`#username`, `#endpoint`, `#bucket`,
  `#accessKeyId`, `#secretAccessKey`, `#provider`). The dialog also has a
  "Test connection" button (server action, no insert).
- Forms are built on forms/ (createFormHook): reusable fields in forms/fields/,
  validators in forms/validators.ts, per-feature forms in features/*/components.
- `/source/<unknown-id>` returns HTTP 200 (streaming shell flushed before
  `notFound()`) but renders the 404 UI — check the body, not the status.
- After schema/route changes run `pnpm exec next typegen` before `tsc --noEmit`
  (RouteContext types live in .next/types).
- DB is Prisma 7 (+ @prisma/adapter-better-sqlite3); client generated into
  lib/generated/ (gitignored) — run `pnpm exec prisma generate` after cloning,
  `pnpm db:push` after schema changes. Architecture: app/ (routes),
  features/{auth,sources,browser}/, lib/dal/ (Prisma + session), lib/ (shared).
- Never import values from a "use client" module into a server component — they
  become opaque client references (this silently broke the view cookie once);
  shared constants live in plain modules like features/browser/view.ts.
- pnpm TaskStop leaves orphaned node servers on Windows — free port 3000 via
  Get-NetTCPConnection | Stop-Process before restarting.
