# Issue 01: Install Netlify CLI

## Task

Install `@netlify/cli` as a dev dependency for local Netlify Functions emulation.

## Steps

1. Install the package:
   ```bash
   npm install -D @netlify/cli
   ```

2. Verify installation:
   ```bash
   npx netlify --version
   ```

## Acceptance Criteria

- [ ] `@netlify/cli` appears in `package.json` devDependencies
- [ ] `npx netlify --version` returns version information
- [ ] No breaking changes to existing test scripts

## Notes

- The CLI provides `netlify dev`, `netlify functions:invoke`, and local emulation
- Do not link to a Netlify site (use local-only mode)
