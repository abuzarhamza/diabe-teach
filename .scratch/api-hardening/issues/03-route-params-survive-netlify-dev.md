# 03: Every route reports its real 403 and 404 under netlify dev

**What to build:** Under `netlify dev`, a route that refuses a request with 403 or 404 delivers that code to the client, not a "missing path parameters" 400 or 401. First confirm the mechanism and record it in the Resolution: `netlify dev` retries the path as `<path>.html` with empty route params. Also record which statuses trigger the retry and whether a deployed site does the same. Then fix it in two ways:
- stop the retry for API responses, but only if Netlify documents a way to (a `netlify.toml` setting or a response header);
- in all cases, read route parameters in **one shared place**, the Netlify v2 → Lambda wrapper, by matching the request URL against the function's own `config.path` with `path-to-regexp` (ADR-0005). The path is declared once and passed to the wrapper, and `context.params` is kept as a cross-check. A `.html` retry of an `/api/` path must never look like a request with empty parameters.

Covers every `:param` route: pack by id, archive, unarchive, session state, standings, list and submit chains, adjudicate, transition, assessments and survey.

See spec: `.scratch/api-hardening/spec.md`. Supersedes part of teacher-login 08.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Resolution records the confirmed retry mechanism, which statuses trigger it, and what is known about production
- [ ] Wrapper unit test: a `Request` plus a `config.path` gives the right `pathParameters`, even when `context.params` is empty, and a `.html` retry of an API path doesn't give empty parameters
- [ ] Every `netlify/functions/*.ts` route passes its `config.path` to the wrapper, declared once
- [ ] BDD through `netlify dev`: archiving the System Pack returns 403 `PACK_IS_SYSTEM_PACK`, archiving an unknown pack returns 404, and `GET` an unknown pack returns 404
- [ ] BDD through `netlify dev`: an unknown session's state returns 404, and another session's token on standings and on list-round-chains returns 403
- [ ] Typecheck, vitest, BDD (one feature per process), lint (92) and boundaries (6) are no worse
