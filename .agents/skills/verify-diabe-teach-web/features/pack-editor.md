# Pack Editor

A signed-in teacher reaches the Pack Library from the TopBar's `Packs` link, clicks `New pack` and lands on `/packs/new` (heading "New pack"). They build the word list three ways: paste words into `Paste words` and click `Add pasted words`; `Upload .txt or .csv…` (the file is read in the browser, nothing is uploaded, and CSV-style `"…"` values are unquoted); or pick a pack in `Start from an existing pack` and click `Copy its words` (adds that pack's card labels, and names the new pack "<title> (my copy)" if no name is typed yet). Blanks and repeats (ignoring case, also against words already in the list) are dropped. Each distinct word shows as a chip in the list "Words in the new pack", with a `Remove <word>` button, and a running count ("10 words"). `Clear all` empties the list. A polite live note (`role="status"`, named "Words added") says what the last add did, for example "From words.csv: added 4 words. Dropped 1 duplicate and 1 blank entry.". The list's description (`#pack-size-note`) says "Add at least N more to publish (a pack needs 9, for a 3 × 3 board)." below 9 words, else "N words: enough for a S × S board.". They fill `Pack name`, and optionally `Learner level` (with suggestions such as "Year 2 undergraduate") and `Learning objective`. `Publish` refuses fewer than 9 distinct words, an empty name, or a word over 60 characters with a sentence (a `role="alert"`) and puts focus on the field to fix, without sending anything. Otherwise it registers the pack and opens its Pack Detail, which shows `v1.0.0`. The library then lists the new pack without a reload. `Cancel` returns to `/packs` without saving.

`Check pack` runs the same local checks, then dry-runs the server's validator (`POST /api/v1/packs/validate` with the Account Token; nothing is saved). Below the buttons, a "Pack check" section says either "N errors to fix before publishing." (`role="alert"`) or "No errors: the pack can be published." (`role="status"`), then lists `Errors` and `Warnings` apart, each line "<part> (<path>): <message>", for example "Perception survey (perceptionSurvey): …". A pack built by the editor always gets 3 warnings (no assessment, no survey, no calibration examples) and no errors. Warnings never block Publish. Any edit drops the check result. After a successful Publish, Pack Detail opens with a "Published with warnings" section listing them. `Check pack` and `Publish` are both disabled while either request runs. Publish refusals are a `role="alert"` `ErrorBanner` ending with the API code in development: 409 `PACK_ALREADY_EXISTS` "Someone released that version of this pack first. Reload the page and try again.", 403 `PACK_IS_SYSTEM_PACK` "Built-in System Packs can't be archived or given new versions.", 422 `PACK_VALIDATION_FAILED` "The server refused the pack: N errors to fix, listed below." plus the lists, 400 `INVALID_REQUEST_BODY` "The server refused <part> (<field>): <reason>.", and the network sentence. The words stay. A 401 signs the teacher out to `/login` with the reason.

## Sub-features

- `editor-signed-out`: `/packs/new` with no Account Token lands on `/login` with "Sign in to continue.".
- `topbar-packs-link`: the TopBar's `Packs` link on `/setup` opens `/packs`.
- `editor-open`: `New pack` on `/packs` opens `/packs/new`.
- `editor-paste`: pasted words with a blank line and a repeat in another case give one chip per distinct word and the right count.
- `editor-upload-csv`: a real `.csv` with quoted values, a repeat in another case and a blank line gives the right chips and the "From <file>: added … Dropped …" note; the console shows no request for it.
- `editor-copy-pack`: `Copy its words` from the System Pack adds its card labels, skipping words already in the list, and fills the pack name.
- `editor-remove-clear`: `Remove <word>` drops one chip and moves focus to the next chip's button; `Clear all` empties the list and the note.
- `editor-type-multiline`: words typed one per line into `Paste words` (see the recipe below) become one chip each.
- `editor-local-refusals`: too few words, then an empty name, each give their sentence and focus, and no `POST /api/v1/packs` is sent.
- `editor-publish`: `Publish` lands on `/packs/<slug>` showing `v1.0.0` and one card per word in the "General" domain; the library lists the pack.
- `editor-unique-id`: publishing a second pack with the same name gets the id `<slug>-2`.
- `editor-cancel`: `Cancel` returns to `/packs`, and nothing new is listed.
- `editor-check-pack`: `Check pack` on a 10-word pack shows "No errors: the pack can be published." and the 3 warnings; `Publish` stays enabled; the console shows `POST /api/v1/packs/validate -> 200` and no `POST /api/v1/packs`.
- `editor-publish-warnings`: after `Publish`, Pack Detail shows "Published with warnings" with the same 3 warnings.
- `editor-409`: two tabs publish the same name at once; the slower one gets the 409 sentence with `PACK_ALREADY_EXISTS`, keeps its words, and both buttons were disabled while its request was held.

## How to get to it (user POV)

