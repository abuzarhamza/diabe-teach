# Layer 1: Pure UI Domain (`web/src/domain/`)

Put **pure UI domain rules and calculations** here (per [ADR-0008](../../../docs/adr/0008-simple-three-layer-ddd-react-vite-frontend.md)):
- Board path adjacency (`chain-path.ts`)
- Phase countdown and grace-period math (`phase-timer.ts`)
- Game Session phase-to-view mapping (`session-phase.ts`)
- Pack Editor rules: word cleaning, board size, pack and card ids, the new-pack body, the next Pack Version and its body (`pack-editor.ts`)
- Pack wording: byline, board summary, pack refusal sentences (409/403/422/400/network), validator issues named by the part of the pack they concern (`pack-library.ts`)

## Boundary Rules (Enforced by `npm run lint:boundaries`)
- **Pure TypeScript only.**
- **Never import:** `react`, `react-dom`, `react-router`, `web/src/api/*`, `web/src/features/*`, `fetch`, `localStorage`, or `sessionStorage`.
