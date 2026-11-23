# Issue 03: Add NPM Scripts for Local Development

**Status:** resolved

Resolved 2026-11-20: done (`netlify-cli` devDependency, `netlify.toml` `[dev]` block and URL-based `tests/integration/support/http-client.ts` in `b368e85`; `dev:local`/`test:bdd` scripts, `BeforeAll` health check in `tests/integration/support/hooks.ts`; no Express in `package.json`).

## Task

Add convenience NPM scripts for local Netlify development and testing.

## Changes to `package.json`

Add to `scripts`:

```json
{
  "scripts": {
    "dev": "netlify dev",
    "dev:debug": "DEBUG=* netlify dev",
    "test:bdd:netlify": "BDD_USE_NETLIFY_DEV=true npm run test:bdd"
  }
}
```

## Script Descriptions

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start local Netlify dev server |
| `npm run dev:debug` | Start with verbose debug logging |
| `npm run test:bdd:netlify` | Run BDD tests against running Netlify dev server |

## Acceptance Criteria

- [ ] `npm run dev` starts the Netlify dev server
- [ ] `npm run dev:debug` shows debug output
- [ ] `npm run test:bdd:netlify` sets the environment variable (implementation in next issue)

## Notes

- `test:bdd:netlify` requires the dev server to be running in a separate terminal
- Consider adding a note to the test output when `BDD_USE_NETLIFY_DEV=true` but server is not running