- Sign in at `http://localhost:5173/login`, open `/setup` (or any teacher screen), click `Packs` in the TopBar, then `New pack`.
- Or go straight to `http://localhost:5173/packs/new`.

## Driving it with Claude in Chrome

Preconditions:

- Baseline from [README](./README.md), and `vweb doctor` is healthy.
- A teacher account made through the API: `vapi req pack-editor setup-sign-up POST /api/v1/accounts/sign-up --json '{"email":"editor.teacher@example.edu","password":"correct horse battery"}' --expect 201`.
- The word list below, typed as one value (10 words, a blank entry, a semicolon, a tab and "insulin" again):
  `Insulin, Glucagon, Beta cell, , Alpha cell; GLUT4<TAB>Glycogen, Liver, Muscle, Ketones, HbA1c, insulin`.

Steps:

- **`editor-signed-out`.** `navigate` to `http://localhost:5173/packs/new` before signing in. The path becomes `/login`, and the `role="alert"` reads "Sign in to continue.".
- **Sign in.** In `form "Teacher sign in"`, type the setup email and password and click `Sign in`, then `navigate` to `/setup`.
- **`topbar-packs-link`.** `find` `link "Packs"` in `navigation "Teacher screens"` and click it. The path is `/packs` and the heading is "Pack Library".
- **`editor-open`.** Click `link "New pack"`. The path is `/packs/new` and the heading is "New pack". Screenshot.
- **`editor-local-refusals` (words).** Click `button "Publish"` with nothing filled in. The `role="alert"` reads "A pack needs at least 9 different words (a 3 × 3 board); this one has 0.", and `document.activeElement.id` is `pack-paste`. `read_console_messages` with pattern `\[API\] POST` shows nothing.
- **`editor-paste`.** Click `textbox "Paste words"`, `computer type` the word list (a tab character types into the textarea as text), then click `Add pasted words`. Read `ul[aria-label="Words in the new pack"] li`: exactly Insulin, Glucagon, Beta cell, Alpha cell, GLUT4, Glycogen, Liver, Muscle, Ketones, HbA1c, and `.count` reads "10 words". Record and screenshot.
- **`editor-local-refusals` (name).** Click `Publish` again. The alert reads "Give the pack a name.", and focus is on `pack-name`. Still no `POST /api/v1/packs` in the console.
- **`editor-publish`.** Type "Diabetes basics" in `Pack name`, "Year 2 undergraduate" in `Learner level`, "Explain insulin resistance" in `Learning objective`, and click `Publish`. The path becomes `/packs/diabetes-basics`, the header shows `v1.0.0`, the description reads "Year 2 undergraduate · Explain insulin resistance", Board reads "3 × 3 board · chains of 2+ cards · any of the 8 neighbouring cards", and Keyword Cards shows "General (10)". The console shows `GET /api/v1/packs?includeArchived=true -> 200` (or `GET /api/v1/packs -> 200` with the query in the URL) then `POST /api/v1/packs -> 201`. Record and screenshot. Second view: `vapi req pack-editor api-sees-pack GET /api/v1/packs/diabetes-basics --expect 200`.
- **Library lists it.** Click `link "Back to the Pack Library"`. "Diabetes basics" is listed with "by editor.teacher · v1.0.0" and "10 cards".
- **`editor-unique-id`.** Click `Archive pack Diabetes basics` first (so the taken id is an archived one), then `New pack`, type the same list without repeats, name it "Diabetes basics" again and `Publish`. The path is `/packs/diabetes-basics-2`. Second view: `vapi req pack-editor api-sees-packs GET '/api/v1/packs?includeArchived=true' --expect 200` lists `diabetes-basics` (archived) and `diabetes-basics-2`.
- **`editor-cancel`.** From `/packs`, click `New pack`, paste the list, name it "Not saved", then click `link "Cancel"`. The path is `/packs`, and "Not saved" is not listed.
- **`editor-upload-csv`.** Before driving, write the file into the run dir (the upload tool accepts files under the working directory): `printf '"Insulin","Beta cell"\nGlucagon,insulin\n\n"Liver"\n' > .verification/<run-id>/words.csv`. On a fresh `/packs/new`, `find` `file-input "Upload .txt or .csv..."` and call `file_upload` with that ref and the file's absolute path. Never click the input or its label: that opens the native file picker, which the tools can't see. Read: chips Insulin, Beta cell, Glucagon, Liver; `.count` "4 words"; `[aria-label="Words added"]` reads "From words.csv: added 4 words. Dropped 1 duplicate and 1 blank entry." with `aria-live="polite"`; `#pack-size-note` reads "Add at least 5 more to publish (a pack needs 9, for a 3 × 3 board).". Record.
- **`editor-copy-pack`.** `Start from an existing pack` shows the library (on a fresh launch, only the `diabe-teach` System Pack). Click `Copy its words`. The console shows `[API] GET /api/v1/packs/diabe-teach -> 200`, the note reads "From Diabe-teach: Undergraduate Diabetes Mellitus Clinical Reasoning: added 47 words. Dropped 2 duplicates." (its 49 cards include Insulin and Glucagon, already in the list), the count is "51 words", `#pack-size-note` reads "51 words: enough for a 7 × 7 board." (class `ok`), and `Pack name` is "Diabe-teach: Undergraduate Diabetes Mellitus Clinical Reasoning (my copy)". Record and screenshot. Second view: `vapi req pack-editor api-system-pack-cards GET /api/v1/packs/diabe-teach --expect 200` has 49 cards.
- **`editor-remove-clear`.** `find` `button "Remove Beta cell"` and click it: the count drops by one and `document.activeElement.getAttribute('aria-label')` is the next chip's "Remove …". Click `Clear all`: no chips, "0 words", "No words yet. Paste, upload or copy from a pack.", and the "Words added" note is empty.
- **`editor-type-multiline`.** See "Typing multi-line text into a textarea" below: type `Insulin`, newline, `Glucagon`, blank line, `insulin`, newline, `Liver`, then `Add pasted words`. Chips: Insulin, Glucagon, Liver; note "Added 3 words. Dropped 1 duplicate and 1 blank entry."; the paste box is empty again.
- **`editor-check-pack`.** On a fresh `/packs/new`, add the 10 words, name it "Race pack", click `Check pack`. Read `section.check-results`: its `p` reads "No errors: the pack can be published." (`role="status"`), no `.issues.err`, three `.issues.warn li` (Assessment questions, Perception survey, Adjudication Rubric), and `Publish` is not disabled. Console `\[API\] POST` shows only `/api/v1/packs/validate -> 200`. Record and screenshot.
- **`editor-publish-warnings`.** Click `Publish`. On `/packs/race-pack`, the first panel's heading is "Published with warnings" with the same 3 lines. Screenshot.
- **`editor-409`.** A new-pack Publish re-reads every pack id right before it registers, so a 409 only happens in a race. Make it a real one: (1) open `/packs/new` in two tabs and fill **both** with the 10 words and the name "Clash pack" first (UI typing takes several seconds a step, so a tab filled after the hold starts loses the race; seen in run `proof-web-pack-editor-03`). (2) In tab A, install a delay shim with `javascript_tool`: `const f = window.fetch; window.fetch = async (i, o = {}) => { if ((o.method || 'GET').toUpperCase() === 'POST' && String(i) === '/api/v1/packs') await new Promise(r => setTimeout(r, 60000)); return f(i, o); }`. It only holds tab A's real request; the server's real reply comes back. Say so in the evidence. (3) Click `Publish` in tab A and read both buttons: `Check pack` and `Publish` are `disabled`. (4) Click `Publish` in tab B: it lands on `/packs/clash-pack`. (5) About 60 s later, tab A's `.toast` is `role="alert"` and reads "Someone released that version of this pack first. Reload the page and try again." with `code` `PACK_ALREADY_EXISTS`; it is still on `/packs/new` with 10 chips and the name kept. Console in tab A: `POST /api/v1/packs -> 409`. Don't run a `javascript_tool` call that waits over about 40 s: the tool times out at 45 s. Wait in shorter calls. Second view: `vapi req pack-editor api-sees-one-clash-pack GET '/api/v1/packs?includeArchived=true' --expect 200` lists `clash-pack` once. Reload tab A to drop the shim.
- **Finish.** Click `Sign out`, close the tabs, run cleanup.

