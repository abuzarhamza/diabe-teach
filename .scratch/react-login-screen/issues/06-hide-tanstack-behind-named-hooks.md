# 06: Screens use hooks named for what they do; only `*-hooks.ts` files touch TanStack Query

**What to build:** A behaviour-preserving refactor, so a first-time React developer reads screens without meeting TanStack Query. Screens call hooks named in domain language: `useSignIn()` and `useCreateAccount()` instead of `useMutation({ … })`, and `useCurrentAccount()` instead of `useQuery({ … })`. Each hook returns the same `data` / `error` / `isPending` / `mutate` that screens use today. TanStack Query is imported only by one hooks file per feature area (for accounts, a file such as `features/accounts/account-hooks.ts`, which owns the query keys and options with a short comment on each) and by the app shell (`main.tsx`, `App.tsx`). A lint rule makes that boundary hold for future screens, such as the Session Shell's 2-second polling hook. The teacher sees no change.

Decided on 2026-11-25 by the user (option A after a discussion about TanStack Query being new to them). It is a prefactor before the session-polling work in `.scratch/react-web-ui/issues/05`.

**Blocked by:** 05 (Teacher screens send signed-out teachers back to login with a reason)

**Status:** ready-for-agent

- [ ] `LoginPage` and `TeacherRoute` (and any other screen) no longer import `@tanstack/react-query`; they call the named hooks.
- [ ] The hooks live in `web/src/features/` (they use React, so not `api/`), take their fetch functions from `web/src/api/`, and keep today's options (query key with `accountId`, `enabled`, the no-retry-on-401 rule, navigation in `onSuccess` stays in the screen or is passed in, whichever reads more simply).
- [ ] ESLint rejects importing `@tanstack/react-query` in `web/src/**` except in `*-hooks.ts` files, `main.tsx` and `App.tsx`, with a message pointing to the hooks convention; test support files are allowed.
- [ ] `tests/web/web-architecture-guards.test.ts` proves the rule: a screen importing `@tanstack/react-query` is rejected, and a `*-hooks.ts` file is accepted.
- [ ] All existing web screen tests pass without changing what they assert (only imports may change).
- [ ] `web/README.md` ("Where code goes") and `web/src/features/README.md` describe the hooks convention.
- [ ] No `useEffect`; typecheck, typecheck:web, vitest, lint:web 0/0, boundaries ≤ 6, build:web all pass.
