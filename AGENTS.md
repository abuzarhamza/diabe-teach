## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default canonical triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` and `docs/adr/` at the repo root). See `docs/agents/domain.md`.

### API architecture & Netlify deployment

Hexagonal DDD architecture (`src/domain/`, `src/application/`, `src/adapters/inbound/`, `src/adapters/outbound/`, and top-level `src/app-runtime.ts`), with layer boundaries enforced by `npm run lint:boundaries`. Domain, application and outbound modules are classes, and their contracts live in separate files (`*.types.ts`, `*.port.ts`, `*.dto.ts`). There is **no central router** (no `OpenApiHttpApp`, `openapi-backend` or `netlify/functions/api.ts`). Instead there is one Netlify Functions v2 file per route (`netlify/functions/<route>.ts`, implemented in `netlify/functions/{packs,sessions,accounts}/`), each declaring its own `config.path` + `method`. Pack routes rely on `config.path` alone; session and account paths still also have forced `netlify.toml` redirects. Every route wraps its handler in the shared middy chain `createApiHandler` (`src/adapters/inbound/http/middy/api-handler.ts`): auth (Capability Token or Account Token, per ADR-0007), then the JSON object body check, then domain errors, then a generic 500. `AppRuntime` wires production dependencies (MongoDB via mongoose inside `src/adapters/outbound/`). `docs/api/openapi.yaml` is the contract but is not read at runtime. Read `docs/agents/api-architecture.md` before designing, implementing, or reviewing API routes, domain logic, ports/adapters, or serverless deployment.

### Dependency selection: Use popular npm modules first

Before developing custom parsers, utilities, or low-level primitives from scratch, always evaluate and adopt well-maintained, battle-tested, popular npm packages (e.g. `yaml` / `js-yaml` for YAML parsing, `jose` for cryptography/tokens, standard validator libraries). Do not write custom bespoke parsing logic when robust community solutions exist.

<!-- OPENWIKI:START -->

## OpenWiki

This repository has a generated `openwiki/` evidence index. It is optional just-in-time context, not required startup reading.

- Do not enumerate, preload, or search wikis at task start. Use retrieval when the user asks for it, when unfamiliar architecture or dependency behavior materially affects the task, or when source inspection leaves an important uncertainty. Stop once the question is grounded.
- When those conditions apply and OpenWiki retrieval tools are available, use `openwiki_search` for just-in-time context and `openwiki_read` for the relevant complete sections. If search returns `workspace_required`, ask which listed workspace to use and retry with its ID.
- Use `openwiki_list_workspaces` or `openwiki_list_wikis` when workspace membership itself needs to be discovered.
- If the retrieval tools are unavailable, read `openwiki/quickstart.md` and follow its links to the relevant pages.
- Treat source code and tests as authoritative. A brief's unknowns and review items are verification gaps, not automatic requirements.
- Prefer the narrowest quiet validation that proves the changed behavior. Preserve complete failure output.

Use the repository's documented maintenance process to refresh generated pages after source changes. Check its configuration and completed runs before relying on automatic updates. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
