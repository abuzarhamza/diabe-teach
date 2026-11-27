# 06: Screens use hooks named for what they do; only `*-hooks.ts` files touch TanStack Query

**What to build:** A behaviour-preserving refactor, so a first-time React developer reads screens without meeting TanStack Query. Screens call hooks named in domain language: `useSignIn()` and `useCreateAccount()` instead of `useMutation({ … })`, and `useCurrentAccount()` instead of `useQuery({ … })`. Each hook returns the same `data` / `error` / `isPending` / `mutate` that screens use today. TanStack Query is imported only by one hooks file per feature area (for accounts, a file such as `features/accounts/account-hooks.ts`, which owns the query keys and options with a short comment on each) and by the app shell (`main.tsx`, `App.tsx`). A lint rule makes that boundary hold for future screens, such as the Session Shell's 2-second polling hook. The teacher sees no change.

Decided on 2026-11-25 by the user (option A after a discussion about TanStack Query being new to them). It is a prefactor before the session-polling work in `.scratch/react-web-ui/issues/05`.

**Blocked by:** 05 (Teacher screens send signed-out teachers back to login with a reason)

**Status:** done

- [x] `LoginPage` and `TeacherRoute` (and any other screen) no longer import `@tanstack/react-query`; they call the named hooks.
- [x] The hooks live in `web/src/features/` (they use React, so not `api/`), take their fetch functions from `web/src/api/`, and keep today's options (query key with `accountId`, `enabled`, the no-retry-on-401 rule, navigation in `onSuccess` stays in the screen or is passed in, whichever reads more simply).
- [x] ESLint rejects importing `@tanstack/react-query` in `web/src/**` except in `*-hooks.ts` files, `main.tsx` and `App.tsx`, with a message pointing to the hooks convention; test support files are allowed.
- [x] `tests/web/web-architecture-guards.test.ts` proves the rule: a screen importing `@tanstack/react-query` is rejected, and a `*-hooks.ts` file is accepted.
- [x] All existing web screen tests pass without changing what they assert (only imports may change).
- [x] `web/README.md` ("Where code goes") and `web/src/features/README.md` describe the hooks convention.
- [x] No `useEffect`; typecheck, typecheck:web, vitest, lint:web 0/0, boundaries ≤ 6, build:web all pass.

## Comments

- **2026-11-25:** All criteria met. The hooks are in `web/src/features/accounts/account-hooks.ts`: `useSignIn(callbacks)`, `useCreateAccount(callbacks)` and `useCurrentAccount(account)`. `TeacherRoute` (in `shared/`) imports `useCurrentAccount` from `accounts/`, as it already did `useSignedInAccount`. Navigation and focus stay in `LoginPage` and go in as `onSuccess` / `onError`. ESLint: `src/**` bans both `useEffect` and `@tanstack/react-query`, and a later entry for `*-hooks.ts`, `main.tsx` and `App.tsx` lists `useEffect` alone. ESLint does not merge `paths` across entries, so each entry lists everything it bans. Test files live in `web/tests/`, outside `src/`, so the rule does not reach them. The guard test checks only `no-restricted-imports` on the accepted hooks file, because antfu's style rules also fire on the one-line snippet.
