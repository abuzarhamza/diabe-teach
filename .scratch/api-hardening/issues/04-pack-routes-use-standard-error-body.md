# 04: Pack routes use the standard error body and answer repeat archives with 409

**What to build:** Every error from the pack routes uses the standard `ApiErrorResponse` body `{ code, message, details? }`; as of `e25a7a1`, register, archive and unarchive still hand-write `{ error: { code } }` in places. Domain errors already go through `domainErrorMiddleware`, so these hand-written bodies are removed. Archiving an already archived pack, and unarchiving one that isn't archived, each return 409 with the documented code, checked through `netlify dev`. The prototype's API overlay friction note about the wrong archive error is removed.

See spec: `.scratch/api-hardening/spec.md`. Finishes teacher-login 08.

**Blocked by:** 03 (Every route reports its real 403 and 404 under netlify dev)

**Status:** resolved

- [x] Handler tests: every pack-route error body is `{ code, message }` with no `error` wrapper
- [x] BDD through `netlify dev`: archive, archive again (409 `PACK_ALREADY_ARCHIVED`), unarchive, unarchive again (409 `PACK_NOT_ARCHIVED`)
- [x] The API overlay catalog's note about refused archives returning 400 `MISSING_PACK_ID` is removed, and the catalog drift and sample tests pass
- [x] Typecheck, vitest, BDD, lint and boundaries are no worse

## Resolution (2026-11-19)

- `register-pack` now throws `PackAlreadyExistsError` (409) and a new `PackValidationFailedError` (422, `details: { errors, warnings }`); both go through `domainErrorMiddleware`, so every pack-route error is `{ code, message, details? }`.
- `archive-pack` and `unarchive-pack` drop the hand-written 400 `MISSING_PACK_ID`; the wrapper fills `packId` from `config.path` (ticket 03), and a missing one is now a final-safety 404 `PACK_NOT_FOUND`.
- Handler tests assert the standard body (no `error` wrapper) on every pack-route error, plus the missing-`packId` case.
- BDD (`teacher-account-journey`): register, archive, archive again (409 `PACK_ALREADY_ARCHIVED`), unarchive, unarchive again (409 `PACK_NOT_ARCHIVED`), with a standard-body check, through `netlify dev`.
- API catalog: removed the archive/unarchive `MISSING_PACK_ID` deviations and the register "`{ error: { code } }` body" deviation. The prototype's `account-api.js` still reads the legacy shape; only its comment changed.
- Checks: typecheck clean, vitest 631 passed, BDD teacher-account-journey 10/10, lint 59, boundaries 6.
