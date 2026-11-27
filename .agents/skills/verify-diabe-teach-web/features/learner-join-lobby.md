# Learner joins the Lobby

A learner needs no account. On `/login` they type the room code from their teacher and their name, choose `Join`, and land on `/sessions/<sessionId>`. During `pretest` that page shows the Lobby: "You're in, <name>!", the room code, an `In the room` roster with "N in the room", and the session's pack, format and review mode. The roster updates on its own (it polls every 2 s), so a learner who joins in another tab appears without a reload.

## Sub-features

- `join-local-refusals`: an empty room code or an empty name is refused before anything is sent.
- `join-unknown-code`: a code no game uses is refused by the server, and the learner stays on `/login`.
- `join-lobby`: a valid code and name open the Lobby for that learner, marked "(you)".
- `lobby-live-roster`: a second learner joining in another tab appears in the first tab's roster and count without any action there.
- `join-no-seat`: opening a session URL in a tab that never joined shows "You haven't joined this game".

## How to get to it (user POV)

- Open `http://localhost:5173/login` and use the form `Join a game` (Room code, Your name, `Join`) under "Join your class game".
- There is no learner entry from `/setup` or a link yet. The teacher shares the room code out of band.
- `/sessions/<sessionId>` opened directly in a tab without a seat shows the `join-no-seat` panel.

## Driving it with Claude in Chrome

Preconditions:

- Baseline from [README](./README.md), and `vweb doctor` is healthy.
- A classroom Game Session exists in `pretest`. The browser cannot create one yet (Game Setup is a placeholder), so create it through the API:
  `vapi req learner-lobby setup-sign-up POST /api/v1/accounts/sign-up --json '{"email":"lobby.teacher@example.edu","password":"correct horse battery"}' --expect 201 --save accountToken=accountToken`, then `vapi set packId=diabe-teach`, then `vapi req learner-lobby setup-create-session POST /api/v1/sessions --auth accountToken --bru-body docs/api/bruno/04-Game-Sessions/01-create-session.bru --expect 201 --expect-field state.currentPhase=pretest --save sessionId=sessionId --save roomCode=roomCode --save instructorToken=instructorToken`. The room code is in the printed response (6 characters, for example `RWH5BD`).

Steps:

- **Open the join form (tab 1).** `tabs_context_mcp` (createIfEmpty), then `navigate` the tab to `http://localhost:5173/login`. `find` with `"Room code textbox, Your name textbox, Join button"` returns `textbox "e.g. K7Q2MX" label "Room code"`, `textbox "Shown to your class" label "Your name"` and `button "Join"` (Join may be off-screen: `scroll_to` it first).
- **`join-local-refusals`.** Leave both fields empty and click `Join`. The form's status reads "Enter the room code from your teacher." and the cursor is in Room code. Type a code, leave the name empty, and click `Join`. The status reads "Enter your name, as your class will see it.". `read_console_messages` with pattern `\[API\]` shows no `POST /api/v1/sessions/join`.
- **`join-unknown-code`.** Type `ZZZZZZ` in Room code and `Asha` in Your name, then click `Join`. Wait for the status to fill (the first join can take over 1 s). The path stays `/login`. The status inside `form[aria-label="Join a game"]` reads "No active session found with room code 'ZZZZZZ'." followed by the dev code `ROOM_CODE_NOT_FOUND`. `sessionStorage` `cc-session-seats-v1` holds no seat. Run `vweb record learner-lobby join-unknown-code`.
- **`join-lobby`.** `triple_click` Room code, type the real code, and click `Join`. Within about 2 s the path is `/sessions/<sessionId>`. The page shows the heading "You're in, Asha!" with "Waiting for your teacher to start…", the phase pill `PRE-TEST`, the room code, `1 IN THE ROOM`, the roster `Asha (you)` with "Waiting for classmates to join…" (each roster `li`'s `innerText` starts with the avatar initial: "A Asha (you)"), and Today's session `diabe-teach · v1.0.0` (read it with a space inserted: see the JWT filter in [SKILL.md](../SKILL.md#drive)), `Classroom game · 2 rounds`, `Class votes + teacher's final say`. The tab's seat exists with `role: participant` (report its token's presence only). Record it, and keep a screenshot.
- **`lobby-live-roster`.** `tabs_create_mcp` (tab 2), `navigate` to `/login`, and join with the same code as `Bilal`. Tab 2 shows "You're in, Bilal!", `2 IN THE ROOM`, `Bilal (you)`, `Asha`. Then, without touching tab 1, read tab 1 with `javascript_tool`: it shows `2 IN THE ROOM` and the roster `Asha (you)`, `Bilal`. Record and screenshot both tabs. `read_console_messages` on tab 1 with pattern `\[API\]` shows `GET /api/v1/sessions/<id> -> 200` about every 2 s. Record those lines.
- **Second view of the side effect.** Run `vapi req learner-lobby instructor-sees-roster GET '/api/v1/sessions/{{sessionId}}' --auth instructorToken --expect 200 --expect-field state.participantCount=2 --expect-field state.participants.0.displayName=Asha --expect-field state.participants.1.displayName=Bilal`.
- **`join-no-seat`.** Open a third tab (`tabs_create_mcp`) and `navigate` it to `http://localhost:5173/sessions/<sessionId>`. The heading reads "You haven't joined this game" with a link `Join with a room code` that leads to `/login`. No `GET /api/v1/sessions/…` appears in that tab's console. A tab made with `tabs_create_mcp` starts with no seats.
- **Proof.** The run dir holds the two API setup files, the refusal record, a record and a screenshot of each tab's Lobby, the tab 1 console lines, and the instructor's API read.

## Gotchas

- Session creation is an API stand-in until Game Setup exists (react-web-ui tickets 03 and 05). Once it does, create the session from `/setup` in the browser and drop the `vapi` setup.
- The API has no lobby phase: `pretest` shows the Lobby. If the session is advanced, the Lobby is replaced by a "coming soon" view for that phase.
- Seats live in `sessionStorage` per tab. Two learners need two tabs (not two windows of one tab). Duplicating a tab copies its seat.
- Polling pauses in a hidden tab (TanStack `refetchIntervalInBackground` is false) and catches up on focus. In the 2026-11-27 run, tab 1 reported `document.visibilityState` `visible` while tab 2 was in front, and its console showed polls every ~2.2 s throughout. So the update was from polling, not from refocus. If a run shows `hidden`, the roster may update only once the tab is focused. Record which of the two you saw.
- The Chrome tool refuses to return values it thinks are sensitive (`[BLOCKED: Sensitive key]` for seat `token`, `sessionId` and `localStorage` reads). Read the session id from the URL, and treat a blocked token as "present".
- Two `role="status"` regions exist on `/login` (one per form). Always scope the query to `form[aria-label="Join a game"]`.
- A display name is limited to 40 characters and a room code to 6 (`maxLength`). Typing more is silently cut off, not refused.
