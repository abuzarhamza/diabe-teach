# 14: Required dependencies are typed as required, unused packages are removed, and Node is pinned

**What to build:**
- `accountRepo` is required in the dependency types of every handler that uses it, and no `!` is left on it.
- Remove `@middy/http-cors`, `@middy/http-header-normalizer` and `@middy/http-security-headers` once you've confirmed nothing imports them.
- Pin Node, with the same major version as today, in `.nvmrc`, `package.json` `engines` and `netlify.toml` `NODE_VERSION`.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No `accountRepo!` remains; typecheck passes
- [ ] The three packages are gone from `package.json` and the lockfile, and nothing imports them
- [ ] `.nvmrc`, `engines` and `NODE_VERSION` agree
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
