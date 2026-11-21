# 01: Bruno collection foundation, environments, Health, Instructor Accounts, and Curriculum Packs (`01`–`03`)

**What to build:** Install Bruno's official language/CLI packages in `devDependencies` (per ADR-0005) and build the first half of the Git-tracked Bruno manual testing collection under `docs/api/bruno/`:
- **Collection root & environments:**
  - `bruno.json` and `collection.bru` (setting shared `x-api-key: {{apiKey}}` and `Accept: application/json` headers, plus collection overview `docs` covering `AccountToken` vs. `CapabilityToken`, the 11-phase Game Session lifecycle, and how to walk the collection top-to-bottom).
  - `environments/Local Dev.bru` (`http://localhost:8888`) and `environments/Netlify Production.bru` (`https://diabe-teach.netlify.app`), using placeholder/non-secret values and `vars:secret` declarations so zero real secrets are committed.
- **Folders `01`–`03` (10 endpoints total), each with `folder.bru` and `.bru` request files containing `docs`, `tests`, and `script:post-response` variable chaining:**
  - `01-Health/01-health-check.bru` (`GET {{baseUrl}}/api/health`)
  - `02-Instructor-Accounts/01-sign-up-instructor.bru` (`POST {{baseUrl}}/api/v1/accounts/sign-up`, auto-saves `accountToken` and `accountId`)
  - `02-Instructor-Accounts/02-sign-in-instructor.bru` (`POST {{baseUrl}}/api/v1/accounts/sign-in`, auto-saves `accountToken` and `accountId`)
  - `02-Instructor-Accounts/03-get-current-account.bru` (`GET {{baseUrl}}/api/v1/accounts/me`, uses `{{accountToken}}`)
  - `03-Curriculum-Packs/01-list-packs.bru` (`GET {{baseUrl}}/api/v1/packs`)
  - `03-Curriculum-Packs/02-get-pack-by-id.bru` (`GET {{baseUrl}}/api/v1/packs/{{packId}}`)
  - `03-Curriculum-Packs/03-validate-pack.bru` (`POST {{baseUrl}}/api/v1/packs/validate`, uses `{{accountToken}}` with a complete valid 3×3 sample Curriculum Pack body)
  - `03-Curriculum-Packs/04-register-pack.bru` (`POST {{baseUrl}}/api/v1/packs`, uses `{{accountToken}}` and registers `{{customPackId}}` `1.0.0`)
  - `03-Curriculum-Packs/05-archive-pack.bru` (`POST {{baseUrl}}/api/v1/packs/{{customPackId}}/archive`, uses `{{accountToken}}`)
  - `03-Curriculum-Packs/06-unarchive-pack.bru` (`POST {{baseUrl}}/api/v1/packs/{{customPackId}}/unarchive`, uses `{{accountToken}}`)

See spec: `.scratch/bruno-api-docs/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Official `@usebruno/*` package(s) installed in `devDependencies`
- [ ] `bruno.json`, `collection.bru`, `environments/Local Dev.bru`, and `environments/Netlify Production.bru` created with zero real secrets (`tests/no-committed-secrets.test.ts` passes)
- [ ] All 10 `.bru` request files and 3 `folder.bru` files under `01-Health`, `02-Instructor-Accounts`, and `03-Curriculum-Packs` parse cleanly with Bruno's official `.bru` parser and include non-empty `docs` blocks and `script:post-response` token chaining on sign-up/sign-in
- [ ] Typecheck, vitest (`--no-file-parallelism`), lint (≤ 29) and boundaries (≤ 6) are no worse
