# Issue 02: Configure netlify.toml [dev] Block

**Status:** resolved

Resolved 2026-11-20: done (`netlify-cli` devDependency, `netlify.toml` `[dev]` block and URL-based `tests/integration/support/http-client.ts` in `b368e85`; `dev:local`/`test:bdd` scripts, `BeforeAll` health check in `tests/integration/support/hooks.ts`; no Express in `package.json`).

## Task

Add local development configuration to `netlify.toml` for `netlify dev` command.

## Changes to `netlify.toml`

Add the following blocks:

```toml
[dev]
  port = 8888
  functionsPort = 9999
  autoLaunch = false
  framework = "#custom"

[context.dev.environment]
  NODE_ENV = "development"
```

## Configuration Explanation

| Setting | Value | Purpose |
|---------|-------|---------|
| `port` | 8888 | Main access port for Netlify Dev |
| `functionsPort` | 9999 | Port for serving functions internally |
| `autoLaunch` | false | Prevent browser auto-opening |
| `framework` | "#custom" | Skip framework auto-detection |
| `NODE_ENV` | "development" | Environment variable for local dev |

## Acceptance Criteria

- [ ] `netlify dev` starts without errors
- [ ] Functions accessible at `http://localhost:8888/.netlify/functions/*` or configured paths
- [ ] Browser does not auto-launch
- [ ] `NODE_ENV` is set to "development" in function context

## Testing

```bash
npx netlify dev
# In another terminal:
curl http://localhost:8888/api/v1/packs
```
