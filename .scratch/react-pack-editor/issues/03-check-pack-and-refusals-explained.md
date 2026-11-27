# 03: Check pack, and publish refusals explained

**What to build:** **Check pack** asks the server to dry-run validate the pack (`POST /api/v1/packs/validate`, Account Token) without saving it. The screen then lists every error and every warning in plain language, each naming the part of the pack it concerns (the issue `path`). Errors and warnings are shown in separate lists. Warnings never block Publish, and a warning returned by a successful publish is shown on the way to the detail page.

Each Publish refusal gets a sentence, mapped by a pure UI-domain rule like `login-errors`:
- 409 `PACK_ALREADY_EXISTS`: someone released that version first; reload and try again.
- 403 `PACK_IS_SYSTEM_PACK`: built-in System Packs can't be given new versions.
- 422 `PACK_VALIDATION_FAILED`: its issues are listed.
- 400 `INVALID_REQUEST_BODY`: `details.field` and `details.reason` are shown.
- 401: the existing signed-out path, which sends the teacher to `/login` with the reason.
- `NETWORK_ERROR`: the "can't reach the API" sentence.

**Check pack** and **Publish** are disabled while either request is running. Errors are announced as alerts, and the API code shows in the `ErrorBanner` in development.

**Blocked by:** 01 (Teacher publishes a new pack from pasted words)

**Status:** done

**Spec:** `../spec.md`

- [x] Screen test: Check pack with a `{ valid: false, errors, warnings }` reply lists both, apart, each with its path; nothing is registered.
- [x] Screen test: Check pack with only warnings → Publish stays enabled and succeeds.
- [x] Screen tests: 409, 403, 422 (with issues), 400 (with `details.field`) → the right sentence each, and the teacher stays on the editor with the words kept.
- [x] Screen test: 401 on Publish → `/login` with the reason, and the Account Token is cleared.
- [x] Screen test: while a fake reply is held pending, both buttons are disabled, so a double click sends one request.
- [x] Manual check in Chrome against `dev:prototype`: Check pack on a real pack; publish the same id and version twice to see the 409 sentence.

## Comments

**2026-11-27 (built):**
- `web/src/domain/pack-library.ts` (extended, no second mapping): `packRefusalSentence` now covers `PACK_ALREADY_EXISTS`, `NETWORK_ERROR` (via the new shared `NETWORK_ERROR_SENTENCE` in `login-errors.ts`), `INVALID_REQUEST_BODY` ("The server refused <part> (<field>): <reason>.") and `PACK_VALIDATION_FAILED` ("… N errors to fix, listed below."). The 403 sentence was already there. New pure helpers: `PackIssue`/`PackIssues`, `packIssuePart(path)` ("cards[3].id" → "Keyword Card 4", "boardConfig.rows" → "Board"), `packIssueLine`, `packIssuesIn`, `packRefusalIssues` (422 `details.errors`/`warnings`), `packCheckSummary`, `publishWarningsFrom(location.state)`.
- `packs-api.ts`: `validatePack(input)` → `PackValidation { valid, errors, warnings }` (Account Token). `pack-hooks.ts`: `useCheckPack()`. It shares a private `draftPackInput(draft)` with `usePublishPack`, so Check pack validates exactly the body Publish would send (same unique id). **Ticket 04** should give `draftPackInput` its new-version branch so both hooks follow.
- `PackEditorPage`: `Check pack` (runs the local checks first), a "Pack check" section with `PackIssueList` `Errors`/`Warnings` (new `PackIssueList.tsx`), and `busy = check.isPending || publish.isPending` disabling both buttons. Any edit calls `check.reset()`. Publish passes `{ publishWarnings }` in the router state; `PackDetailPage` shows a "Published with warnings" section.
- `ErrorBanner` gains `alert`: `role="alert"` only while it has text, so an empty banner never counts as an alert. Other screens are unchanged (still `status`).
- Tests: 11 new screen tests in `pack-editor.test.tsx` (27 in all). The 401 test passed before any change, since it is the existing http-client path. Mutating `busy` to `false` fails both disabled-while-running tests.
- Not met as written: nothing. Note: a new-pack 409 can only happen in a race, because Publish re-reads the ids. The manual check made a real race with a fetch-delay shim in one tab (see the recipe `editor-409`).
- Manual check: run `proof-web-pack-editor-03`: Check pack (3 warnings, no errors, Publish enabled), "Published with warnings" on detail, and a real 409 with `PACK_ALREADY_EXISTS` (both buttons disabled while held, words kept). The API's second view lists `clash-pack` once.
