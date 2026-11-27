# 04: Signed-in panel and Sign out

**What to build:** A teacher who already holds a valid Account Token and opens `/login` sees "Signed in as <email>" with **Continue to Game setup** and **Sign out** instead of the form. A stored token that is malformed or past `expiresAt` counts as signed out, so the form shows. **Sign out** removes the Account Token, shows the form and puts the cursor in Email. Signing out (or in) in one tab is reflected in other open tabs through the browser `storage` event, read with `useSyncExternalStore` (no `useEffect`).

**Blocked by:** 01 (Teacher signs in and lands on Game Setup)

**Status:** done

- [x] Screen test: valid stored token → signed-in panel with the email; **Continue to Game setup** navigates to `/setup`.
- [x] Screen test: expired or malformed stored token → form shown.
- [x] Screen test: **Sign out** → token removed from `localStorage`, form shown, focus on Email.
- [x] Screen test: a `storage` event removing the token (another tab signed out) switches the panel to the form.
- [x] The Account Token is kept under its own key, separate from any Capability Token (ADR-0007).

## Comments

- All criteria met. Screen tests: `web/tests/features/accounts/signed-in-panel.test.tsx` (11 tests, including another tab signing *in* and a `storage` event for a different key being ignored). Malformed covers non-JSON, `null`, a missing field and an unreadable `expiresAt`.
- The store (`web/src/api/account-token-store.ts`) exposes `subscribeToStoredAccount` / `readStoredAccountSnapshot` (the raw string, so the snapshot is stable) and `accountFromSnapshot` (parse + expiry, run during render); `useSignedInAccount` in `features/accounts/` reads it with `useSyncExternalStore`, ready for ticket 05's guard. The `storage` event only reaches other tabs, so `saveAccount` / `clearAccount` also notify in-tab subscribers.
- Focus after **Sign out** goes through the Email input's ref callback (the field does not exist until the form renders); `flushSync` was rejected by `react/dom-no-flush-sync`.
- The panel does not switch by itself when the token expires while `/login` is open; it re-reads on the next render or storage change. Ticket 05's guard covers expiry on teacher screens.
- Manual check (`dev:prototype`, no `VITE_API_KEY`): signed in, reloaded `/login` -> "Signed in as <email>"; Sign out -> form, token removed, focus on Email; a second open `/login` tab switched to the form.
