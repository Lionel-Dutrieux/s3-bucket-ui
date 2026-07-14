<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions

Read `ARCHITECTURE.md` before structural changes — it defines the layers and
the conventions. The short version:

- Code lives under `src/`; features are split into
  `actions.ts / api/ / components/ / hooks/ / lib/ / server/`. No cross-feature
  imports, no barrel files — boundaries are enforced by Biome
  (`noRestrictedImports`); shared infra goes in `src/lib/` (e.g.
  `lib/storage/`).
- Reads: RSC first, else GET route under `app/api/` + TanStack Query
  (`queryOptions` factories in `features/*/api/queries.ts`). Never a server
  action for a read.
- Mutations: server actions returning `ActionResult`
  (`src/lib/action-result.ts`), input validated with zod, permissions
  re-checked server-side (`withWriteAccess` for browser writes).
- Forms: always the TanStack Form kit (`src/forms/`, `useAppForm`).
- Prisma only inside `src/lib/dal/`; route-handler errors via `apiError`.
- Verify with `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; the
  user tests the UI manually — don't run E2E.
