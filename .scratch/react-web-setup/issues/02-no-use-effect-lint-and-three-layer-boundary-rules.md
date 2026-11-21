# 02: Standalone Antfu React ESLint (`web/eslint.config.js`) with `no-useEffect` rule and 3-layer DDD boundary rules (`npm run lint:boundaries`)

**What to build:** Configure a standalone `@antfu/eslint-config` setup inside `web/` (`web/eslint.config.js`) and 3-layer dependency-cruiser boundary rules enforcing ADR-0008 across `web/src/`:
1. **Standalone Antfu ESLint in `web/` (`web/eslint.config.js`):**
   - Add `eslint` and `@antfu/eslint-config` to `web/package.json` (`devDependencies`), with `"lint": "eslint src"` and `"lint:fix": "eslint src --fix"` scripts in `web/package.json` and `"lint:web": "npm --prefix web run lint"` in root `package.json`.
   - Configure `web/eslint.config.js` with `antfu({ react: true, stylistics: { quotes: "double", semi: true } })` (matching the repo's double-quote + semicolon convention) and a rule that forbids importing `useEffect` from `"react"` or calling `.useEffect` in `web/src/**/*.{ts,tsx}` (pointing to TanStack Query `useQuery`, event handlers, and `web/src/domain/` per ADR-0008).
   - Ensure `npm run lint:web` passes with **0 errors and 0 warnings** (keeping `web/` 100% clean and separate from the backend's 29-error lint baseline!).
2. **Enforce 3-Layer Simple DDD boundaries in `.dependency-cruiser.cjs` (`npm run lint:boundaries`):**
   - Update `"lint:boundaries"` in root `package.json` to cruise `src netlify web/src`.
   - Add two boundary rules in `.dependency-cruiser.cjs`:
     - `web-domain-stays-pure`: `^web/src/domain/` cannot depend on `^web/src/(api|features)/` or `react` / `react-dom` / `react-router` / `@tanstack/react-query`.
     - `web-api-no-react-or-features`: `^web/src/api/` cannot depend on `^web/src/features/` or `react` / `react-dom`.
3. **Vitest guardrail verification test (`tests/web/web-architecture-guards.test.ts`):**
   - Proves that `web/eslint.config.js` rejects `useEffect` inside `web/src/` and passes with 0 errors on `web/src/App.tsx`.
   - Proves that `dependency-cruiser` rejects a `web/src/domain/` → `react` or `web/src/api/` import and a `web/src/api/` → `web/src/features/` import.

See spec: `.scratch/react-web-setup/spec.md`. Decision record: `docs/adr/0008-simple-three-layer-ddd-react-vite-frontend.md`.

**Blocked by:** 01 (Standalone `web/package.json` Vite + React + TypeScript package and 3-layer folder structure)

**Status:** done

- [x] `web/eslint.config.js` uses `@antfu/eslint-config({ react: true })`, bans `useEffect` in `web/src/**/*.{ts,tsx}`, and `npm run lint:web` passes with 0 errors
- [x] `npm run lint:boundaries` cruises `web/src` alongside `src` and `netlify` and enforces `web-domain-stays-pure` and `web-api-no-react-or-features` (baseline stays ≤ 6)
- [x] `tests/web/web-architecture-guards.test.ts` passes, verifying both the standalone `web/eslint.config.js` `no-useEffect` rule and the 3-layer dependency-cruiser boundary rules
- [x] `npm run typecheck`, `npm run typecheck:web`, `npm run lint:web` (0 errors), `npm run build:web`, `npx vitest run --no-file-parallelism`, `npm run lint` (≤ 29), and `npm run lint:boundaries` (≤ 6) all pass

## Resolution

- Created standalone `web/eslint.config.js` with `antfu({ react: true, stylistic: { quotes: "double", semi: true } })` and `no-restricted-imports` + `no-restricted-properties` rules banning `useEffect` and `React.useEffect` across `web/src/**/*.{ts,tsx}`. Verified `npm run lint:web` passes with 0 errors.
- Added `web-domain-stays-pure` and `web-api-no-react-or-features` rules to `.dependency-cruiser.cjs` and updated `"lint:boundaries"` to cruise `src netlify web/src`.
- Added `tests/web/web-architecture-guards.test.ts` (4 tests) verifying both the `no-useEffect` lint ban and the 3-layer boundary rules.
