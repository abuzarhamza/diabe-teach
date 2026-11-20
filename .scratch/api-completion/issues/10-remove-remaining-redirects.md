# 10: No API route depends on a netlify.toml redirect

**What to build:** Remove every remaining forced `[[redirects]]` for `/api/v1/sessions*` and `/api/v1/accounts*`, so every function routes by its own `config.path` + `method`, as the pack and chains routes already do. Update `docs/agents/api-architecture.md` and the matching `AGENTS.md` line.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately; run after 02–04 so new routes are covered)

**Status:** ready-for-agent

- [ ] `netlify.toml` has no redirect for any `/api/v1` path
- [ ] Every BDD feature passes against `dev:local`, one feature per process
- [ ] A test fails if a `/api/v1` redirect is added back
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
