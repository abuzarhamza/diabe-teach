# Pack Library and Pack Detail

A signed-in teacher opens `/packs` and sees the shared library's Curriculum Packs, each with its title (a link to Pack Detail), a byline ("by <handle> · v<version>", "by unknown" for System Packs), its card count and subject. Every active pack has `Start Game with Pack`, which opens `/setup?packId=<id>`. Packs a teacher released have `Archive`; System Packs (tag "System Pack") have no Archive or Unarchive control. Ticking `Show archived` also lists archived packs (tag "Archived", dashed, no Start), each with `Unarchive`. Archive and Unarchive refresh the list on their own. `/packs/<packId>` shows the pack read-only: Board, Semantic Domains, Keyword Cards, Adjudication Rubric, Assessment questions and Survey items (the last two say "This pack has no …" when the pack has none).

## Sub-features

- `library-signed-out`: `/packs` with no Account Token lands on `/login` with "Sign in to continue.".
- `library-list`: the list shows the `diabe-teach` System Pack (no Archive) and a teacher's pack (with Archive).
- `library-archive`: `Archive` removes the pack from the list without a reload.
- `library-show-archived`: `Show archived` lists the archived pack with "Archived" and `Unarchive`, and no `Start Game with Pack`.
- `library-unarchive`: `Unarchive` puts the pack back as active, with `Start Game with Pack` and `Archive`.
- `detail-sections`: a pack's title link opens `/packs/<id>` with its six sections; missing questions or survey are said in words.
- `detail-system-pack`: `/packs/diabe-teach` shows "System Pack", no archive control, and its questions and survey items.
- `start-game`: `Start Game with Pack` opens `/setup?packId=<id>` (Game Setup is still a placeholder).

## How to get to it (user POV)

- Sign in at `http://localhost:5173/login`, then go to `http://localhost:5173/packs`. There is no link to `/packs` from `/setup` or the TopBar yet, so type the URL.
- Pack Detail opens from a pack's title link on `/packs`, or directly at `/packs/<packId>`.

## Driving it with Claude in Chrome

Preconditions:

- Baseline from [README](./README.md), and `vweb doctor` is healthy.
- A teacher account and one non-system pack, set up through the API (the browser can't register a pack until the Pack Editor exists):
  `vapi req pack-library setup-sign-up POST /api/v1/accounts/sign-up --json '{"email":"packs.teacher@example.edu","password":"correct horse battery"}' --expect 201 --save accountToken=accountToken`, then `vapi set customPackId=endocrine-intro`, then `vapi req pack-library setup-register-pack POST /api/v1/packs --auth accountToken --bru-body docs/api/bruno/03-Curriculum-Packs/04-register-pack.bru`. That pack ("Endocrine Pathophysiology Intro", 9 cards, 3 × 3) has no assessment questions and no survey.

Steps:

- **`library-signed-out`.** `navigate` to `http://localhost:5173/packs` before signing in. The path becomes `/login` and the `role="alert"` reads "Sign in to continue.".
- **Sign in.** In `form "Teacher sign in"`, type the setup email and password and click `Sign in`, then `navigate` to `/packs`.
- **`library-list`.** Read `ul[aria-label="Curriculum Packs"] > li` with `javascript_tool`. You see two items: "Diabe-teach: …" with `System Pack`, "by unknown · v1.0.0", `Start Game with Pack` and no Archive; and "Endocrine Pathophysiology Intro" with "by packs.teacher · v1.0.0", "9 cards · Endocrinology and Glucose Homeostasis", `Start Game with Pack` and `Archive`. Record it and keep a screenshot.
- **`library-archive`.** `find` `button "Archive pack Endocrine Pathophysiology Intro"` and click it. Within about 2 s only Diabe-teach is listed, and the page's `role="status"` is empty.
- **`library-show-archived`.** Click `checkbox "Show archived"`. The Endocrine pack comes back with "Archived" and `button "Unarchive pack Endocrine Pathophysiology Intro"`, and without `Start Game with Pack`. Record and screenshot. Second view: `vapi req pack-library api-sees-archived GET '/api/v1/packs?includeArchived=true' --expect 200` shows `endocrine-intro` with `isArchived: true`.
- **`library-unarchive`.** Click `Unarchive pack Endocrine Pathophysiology Intro`. The pack loses "Archived" and shows `Start Game with Pack` and `Archive` again.
- **`detail-sections`.** Click `link "Endocrine Pathophysiology Intro"`. The path is `/packs/endocrine-intro`. Read each `section h3` and its text: Board "3 × 3 board · chains of 3+ cards · any of the 8 neighbouring cards", Semantic Domains (Hormones & Signaling, Glucose Metabolism), Keyword Cards grouped by domain ("Hormones & Signaling (4)" …), Adjudication Rubric (Evaluator, Subject, criteria), Assessment questions "This pack has no assessment questions.", Survey items "This pack has no perception survey.". Record and screenshot.
- **`detail-system-pack`.** `navigate` to `/packs/diabe-teach`. The header shows "v1.0.0" and "System Pack", there is no Archive/Unarchive button, and the question and survey lists are filled.
- **`start-game`.** Click `link "Start Game with Pack Diabe-teach: …"`. The path is `/setup` with search `?packId=diabe-teach`, heading "Game setup". `read_console_messages` with pattern `\[API\]` shows `GET /api/v1/packs/diabe-teach -> 200`.
- **Finish.** Click `Sign out`, close the tab, run cleanup.

## Gotchas

- The 403 `PACK_IS_SYSTEM_PACK` banner ("Built-in System Packs can't be archived or given new versions.") is only a fallback for a stale list; the browser can't reach it, because System Packs get no Archive button. The screen test covers it.
- The console log clears on navigation, so read `[API]` lines on the page where they happened.
- After `Archive` with `Show archived` off the pack simply disappears: there is no success message. Tick `Show archived` to see it again.
- Pack Detail fetches without a token, so the assessment answer keys stay redacted; that is intended.
