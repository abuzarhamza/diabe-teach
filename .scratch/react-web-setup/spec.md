# Spec: Basic React + Vite setup with Simple 3-Layer DDD folder skeleton (`web/src/{domain,api,features}`), boundary enforcement, and zero-`useEffect` lint guard

**Status:** ready-for-agent

## Problem Statement

We want to pair-program the React frontend for the Concept-Chain Educational Game Engine step by step following **ADR-0008** (Simple 3-Layer Pragmatic DDD under `web/src/{domain,api,features}` with zero `useEffect`), so we need only the bare-minimum Vite + React + TypeScript project scaffold, the empty 3-layer folder structure in place, and the ESLint/dependency-cruiser rules wired up—with **no feature screens or domain/API features implemented yet**.

## Solution

Place the clean **Vite + React + TypeScript folder structure** under `web/` and configure the lint/boundary guardrails so we can build features together:

1. **Standalone `web/package.json` Vite + React + TypeScript scaffold (`web/`):**
   - Create a dedicated `web/package.json` (`"name": "diabe-teach-web"`) containing the frontend `dependencies` (`react`, `react-dom`, `react-router`, `@tanstack/react-query`) and `devDependencies` (`vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`), keeping the root `package.json` backend dependencies completely separate.
   - Create `web/tsconfig.json` (`"jsx": "react-jsx"`), `web/vite.config.ts` (`/api` proxy to `http://localhost:8888`, build output `web/dist`), `web/index.html`, `web/src/main.tsx`, a minimal placeholder `web/src/App.tsx`, and `web/src/styles.css` (copied from `claudPoc/concept-chain/styles.css`).
   - Add convenience scripts to the root `package.json`: `"dev:web": "npm --prefix web run dev"`, `"build:web": "npm --prefix web run build"`, and `"typecheck:web": "npm --prefix web run typecheck"`.
2. **Place the 3-Layer Simple DDD folders (`web/src/{domain,api,features}`):**
   - `web/src/domain/` (with a short `README.md` or `.gitkeep` explaining Layer 1: pure UI domain rules, zero React, zero `fetch`/storage)
   - `web/src/api/` (with a short `README.md` or `.gitkeep` explaining Layer 2: `fetch` and token storage only, zero React)
   - `web/src/features/` with empty subfolders ready for us to work in together:
     - `web/src/features/shared/`
     - `web/src/features/accounts/`
     - `web/src/features/packs/`
     - `web/src/features/game-session/`
3. **Pit-of-Success Guardrails (Standalone Antfu ESLint in `web/` + Dependency Cruiser):**
   - **Standalone `web/eslint.config.js` using `@antfu/eslint-config({ react: true })`:**
     - `web/package.json` includes its own `"lint": "eslint src"` and `"lint:fix": "eslint src --fix"` scripts (with `"lint:web": "npm --prefix web run lint"` in root `package.json`), completely separate from the backend's root `eslint.config.mjs`.
     - **Ban `useEffect` in `web/src/**`** inside `web/eslint.config.js`.
   - **Enforce the 3-layer boundaries in `.dependency-cruiser.cjs`** (`web-domain-stays-pure` and `web-api-no-react-or-features`).

## User Stories

1. As a first-time React developer pairing with the agent, I want `web/src/{domain,api,features}` already placed with clear folder boundaries and a minimal `App.tsx` that boots in Vite, so that we can build our first component and domain helper together without setup clutter.
2. As a developer, I want `npm run dev:web`, `npm run build:web`, and `npm run typecheck` to work out of the box on the empty scaffold.
3. As a developer, I want ESLint to forbid `useEffect` in `web/src/**` and `npm run lint:boundaries` to enforce the `domain` → `api` → `features` rules from day one.

## Implementation Decisions

- **No features implemented yet:** Do not implement Login, Packs, Game Session views, API client wrappers, or domain logic yet—only the minimal `main.tsx` + placeholder `App.tsx` and the folder structure with short `README.md` guides in `web/src/domain/`, `web/src/api/`, and `web/src/features/`.
- **Architecture decision record:** Follows **ADR-0008** (`docs/adr/0008-simple-three-layer-ddd-react-vite-frontend.md`).

## Testing Decisions

- Verify `npm run typecheck` passes with 0 errors.
- Verify `npm run build:web` succeeds and produces `dist/web/index.html`.
- Verify `npm run lint` (≤ 29) and `npm run lint:boundaries` (≤ 6) pass with the new `web/src` rules active.

## Out of Scope

- Implementing any domain logic, API client modules, or feature screens (we will build those together next).
