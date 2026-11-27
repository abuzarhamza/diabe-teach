# Signed-in panel, TopBar and Sign out

A signed-in teacher who opens `/login` sees a panel instead of the form: "Signed in as <email>", a `Continue to Game setup →` link and `Sign out`. Every teacher-only screen (today `/setup`) has a TopBar with "Signed in as <email>" and `Sign out`. Signing out from either place removes the Account Token in this browser. The panel switches back to the form with the cursor in Email, and from the TopBar the teacher lands on `/login` with no warning. Other open tabs follow.

## Sub-features

- `panel-shown`: `/login` shows the panel, not the form, while signed in.
- `panel-continue`: `Continue to Game setup →` opens `/setup`.
- `topbar-shown`: `/setup` shows the TopBar with the teacher's email.
- `panel-sign-out`: `Sign out` on the panel shows the form, with focus in Email.
- `topbar-sign-out`: `Sign out` in the TopBar lands on `/login` with no "Sign in to continue." alert.
- `second-tab-sync`: signing out in one tab turns another tab's panel into the form, and sends another tab's `/setup` to `/login`.

## How to get to it (user POV)

- Sign in or create an account (see [teacher sign in](./teacher-sign-in.md)), then open `http://localhost:5173/login` or `/setup`.

## Driving it with Claude in Chrome

Preconditions:

- Baseline from [README](./README.md).
- An account exists: `vapi req signed-in-panel setup-sign-up POST /api/v1/accounts/sign-up --json '{"email":"panel.teacher@example.edu","password":"correct horse battery"}' --expect 201`. Sign in as that teacher in tab 1 through the `/login` form (a token made by `vapi` is not in the browser).

Steps:

- **`topbar-shown`.** After signing in, tab 1 is at `/setup`. A `banner` (header) contains "Signed in as panel.teacher@example.edu" and `button "Sign out"`, and the heading "Game setup" is shown.
- **`panel-shown`.** `navigate` tab 1 to `/login`. The form `Teacher sign in` is absent, and the page shows "Signed in as panel.teacher@example.edu", `link "Continue to Game setup →"` and `button "Sign out"`. The `Join a game` form is still below.
- **`panel-continue`.** Click `Continue to Game setup →`. The path becomes `/setup`.
- **`second-tab-sync` (prepare).** `tabs_create_mcp` (tab 2) and `navigate` to `/login`. It shows the panel.
- **`topbar-sign-out`.** In tab 1 (`/setup`), click the TopBar's `Sign out`. The path becomes `/login`, the form is shown, and there is **no** `role="alert"` paragraph. `cc-account-token-v1` is absent.
- **`second-tab-sync`.** Without touching tab 2, read it: the panel has turned into the form `Teacher sign in`.
- **`panel-sign-out`.** Sign in again in tab 1 and `navigate` to `/login`, then click the panel's `Sign out`. The form appears, `document.activeElement.id === "email"`, and the token key is absent. A tab 2 left at `/setup` is now at `/login` with the alert "Sign in to continue.".
- **Proof.** `vweb record` the path, the presence of the form or panel, the alert text (or its absence) and the token key's presence after each step. Keep screenshots of the panel, the TopBar, and `/login` after the TopBar Sign out.

## Gotchas

- The TopBar Sign out is the race that jsdom tests missed. A regression shows "Sign in to continue." after a deliberate Sign out. Read the alert straight after the click, and again after 2 s.
- Another tab at `/setup` **should** show "Sign in to continue." when signed out elsewhere. The no-alert rule applies only to the tab where the teacher clicked.
- The one-time reason is in `sessionStorage` per tab, and a reload of `/login` clears it. Don't reload before reading.
- The panel reads the token from storage and doesn't call the API, so a token from an earlier run still shows the panel. `/setup` then calls `/accounts/me`, which can answer 401 because the database is new.
