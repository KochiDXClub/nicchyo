# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router entry. Public routes live under `app/(public)/` (e.g., `map`, `posts`, `search`, `user`). Shared UI sits in `app/components/`. Global styles in `app/globals.css`.
- `public/`: Static assets (images, maps).
- `docs/`: Product and feature specs (map, kotodute, event).
- `prisma/`, `lib/`, `styles/`: Backend schema, shared libs, Tailwind setup.
- Build output `.next/` and dependencies `node_modules/` should stay untracked.

## Build, Test, and Development Commands
- `npm run dev`: Start Next.js dev server (auto selects free port if 3000 busy).
- `npm run build`: Production build; runs type checks.
- `npm run lint`: Next.js ESLint runner (interactive setup if `.eslintrc` absent). Prefer to add an eslint config before use.

## Coding Style & Naming Conventions
- TypeScript + React (Next.js). Keep components under `app/.../components`.
- Tailwind CSS for styling; custom palette in `tailwind.config.js`.
- Prefer functional components, hooks, and Next.js conventions (client components with `"use client"` when needed).
- File/route names: use kebab-case for routes, PascalCase for components, camelCase for variables/functions.

## Testing Guidelines
- No automated tests configured. If adding tests, align with Next.js/React best practices (e.g., Vitest/React Testing Library). Name test files `*.test.ts[x]`.
- Manual: run `npm run build` before PR to catch type/route issues.

## Commit & Pull Request Guidelines
- Commit messages: short imperative summary (e.g., `Add user popup`, `Fix map banner swipe`).
- Before committing: ensure `npm run build` passes; remove `.next/` from staging.
- PRs: describe scope, list key changes, note any UI impacts (screenshots optional but helpful), and link issues if applicable. Mention breaking changes or new env/config steps.

## Security & Configuration Tips
- Secrets/env: keep `.env*` out of git; follow `.gitignore`.
- Image/assets: store in `public/` to allow static serving; avoid committing large binaries unless necessary.
- Route conflicts: avoid duplicate routes (e.g., `app/map` vs `app/(public)/map`); keep a single source of truth under `app/(public)/map`.
