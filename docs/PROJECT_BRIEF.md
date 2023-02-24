# Project Brief

## Product in one sentence
Essentia is a suite of five small, independent productivity apps (Folio notes, Acta tasks, Virtus habits, Dictum markdown writing, Aurum personal finance) that share one design language and a landing hub, built mainly for the author's personal use and shown as a portfolio piece.

## Audience and context
- Primary user: the author, in daily personal use.
- Secondary audience: people reviewing the portfolio.
- Context of use: desktop and mobile browsers. Each app works on its own; the hub at `/` is one way in.

## Outcomes
- User outcome: five reliable everyday tools in one consistent, calm interface.
- Project outcome: a polished, deployed portfolio piece.
- How success is judged: build, lint, typecheck, tests and `pnpm audit` all clean (zero known vulnerabilities); one visual language across apps; WCAG 2.2 AA; live on Vercel.

## Core user journeys
1. Open the hub, pick an app, use it immediately (Acta and Folio are local-only; Virtus and Dictum work locally without signing in).
2. Sign in once (one Supabase project, shared session across the suite) and have Virtus, Dictum and Aurum data available across devices.
3. Aurum: record income and expenses, set budgets, create recurring items that post when the app syncs, review summaries and charts.
4. Dictum: write markdown with live preview, keep version history, share a read-only link at `/dictum/shared/<id>`.

## Requirements
- Must have: all five apps and the hub working; shared `@essentia/tokens` design system across all apps; Aurum built on Supabase (Auth + RLS); Virtus habits and Dictum documents synced to Supabase; current dependency versions with zero known vulnerabilities; lint, typecheck, test and build passing; no open security findings; deployed on Vercel.
- Should have: tests and an accessibility pass per app; dark mode in every app; UX tweaks where they help users or features.
- Later / out of scope: CI; E2E tests; native apps; collaboration; bank imports; a daily `pg_cron` job for recurring items.

## Constraints
- Required stack or integrations: pnpm + turbo monorepo; Vite + React 19 + TypeScript in every app; Supabase (free tier, one project); Vercel.
- Data, privacy, and security: personal finance data and notes. RLS on every table; only the anon key in client code; no secrets in the repo.
- Accessibility: WCAG 2.2 AA.
- Deployment target: Vercel, static `dist/` on one origin, each app under `/<app>/`.

## Where it lives
- Code: `apps/` (one folder per app), `packages/` (tokens, ui, supabase, config), `scripts/assemble.mjs`.
- Live: https://essentia-beta.vercel.app/
- Architecture: `docs/ARCHITECTURE.md`; flows and screens: `docs/UX_FLOWS.md`.

## Definition of MVP
Visiting the deployed hub lets you use all five apps on one design system, with sign-in and synced data in Virtus, Dictum and Aurum, working Dictum share links, clean checks, and no known vulnerabilities.
