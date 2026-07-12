# Contributing

## Setup

```bash
pnpm install            # also generates the Prisma client (postinstall)
cp .env.example .env    # fill ENCRYPTION_KEY (openssl rand -hex 32)
pnpm dev
```

## Before opening a PR

All four must pass (CI runs the same):

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Conventions

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) first — especially the dependency
  direction between `app/`, `features/`, `forms/` and `lib/`.
- New validation rules go in the feature's Zod schema, not in components.
- New pure logic gets a colocated `*.test.ts` (Vitest).
- UI text is English, sentence case, plain verbs ("Add source", not "Submit").
- Follow the existing shadcn/ui + Tailwind idiom; no new UI libraries.
