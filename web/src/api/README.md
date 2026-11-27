# Layer 2: API & Token Store Boundary (`web/src/api/`)

Put **all HTTP `fetch()` calls and browser token storage (`localStorage` / `sessionStorage`)** here (per [ADR-0008](../../../docs/adr/0008-simple-three-layer-ddd-react-vite-frontend.md)):
- `http-client.ts` (single `fetch` wrapper that attaches `x-api-key` + Bearer token and parses `ApiErrorResponse`)
- `token-store.ts` (`AccountToken` vs. session `CapabilityToken`, per ADR-0007)
- `accounts-api.ts`, `packs-api.ts`, `sessions-api.ts`

## Boundary Rules (Enforced by `npm run lint:boundaries`)
- **The ONLY folder allowed to call `fetch()` or touch `localStorage` / `sessionStorage`.**
- **Never import:** `react`, `react-dom`, or `web/src/features/*`.
