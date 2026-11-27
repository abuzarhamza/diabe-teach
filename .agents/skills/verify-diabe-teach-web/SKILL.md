---
name: verify-diabe-teach-web
description: "Launch, health-check and drive the diabe-teach React web app (web/, Vite on localhost:5173 proxying to the dev:prototype API on :8888) in a real Chrome browser the way a teacher or learner does, and capture redacted screenshots, page-state and console evidence in .verification/. Use to prove a web/ change works in the running app (not just in jsdom screen tests): teacher sign in and its refusals, create account, the signed-in panel and TopBar Sign out, the signed-out redirect to /login, learners joining by room code into the Lobby, the Pack Library and Pack Detail, and the Pack Editor."
---

# Verify the diabe-teach web app

`web/` is a Vite + React 19 single-page app (ADR-0008). A user touches it in a browser at `http://localhost:5173`. Vite proxies `/api/*` to the API on `:8888` (`web/vite.config.ts`). Screens as of `36cc398` (`web/src/routes.tsx`):

| Route | Who | What |
|---|---|---|
| `/login` | teacher and learner | form `Teacher sign in` (Email, Password, `Sign in`, `Create account`), or the signed-in panel; below it, form `Join a game` (Room code, Your name, `Join`) |
| `/setup` | teacher only (guard `requireTeacher`) | TopBar (`Packs` link, "Signed in as …", `Sign out`) and the Game setup placeholder |
| `/packs`, `/packs/:packId` | teacher only (same guard) | Pack Library (New pack, Show archived, Archive/Unarchive, Start Game with Pack) and read-only Pack Detail |
| `/packs/new` | teacher only (same guard) | Pack Editor: paste, upload a .txt/.csv or copy a pack's words; chips with Remove, Clear all, word notes; name, level, objective, Publish, Cancel |
| `/sessions/:sessionId` | whoever holds a seat in this tab | Session Shell: polls the session every 2 s, shows the Lobby during `pretest` |
| anything else | | redirects to `/login` |

The API is driven by the sibling skill [`verify-diabe-teach-api`](../verify-diabe-teach-api/SKILL.md). This skill reuses its `vapi.ts` (run dir, API-side setup and reads, token redaction) and its `cleanup.sh`. Don't copy them. Read that skill for the API routes and auth model. Terms such as Game Session, Room Code and Instructor Account are in `GLOSSARY.md`.

Run every command from the repo root. Shell state does not persist between calls, so define these two functions at the start of each shell call:

```bash
vapi() { node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts "$@"; }
vweb() { node --import tsx .agents/skills/verify-diabe-teach-web/scripts/vweb.ts "$@"; }
```

## Rules

