# 10: No API route depends on a netlify.toml redirect

**What to build:** Remove every remaining forced `[[redirects]]` for `/api/v1/sessions*` and `/api/v1/accounts*`, so every function routes by its own `config.path` + `method`, as the pack and chains routes already do. Update `docs/agents/api-architecture.md` and the matching `AGENTS.md` line.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately; run after 02–04 so new routes are covered)

**Status:** resolved

- [x] `netlify.toml` has no redirect for any `/api/v1` path
- [x] Every BDD feature passes against `dev:local`, one feature per process
- [x] A test fails if a `/api/v1` redirect is added back
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- `netlify.toml` no longer has any `[[redirects]]`: the eleven forced session and account redirects are gone, replaced by a comment explaining why. Every route already declared a matching `config.path` + `method`; no route file changed.
- Overlaps checked: `POST /api/v1/sessions/join` and `GET /api/v1/sessions/:sessionId` differ by method; `.../phase` and `.../phase/extend` are distinct paths; no two route files share a method + path. Live on `dev:local`: `POST /sessions/join` reached join-session (400 `roomCode` required), `GET /sessions/<id>` reached get-session (401 capability token), `POST /sessions/<id>` gets 405, `POST /accounts/sign-in` reached sign-in (401 `INVALID_CREDENTIALS`).
- New `tests/adapters/netlify-toml-redirects.test.ts` parses `netlify.toml` with `smol-toml` (now a direct devDependency) and fails on any `/api/v1` redirect (verified red with one re-added); it also refuses duplicate method + path across route files.
- `docs/agents/api-architecture.md` and `AGENTS.md` now say no route depends on a redirect.
- Checks: typecheck passes; lint 29; boundaries 6; vitest 879 passed (`--no-file-parallelism`, no intermittent failures); BDD on `dev:local`, one feature per process: assessment-journey 6/6, classroom-session-journey 24/24, solo-session-journey 8/8, survey-journey 5/5, teacher-account-journey 10/10 scenarios.
