# Spec: Teacher login (email and password) and a shared Curriculum Pack library

**Status:** ready-for-agent

## Problem Statement

A teacher who opens the Concept Chain screens today signs in on a demo page that only stores their name and email in the browser. The server has no idea who the teacher is. The only credential is the instructor Capability Token that starting a Game Session returns, and that token is tied to that one session. As a result:

- A teacher can't create a Curriculum Pack before running a game, because registering and validating a pack need an instructor Capability Token, which only exists once a Game Session has been started.
- Nobody can tell who made a pack, so Game setup can't say who wrote a pack or which version it is.
- Anyone who has the API key can start a classroom Game Session without identifying themselves.
- The prototype offers "Delete" on a pack, but packs can't be deleted (ADR-0006). They can only be archived or replaced by a new Pack Version.
- A Game Session stores only the pack id. If someone releases a new Pack Version during a class, that class's Post-test and survey are marked against the new version, not the one the class played.

## Solution

Teachers get a simple **Instructor Account**: they sign up with an email and a password and sign in with the same. In this proof-of-concept phase there's no verification email, no forgot-password email and no check that the email belongs to a university. Anyone with an email can sign up.

Signing in returns an **Account Token** that lasts a teaching day. A teacher needs it for two things only: starting a classroom Game Session, and working with Curriculum Packs (validate, register, release a new version, archive, unarchive). Once a game has started, everything inside it works exactly as today, with the per-session instructor Capability Token. Learners don't get accounts: they still join with a room code and a name. Solo games, which a learner starts alone, stay anonymous.

Curriculum Packs become a **shared library**. Every signed-in teacher can see and use every pack, release a new Pack Version of any pack, and archive or unarchive any pack except a System Pack. Nothing is ever deleted. Each Pack Version records who released it, and Game setup shows it as "by rahman.s · v1.1.0" (the part of the email before the @). A Game Session now records the Pack Version it started with and keeps using it until the game ends.

## User Stories

### Signing up and signing in

1. As a teacher, I want to create an account with just my email and a password, so that I can start using the platform in seconds.
2. As a teacher, I want to be told when my password is too short (under 10 characters), so that I can pick an acceptable one straight away.
3. As a teacher, I want sign-up to refuse an email that's already registered, so that two accounts never share an address.
4. As a teacher, I want my email treated the same whatever its capitals or surrounding spaces, so that `Rahman.S@AKU.edu ` and `rahman.s@aku.edu` are the same account.
5. As a teacher, I want to be signed in right after signing up, so that I don't have to type my details twice.
6. As a teacher, I want to sign in with my email and password, so that I can come back on another day or device.
7. As a teacher, I want one clear "email or password is incorrect" message whichever one is wrong, so that the form doesn't reveal which emails have accounts.
8. As a teacher, I want to stay signed in for the whole teaching day, so that I'm not asked to sign in again mid-class.
9. As a teacher, I want to sign out, so that the next person at a shared computer can't act as me.
10. As a teacher whose token has expired, I want to be sent back to sign in with a clear message, so that I understand why an action failed.
11. As a teacher, I want an account that sees five wrong passwords in a row to be locked for 15 minutes, so that nobody can guess my password by brute force.
12. As a teacher who hits the lock, I want to be told to try again later, so that I know it isn't a wrong password.
13. As a teacher, I want a successful sign-in to clear the wrong-password count, so that occasional typos never lock me out.
14. As a teacher, I want my password never to be stored or logged in readable form, so that a database leak doesn't expose it.
15. As a teacher, I want Game setup and the teacher screen to send me to sign in when I'm not signed in, so that the flow always starts in the right place.
16. As a teacher, I want the screens to show which email I'm signed in as, so that I know whose account I'm using.

### Starting games