## Typing multi-line text into a textarea

`computer type` sends real newline characters as Enter key presses, and in a `<textarea>` Enter inserts a line break (the Pack Editor's textareas are not inside a `<form>`, so nothing submits). So put literal line breaks in the `text` argument, not the two characters `\n`:

```
computer left_click ref=<textbox "Paste words">
computer type text="Insulin
Glucagon

insulin
Liver"
```

Check what landed with `javascript_tool`: `JSON.stringify(document.getElementById('pack-paste').value)` returns `"Insulin\nGlucagon\n\ninsulin\nLiver"`. Proven in run `proof-web-pack-editor-02`. A tab character types as text too (see `editor-paste`).

## Gotchas

- Registered Pack Versions can't be deleted, and every launch starts with an empty in-memory database: rerun from a fresh launch, or the ids move on to `-3`, `-4`….
- The library list is cached: after `Back to the Pack Library` it can show the old list for a moment before the refetch lands. Wait for the item rather than reading at once.
- Edit → save as new version is ticket react-pack-editor 04; extend this file when it lands. Once it does, a 409 is easier to reach: two tabs releasing the same next version of one pack.
- Sign in, then wait for the TopBar or `[API] GET /api/v1/accounts/me -> 200` before you `navigate` to a teacher route. Navigating straight after clicking `Sign in` can land on `/login` with "Sign in to continue." (seen in `proof-web-pack-editor-02`).
- `Copy its words` is disabled until the pack list has loaded.
- The console log clears on navigation, so read the `[API]` lines for Publish on the detail page (the client keeps logging there) or before clicking.
