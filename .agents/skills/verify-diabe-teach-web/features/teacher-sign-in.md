# Teacher sign in

A teacher with an Instructor Account signs in on `/login` with email and password and lands on Game setup (`/setup`). Refusals are shown as one sentence in the form's status region, and the cursor goes to the field to fix: an empty field is refused before anything is sent, a wrong password or an unknown email gets the same sentence, and five wrong passwords lock sign-in for about 15 minutes.

## Sub-features

- `sign-in-ok`: correct credentials lead to `/setup`, and the teacher stays signed in.
- `sign-in-empty`: an empty email or password is refused locally.
- `sign-in-wrong`: a wrong password and an unknown email get the same sentence.
- `sign-in-locked`: the fifth wrong password locks the account, and even the right password is then refused until the time shown.

## How to get to it (user POV)

- Open `http://localhost:5173/login`, fill in form `Teacher sign in` (Email, Password) and click `Sign in`, or press Enter in a field.
- Any teacher-only URL (`/setup`) when signed out redirects here (see [signed-out redirect](./signed-out-redirect.md)).

## Driving it with Claude in Chrome

Preconditions:

- Baseline from [README](./README.md). `/login` shows the form, not the panel.
- An account exists: `vapi req teacher-sign-in setup-sign-up POST /api/v1/accounts/sign-up --json '{"email":"signin.teacher@example.edu","password":"correct horse battery"}' --expect 201`. For the lock, create a second one, `lock.teacher@example.edu`, the same way.

Steps:

- **Find the form.** `navigate` to `/login`. Then `find` with `"Email textbox, Password textbox, Sign in button"` returns `textbox "Email"`, `textbox "Password"` (with hint "At least 10 characters.") and `button "Sign in"`.
- **`sign-in-empty`.** Click `Sign in` with both fields empty. The status in `form[aria-label="Teacher sign in"]` reads "Enter your email and password." and focus is on Email (`document.activeElement.id === "email"`). Type an email only and click `Sign in`: the same sentence, and focus is on Password. The console (`\[API\]`) shows no `POST /api/v1/accounts/sign-in`.
- **`sign-in-wrong`.** Type `signin.teacher@example.edu` and `not my password`, then click `Sign in`. The status reads "Wrong email or password." followed by `INVALID_CREDENTIALS`, focus is on Password, and the path stays `/login`. Repeat with `nobody@example.edu`: the sentence is the same.
- **`sign-in-locked`.** With `lock.teacher@example.edu`, submit a wrong password five times. Attempts 1 to 4 read "Wrong email or password.". Attempt 5 reads "Too many wrong passwords: sign-in is temporarily locked until HH:MM. Try again later." followed by `ACCOUNT_TEMPORARILY_LOCKED`, where HH:MM is local 24-hour time about 15 minutes ahead. Then type the correct password: it gets the same lock sentence.
- **`sign-in-ok`.** Type `signin.teacher@example.edu` and `correct horse battery`, then click `Sign in`. The path becomes `/setup`, the TopBar reads "Signed in as signin.teacher@example.edu", and "Game setup" is shown. `localStorage` key `cc-account-token-v1` is present. The console shows `POST /api/v1/accounts/sign-in -> 200`, then `GET /api/v1/accounts/me -> 200`.
- **Second view.** Open a new tab at `/setup`. It opens without a redirect, because the Account Token is shared by tabs.
- **Proof.** For each sub-feature, `vweb record` the path, status text and focused field id, and keep a screenshot of the lock sentence and of `/setup`. End with `Sign out`.

## Gotchas

- The lock is counted per account and lasts 15 minutes in the in-memory database. Use a separate account for `sign-in-locked`, or later steps on the same account will fail.
- The fifth wrong attempt is already the locked one. Don't expect a sixth "wrong" answer.
- The lock time is the browser's local time in HH:MM (24-hour), not the prototype's locale format.
- `/login` has two `role="status"` regions. Scope to `form[aria-label="Teacher sign in"]`.
- A teacher signed in from an earlier run sees the panel instead of the form. Sign out first.
- In production builds the API code is not shown after the sentence. This map assumes the Vite dev server.
