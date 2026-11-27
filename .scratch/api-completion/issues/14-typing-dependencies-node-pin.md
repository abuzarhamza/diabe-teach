# 14: Required dependencies are typed as required, unused packages are removed, and Node is pinned

**What to build:**
- `accountRepo` is required in the dependency types of every handler that uses it, and no `!` is left on it.
- Remove `@middy/http-cors`, `@middy/http-header-normalizer` and `@middy/http-security-headers` once you've confirmed nothing imports them.
- Pin Node, with the same major version as today, in `.nvmrc`, `package.json` `engines` and `netlify.toml` `NODE_VERSION`.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] No `accountRepo!` remains; typecheck passes
- [x] The three packages are gone from `package.json` and the lockfile, and nothing imports them
- [x] `.nvmrc`, `engines` and `NODE_VERSION` agree
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- `ProductionDependencies.accountRepo` and `ListCurriculumPacksDependencies.accountRepo` are now required; `AppRuntime.buildProductionDependencies` always supplies a `MongoInstructorAccountRepository`. The three account handlers drop `accountRepo!`. `list-packs` no longer has a "no account repo" fallback. `get-pack-by-id`, which never reads accounts, takes `Omit<ProductionDependencies, "accountRepo">`. Tests that build `list-packs` now pass an in-memory account repository.
- `@middy/http-cors`, `@middy/http-header-normalizer` and `@middy/http-security-headers` removed with `npm uninstall`. No source imported them; the only import was `tests/middy-middlewares.test.ts`, whose events already use lowercase header names, so the normalizer was dropped from it.
- Node pinned to major **24** (the version running locally, v24.11.0): `.nvmrc` = `24`, `package.json` `engines.node` = `24.x`, `netlify.toml` `[build.environment] NODE_VERSION = "24"`.
- Checks: typecheck passes; lint 29; boundaries 6; vitest (`--no-file-parallelism`) 907 passed; BDD all 5 features pass, one per process, against `dev:local`.
- Not changed: `.github/workflows/openwiki-update.yml` still uses Node 22 (OpenWiki job only), and `wiki/18-deploying-diabe-teach-to-netlify.md` still recommends `NODE_VERSION` 20/22.
