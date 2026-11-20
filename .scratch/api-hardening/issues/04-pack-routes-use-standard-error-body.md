# 04: Pack routes use the standard error body and answer repeat archives with 409

**What to build:** Every error from the pack routes uses the standard `ApiErrorResponse` body `{ code, message, details? }`; as of `e25a7a1`, register, archive and unarchive still hand-write `{ error: { code } }` in places. Domain errors already go through `domainErrorMiddleware`, so these hand-written bodies are removed. Archiving an already archived pack, and unarchiving one that isn't archived, each return 409 with the documented code, checked through `netlify dev`. The prototype's API overlay friction note about the wrong archive error is removed.

See spec: `.scratch/api-hardening/spec.md`. Finishes teacher-login 08.

**Blocked by:** 03 (Every route reports its real 403 and 404 under netlify dev)

**Status:** ready-for-agent

- [ ] Handler tests: every pack-route error body is `{ code, message }` with no `error` wrapper
- [ ] BDD through `netlify dev`: archive, archive again (409 `PACK_ALREADY_ARCHIVED`), unarchive, unarchive again (409 `PACK_NOT_ARCHIVED`)
- [ ] The API overlay catalog's note about refused archives returning 400 `MISSING_PACK_ID` is removed, and the catalog drift and sample tests pass
- [ ] Typecheck, vitest, BDD, lint and boundaries are no worse