17. As a teacher, I want starting a classroom game to require me to be signed in, so that every classroom Game Session has a known instructor.
18. As a teacher, I want the game I start to record my account, so that it can later be traced to me.
19. As a teacher, I want the name my learners see to stay a per-game choice on Game setup, so that I can be "Ms Rahman" to one class and "Dr Rahman" to another.
20. As a teacher, I want everything inside a running game (next phase, rulings, standings, state) to keep working with the game's own instructor token, so that signing out or token expiry never breaks a class in progress.
21. As a learner, I want to start a solo game without any account, so that self-study stays frictionless.
22. As a learner, I want to keep joining a classroom game with just the room code and my name, so that joining stays as easy as today.

### Shared pack library

23. As a teacher, I want to see every non-archived Curriculum Pack, whoever made it, so that colleagues can reuse each other's work.
24. As a teacher, I want each pack to show who released its latest version and the version number, so that I can judge where it came from.
25. As a teacher, I want to validate a draft pack without having started a game, so that I can prepare content ahead of class.
26. As a teacher, I want to register a new pack without having started a game, so that it's ready when I run Game setup.
27. As a teacher, I want to release a new Pack Version of any pack, including one a colleague made, so that I can fix mistakes without waiting for the original author.
28. As a teacher, I want the earlier version to stay unchanged when a new version is released, so that results already gathered stay comparable.
29. As a teacher, I want each Pack Version to record its own author, so that it's clear who changed what.
30. As a teacher, I want registering an existing pack id with an existing version to be refused, so that a version is never overwritten.
31. As a teacher, I want to archive any pack that isn't a System Pack, so that the shared list stays tidy.
32. As a teacher, I want to see the archived packs and unarchive one, so that an accidental archive can be undone.
33. As a teacher, I want the platform to record who archived a pack and when, so that a surprise archive can be explained.
34. As a teacher, I want System Packs such as Diabe-teach to stay protected from archiving and new versions by users, so that the reference content stays intact.
35. As a teacher, I want there to be no way to delete a pack, so that no Game Session ever loses its content.

### Pack Version pinning

36. As a teacher, I want Game setup to start a game on the latest non-archived version of the pack I pick, so that I get the newest content by default.
37. As a teacher, I want a running game to keep the Pack Version it started with, so that a colleague releasing a new version mid-class doesn't change my class's Post-test or survey.
38. As a researcher, I want each Game Session to record its Pack Version, so that study results can be tied to the exact content used.
39. As a teacher, I want a game started on a pack that's archived later to keep working, so that archiving never breaks a class in progress.

### Prototype screens

40. As a teacher, I want the Teacher login page to offer "Sign in" and "Create account" with an email and a password, so that the demo name-only sign-in goes away.
41. As a teacher, I want Game setup's "Delete" on a pack replaced by "Archive", so that the screen matches what the platform allows.
42. As a teacher, I want a "Show archived" toggle with "Unarchive" on Game setup, so that I can restore a pack.
43. As a teacher, I want "Edit → save as new version" on a pack, so that changing a pack is clearly releasing a new version.
44. As a developer, I want the API overlay to stop showing teacher sign-in and pack deletion as gaps, and to show the new account routes, so that the overlay matches the backend.

### Operating the PoC

45. As an operator, I want to be able to reset a teacher's password by hand in the database during the PoC, so that a forgotten password doesn't block a tester.
46. As an operator, I want the Account Token secret configured separately from the Capability Token secret, so that rotating one never invalidates the other.
47. As a developer, I want tests to run without sending email or calling external services, so that they stay offline and fast.

## Implementation Decisions

### Domain and vocabulary

- A new term, **Instructor Account**, goes into the glossary: a teacher's persistent identity, made of an email and a password. The glossary's **Capability Token** entry stays as it is. A new term, **Account Token**, is added: a bearer token that proves which Instructor Account is calling, is not tied to a Game Session, and lasts 12 hours. The two token kinds are never interchangeable.
- The Instructor Account is a new domain aggregate. It holds: an id, a normalised email (trimmed and lower-cased, unique), a password hash, a failed sign-in count, a lock-until time, and a created-at time. It has no display name. Its domain methods decide whether a sign-in attempt is allowed (locked or not), record a failure (locking for 15 minutes on the fifth consecutive failure), and record a success (reset the count). The time comes from the existing clock port, not from `new Date()`.
- The **author handle** shown for a Pack Version is the part of the account's email before the @. It's worked out when the pack is read, and is not stored as a separate name.

