# 03: Every route reports its real 403 and 404 under netlify dev

**What to build:** Under `netlify dev`, a route that refuses a request with 403 or 404 delivers that code to the client, not a "missing path parameters" 400 or 401. First confirm the mechanism and record it in the Resolution: `netlify dev` retries the path as `<path>.html` with empty route params. Also record which statuses trigger the retry and whether a deployed site does the same. Then fix it in two ways:
- stop the retry for API responses, but only if Netlify documents a way to (a `netlify.toml` setting or a response header);
- in all cases, read route parameters in **one shared place**, the Netlify v2 → Lambda wrapper, by matching the request URL against the function's own `config.path` with `path-to-regexp` (ADR-0005). The path is declared once and passed to the wrapper, and `context.params` is kept as a cross-check. A `.html` retry of an `/api/` path must never look like a request with empty parameters.

Covers every `:param` route: pack by id, archive, unarchive, session state, standings, list and submit chains, adjudicate, transition, assessments and survey.

See spec: `.scratch/api-hardening/spec.md`. Supersedes part of teacher-login 08.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Resolution records the confirmed retry mechanism, which statuses trigger it, and what is known about production
- [x] Wrapper unit test: a `Request` plus a `config.path` gives the right `pathParameters`, even when `context.params` is empty, and a `.html` retry of an API path doesn't give empty parameters
- [x] Every `netlify/functions/*.ts` route passes its `config.path` to the wrapper, declared once
- [x] BDD through `netlify dev`: archiving the System Pack returns 403 `PACK_IS_SYSTEM_PACK`, archiving an unknown pack returns 404, and `GET` an unknown pack returns 404
- [x] BDD through `netlify dev`: an unknown session's state returns 404, and another session's token on standings and on list-round-chains returns 403
- [x] Typecheck, vitest, BDD (one feature per process), lint (92) and boundaries (6) are no worse

## Resolution (2026-11-19)

**Mechanism (confirmed live on `npm run dev:local`, netlify-cli 27.16.2).** `node_modules/netlify-cli/dist/utils/proxy.js`: when the proxied response is **403 or 404** (`proxyRes.statusCode === 404 || proxyRes.statusCode === 403`), the dev proxy re-sends the request to the next of `<path>.html`, `<path>.htm`, `<path>/index.html`, `<path>/index.htm` ("to mimic the CDN behavior") and the client sees only the last answer. No other status triggers it (a 400/401 stops the chain). Each retry **reaches the same function** (logged in the wrapper): `context.params` was `{}` for `.../archive.html`, `.../standings.html`, `.../chains.html` and `.../index.html`, and `{ packId: "nope.html" }` / `{ sessionId: "x.html" }` when the parameter is the last segment. Before the fix: System Pack archive gave 400 `MISSING_PACK_ID`, unknown-pack archive 400, `GET` unknown pack 404 with packId `''`, standings and chains with another session's token 401 "Missing path parameters.". The retry is unconditional in the CLI (only `/.netlify/functions/...` URLs and asset extensions are skipped); **Netlify documents no `netlify.toml` setting or response header to turn it off**, so none was added. **Production:** not verified (no deployed site checked); the retry lives in the CLI's local proxy, and the wrapper fix holds either way.

**Fix.** `wrapLambdaHandler(handler, config)` now fills `pathParameters` by matching the URL against `config.path` with `path-to-regexp` (now a direct dependency, `^8.4.2`; it was only transitive via netlify-cli). It strips the four retry suffixes from `/api/` paths first, so a retry gets the original parameters and the same refusal. `context.params` is a cross-check (warns on a mismatch for a plain request) and the fallback when no path matches. Every route file declares `config` once and ends with `export default wrapLambdaHandler(lambdaHandler, config)`; the implementations no longer export `default`. After the fix: 403 `PACK_IS_SYSTEM_PACK`, 404 `PACK_NOT_FOUND` (archive and `GET`), 404 `SESSION_NOT_FOUND`, 403 `FORBIDDEN_ROLE` on standings and chains, and the old "401 or 403" BDD allowance for a participant advancing the phase is now a strict 403.

**Tests.** `tests/adapters/lambda-to-v2-wrapper.test.ts` (wrapper + a check that every route file passes its `config`); BDD `@route-params` scenarios in `teacher-account-journey.feature` and `classroom-session-journey.feature` (the unknown-session scenario signs a Capability Token with the local dev secret, read like the API key and never logged). Typecheck passes; vitest 629 passed; all five BDD features pass; lint 59 (baseline 92, the rewritten route files lost their old export-order errors); boundaries 6.

**Left open.** Under `netlify dev` a 404 still runs the handler up to five times (once per retry); harmless for refusals. Pack error bodies (`{ error: { code } }`) are ticket 04.
