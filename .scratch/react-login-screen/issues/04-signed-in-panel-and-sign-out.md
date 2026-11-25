# 04: Signed-in panel and Sign out

**What to build:** A teacher who already holds a valid Account Token and opens `/login` sees "Signed in as <email>" with **Continue to Game setup** and **Sign out** instead of the form. A stored token that is malformed or past `expiresAt` counts as signed out, so the form shows. **Sign out** removes the Account Token, shows the form and puts the cursor in Email. Signing out (or in) in one tab is reflected in other open tabs through the browser `storage` event, read with `useSyncExternalStore` (no `useEffect`).

**Blocked by:** 01 (Teacher signs in and lands on Game Setup)

**Status:** ready-for-agent

- [ ] Screen test: valid stored token → signed-in panel with the email; **Continue to Game setup** navigates to `/setup`.
- [ ] Screen test: expired or malformed stored token → form shown.
- [ ] Screen test: **Sign out** → token removed from `localStorage`, form shown, focus on Email.
- [ ] Screen test: a `storage` event removing the token (another tab signed out) switches the panel to the form.
- [ ] The Account Token is kept under its own key, separate from any Capability Token (ADR-0007).
