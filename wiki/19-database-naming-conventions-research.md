# 19 - Database Naming Conventions Research

This research document analyzes and establishes the database naming conventions for the application, taking into account the domain model, architecture decision records ([`ADR-0001`](../docs/adr/0001-subject-agnostic-curriculum-pack-architecture.md), [`ADR-0002`](../docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md)), and existing persistence implementations.

---

## 1. Domain Context & Architectural Scope

From [`GLOSSARY.md`](../GLOSSARY.md) and [`docs/adr/0001-subject-agnostic-curriculum-pack-architecture.md`](../docs/adr/0001-subject-agnostic-curriculum-pack-architecture.md):

- **The Platform Engine**: **Concept-Chain Educational Game Engine**
  - A reusable, subject-agnostic educational board game engine managing game sessions, board topologies, scoring engines, participant states, and analytics.
- **The Inaugural Pack**: **Diabe-teach**
  - A specific curriculum pack (`CurriculumPack`, pack ID `diabe-teach`) bundling 49 diabetes-specific keywords, semantic domains, clinical calibration examples, and pre/post-test MCQs.

The MongoDB database stores:
1. `curriculum_packs` (both `diabe-teach` and future packs like Cardiology, Pharmacology, etc.)
2. `game_sessions` (state machines, participant states, submitted chains, and metacognitive analytics)

---

## 2. Existing Codebase Conventions

In the existing codebase:
- [`src/adapters/outbound/curriculum-pack.schema.ts`](../src/adapters/outbound/curriculum-pack.schema.ts), [`src/app-runtime.ts`](../src/app-runtime.ts), and [`scripts/seed-curriculum-packs.ts`](../scripts/seed-curriculum-packs.ts) currently configure:
  ```typescript
  export const DEFAULT_MONGODB_DB_NAME = "diabe_teach";
  ```
- Environment variable overrides:
  - `MONGODB_DB_NAME` (optional override)
  - `MONGODB_URI` (full connection string)

---

## 3. Database Naming Analysis

| Convention Option | Example Names | Domain Alignment | Pros & Cons |
|---|---|---|---|
| **Platform-Level (Recommended)** | `concept_chain`<br>`concept_chain_prod` | **High** (Aligns with ADR-0001 engine architecture) | **Pros**: Future-proof for multi-subject packs; reflects true bounded context.<br>**Cons**: Differs from repository name (`diabe-teach`). |
| **Project / Pilot Brand** | `diabe_teach`<br>`diabe_teach_prod` | **Medium** (Tied to the inaugural paper/pilot) | **Pros**: Zero friction with current code default (`DEFAULT_MONGODB_DB_NAME`).<br>**Cons**: Semantically inaccurate if storing Cardiology or Pharmacology packs. |
| **Cluster-Qualified / Engine** | `concept_chain_db`<br>`concept_chain_engine` | **High** | **Pros**: Ideal if sharing a MongoDB Atlas cluster with other unrelated applications.<br>**Cons**: Redundant `_db` suffix in dedicated clusters. |

---

## 4. Recommendations

### 1. Primary Recommendation: `concept_chain`
- **Development**: `concept_chain_dev`
- **Staging / Preview**: `concept_chain_staging`
- **Production**: `concept_chain_prod` (or simply `concept_chain`)

*Why:* In Hexagonal Architecture and DDD, the persistence store serves the entire **Concept-Chain** aggregate boundary (all curriculum packs and game sessions).

### 2. Immediate Drop-in: `diabe_teach`
If you are deploying exclusively for the Diabe-teach study trial or want 100% parity with existing `DEFAULT_MONGODB_DB_NAME`, use:
- **Production**: `diabe_teach` (or `diabe_teach_prod`)
