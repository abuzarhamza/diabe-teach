## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default canonical triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` and `docs/adr/` at the repo root). See `docs/agents/domain.md`.

### API architecture & Netlify deployment

Hexagonal DDD architecture (`src/domain/`, `src/application/`, `src/adapters/inbound/`, `src/adapters/outbound/`, `src/config/`) with strict separation between interface/contract files (`*.types.ts`, `*.port.ts`, `*.dto.ts`) and class/implementation files, centrally routed by `openapi-backend` reading `docs/api/openapi.yaml` (`src/adapters/inbound/http/create-app.ts`), deployed via a single Netlify Functions v2 entrypoint (`netlify/functions/api.ts` wired through `src/config/runtime.config.ts`) and MongoDB (`MongoCurriculumPackRepository`, `MongoSessionRepository` inside `src/adapters/outbound/`). Read `docs/agents/api-architecture.md` before designing, implementing, or reviewing API routes, domain logic, ports/adapters, or serverless deployment.
