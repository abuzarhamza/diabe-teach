# Create a teacher account

A teacher without an account types an email and a password on `/login` and clicks `Create account`. A malformed email or a short password is refused before anything is sent. An email already registered (in any letter case, with surrounding spaces) is refused by the server. On success the teacher is signed in at once and lands on Game setup.

## Sub-features

- `sign-up-ok`: a new account is created, the teacher is signed in, and the browser opens `/setup`.
- `sign-up-bad-email`: an email not shaped like `name@school.org` is refused locally.
- `sign-up-short-password`: a password under 10 characters is refused locally.
- `sign-up-taken`: an email already registered is refused by the server, and the cursor goes to Email.

## How to get to it (user POV)

- Open `http://localhost:5173/login`, fill in Email and Password in form `Teacher sign in`, and click `Create account` (not `Sign in`).

## Driving it with Claude in Chrome

Preconditions:

- Baseline from [README](./README.md). `/login` shows the form.
- No account exists for `new.teacher@example.edu`.

Steps:

- **`sign-up-bad-email`.** Type `not-an-email` and `correct horse battery`, then click `Create account`. The status in `form[aria-label="Teacher sign in"]` reads "Enter a valid email address, like name@school.org." and focus is on Email. No `POST /api/v1/accounts/sign-up` appears in the console.
- **`sign-up-short-password`.** Type `new.teacher@example.edu` and `short`, then click `Create account`. The status reads "Password too short: use at least 10 characters." and focus is on Password. No sign-up request is sent.
- **`sign-up-ok`.** Replace the password with `correct horse battery` and click `Create account`. The path becomes `/setup`, and the TopBar reads "Signed in as new.teacher@example.edu". `cc-account-token-v1` is present. The console shows `POST /api/v1/accounts/sign-up -> 201`.
- **Second view.** Run `vapi req create-account sign-in-check POST /api/v1/accounts/sign-in --json '{"email":"new.teacher@example.edu","password":"correct horse battery"}' --expect 200 --expect-field email=new.teacher@example.edu`. The account exists server-side.
- **`sign-up-taken`.** Choose `Sign out`, then on `/login` type ` New.Teacher@Example.edu ` (other case, surrounding spaces) and `correct horse battery`, then click `Create account`. The status reads "That email is already registered. Sign in instead." followed by `EMAIL_ALREADY_REGISTERED`, focus is on Email, and the path stays `/login`.
- **Proof.** `vweb record` each status and path, and keep screenshots of `/setup` after sign-up and of the taken-email refusal. End signed out.

## Gotchas

- Both buttons submit the same form. Enter in a field means `Sign in`, not `Create account`.
- The password field keeps `autocomplete="current-password"`, so Chrome may offer a saved password. Clear the field before typing.
- The web email check copies the server's rule. If the two drift, a value may pass locally and then get a `400 INVALID_REQUEST_BODY` from the server (shown with the same field sentence). Record which one refused it from the console.
- Accounts live until cleanup. Use a fresh email for each run of `sign-up-ok`.
