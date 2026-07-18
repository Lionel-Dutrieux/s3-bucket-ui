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
- Mutations: server actions built with next-safe-action
  (`src/lib/safe-action.ts`) — `authActionClient`/`adminActionClient`, or
  `actionClient` + `sourceAccessMiddleware` for browser writes. Inputs
  validated with `.inputSchema()` zod schemas, user-visible errors thrown as
  `ActionError`, each action carries metadata `{ actionName, revalidate?,
  failureKey? }`. Permissions re-checked server-side by the client/middleware.
- Auth: every server entry point re-validates — `requireSession`/
  `requireAdmin` for pages, `requireSourceAccess` for anything
  source-scoped (uniform 404). `proxy.ts` is optimistic UX, never a guard.
- Forms: always the TanStack Form kit (`src/forms/`, `useAppForm`).
- i18n: every UI string through next-intl (`useTranslations`/
  `getTranslations`), keys in `messages/en.json` **and** `messages/fr.json`;
  pure `lib/` modules expose keys, never resolved text.
- Prisma only inside `src/lib/dal/` (and `src/lib/auth/` for the better-auth
  instance); route-handler errors via `apiError`.
- Verify with `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; the
  user tests the UI manually — don't run E2E.