- **Never set `VITE_API_KEY`.** Vite inlines every `VITE_*` value into the JavaScript the browser loads. Web checks run against `npm run dev:prototype` (the API's x-api-key check is off), so the browser never holds the key. `launch.sh` starts Vite with `env -u VITE_API_KEY`, and `vweb doctor` fails if the served bundle carries one.
- **Use a real browser.** jsdom screen tests (`npx vitest run --project web`) flush every update inside `act()`, so they cannot see races between navigation and store writes. One such bug (Sign out showing "Sign in to continue.") was only found in Chrome. Any change that mixes navigation with token, seat or reason storage needs a drive here.
- **One instance, one agent.** `:8888` and `:5173` each hold one server. `launch.sh` refuses when either is taken. Never drive a server this run did not start: another agent's BDD run may own `:8888`.
- **Run checks one at a time.** No BDD, Bruno or vitest runs during a verification run. Don't edit `src/` or `netlify/` while the API runs: netlify dev reloads and requests then time out.
- **Never `pkill`.** Stop everything with `scripts/cleanup.sh`.
- **Never put a token in evidence.** That includes screenshots. Today no screen renders a token, but look at each screenshot before you `vweb keep` it. Don't print `localStorage`/`sessionStorage` values. Report key names and lengths only.

## Launch

```bash
.agents/skills/verify-diabe-teach-web/scripts/launch.sh [run-id]
```

1. It calls `vapi init` to create `.verification/<run-id>/` (default id: UTC timestamp) and write `.verification/CURRENT`.
2. It starts `npm run dev:prototype` in the background, records `dev-local.pid`, and waits for `DEV READY http://localhost:8888` in `<run-dir>/dev-local.stdout.log`. Allow 30 to 120 s on a cold start. That line means every function has loaded and a real route answers. An open port alone does not.
3. It starts Vite as `npm --prefix web run dev -- --strictPort` (that is `npm run dev:web` plus `--strictPort`, so Vite fails instead of moving to 5174) and records `web.pid` and `web-listener.pid`. It waits until `GET :5173/login` and `GET :5173/api/health` (through the proxy) both return 200.

**Ready** means it printed `WEB READY http://localhost:5173/login` and exited 0. Each launch starts with an empty in-memory database. The only seeded data is the `diabe-teach` System Pack: no accounts, no sessions.

On `REFUSE`, find out who owns the port. Don't drive it. On `LAUNCH FAILED` or `LAUNCH TIMED OUT`, read the printed tail and `.netlify/dev-local.log`, then run cleanup before you retry. `web/node_modules` must exist (`npm --prefix web install`).

## Doctor

Run this first, and again whenever something looks off. It only reads.

```bash
vweb doctor
```

It checks that the `:5173` listener descends from this run's `web.pid` and that this run's `dev:prototype` PID is alive with `:8888` listening. It checks that the API printed `x-api-key check off` (so it is `dev:prototype`, not `dev:local`) and that `.netlify/dev-local.log` shows in-memory MongoDB. It checks that `:5173/login` serves the React root, that `:5173/api/health` returns 200 through the proxy, and that `:5173/api/v1/packs` without a key returns 200 and lists `diabe-teach`. Last, it checks that the served `src/api/http-client.ts` has no `VITE_API_KEY` in its injected `import.meta.env`. It prints `git HEAD` and the PIDs, and writes `<run-dir>/web-doctor.json`. Drive only after `DOCTOR HEALTHY`.

(The API skill's `vapi doctor` reports UNHEALTHY here, by design: it insists on the key check being on. Don't use it in a web run.)

## Drive

**Harness: Claude in Chrome** (`mcp__claude-in-chrome__*`). Load them in one ToolSearch call: `tabs_context_mcp`, `tabs_create_mcp`, `tabs_close_mcp`, `navigate`, `find`, `read_page`, `computer`, `javascript_tool`, `read_console_messages`. Start with `tabs_context_mcp` (createIfEmpty), work only in tabs you created, and close them at the end. If the extension is not connected, stop and say so. A Playwright harness would replace these steps, but it is not installed and needs the user's approval.

How to act like the user, with stable handles:

- **Find by role and name**, never by coordinates: `find` with `"Room code textbox, Your name textbox, Join button"` returns refs like `textbox "Room code"`, `button "Join"`. Forms have accessible names: `form "Teacher sign in"` and `form "Join a game"`.
- **Type like a user**: `computer left_click` with `ref`, then `computer type`. To replace a value, `triple_click` the ref, then `type`. The forms are uncontrolled (read with `FormData` on submit), so `form_input` also works, but typing is closer to the user.
- **Navigate by route path**: `navigate` to `http://localhost:5173/login`, `/setup`, `/sessions/<id>`.
- **Read the outcome** with one `javascript_tool` expression that returns what the user sees, for example:

  ```js
  ({ path: location.pathname,
     status: document.querySelector('form[aria-label="Join a game"] [role="status"]')?.innerText,
     roster: [...document.querySelectorAll('ul[aria-labelledby="roster-heading"] li')].map(li => li.innerText.replace(/\s+/g, ' ').trim()) })
  ```

  Refusals appear in a `role="status"` region inside their form (`ErrorBanner`). In development it ends with the API `code`, for example `…ROOM_CODE_NOT_FOUND`. The one-time "why you were sent here" message is a `role="alert"` paragraph above the form.
- **Second learner or second teacher view**: open another tab with `tabs_create_mcp`. Each tab keeps its own seats (`sessionStorage`, `cc-session-seats-v1`), while the teacher's Account Token (`localStorage`, `cc-account-token-v1`) is shared by every tab.
- **Console**: `read_console_messages` with pattern `\[API\]` lists every call as `[API] METHOD /path -> status`.
- **What the browser cannot do yet**: create a Game Session (Game Setup is a placeholder). Do that with `vapi` and an Account Token, then drive the learner side in the browser.

The recipes are in the feature map, [`features/README.md`](features/README.md). Pick the feature, check its preconditions, and run its bullets in order.

## Evidence

Everything goes under `.verification/<run-id>/`. The folder is git-ignored, and cleanup never deletes it.

```bash
# What the page showed (JSON is redacted: *Token keys and JWT-shaped strings)
echo '<json from javascript_tool>' | vweb record <feature> <label>
# A screenshot: take it with computer screenshot save_to_disk=true, look at it, then
vweb keep <feature> <label> <path the tool printed>
# API-side setup or a second, read-only view of the side effect
vapi req <feature> <label> GET '/api/v1/sessions/{{sessionId}}' --auth instructorToken --expect-field state.participantCount=2
```

| File | What it shows |
|---|---|
| `web-doctor.json` | instance identity: git HEAD, PIDs, statuses, checks |
| `<feature>/NN-<label>.json` | from `vweb record`: the action taken and what the page showed. From `vapi req`: one redacted request and response. |
| `<feature>/NN-<label>.jpg` | screenshots kept with `vweb keep` |
| `<feature>/NN-<label>.txt` | console `[API]` lines or other text |
| `dev-local.stdout.log`, `dev-local.log`, `web.stdout.log` | server logs (the API log is copied at cleanup) |

What counts as proof:

- **Use the real user path.** Click and type in the real screens against the real API. Don't call hooks or stores, and don't use test-only routes. Setting storage by hand is allowed only where a feature file says so (an expired or tampered token cannot be reached any other way), and the evidence must say you did it.
- **Capture the action and the resulting state.** Record the route, the visible text or roster, and a screenshot after each step that matters. One final screenshot is not enough.
- **Check side effects from a second point of view.** Examples: another tab shows the new learner; `vapi req … GET /sessions/:id` with the instructor token shows the roster; `/setup` in a new tab is reachable after sign-in; the storage key exists or is gone (report presence, never the value).
- **Prove refusals by their sentence and their code.** The sentence is what the user reads. The code (shown in dev) tells refusals apart.
- **No mocks.** The only stand-in is the in-memory MongoDB behind the same mongoose adapter.
- Report a step you could not reach with the action you tried and the missing precondition. Don't count it as verified through another path.

## Cleanup

```bash
.agents/skills/verify-diabe-teach-web/scripts/cleanup.sh
```

First close every tab you created (`tabs_close_mcp`). The script then sends SIGTERM to the Vite PIDs that `launch.sh` recorded (never by name) and confirms `PORT 5173 FREE`. Next it runs the API skill's `cleanup.sh`: that copies `.netlify/dev-local.log` into the run dir, stops the recorded `dev:prototype` PID, runs `npm run dev:local:stop`, prints `PORT 8888 FREE`, deletes `<run-dir>/vars.json` (live tokens), and lists the evidence it kept. Run it after every run, including failed and aborted ones. The database disappears with the server, and closing the tabs drops the per-tab seats. An Account Token left in Chrome's `localStorage` for `localhost:5173` survives, though: if a teacher recipe signed in, end it with `Sign out` so the next run does not start on the signed-in panel.

## Helpers

| Script | How to call it |
|---|---|
| `scripts/launch.sh` | `.agents/skills/verify-diabe-teach-web/scripts/launch.sh [run-id]` |
| `scripts/vweb.ts` | `node --import tsx .agents/skills/verify-diabe-teach-web/scripts/vweb.ts doctor \| record <feature> <label> (stdin) \| keep <feature> <label> <file>` |
| `scripts/cleanup.sh` | `.agents/skills/verify-diabe-teach-web/scripts/cleanup.sh` |
| `vapi.ts` (API skill) | see [verify-diabe-teach-api](../verify-diabe-teach-api/SKILL.md#drive). `vapi req` still sends the API key header (harmless with the check off, and redacted in evidence). |

## Keeping the map honest

When a screen, label, route or sentence in `web/src/` changes, update the matching file in `features/` in the same change. Use `/maintain-verification-skill` to bring the map back in line with the app.
