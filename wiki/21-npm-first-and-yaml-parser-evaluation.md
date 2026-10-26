# Wiki Note 21: Dependency Selection Standard & YAML Parser Evaluation

**Status**: Accepted & Applied  
**Date**: October 26, 2026  
**Related ADRs**: [ADR-0002](../docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md), [ADR-0003](../docs/adr/0003-platform-database-naming-concept-chain.md)  
**Primary Standards**: [AGENTS.md](../AGENTS.md) (`Dependency selection: Use popular npm modules first`)

---

## 1. Context & Motivation

During the development of the `.env.dev.yaml` configuration loader ([`EnvYamlConfigLoader`](../src/adapters/outbound/env-yaml-config-loader.ts)), an initial bespoke implementation parsed YAML lines using regular expressions. While functional for basic key-value pairs, bespoke parsers suffer from:
1. **Fragility**: Limited handling of nested structures, multiline strings, escape sequences, arrays, and standard YAML 1.2 specifications.
2. **Security Vulnerabilities**: Risk of polynomial backtracking (ReDoS) on user-crafted inputs (flagged by `@antfu/eslint-config` rule `regexp/no-super-linear-backtracking`).
3. **Maintenance Overhead**: Unnecessary maintenance burden for domain and platform engineers recreating standard language primitives.

To establish sustainable engineering practices across the platform, a platform-wide rule was added to [`AGENTS.md`](../AGENTS.md):
> **Dependency selection: Use popular npm modules first**: Before developing custom parsers, utilities, or low-level primitives from scratch, always evaluate and adopt well-maintained, battle-tested, popular npm packages (e.g. `yaml` / `js-yaml` for YAML parsing, `jose` for cryptography/tokens, standard validator libraries). Do not write custom bespoke parsing logic when robust community solutions exist.

---

## 2. Comparative Evaluation: `yaml` vs `js-yaml`

The two dominant packages in the Node.js/JavaScript ecosystem for parsing YAML were evaluated against high-trust primary sources:

| Evaluation Criteria | `yaml` (npm: `yaml` by Eemeli Aro) | `js-yaml` (npm: `js-yaml` by Andrey Zholos) | Evaluation & Verdict |
| :--- | :--- | :--- | :--- |
| **Weekly Downloads** | ~99.7 Million | ~100–117 Million | Both are industry-standard, top-tier npm packages. |
| **YAML Specification** | Full YAML 1.2, 1.1, and 1.0 support | YAML 1.2 support | `yaml` provides comprehensive spec compliance and comments retention. |
| **TypeScript Support** | Native first-party TypeScript types included | Requires `@types/js-yaml` | `yaml` avoids separate `@types/*` synchronization issues. |
| **ESM & Node.js Native** | Dual CJS/ESM exports with `exports` field in `package.json` | Traditionally CJS-first, bundled ESM | `yaml` is modern, zero-dependency, and works natively in ESM Node.js. |
| **Bundle Size** | ~30.6 kB minified + gzipped (~100.8 kB min) | ~14.5 kB minified + gzipped (~43 kB min) | `yaml` is lightweight, zero external dependencies. |
| **Security & CVE History** | 0 active high/critical vulnerabilities | Historic prototype pollution CVEs in older v3 versions (remediated in v4) | Both current versions are actively maintained and secure. |

---

## 3. Decision: Adoption of `yaml`

The platform has adopted **`yaml`** as the standard parser for `.env.dev.yaml` and YAML runtime assets because:
1. **First-Party TypeScript Support**: Native type definitions ship inside `yaml`, eliminating external `@types` drift.
2. **Clean ESM Compatibility**: Seamlessly integrates into the project's native `"type": "module"` Node.js 24 environment and Netlify Functions v2 runtime.
3. **Zero Dependencies**: `yaml` has zero runtime sub-dependencies, ensuring lean serverless cold-start times.
4. **Standard Compliance**: Handles arbitrary nesting, comments, scalar types, and whitespace without custom maintenance.

---

## 4. Implementation in `EnvYamlConfigLoader`

[`src/adapters/outbound/env-yaml-config-loader.ts`](../src/adapters/outbound/env-yaml-config-loader.ts) uses `yaml` to parse `.env.dev.yaml`:

```typescript
import { parse as parseYaml } from "yaml";

export class EnvYamlConfigLoader {
  public static parseYamlString(content: string): EnvYamlConfig {
    if (!content || !content.trim()) {
      return {};
    }

    try {
      const parsed = parseYaml(content) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== "object") {
        return {};
      }

      const result: EnvYamlConfig = {};

      if (parsed.mongodb && typeof parsed.mongodb === "object") {
        const mongo = parsed.mongodb as Record<string, unknown>;
        (result as { mongodb: EnvYamlMongoConfig }).mongodb = {
          uri: typeof mongo.uri === "string" ? mongo.uri : undefined,
          database: typeof mongo.database === "string" ? mongo.database : undefined,
        };
      }

      if (parsed.auth && typeof parsed.auth === "object") {
        const auth = parsed.auth as Record<string, unknown>;
        (result as { auth: EnvYamlAuthConfig }).auth = {
          capability_token_secret:
            typeof auth.capability_token_secret === "string"
              ? auth.capability_token_secret
              : undefined,
          api_key: typeof auth.api_key === "string" ? auth.api_key : undefined,
        };
      }

      return result;
    } catch {
      return {};
    }
  }
}
```

---

## 5. Verification & Compliance

- **ESLint (`@antfu/eslint-config`)**: Clean pass (0 errors, 0 warnings).
- **TypeScript (`tsc --noEmit`)**: Clean pass (0 errors).
- **Architecture Boundaries (`dependency-cruiser`)**: 0 violations.
- **Unit & Integration Tests**: 36/36 tests passing.

---

## References

1. `yaml` on GitHub: [github.com/eemeli/yaml](https://github.com/eemeli/yaml)
2. `yaml` on npm: [npmjs.com/package/yaml](https://www.npmjs.com/package/yaml)
3. `js-yaml` on GitHub: [github.com/nodeca/js-yaml](https://github.com/nodeca/js-yaml)
4. Repository Agent Rules: [`AGENTS.md`](../AGENTS.md)
