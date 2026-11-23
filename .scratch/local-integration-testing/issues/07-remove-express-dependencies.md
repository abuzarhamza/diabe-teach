# Issue 07: Remove Express Dependencies

**Status:** resolved

Resolved 2026-11-20: done (`netlify-cli` devDependency, `netlify.toml` `[dev]` block and URL-based `tests/integration/support/http-client.ts` in `b368e85`; `dev:local`/`test:bdd` scripts, `BeforeAll` health check in `tests/integration/support/hooks.ts`; no Express in `package.json`).

## Task

Remove Express and related packages from devDependencies since they're no longer needed.

## Commands

```bash
npm uninstall express @types/express
```

## Files to Delete

- `tests/integration/support/test-server.ts`

## Verify

After removal, ensure:

```bash
npm run test:bdd  # Should work (with netlify dev running)
npm run typecheck # Should pass
```

## Acceptance Criteria

- [ ] `express` removed from package.json
- [ ] `@types/express` removed from package.json
- [ ] `test-server.ts` deleted
- [ ] No import errors in remaining files
- [ ] TypeScript compiles successfully

## Notes

- `supertest` remains - it works with base URLs, not just Express
- `@types/supertest` remains for type definitions
