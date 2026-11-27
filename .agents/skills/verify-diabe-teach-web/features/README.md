# diabe-teach web verification map

This directory is the maintained source for verifying the user-facing behavior of the diabe-teach React web app (`web/`). Read this index before driving the app, then use the matching feature file as the recipe. Launch, doctor, evidence and cleanup are in [`../SKILL.md`](../SKILL.md).

## Baseline preconditions

- `launch.sh` printed `WEB READY http://localhost:5173/login`, and `vweb doctor` printed `DOCTOR HEALTHY` for this run.
- The API is `dev:prototype` with an empty in-memory database: no accounts, no sessions, only the `diabe-teach` System Pack.
- `VITE_API_KEY` is not set anywhere.
- Claude in Chrome is connected. You work only in tabs you created in this run.
- `/login` shows the form `Teacher sign in`, not the signed-in panel. If an old run left an Account Token, choose `Sign out` on the panel first, and say so in the evidence.
- You never drive a server that this run did not start.

## Driving conventions

- Every recipe starts from the baseline unless its preconditions say otherwise. Use a new email per recipe, because accounts persist until cleanup.
- Find elements by role and accessible name (`find`, then a `ref`). Don't use coordinates or tab order.
- Type into fields (`computer left_click` with the ref, then `computer type`). Submit by clicking the named button.
- Wait for the result by polling for the element you expect, not with a fixed pause (see [`../SKILL.md`](../SKILL.md#drive)). After `Sign in`, wait for `/setup` before you `navigate` to any teacher route.
- Read results with one `javascript_tool` expression that returns the route and the visible text. Refusals are in the `role="status"` region inside their form. The one-time reason is the `role="alert"` above the form.
- Do API-only setup (a Game Session, a second account) with `vapi req` and `--save`. Then do the user's part in the browser.
- Treat every quoted label, sentence and command as literal.

## Proof and skip reporting

- Capture the user action and the resulting state: `vweb record` the route and visible text after each step that matters, and `vweb keep` a screenshot of the key states.
- Prove each mutation from a second view: another tab, a reload, or a read-only `vapi req`.
- A refusal is proved by its sentence and, in dev, its API code. The code alone or the sentence alone is not enough.
- Report storage only as present or absent, plus the length of a token. Never report a value.
- Record the feature ID and entry point in each evidence label.
- Report an unreachable step with what you tried and the unmet precondition. Don't report it as verified through another path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with Claude in Chrome` starts with `Preconditions:` and uses labeled bullets that pair each user action with the exact tool call and the observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands and observable proof.

## Features

| Feature | Last proven |
|---|---|
| [Teacher sign in](./teacher-sign-in.md): sign in, empty field, wrong password, lockout | 2026-11-27 at `a342c5c`, run `maintain-web-2026-11-27` (all bullets) |
| [Create a teacher account](./create-account.md): sign up, local refusals, email already registered | 2026-11-27 at `a342c5c`, run `maintain-web-2026-11-27` (all bullets) |
| [Signed-in panel, TopBar and Sign out](./signed-in-panel-and-sign-out.md): panel at `/login`, TopBar on teacher screens, Sign out from each, second-tab sync | 2026-11-27 at `a342c5c`, run `maintain-web-2026-11-27` (all bullets) |
| [Signed-out redirect to /login](./signed-out-redirect.md): signed out, expired, not accepted | 2026-11-27 at `a342c5c`, run `maintain-web-2026-11-27` (all bullets; storage stand-ins for expired and not accepted) |
| [Learner joins the Lobby](./learner-join-lobby.md): join refusals, join, live roster across two tabs | 2026-11-27 at `a342c5c`, run `maintain-web-2026-11-27` (all bullets) |
| [Pack Library and Pack Detail](./pack-library.md): signed-out redirect, list, archive, show archived, unarchive, detail sections, System Pack, Start Game with Pack | 2026-11-27 at `a342c5c`, run `maintain-web-2026-11-27` (all bullets) |
| [Pack Editor](./pack-editor.md): TopBar Packs link, New pack, paste words, upload a .csv, copy a pack's words, Remove / Clear all, multi-line typing, local refusals, publish, unique id against archived packs, Cancel, Check pack, publish warnings on detail, 409 refusal, Edit → save as new version (open, reload, publish, unarchived, hidden on System Packs) | 2026-11-27 on `1ccf0fe` + 01, run `proof-web-pack-editor` (01 bullets); 2026-11-27 on `98d12d7` + 02, run `proof-web-pack-editor-02` (upload, copy, remove/clear, multi-line typing); 2026-11-27 on `f2445de` + 03, run `proof-web-pack-editor-03` (Check pack, publish warnings, 409 race, buttons disabled while held); 2026-11-27 on `4b22b5e` + 04, run `proof-web-pack-editor-04` (the five `version-*` bullets); 2026-11-27 at `a342c5c`, run `maintain-web-2026-11-27` (all bullets) |
