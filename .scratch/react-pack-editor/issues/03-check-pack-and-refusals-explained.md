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

**Status:** ready-for-agent

**Spec:** `../spec.md`

- [ ] Screen test: Check pack with a `{ valid: false, errors, warnings }` reply lists both, apart, each with its path; nothing is registered.
- [ ] Screen test: Check pack with only warnings → Publish stays enabled and succeeds.
- [ ] Screen tests: 409, 403, 422 (with issues), 400 (with `details.field`) → the right sentence each, and the teacher stays on the editor with the words kept.
- [ ] Screen test: 401 on Publish → `/login` with the reason, and the Account Token is cleared.
- [ ] Screen test: while a fake reply is held pending, both buttons are disabled, so a double click sends one request.
- [ ] Manual check in Chrome against `dev:prototype`: Check pack on a real pack; publish the same id and version twice to see the 409 sentence.
