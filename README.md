# Essentia

A productivity suite of small, independent apps that share one design language.

## Layout

```text
apps/              one folder per app, each served under /<app>/
packages/
  config/          @essentia/config: shared TypeScript and ESLint configs
scripts/
  assemble.mjs     combines every app build into one deployable dist/
```

## Requirements

Node 24 or later (see `.nvmrc`) and pnpm 11 (`corepack enable`).

## Commands

```bash
pnpm install
pnpm dev          # run every app
pnpm build        # build everything, then assemble dist/
pnpm preview      # serve dist/ at http://localhost:4173
pnpm lint
pnpm typecheck
pnpm test
```

Shared dependency versions live in the `catalog` in `pnpm-workspace.yaml`; packages refer to them as `"catalog:"`.
