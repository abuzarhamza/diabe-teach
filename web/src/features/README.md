# Layer 3: React Screens & Components (`web/src/features/`)

Put **React pages and presentational components** here, grouped by domain area (per [ADR-0008](../../../docs/adr/0008-simple-three-layer-ddd-react-vite-frontend.md)):
- `shared/`: reusable UI building blocks (`TopBar`, `ErrorBanner`, `PhaseTimerBadge`)
- `accounts/`: teacher sign-in/sign-up and learner room-code join (`LoginPage`)
- `packs/`: shared Curriculum Pack library (`PackLibraryPage`, `PackDetailPage`, `PackEditorPage`)
- `game-session/`: `GameSetupPage` and `SessionShellPage` + phase views (`views/`)

## Rules (Enforced by ESLint & `npm run lint:boundaries`)
- **No `useEffect`:** Use a named query hook (TanStack Query) for server data/polling, event handlers (`onClick`, `onSubmit`) for user actions, and pure functions from `web/src/domain/` for derived render state.
- **No direct `fetch()` or `localStorage`:** Call functions from `web/src/api/`.
- **TanStack Query only in `*-hooks.ts`:** Each area keeps its `useQuery` / `useMutation` calls in one hooks file (e.g. `accounts/account-hooks.ts` with `useSignIn`, `useCreateAccount`, `useCurrentAccount`). Screens call those hooks and never import `@tanstack/react-query`; ESLint refuses it outside `*-hooks.ts`, `main.tsx` and `App.tsx`.
