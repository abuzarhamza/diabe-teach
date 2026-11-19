# 07: The prototype screens use the real login and the shared pack library

**What to build:** The Concept Chain prototype screens use the new routes instead of their browser-only stand-ins.

- **Teacher login:** an email and password form with "Sign in" and "Create account", replacing the demo name and email sign-in. It shows the "wrong email or password", "already registered", "password too short" and "temporarily locked" errors. The Account Token is kept in browser storage under its own key, and "Sign out" removes it.
- **Redirects:** the existing redirect guard on Game setup and the teacher screen checks for that token. An expired or rejected token sends the teacher back to Teacher login with a message. The screens show the signed-in email.
- **Game setup:**
  - sends the Account Token when starting a classroom game and on pack calls;
  - keeps its per-game "name shown to your class" as `creatorDisplayName`;
  - shows "by <handle> · v<version>" on each pack;
  - replaces "Delete" with "Archive";
  - adds a "Show archived" toggle that lists archived packs with "Unarchive";
  - adds "Edit → save as new version", which releases a new Pack Version.
- **API overlay:** the catalog drops the teacher sign-in and pack deletion gaps, adds the sign-up and sign-in operations, and updates the auth notes and deviations on the pack and create-session operations.

The prototype (`claudPoc/concept-chain/`) is untracked work from another session. Agree with the user how it gets committed before changing it.

See spec: `.scratch/teacher-login/spec.md`.

**Blocked by:** 02 (Sign-in locks for 15 minutes after five wrong passwords), 04 (Starting a classroom game needs a signed-in teacher), 06 (The pack list shows each pack's author and can include archived packs)

**Status:** ready-for-agent

- [ ] The prototype's API catalog drift and sample tests pass with the new operations
- [ ] Checked by hand in a browser against `npm run dev:local`: create an account, sign out, sign in, see the wrong-password and locked messages, get redirected when the token is missing or expired, start a classroom game, and a learner joins from another tab
- [ ] Checked by hand: archive and unarchive a pack, "Show archived", save a pack as a new version, and see the author handle and version on Game setup
- [ ] The API overlay no longer shows teacher sign-in or pack deletion as gaps
- [ ] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse
