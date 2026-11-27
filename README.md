# Diabe-Teach

> An evidence-based educational serious game designed to enhance medical undergraduates' knowledge, comprehension, and metacognitive clinical reasoning in diabetes mellitus.

This project is built directly on the randomized controlled trial (RCT) research published in *BMC Medical Education* (2025):

**"Diabe-teach: a randomized controlled trial of a gamified approach to enhance medical undergraduates’ knowledge and comprehension of diabetes mellitus"**  
*Mariam Shadan, Heba Ismail, and Fathima Hana Mohamed Naushad*  
DOI: [10.1186/s12909-024-06602-9](https://doi.org/10.1186/s12909-024-06602-9) | PMCID: [PMC11697910](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11697910/)

---

## 📄 Source Papers & Artifacts

- **Full Publication PDF:** [`papers/diabe-teach.pdf`](papers/diabe-teach.pdf)
- **Supplementary Material (Appendices 1 & 2):** [`papers/supplementary_material_1.docx`](papers/supplementary_material_1.docx)

---

## 📖 Comprehensive Project Wiki

A comprehensive wiki converting the entire publication into structured, actionable documentation has been created in the [`wiki/`](wiki/index.md) directory:

1. **[Paper Overview & Executive Summary](wiki/01-paper-overview.md)**  
   Citation metadata, abstract breakdown, objectives, key trial findings, and significance.
2. **[Study Methodology & RCT Design](wiki/02-study-methodology-and-rct-design.md)**  
   Ethical approvals, inclusion/exclusion criteria, power calculation, randomization, and the 2-hour session timeline.
3. **[Game Mechanics & Rules](wiki/03-game-mechanics-and-rules.md)**  
   7×7 grid layout, minimum 4-card chain rule, Chebyshev adjacency (horizontal/diagonal), valid vs invalid chain criteria, scoring, and adjudication.
4. **[The 49 Keywords & Clinical Domains](wiki/04-the-49-keywords-and-clinical-domains.md)**  
   Full catalog of all 49 medical keywords from Appendix 1, definitions, clinical relevance, and 7-domain semantic clustering.
5. **[Results & Statistical Analysis](wiki/05-results-and-statistical-analysis.md)**  
   Pretest vs post-test data, Table 1 & Table 2 t-test statistics, and the crucial metacognitive finding ("I don't know" vs blind guessing error reduction).
6. **[Discussion & Comparative Analysis](wiki/06-discussion-and-comparative-analysis.md)**  
   Pedagogical comparison of Diabe-teach vs trivia games (*Candyland*) and escape rooms, constructivist learning mechanisms, and study limitations.
7. **[Digital Implementation Architecture](wiki/07-digital-implementation-architecture.md)**  
   Full software engineering architecture: 2D adjacency algorithms, LLM clinical reasoning validation prompt, game modes, and analytics engine.

---

## 🎮 How the Board Game Operates (Summary)

```
+-------------------------------------------------------------------------------+
|                                7 x 7 GRID BOARD                               |
| [ Retinopathy ] [  Pancreas  ] [    Ulcer   ] [Sulfonylureas] [  Metformin  ] |
| [ Autoimmune  ] [Glycemic Ind] [Hypoglycemia] [ Weight loss ] [ Adiponectin ] |
| [ Islet Cells ] [ Transplant ] [     HHS    ] [   Amylin    ] [Thiazolidined] |
| [ACE Inhibitor] [ Screening  ] [Microalbumin] [   Smoking   ] [   Genetic   ] |
| [  Glucagon   ] [ Neuropathy ] [Dyslipidemia] [   Insulin   ] [   Weight    ] |
| [ Polydipsia  ] [Gastroparesi] [  C-Peptide ] [   Venous    ] [Ketoacidosis ] |
| [    MODY     ] [Lipohypertro] [  Children  ] [  Pregnancy  ] [    LADA     ] |
+-------------------------------------------------------------------------------+
```

- **Objective:** Find sequences of $\ge 4$ connected cards touching horizontally or diagonally.
- **Requirement:** Explain and justify the medical and pathophysiological reasoning connecting every keyword in the chain.
- **Winning:** The player with the longest valid clinical chain (or highest count of valid chains in ties) wins the round.

---

## 🚀 Quick Start (Local Development & Manual Testing)

### Prerequisites
- **Node.js 24.x** (see [`.nvmrc`](.nvmrc))
- Install root (backend) and standalone `web/` (React frontend) dependencies:
  ```bash
  npm install
  npm --prefix web install
  ```

### 1. Run the Prototype UI + Local API (In-Memory MongoDB)

To test the interactive HTML prototype (`claudPoc/concept-chain/`) and the standalone Bruno API Docs playground locally with an automatically seeded in-memory MongoDB (`diabe-teach` System Pack pre-loaded) and the `x-api-key` header check disabled for browser calls:

```bash
npm run dev:prototype
```

Wait until the terminal prints:
```text
DEV READY http://localhost:8888
PROTOTYPE http://localhost:8888/claudPoc/concept-chain/login.html (x-api-key check off)
```

Then open in your browser:
- **Teacher Login & Prototype UI:** [`http://localhost:8888/claudPoc/concept-chain/login.html`](http://localhost:8888/claudPoc/concept-chain/login.html)
  - **Important (First-Time Login):** Because `dev:prototype` starts a fresh in-memory MongoDB instance on each boot, **no teacher account exists yet**. On the login screen, enter any email (e.g. `rahman.s@aku.edu`) and a password of **at least 10 characters** (e.g. `correct horse battery`), and click **"Create account"** (`Sign Up`) first. After your account is created, you can use **"Sign in"** for the rest of that server session.
- **Standalone Interactive Bruno API Docs & Playground:** [`http://localhost:8888/docs/api/api-docs.html`](http://localhost:8888/docs/api/api-docs.html)

To stop the local server cleanly (releasing port `8888` and stopping the in-memory MongoDB):
```bash
npm run dev:local:stop
```

---

### 2. Run the React + Vite Frontend (`web/`)

The production React + Vite Single-Page Application lives in [`web/`](web/) as a standalone package ([`web/package.json`](web/package.json)) following the **Simple 3-Layer Pragmatic DDD architecture** ([ADR-0008](docs/adr/0008-simple-three-layer-ddd-react-vite-frontend.md)):

- [`web/src/domain/`](web/src/domain/README.md) — **Layer 1:** Pure UI domain rules (zero React, zero `fetch`/storage)
- [`web/src/api/`](web/src/api/README.md) — **Layer 2:** Outbound HTTP client & token store (`AccountToken` vs. `CapabilityToken`)
- [`web/src/features/`](web/src/features/README.md) — **Layer 3:** React screens & components (strictly **no `useEffect`**, enforced by [`web/eslint.config.js`](web/eslint.config.js))

With `npm run dev:local` (or `npm run dev:prototype`) running on port `8888`, start the Vite dev server in a second terminal:

```bash
npm run dev:web
```

- Opens at [`http://localhost:5173`](http://localhost:5173) and automatically proxies `/api/*` requests to `http://localhost:8888`.

---

### 3. Manual API Testing with Bruno (`docs/api/bruno/`)

A complete, Git-tracked **Bruno** collection covering all **24 implemented endpoints** (`GET /api/health` + all 23 `/api/v1/*` routes) lives in [`docs/api/bruno/`](docs/api/bruno/):

1. Start the local server (`npm run dev:local`).
2. Open [`docs/api/bruno/`](docs/api/bruno/) in the [Bruno Desktop App](https://www.usebruno.com/) and select the **`Local Dev`** environment (`baseUrl: http://localhost:8888`, `apiKey: dev-local-api-key`).
3. Run requests top-to-bottom across folders `01-Health` through `06-Assessments-Survey-and-Lifecycle`. Every token (`accountToken`, `instructorToken`, `participantToken`) and resource ID (`accountId`, `sessionId`, `roomCode`, `participantId`, `chainId`) is automatically captured by `script:post-response` hooks and chained into subsequent requests.
4. To regenerate the standalone HTML documentation ([`docs/api/api-docs.html`](docs/api/api-docs.html)) after editing `.bru` files:
   ```bash
   npm run generate:api-docs
   ```

---

## 🛠️ Commands & Verification Suite

| Command | Description |
|---|---|
| `npm run dev:local` | Start Netlify Functions v2 + in-memory MongoDB on `http://localhost:8888` (with `x-api-key` enabled) |
| `npm run dev:prototype` | Start local server on `http://localhost:8888` with `x-api-key` disabled for prototype browser testing |
| `npm run dev:local:stop` | Stop `dev:local` / `dev:prototype` process tree and free port `8888` |
| `npm run dev:web` | Start the standalone React + Vite dev server (`web/`) on `http://localhost:5173` |
| `npm run build:web` | Build the production React bundle to `web/dist/` |
| `npm run typecheck` | Typecheck backend (`src/`, `netlify/`, `tests/`) |
| `npm run typecheck:web` | Typecheck standalone React frontend (`web/src/`) |
| `npm run lint` | Run backend ESLint (`src`, `netlify`, `scripts`, `tests`) |
| `npm run lint:web` | Run standalone Antfu React ESLint in `web/` (enforces `no-useEffect`) |
| `npm run lint:boundaries` | Enforce Hexagonal DDD (`src/`) and 3-layer UI DDD (`web/src/`) architecture boundaries |
| `npx vitest run --no-file-parallelism` | Run all Vitest unit, handler, contract, and architecture guard tests |
| `npm run test:bdd` | Run all 5 Cucumber BDD features sequentially against a running `npm run dev:local` server |
| `npm run generate:request-schemas` | Regenerate Ajv 2020-12 request schemas from [`docs/api/openapi.yaml`](docs/api/openapi.yaml) |
| `npm run generate:api-docs` | Regenerate standalone Bruno HTML docs ([`docs/api/api-docs.html`](docs/api/api-docs.html)) from [`docs/api/bruno/`](docs/api/bruno/) |

---

## 🏛️ Architecture & Domain Documentation

- **Domain Glossary:** [`GLOSSARY.md`](GLOSSARY.md)
- **API Contract (OpenAPI 3.1):** [`docs/api/openapi.yaml`](docs/api/openapi.yaml)
- **API & Serverless Architecture Guide:** [`docs/agents/api-architecture.md`](docs/agents/api-architecture.md)
- **Architecture Decision Records (`docs/adr/`):**
  - [ADR-0001: Subject-Agnostic Curriculum Pack Architecture](docs/adr/0001-subject-agnostic-curriculum-pack-architecture.md)
  - [ADR-0002: Hexagonal DDD Architecture & Netlify Serverless Deployment](docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md)
  - [ADR-0004: Fail-Closed Bearer Tokens & JWT Verification](docs/adr/0004-openapi-security-handlers-and-jwt-verification.md)
  - [ADR-0005: Popular npm Modules First & Middy Middleware](docs/adr/0005-npm-first-dependency-policy-and-middy-middleware-selection.md)
  - [ADR-0006: Curriculum Pack Registration & Lifecycle](docs/adr/0006-curriculum-pack-registration-and-lifecycle.md)
  - [ADR-0007: Instructor Accounts, Account Tokens, Shared Pack Library & Pack Version Pinning](docs/adr/0007-instructor-accounts-and-shared-pack-library.md)
  - [ADR-0008: Simple Three-Layer DDD React + Vite Frontend (`web/src/{domain,api,features}`)](docs/adr/0008-simple-three-layer-ddd-react-vite-frontend.md)

