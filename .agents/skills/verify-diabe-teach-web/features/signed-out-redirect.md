# Signed-out redirect to /login

A teacher who opens a teacher-only screen (`/setup`) without a valid sign-in is sent to `/login`, which says why once, in an alert above the form. There are three reasons. "Sign in to continue." means there was no sign-in at all. "Your sign-in has expired. Sign in again." means the stored sign-in passed its expiry time. "Your sign-in was not accepted (expired or signed out elsewhere). Sign in again." means the API refused it. A reload of `/login` shows no alert. Unknown paths go to `/login` with no alert.

## Sub-features

- `redirect-signed-out`: `/setup` with no Account Token goes to `/login` with "Sign in to continue.".
- `redirect-expired`: a stored token past `expiresAt` goes to `/login` with the expired sentence.
- `redirect-not-accepted`: a token the API answers with 401 is cleared and goes to `/login` with the not-accepted sentence.
- `reason-once`: reloading `/login` removes the alert.
- `unknown-path`: any unknown path, such as `/nope`, goes to `/login` with no alert.

## How to get to it (user POV)

- Type `http://localhost:5173/setup` (or follow a bookmark) while signed out, or after the sign-in has expired, or after it was revoked.
- Type any unknown path.

## Driving it with Claude in Chrome

Preconditions:

- Baseline from [README](./README.md), and `cc-account-token-v1` is absent.
- For `redirect-expired` and `redirect-not-accepted`, a teacher signed in through the `/login` form (`vapi req signed-out-redirect setup-sign-up POST /api/v1/accounts/sign-up --json '{"email":"guard.teacher@example.edu","password":"correct horse battery"}' --expect 201`, then sign in in the browser).

Steps:

- **`redirect-signed-out`.** `navigate` to `http://localhost:5173/setup`. The path becomes `/login`, and `role="alert"` reads "Sign in to continue.". No TopBar or Game setup content is shown.
- **`reason-once`.** `navigate` to `/login` again (a reload). No `role="alert"` is shown.
- **`unknown-path`.** `navigate` to `/nope`. The path becomes `/login` with no alert.
- **`redirect-not-accepted`.** Signed in, make the stored token one the API refuses. This is a storage stand-in, because the user path (a token revoked elsewhere) has no UI: run `javascript_tool` with `const k='cc-account-token-v1'; const a=JSON.parse(localStorage.getItem(k)); a.accountToken=a.accountToken.slice(0,-4)+'AAAA'; localStorage.setItem(k, JSON.stringify(a)); 'tampered'`. Then `navigate` to `/setup`. The console shows `GET /api/v1/accounts/me -> 401`, the path becomes `/login`, the alert reads the not-accepted sentence, and the token key is absent.
- **`redirect-expired`.** Sign in again. Stand-in: set `expiresAt` to the past with `const k='cc-account-token-v1'; const a=JSON.parse(localStorage.getItem(k)); a.expiresAt='2000-01-01T00:00:00.000Z'; localStorage.setItem(k, JSON.stringify(a)); 'expired'`. Then `navigate` to `/setup`. The path becomes `/login`, the alert reads "Your sign-in has expired. Sign in again.", and no `/accounts/me` request is sent.
- **Proof.** `vweb record` the path, the alert text and the token key's presence for each sub-feature, plus the `\[API\]` console lines for `redirect-not-accepted`. Keep a screenshot of each alert. In each record, say when a storage stand-in was used.

## Gotchas

- The Chrome tool may refuse to read or write values under the sensitive-looking key `cc-account-token-v1` (`[BLOCKED: Sensitive key]`). If it does, report the two stand-in steps as not reachable with that tool. Don't work around the block.
- The scripts above must never print the token. They return only a fixed word.
- A reason already waiting wins: if a 401 left "not accepted", the guard does not overwrite it with "Sign in to continue.".
- When `/accounts/me` fails with something other than 401 (for example, the API is down), `/setup` shows an error banner and stays. That is not a redirect, and the spec leaves it open.
