# Pack Editor

A signed-in teacher reaches the Pack Library from the TopBar's `Packs` link, clicks `New pack` and lands on `/packs/new` (heading "New pack"). They paste words into `Paste words` and click `Add pasted words`: blanks and repeats (ignoring case) are dropped, and each distinct word shows as a chip in the list "Words in the new pack", with a running count ("10 words"). They fill `Pack name`, and optionally `Learner level` (with suggestions such as "Year 2 undergraduate") and `Learning objective`. `Publish` refuses fewer than 9 distinct words or an empty name with a sentence (a `role="alert"`) and puts focus on the field to fix, without sending anything. Otherwise it registers the pack and opens its Pack Detail, which shows `v1.0.0`. The library then lists the new pack without a reload. `Cancel` returns to `/packs` without saving.

## Sub-features

- `editor-signed-out`: `/packs/new` with no Account Token lands on `/login` with "Sign in to continue.".
- `topbar-packs-link`: the TopBar's `Packs` link on `/setup` opens `/packs`.
- `editor-open`: `New pack` on `/packs` opens `/packs/new`.
- `editor-paste`: pasted words with a blank line and a repeat in another case give one chip per distinct word and the right count.
- `editor-local-refusals`: too few words, then an empty name, each give their sentence and focus, and no `POST /api/v1/packs` is sent.
- `editor-publish`: `Publish` lands on `/packs/<slug>` showing `v1.0.0` and one card per word in the "General" domain; the library lists the pack.
- `editor-unique-id`: publishing a second pack with the same name gets the id `<slug>-2`.
- `editor-cancel`: `Cancel` returns to `/packs`, and nothing new is listed.

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
- **Finish.** Click `Sign out`, close the tab, run cleanup.

## Gotchas

- Registered Pack Versions can't be deleted, and every launch starts with an empty in-memory database: rerun from a fresh launch, or the ids move on to `-3`, `-4`….
- The library list is cached: after `Back to the Pack Library` it can show the old list for a moment before the refetch lands. Wait for the item rather than reading at once.
- Upload, Copy from a pack, Remove, Clear all, Check pack and Edit → save as new version are later tickets (react-pack-editor 02–04); extend this file when they land.
- The console log clears on navigation, so read the `[API]` lines for Publish on the detail page (the client keeps logging there) or before clicking.
