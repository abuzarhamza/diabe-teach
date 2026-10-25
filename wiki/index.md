# Diabe-Teach Wiki

Welcome to the **Diabe-Teach Knowledge Base & Research Wiki**. This repository is based on the randomized controlled trial (RCT) publication:

> **Diabe-teach: a randomized controlled trial of a gamified approach to enhance medical undergraduates’ knowledge and comprehension of diabetes mellitus**  
> *Mariam Shadan, Heba Ismail, and Fathima Hana Mohamed Naushad*  
> Published in: *BMC Medical Education* (2025) 25:17  
> DOI: [10.1186/s12909-024-06602-9](https://doi.org/10.1186/s12909-024-06602-9) | PMCID: [PMC11697910](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11697910/)  
> Full Paper PDF: [`papers/diabe-teach.pdf`](../papers/diabe-teach.pdf)  
> Supplementary File: [`papers/supplementary_material_1.docx`](../papers/supplementary_material_1.docx)

---

## 📚 Wiki Directory

| Section | Title | Description |
|---|---|---|
| [01](01-paper-overview.md) | [Paper Overview & Executive Summary](01-paper-overview.md) | High-level summary, citation metadata, background, objectives, and key findings. |
| [02](02-study-methodology-and-rct-design.md) | [Study Methodology & RCT Design](02-study-methodology-and-rct-design.md) | Experimental protocol, participant recruitment, 2-hour timeline, randomization, power calculations, and inclusion/exclusion criteria. |
| [03](03-game-mechanics-and-rules.md) | [Game Mechanics & Rules](03-game-mechanics-and-rules.md) | How the board game works: 7×7 grid layout, adjacency rules (horizontal/diagonal), chain validation, scoring, and round structures. |
| [04](04-the-49-keywords-and-clinical-domains.md) | [The 49 Keywords & Clinical Domains](04-the-49-keywords-and-clinical-domains.md) | Full catalog of the 49 medical terms used in Diabe-teach, organized by pathophysiological and clinical domains with sample chains. |
| [05](05-results-and-statistical-analysis.md) | [Results & Statistical Analysis](05-results-and-statistical-analysis.md) | In-depth breakdown of pre/post-test scores, the metacognitive shift ("I don't know" vs blind guessing), Table 1 & Table 2 data, and Likert survey results. |
| [06](06-discussion-and-comparative-analysis.md) | [Discussion & Pedagogical Comparison](06-discussion-and-comparative-analysis.md) | Diabe-teach vs. trivia/escape-room formats (e.g., *Candyland*), open-ended cognitive benefits, limitations, and future directions. |
| [07](07-digital-implementation-architecture.md) | [Digital Implementation Blueprint](07-digital-implementation-architecture.md) | Engineering architecture to adapt Diabe-teach into an interactive web/mobile application (grid generator, graph-chain validator, LLM reasoning assessor, UI design). |
| [08](08-module-breakdown.md) | [Software Module Breakdown](08-module-breakdown.md) | Deep-module breakdown of the 9 software modules, interfaces, invariants, and seams grounded in the primary RCT paper and supplementary appendices. |
| [09](09-engineering-decisions-and-environment-log.md) | [Engineering Decisions & Environment Log](09-engineering-decisions-and-environment-log.md) | Dated historical record of architectural decisions, Hexagonal DDD guardrails, and implemented vertical slices. |
| [10](10-netlify-and-lambda-routing-research.md) | [Netlify Functions v2 & AWS Lambda Routing Research](10-netlify-and-lambda-routing-research.md) | Primary-source breakdown of Netlify Functions v2 (`config.path`, `config.method`, `context.params` URLPattern routing) vs. catch-all routing and AWS Lambda API Gateway `pathParameters`. |
| [11](11-simple-factory-and-transformer-handler-pattern.md) | [Simple Factory & Request-Transformer Pattern](11-simple-factory-and-transformer-handler-pattern.md) | Pattern guide for structuring HTTP Driving Adapters as a 3-step `transformRequest -> execute -> presentResponse` factory pipeline. |
| [12](12-serverless-function-and-endpoint-frameworks-research.md) | [Existing Serverless & YAML Routing Frameworks Research](12-serverless-function-and-endpoint-frameworks-research.md) | Comparison of existing open-source frameworks: `openapi-backend` (routes directly from `openapi.yaml`), Serverless Framework (`serverless.yml`), `hono`, and `@middy/http-router`. |
| [13](13-single-entrypoint-dead-code-audit.md) | [Single-Entrypoint Dead & Redundant Code Audit](13-single-entrypoint-dead-code-audit.md) | Line-by-line audit of files, regexes, and duplicate security checks made redundant by centralizing routing in `netlify/functions/api.ts` + `OpenApiHttpApp` (`openapi-backend`). |
| [14](14-config-and-composition-root-in-hexagonal-architecture.md) | [Config & Composition Root in Hexagonal Architecture](14-config-and-composition-root-in-hexagonal-architecture.md) | Primary-source research (Cockburn, Seemann, Martin) on why runtime configuration and dependency wiring belong in the Composition Root (`AppRuntime`) rather than `src/adapters/inbound/`. |
| [15](15-class-based-hexagonal-architecture-audit.md) | [100% Class-Based Hexagonal Architecture Audit](15-class-based-hexagonal-architecture-audit.md) | Audit and refactoring design replacing loose procedural helper/factory functions with cohesive classes (`AppRuntime`, `OpenApiHttpApp`, `BaseHttpHandler`, `GetPackByIdHttpHandler`, `MongoConnectionManager`). |
| [16](16-mongoose-outbound-adapter-research.md) | [Using Mongoose for Outbound Persistence in Hexagonal DDD](16-mongoose-outbound-adapter-research.md) | Evaluation of Mongoose Schema/Model, AWS Lambda connection pooling, and `.lean()` queries for Aggregate Root rehydration. |
| [17](17-pure-mongodb-persistence-without-in-memory-fallback.md) | [Pure MongoDB Persistence Without In-Memory Built-In Fallback](17-pure-mongodb-persistence-without-in-memory-fallback.md) | Removal of hardcoded in-memory built-in packs from `MongoCurriculumPackRepository`, establishing `DIABE_TEACH_PACK` as canonical seed/test fixture. |
| [18](18-deploying-diabe-teach-to-netlify.md) | [Deploying Diabe-Teach to Netlify](18-deploying-diabe-teach-to-netlify.md) | Authoritative deployment guide: Netlify Functions v2, MongoDB Atlas setup, database seeding (`npm run db:seed`), environment variables, and smoke tests. |

---

## 🎯 Core Premise of the "Diabe-Teach" Concept

Traditional medical education predominantly relies on didactic lectures and textbook reading. While effective for passive knowledge absorption, these traditional formats often fail to foster active clinical reasoning, cross-concept synthesis, and metacognitive awareness.

Unlike standard trivia-based games (which test isolated facts via single-answer prompts), **Diabe-teach** utilizes an **open-ended, combinatorial associative approach**:
- 49 domain-curated keyword cards are shuffled into a **7×7 dynamic grid**.
- Students construct associative chains of $\ge 4$ connected cards touching horizontally or diagonally.
- Students must articulate and defend the underlying pathophysiological, clinical, or therapeutic logic connecting every step of the chain.
- The format actively rewards synthesizing multidimensional clinical pathways (e.g., linking genetics $\to$ insulin resistance $\to$ microalbuminuria $\to$ ACE inhibitor therapy).
