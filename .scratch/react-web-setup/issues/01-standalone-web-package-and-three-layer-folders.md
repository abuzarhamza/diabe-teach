# 01: Standalone `web/package.json` Vite + React + TypeScript package and 3-layer folder structure (`web/src/{domain,api,features}`)

**What to build:** Create a standalone frontend package in `web/` (`web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`) so frontend dependencies stay completely separate from the backend's root `package.json`, and place the empty 3-layer Simple DDD folder structure (`web/src/{domain,api,features}`) per ADR-0008:
- **Standalone frontend package (`web/package.json`):**
  - `"name": "diabe-teach-web"`, `"private": true`, `"type": "module"`, `"engines": { "node": "24.x" }`.
  - `"scripts"`: `"dev": "vite"`, `"build": "tsc --noEmit && vite build"`, `"typecheck": "tsc --noEmit"`, `"preview": "vite preview"`.
  - `"dependencies"`: `react`, `react-dom`, `react-router`, `@tanstack/react-query`.
  - `"devDependencies"`: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`.
  - Install dependencies inside `web/` (`npm --prefix web install`).
- **Frontend config and entry shell (`web/`):**
  - `web/tsconfig.json` (`"jsx": "react-jsx"`, strict TypeScript settings checking `src`).
  - `web/vite.config.ts` (`@vitejs/plugin-react`, dev server `/api` proxy to `http://localhost:8888`, build output `dist`).
  - `web/index.html`, `web/src/main.tsx`, a minimal placeholder `web/src/App.tsx` (no feature screens yet), and `web/src/styles.css` (copied from `claudPoc/concept-chain/styles.css`).
- **Root convenience scripts (`package.json`):**
  - Add `"dev:web": "npm --prefix web run dev"`, `"build:web": "npm --prefix web run build"`, and `"typecheck:web": "npm --prefix web run typecheck"`.
- **Empty 3-layer Simple DDD folders (`web/src/`):**
  - `web/src/domain/README.md`
  - `web/src/api/README.md`
  - `web/src/features/README.md` plus `web/src/features/{shared,accounts,packs,game-session}/README.md`

See spec: `.scratch/react-web-setup/spec.md`. Decision record: `docs/adr/0008-simple-three-layer-ddd-react-vite-frontend.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `web/package.json` has its own `dependencies` and `devDependencies`, while root `package.json` keeps only backend dependencies plus `"dev:web"`, `"build:web"`, and `"typecheck:web"` scripts
- [x] `npm run typecheck:web` and `npm run build:web` succeed and produce `web/dist/index.html`
- [x] The 3-layer Simple DDD folders (`web/src/domain/`, `web/src/api/`, `web/src/features/{shared,accounts,packs,game-session}/`) are in place with no feature screens implemented yet
- [x] Root `npm run typecheck`, `npx vitest run --no-file-parallelism`, `npm run lint` (≤ 29) and `npm run lint:boundaries` (≤ 6) are no worse

## Resolution

- Created standalone `web/package.json` (`diabe-teach-web`), `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, and `web/src/styles.css` (from `claudPoc/concept-chain/shared.css`), and installed dependencies inside `web/node_modules/`.
- Placed empty 3-layer Simple DDD folders (`web/src/domain/`, `web/src/api/`, `web/src/features/{shared,accounts,packs,game-session}/`) with layer guide `README.md` files.
- Added `"dev:web"`, `"build:web"`, `"typecheck:web"`, and `"lint:web"` convenience scripts to root `package.json`.
