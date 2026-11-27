# 00: The API marks System Packs (`isSystemPack`)

**What to build:** A teacher's Pack Library and Pack Detail can tell which packs are built-in System Packs, so the web app hides Archive and "save as new version" on them instead of waiting for a 403. Add a required boolean `isSystemPack` to each item of `GET /api/v1/packs` and to the pack of `GET /api/v1/packs/{packId}`, true exactly when the server would refuse archiving or a new version with `PACK_IS_SYSTEM_PACK`. Contract (`docs/api/openapi.yaml`), domain/application/outbound code, handler tests, the Bruno docs and the BDD pack feature follow. Hexagonal layers per `docs/agents/api-architecture.md`.

**Blocked by:** None (can start immediately)

**Status:** done

**Decided by the user on 2026-11-27** (react-web-ui spec, open question (a)).

- [x] Handler tests: the list and detail report `isSystemPack: true` for a System Pack and `false` for a teacher's pack; the value comes from the same rule that produces 403 `PACK_IS_SYSTEM_PACK`.
- [x] `docs/api/openapi.yaml` lists the field as required on `CurriculumPackListItem` and the pack-by-id response; the contract tests pass.
- [x] Bruno docs and drift test updated.
- [x] BDD pack feature asserts the flag (run alone against `dev:local`).
- [x] typecheck, vitest, lint, lint:boundaries (no new errors) clean.

## Comments

**2026-11-27 (implementation agent):** Built.
- **One rule:** `CurriculumPack.assertTeachersMayChange()` (domain) throws `PackIsSystemPackError` when `isSystemPack` is true. Archive and register (new version) now both call it on the pack's latest version, and `CurriculumPackProjector` reports that same `pack.isSystemPack` in `toListItemDto` and `toPublicDto`. `tests/functions/system-pack-flag.test.ts` checks for each pack that list flag = detail flag = "archive refused with PACK_IS_SYSTEM_PACK" = "new version refused".
- **Contract:** `isSystemPack` is required on `CurriculumPackListItem`. For the detail, a new `CurriculumPackDetail` schema (`PublicCurriculumPack` + required `isSystemPack`) is now the `getCurriculumPackById` 200 `pack`. `PublicCurriculumPack` itself is unchanged, because `CurriculumPackInput` (the validate/register request body) is built on it, and requiring the flag there would have required clients to send it. A shared `IsSystemPack` schema holds the description.
- **For later tickets (web):** read `pack.isSystemPack` from the list item and the detail `pack`. If a client sends the field back in a register body, it is ignored: register always stores `isSystemPack: false`.
- **Bruno:** the list docs' field list was wrong (`packId`, `description`, `authorName`). It now names the real `CurriculumPackListItem` fields, and the drift test checks that list against the OpenAPI schema. Both requests' Bruno `tests` assert `isSystemPack`. `docs/api/api-docs.html` was regenerated.
- **BDD:** a new scenario in `teacher-account-journey.feature` (list and detail flags for `diabe-teach` and for a teacher's pack) passed alone against `dev:local` (16/16).