### Ports and adapters

- A new **Instructor Account repository port**, with in-memory and MongoDB adapters, like the Game Session repository. It finds an account by id and by normalised email, creates one (refusing a duplicate email at the storage level with a unique index), and saves changes to the sign-in counters.
- A new **password hasher port**, backed by argon2id through a well-known npm package that ships prebuilt binaries (for example `@node-rs/argon2`), following ADR-0005's npm-first policy. Passwords must be at least 10 characters. There are no other complexity rules and no upper limit beyond a sane request-size cap.
- A new **Account Token port** that signs and verifies Account Tokens with the same standard JWT approach as ADR-0004. It has its own secret, configured through `AppRuntime` and the YAML environment files, and a claim that marks the token kind so a Capability Token can never pass as an Account Token, or the reverse.

### API contract

- New routes: **sign up** (email and password; returns the Account Token and the account's id and email; 409 when the email is taken; 400 for a missing or invalid email or a password under 10 characters) and **sign in** (email and password; returns the Account Token; 401 with one generic message for an unknown email or a wrong password; a distinct 423-style or 429 "temporarily locked" error while locked). The exact paths and error codes are chosen during implementation, following the existing `/api/v1` naming and `ApiErrorResponse` shape, and documented in the OpenAPI file first.
- A new OpenAPI security scheme for the Account Token, handled centrally in `OpenApiHttpApp`'s security handlers like `BearerAuth`. It fails closed: a present but invalid token gets 401.
- **createGameSession:** classroom mode requires a valid Account Token (401 without one). Solo mode accepts no token. The Game Session stores the creating account's id (`ownerAccountId`, null for solo) and the **Pack Version** it started with. The response is unchanged: it still returns the per-session instructor Capability Token, and every in-game route keeps using that token.
- **Pack routes** (validate, register, archive, unarchive) accept the Account Token instead of an instructor Capability Token. Registering an existing pack id with a new version is how a new Pack Version is released, and any signed-in teacher can do it. System Packs stay protected from archiving and from new versions by users.
- A Pack Version's `createdBy` changes from a session id to the account id. Archiving and unarchiving record the acting account and the time.
- **Pack listing** adds the author handle and version to each summary, and gains an option to include archived packs, so Game setup's "Show archived" works. There's still no delete route.
- **Version pinning:** the curriculum pack repository gains a lookup by pack id and version. Everything that reads the pack for a running Game Session (assessment, survey, board dealing) uses the session's pinned version. The latest-version lookup stays for Game setup and for direct pack reads.
- The known `netlify.toml` redirect issue (every method on the pack collection path goes to the list function) must be fixed or worked around, so that registering a pack at the documented path reaches the register function.

### Existing data

- Packs registered before this change keep their old `createdBy` session id. They show no author handle ("by unknown"), and anyone can still release new versions of them or archive them.
- Game Sessions stored before this change have no `ownerAccountId` and no pinned Pack Version. When the pinned version is missing, they fall back to the latest version, which is today's behaviour.

### Prototype screens

- Teacher login becomes a form with email, password, and "Sign in" / "Create account". It calls the new routes and keeps the Account Token in browser storage under its own key. "Sign out" removes it. The existing redirect guard on Game setup and the teacher screen checks for this token, and an expired token sends the teacher back to sign in.
- Game setup keeps its per-game "name shown to your class", sent as `creatorDisplayName`. Pack Delete becomes Archive. "Show archived" lists archived packs with Unarchive, and "Edit → save as new version" releases a new Pack Version.
- The API overlay catalog drops the teacher sign-in and pack deletion gaps, adds the account routes, and updates the auth notes on the pack and create-session operations.

### Decision record

- A new ADR records: our own email and password accounts for the PoC (no external identity provider, though Auth0 and Clerk were considered and both are free at this scale); Account Token versus Capability Token; the shared pack library, where any teacher can version or archive; and Pack Version pinning. It updates ADR-0006's ownership section (`createdBy` becomes an account id) and replaces the earlier prototype spec's "real authentication is out of scope".

## Testing Decisions

- Good tests check behaviour from outside: a request goes in, a response comes out, and the stored state can be read back. They don't assert internal calls, hashing details or token internals beyond "this token is accepted or rejected".
- **Seam 1: Netlify function handlers** (prior art: the register-pack, create-session, archive-pack and session-board handler tests). Cover:
  - sign-up success, duplicate email, email normalisation, short password, missing fields;
  - sign-in success, wrong password, unknown email (same response), lock after five failures, lock expiry (using the existing clock seam), success resetting the count;
  - classroom create-session with no, invalid, expired or Capability Token-instead-of-Account-Token credentials (all 401), and with a valid Account Token (stores `ownerAccountId` and the pinned version);
  - solo create-session with no token;
  - pack validate, register, archive and unarchive with an Account Token from a different teacher than the author (allowed);
  - System Pack protection;
  - a new version recording its own author;
  - the listing's author handle and the include-archived option;
  - a Post-test for a session pinned to v1 still marked against v1 after v2 is registered.
- **Seam 2: the Instructor Account repository contract suite**, run against the in-memory and MongoDB adapters (prior art: the Game Session repository contract suite). Cover: create and find by email or id; the duplicate email refused; sign-in counters round-tripping. Add a pinned Pack Version and `ownerAccountId` round-trip to the existing Game Session contract suite, and a Mongo-only case where a legacy session with neither field loads.
- **Seam 3: one Cucumber journey** (prior art: the classroom session journey feature). A teacher signs up, signs in, registers a pack, starts a classroom game on it, and a learner joins with the room code. A second scenario covers a classroom start with no Account Token being refused. Run each feature file on its own against `npm run dev:local`.
- Typecheck, the vitest suite, BDD, lint (118) and the dependency boundaries (6) must be no worse than the baselines as of `3776eda`.

## Out of Scope

- Verification emails, forgot-password and reset emails, and any email sending (no email sender port, no Resend or SMTP).
- Checking that an email belongs to a university or a medical school (`swot-node` was considered and dropped for the PoC).
- An external identity provider (Auth0, Clerk), social sign-in, multi-factor authentication, passkeys.
- Refresh tokens, server-side sign-out or token revocation, "remember me".
- Learner accounts.
- Using the Account Token on in-game routes, and checking that a teacher owns a Game Session.
- An admin role, account approval, or account deletion.
- Display names on accounts, profile editing, and changing email or password through the API.
- Listing or comparing a pack's versions, and the ADR's per-version GET route.
- Real pack deletion.

## Further Notes

- Decided in conversation on 2026-11-19, using the grilling skill. The user picked our own email and password login over Auth0 or Clerk for the PoC, sign-up with email and password only, no verification email, no university check ("open to all"), and a shared pack library with no deletion (archive or release a new version). The user accepted the remaining recommendations as a set: no forgot-password, argon2id with a 10-character minimum, a 12-hour Account Token, the 5-attempt / 15-minute lock, teacher-only accounts, login only for starting classroom games and managing packs, any teacher can version or archive, the email-prefix author handle, version pinning, Archive replacing Delete in the prototype, and tests going through the real sign-up.
- Hosted-provider pricing (checked in November 2026, not on the vendors' own pages): Auth0 free up to 25,000 monthly active users with passwordless login; Clerk free up to 50,000 retained users per app. Either would cover a later move to a hosted provider.
- Risks accepted for the PoC: anyone can sign up and then version or archive any non-system pack, and archives are recorded and reversible. A stolen Account Token works until it expires. Password resets are manual.
- To log in the environment backlog: add verification and forgot-password email, and revisit the university-email check, when the PoC ends.
