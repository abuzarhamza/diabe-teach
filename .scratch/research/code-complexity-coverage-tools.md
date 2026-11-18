# Code Complexity and Coverage Tools Research

**Date**: November 2026
**Project**: diabe-teach
**Scope**: TypeScript/Node.js codebase with Vitest and ESLint

---

## Executive Summary

This document provides research findings on tools for measuring cyclomatic complexity, cognitive complexity, and code coverage in TypeScript/Node.js projects. The research is based on primary sources (official documentation, npm pages, and GitHub repositories).

### Current Codebase Status

The diabe-teach project already has several relevant tools installed:

| Tool | Version | Purpose |
|------|---------|---------|
| `@vitest/coverage-v8` | ^3.0.5 | V8-based code coverage |
| `c8` | ^12.0.0 | V8 code coverage CLI |
| `escomplex` | ^2.0.0-alpha | Cyclomatic complexity, Halstead metrics, maintainability index |
| `@antfu/eslint-config` | ^10.0.0 | ESLint configuration preset |

---

## 1. Cyclomatic Complexity Tools

### 1.1 ESLint Built-in Complexity Rule

The ESLint `complexity` rule is the most direct way to enforce cyclomatic complexity thresholds at the linting level.

**Key Features:**
- Default threshold: 20
- Supports "classic" (McCabe) and "modified" variants
- Warns when complexity crosses the configured threshold

**Configuration Examples:**

```javascript
// Number format
"complexity": ["error", 10]

// Object format with options
"complexity": ["error", { "max": 10, "variant": "classic" }]
```

**Primary Source:** [ESLint Complexity Rule - Official Documentation](https://eslint.org/docs/latest/rules/complexity)

---

### 1.2 escomplex (Already Installed)

The project already uses `escomplex` via `scripts/run-complexity.ts`. This provides comprehensive metrics beyond cyclomatic complexity.

**Metrics Provided:**
- **Cyclomatic Complexity**: Mean per function and aggregate total
- **Maintainability Index**: Scale from -infinity to 171 (higher is better, >100 is good)
- **Halstead Metrics**: Difficulty, effort, volume, estimated bugs, development time
- **Lines of Code**: Physical and logical SLOC

**Usage (existing script):**

```bash
npm run complexity src/domain/game-session/game-session.ts
npm run escomplex src/application/use-cases/*.ts --json
```

**Primary Sources:**
- [escomplex - npm](https://www.npmjs.com/package/escomplex)
- [escomplex - GitHub](https://github.com/Thomas-P/escomplex)

---

### 1.3 typhonjs-escomplex

A next-generation complexity reporting tool with native TypeScript support via Babel parser.

**Advantages over escomplex:**
- Direct TypeScript parsing (no transpilation needed)
- Babel parser with all plugins enabled
- More accurate metrics for modern JS/TS syntax

**Installation:**

```bash
npm install --save-dev typhonjs-escomplex
```

**Primary Sources:**
- [typhonjs-escomplex - npm](https://npmjs.com/package/typhonjs-escomplex)
- [TyphonJS Node ESComplex - GitHub](https://github.com/typhonjs-node-escomplex)

---

### 1.4 Plato / es6-plato (Visualization)

HTML-based complexity visualization tool. Note: These tools are largely unmaintained.

**Status:**
- `plato`: Last published 10 years ago
- `es6-plato`: Last published 6 years ago

**Not Recommended** for new projects due to maintenance status.

**Primary Sources:**
- [plato - npm](https://www.npmjs.com/package/plato)
- [es6-plato - GitHub](https://github.com/deedubs/es6-plato)

---

### 1.5 SonarQube / SonarJS

Enterprise-grade static analysis platform with comprehensive complexity metrics.

**Features:**
- 534 JS rules and 553 TS rules
- Cyclomatic and cognitive complexity
- Bug and vulnerability detection
- Code smell identification

**Integration Options:**
- SonarQube Server (self-hosted)
- SonarQube Cloud (SaaS)
- `eslint-plugin-sonarjs` for local linting (see Section 2)

**Primary Sources:**
- [SonarJS - GitHub](https://github.com/SonarSource/sonarjs)
- [SonarQube JS/TS Documentation](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/languages/javascript-typescript-css)

---

### 1.6 Code Climate

Cloud-based code quality platform with complexity analysis.

**Features:**
- A-F letter ratings for files
- Default thresholds: argument count (4), method complexity (5), method count (20), method length (25)
- Duplication detection
- Pull request integration

**Integration:** Requires Code Climate account and CI/CD integration.

**Primary Source:** [Code Climate Default Analysis Configuration](https://docs.codeclimate.com/docs/default-analysis-configuration)

---

## 2. Cognitive Complexity Tools

### 2.1 Understanding Cognitive Complexity

**Key Differences from Cyclomatic Complexity:**

| Aspect | Cyclomatic Complexity | Cognitive Complexity |
|--------|----------------------|---------------------|
| Purpose | Measure testability | Measure understandability |
| Focus | Independent execution paths | Mental effort to read code |
| Nesting | Not weighted | Extra penalty for nesting |
| Switch statements | High score | Low score (linear, readable) |
| Shorthand syntax | Penalized same as verbose | No penalty if readable |

**Primary Sources:**
- [SonarSource: Cognitive Complexity](https://www.sonarsource.com/blog/cognitive-complexity-because-testability-understandability/)
- [SonarSource: Cyclomatic Complexity Guide](https://www.sonarsource.com/resources/library/cyclomatic-complexity/)

---

### 2.2 eslint-plugin-sonarjs

**Installation:**

```bash
npm install --save-dev eslint-plugin-sonarjs
```

**Configuration (Flat Config - eslint.config.js):**

```javascript
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  sonarjs.configs.recommended,
  {
    rules: {
      // Default threshold is 15
      "sonarjs/cognitive-complexity": ["error", 15],
    }
  }
];
```

**Integration with @antfu/eslint-config:**

```javascript
import antfu from "@antfu/eslint-config";
import sonarjs from 'eslint-plugin-sonarjs';

export default antfu(
  {
    typescript: true,
    // ... existing config
  },
  sonarjs.configs.recommended,
  {
    rules: {
      "sonarjs/cognitive-complexity": ["error", 15],
    }
  }
);
```

**Available Cognitive Complexity Rules:**
- `sonarjs/cognitive-complexity` - Limits cognitive complexity of functions

**Primary Sources:**
- [eslint-plugin-sonarjs - npm](https://www.npmjs.com/package/eslint-plugin-sonarjs)
- [cognitive-complexity.md - GitHub](https://github.com/SonarSource/eslint-plugin-sonarjs/blob/master/docs/rules/cognitive-complexity.md)

---

## 3. Code Coverage Tools

### 3.1 Vitest Coverage (Already Configured)

The project already has Vitest coverage configured with the V8 provider.

**Current Configuration (`vitest.config.ts`):**

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: ["src/**/*.ts", "netlify/**/*.ts"],
  exclude: ["**/*.types.ts", "**/*.dto.ts", "**/*.port.ts"],
}
```

**Adding Thresholds:**

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: ["src/**/*.ts", "netlify/**/*.ts"],
  exclude: ["**/*.types.ts", "**/*.dto.ts", "**/*.port.ts"],
  thresholds: {
    branches: 75,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

**Per-Directory Thresholds:**

```typescript
coverage: {
  provider: "v8",
  thresholds: {
    // Global defaults
    branches: 75,
    functions: 80,
    lines: 80,
    statements: 80,
    // Domain code requires higher coverage
    "src/domain/**": {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    // Adapter code can be lower
    "src/adapters/**": {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
}
```

**Running Coverage:**

```bash
npx vitest run --coverage
```

**Primary Sources:**
- [Vitest Coverage Guide](https://vitest.dev/guide/coverage)
- [Vitest Coverage Config](https://vitest.dev/config/coverage)

---

### 3.2 V8 vs Istanbul

| Feature | V8 (@vitest/coverage-v8) | Istanbul (@vitest/coverage-istanbul) |
|---------|--------------------------|--------------------------------------|
| Speed | Faster (native V8) | Slower (instrumentation) |
| Accuracy | AST-based since v3.2.0 | High accuracy |
| Setup | Minimal | Requires more config |
| TypeScript | Works well | Works well |

**Recommendation:** Use V8 provider (already configured). Since Vitest v3.2.0, V8 uses AST-based coverage remapping, producing identical reports to Istanbul.

**Primary Source:** [c8 vs nyc vs Istanbul 2026 Comparison](https://www.pkgpulse.com/guides/c8-vs-nyc-vs-istanbul-javascript-code-coverage-2026)

---

### 3.3 NYC (Istanbul CLI)

NYC is the command-line interface for Istanbul, useful for non-Vitest test runners.

**Not recommended** for this project since Vitest's built-in coverage is already configured and provides better integration.

**Primary Sources:**
- [NYC - GitHub](https://github.com/istanbuljs/nyc)
- [c8 - npm](https://www.npmjs.com/package/c8)

---

## 4. Recommendations for This Codebase

### 4.1 Immediate Enhancements

#### Add ESLint Complexity Rules

Update `eslint.config.js`:

```javascript
import antfu from "@antfu/eslint-config";
import sonarjs from 'eslint-plugin-sonarjs';

export default antfu(
  {
    typescript: true,
    jsonc: true,
    yaml: true,
    stylistic: {
      semi: true,
      quotes: "double",
      indent: 2,
    },
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.netlify/**",
      "**/.scratch/**",
      "**/wiki/**",
      "**/assets/**",
      "docs/**",
    ],
  },
  sonarjs.configs.recommended,
  {
    rules: {
      "node/prefer-global/process": "off",
      "node/prefer-global/buffer": "off",
      // Cyclomatic complexity
      "complexity": ["warn", { "max": 10 }],
      // Cognitive complexity
      "sonarjs/cognitive-complexity": ["warn", 15],
    },
  },
);
```

#### Add Coverage Thresholds

Update `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts", "netlify/**/*.ts"],
      exclude: ["**/*.types.ts", "**/*.dto.ts", "**/*.port.ts"],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
```

### 4.2 npm Scripts to Add

Add to `package.json`:

```json
{
  "scripts": {
    "coverage": "vitest run --coverage",
    "coverage:watch": "vitest --coverage",
    "complexity:all": "node --experimental-strip-types scripts/run-complexity.ts src/**/*.ts",
    "complexity:check": "eslint src netlify --rule 'complexity: [error, 10]'",
    "quality": "npm run lint && npm run coverage && npm run complexity:all"
  }
}
```

### 4.3 Installation Commands

```bash
# Add eslint-plugin-sonarjs for cognitive complexity
npm install --save-dev eslint-plugin-sonarjs

# Optional: Add typhonjs-escomplex for better TypeScript support
npm install --save-dev typhonjs-escomplex
```

---

## 5. Interpreting the Metrics

### 5.1 Cyclomatic Complexity Thresholds

| Score | Risk Level | Action |
|-------|------------|--------|
| 1-10 | Low | Acceptable |
| 11-20 | Moderate | Consider refactoring |
| 21-50 | High | Refactor recommended |
| 50+ | Very High | Refactor required |

### 5.2 Cognitive Complexity Thresholds

| Score | Interpretation |
|-------|---------------|
| 0-5 | Easy to understand |
| 6-10 | Slightly complex |
| 11-15 | Moderately complex (default threshold) |
| 16-25 | Complex, consider refactoring |
| 25+ | Very complex, refactor required |

### 5.3 Maintainability Index (escomplex)

| Score | Interpretation |
|-------|---------------|
| 100-171 | Highly maintainable |
| 70-99 | Moderately maintainable |
| 50-69 | Difficult to maintain |
| 0-49 | Unmaintainable |

### 5.4 Code Coverage Targets

| Type | Minimum | Good | Excellent |
|------|---------|------|-----------|
| Lines | 60% | 80% | 90%+ |
| Branches | 50% | 75% | 85%+ |
| Functions | 70% | 80% | 95%+ |
| Statements | 60% | 80% | 90%+ |

---

## 6. Primary Source Citations

### Official Documentation

1. **ESLint Complexity Rule**: [https://eslint.org/docs/latest/rules/complexity](https://eslint.org/docs/latest/rules/complexity)
2. **Vitest Coverage Guide**: [https://vitest.dev/guide/coverage](https://vitest.dev/guide/coverage)
3. **Vitest Coverage Config**: [https://vitest.dev/config/coverage](https://vitest.dev/config/coverage)
4. **SonarJS Documentation**: [https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/languages/javascript-typescript-css](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/languages/javascript-typescript-css)
5. **SonarSource Cognitive Complexity**: [https://www.sonarsource.com/blog/cognitive-complexity-because-testability-understandability/](https://www.sonarsource.com/blog/cognitive-complexity-because-testability-understandability/)

### npm Packages

6. **eslint-plugin-sonarjs**: [https://www.npmjs.com/package/eslint-plugin-sonarjs](https://www.npmjs.com/package/eslint-plugin-sonarjs)
7. **escomplex**: [https://www.npmjs.com/package/escomplex](https://www.npmjs.com/package/escomplex)
8. **typhonjs-escomplex**: [https://npmjs.com/package/typhonjs-escomplex](https://npmjs.com/package/typhonjs-escomplex)
9. **@vitest/coverage-v8**: [https://www.npmjs.com/package/@vitest/coverage-v8](https://www.npmjs.com/package/@vitest/coverage-v8)
10. **c8**: [https://www.npmjs.com/package/c8](https://www.npmjs.com/package/c8)

### GitHub Repositories

11. **eslint-plugin-sonarjs cognitive-complexity rule**: [https://github.com/SonarSource/eslint-plugin-sonarjs/blob/master/docs/rules/cognitive-complexity.md](https://github.com/SonarSource/eslint-plugin-sonarjs/blob/master/docs/rules/cognitive-complexity.md)
12. **escomplex**: [https://github.com/Thomas-P/escomplex](https://github.com/Thomas-P/escomplex)
13. **SonarJS**: [https://github.com/SonarSource/sonarjs](https://github.com/SonarSource/sonarjs)

---

## 7. Summary

### What This Codebase Already Has

- `escomplex` for cyclomatic complexity, Halstead metrics, and maintainability index
- `@vitest/coverage-v8` for code coverage with V8 provider
- `c8` as a backup coverage CLI
- `@antfu/eslint-config` for linting

### Recommended Additions

1. **eslint-plugin-sonarjs** - Add cognitive complexity linting
2. **Coverage thresholds** - Enforce minimum coverage in CI
3. **ESLint complexity rule** - Add cyclomatic complexity to linting
4. **npm scripts** - Standardize quality check commands

### Tools NOT Recommended

- **plato/es6-plato** - Unmaintained
- **NYC** - Redundant with Vitest coverage
- **SonarQube Server** - Overkill for this project size; use eslint-plugin-sonarjs instead
- **Code Climate** - Cloud-only; adds external dependency

---

## Additional Tools: Lizard and Alternatives

This section covers Lizard, a language-agnostic complexity analyzer, and compares it with other tools for JavaScript/TypeScript projects.

---

### 8. Lizard - Multi-Language Complexity Analyzer

Lizard is a simple code complexity analyzer that works across many programming languages without requiring header files or imports. It is particularly useful for polyglot codebases or when a single tool needs to analyze multiple languages consistently.

**Primary Sources:**
- [Lizard - GitHub](https://github.com/terryyin/lizard)
- [Lizard - PyPI](https://pypi.org/project/lizard/)
- [Lizard README](https://github.com/terryyin/lizard/blob/master/README.rst)

#### 8.1 Installation

```bash
# Install via pip (requires Python)
pip install lizard

# Or with sudo for global installation
sudo pip install lizard

# Verify installation
lizard --version
```

#### 8.2 Supported Languages

Lizard supports 25+ programming languages including:

| Language | Extension Support |
|----------|------------------|
| **JavaScript** | ES6 and JSX |
| **TypeScript** | TSX support |
| C/C++ | C++14 |
| Python | Standard |
| Java | Standard |
| Go | Standard |
| Rust | Standard |
| Swift | Standard |
| Kotlin | Standard |
| Ruby | Standard |
| PHP | Standard |
| C# | Standard |
| Scala | Standard |
| And more... | |

#### 8.3 Metrics Provided

Lizard analyzes and reports:

| Metric | Description |
|--------|-------------|
| **NLOC** | Lines of code without comments |
| **CCN** | Cyclomatic Complexity Number (McCabe complexity) |
| **Token Count** | Number of tokens in the function |
| **Parameter Count** | Number of function parameters |
| **Nesting Depth** | Maximum nesting level (via extension) |

#### 8.4 CLI Usage

**Basic Usage:**

```bash
# Analyze current directory recursively
lizard

# Analyze specific directory
lizard src/

# Analyze specific files
lizard src/domain/**/*.ts

# Verbose output
lizard -V src/
```

**Setting Thresholds:**

```bash
# Set cyclomatic complexity threshold (default: 15)
lizard -C 10 src/

# Set parameter count threshold (default: 100)
lizard -a 5 src/

# Set threshold for any field
lizard -T nloc=25 src/
lizard -T cyclomatic_complexity=10 src/
lizard -T parameter_count=5 src/
```

**Excluding Files:**

```bash
# Exclude test files
lizard src/ -x"./tests/*"

# Exclude multiple patterns
lizard src/ -x"./tests/*" -x"./node_modules/*" -x"./*.d.ts"
```

#### 8.5 Output Formats

Lizard supports multiple output formats for different use cases:

```bash
# Default tabular output
lizard src/

# XML output (cppncss style)
lizard -X src/ > complexity.xml
lizard --xml src/ > complexity.xml

# CSV output
lizard --csv src/ > complexity.csv

# HTML report (interactive, sortable, filterable)
lizard -H src/ -o complexity.html
lizard --html src/ -o complexity.html

# Checkstyle XML (for Jenkins integration)
lizard --checkstyle src/ > checkstyle.xml
```

**Output format is inferred from file extension:**

```bash
# Automatically uses HTML format
lizard src/ -o report.html

# Automatically uses XML format
lizard src/ -o report.xml
```

#### 8.6 Extensions

Lizard has a plugin system for additional metrics:

```bash
# Duplicate/clone detection
lizard -Eduplicate src/

# Nesting depth analysis
lizard -Ens src/

# Word count / tag cloud generation
lizard -EWordCount src/
```

#### 8.7 Example Usage for This TypeScript Codebase

```bash
# Basic analysis of source code
lizard src/ netlify/

# With thresholds matching ESLint complexity rule
lizard -C 10 -a 4 src/ netlify/ -x"./src/**/*.types.ts" -x"./src/**/*.dto.ts"

# Generate HTML report
lizard src/ netlify/ -o .scratch/complexity-report.html

# Generate Checkstyle XML for CI
lizard -C 10 --checkstyle src/ netlify/ > complexity-checkstyle.xml

# Full analysis with all extensions
lizard -Ens -Eduplicate src/ netlify/
```

#### 8.8 Sample npm Script

Add to `package.json`:

```json
{
  "scripts": {
    "complexity:lizard": "lizard -C 10 -a 4 src/ netlify/ -x'./src/**/*.types.ts' -x'./src/**/*.dto.ts' -x'./src/**/*.port.ts'",
    "complexity:lizard:html": "lizard src/ netlify/ -o .scratch/complexity-report.html",
    "complexity:lizard:ci": "lizard -C 10 --checkstyle src/ netlify/ > complexity-checkstyle.xml"
  }
}
```

#### 8.9 CI Integration

**Exit Codes:**
- Lizard exits with non-zero status if any function exceeds configured thresholds
- This makes it suitable for CI pipeline failure triggers

**GitHub Actions Example:**

```yaml
- name: Install Lizard
  run: pip install lizard

- name: Check Complexity
  run: lizard -C 10 -a 4 src/ netlify/
```

**Pre-commit Hook:**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: lizard
        name: Check cyclomatic complexity
        entry: lizard -C 10
        language: system
        types: [typescript, javascript]
        pass_filenames: true
```

**Jenkins Integration:**
Use `--checkstyle` output format for integration with Jenkins Checkstyle plugin.

#### 8.10 Source Code Comments

Lizard supports inline forgiveness for specific functions:

```typescript
// lizard forgives
function complexLegacyFunction() {
  // This function is exempt from complexity checks
}

// Forgive specific metrics
// lizard forgives(cyclomatic_complexity, parameter_count)
function anotherFunction(a, b, c, d, e, f) {
  // Only cyclomatic_complexity and parameter_count are forgiven
}
```

---

### 9. CodeClimate CLI

CodeClimate CLI allows running Code Climate analysis engines locally via Docker containers.

**Primary Sources:**
- [CodeClimate CLI - GitHub](https://github.com/codeclimate/codeclimate)
- [CodeClimate Documentation](https://docs.codeclimate.com/)

#### 9.1 Installation

```bash
# macOS (Homebrew)
brew tap codeclimate/formulae
brew install codeclimate

# Any platform (requires Docker)
curl -L https://github.com/codeclimate/codeclimate/archive/master.tar.gz | tar xvz
cd codeclimate-* && sudo make install
```

**Prerequisites:** Docker must be installed and running.

#### 9.2 Usage

```bash
# Initialize configuration
codeclimate init

# Install required engines
codeclimate engines:install

# Run analysis
codeclimate analyze

# Run with specific engines
codeclimate analyze -e duplication -e structure
```

#### 9.3 Configuration (.codeclimate.yml)

```yaml
version: "2"
plugins:
  duplication:
    enabled: true
    config:
      languages:
        - javascript
        - typescript
  structure:
    enabled: true
checks:
  argument-count:
    config:
      threshold: 4
  complex-logic:
    config:
      threshold: 10
  method-complexity:
    config:
      threshold: 10
  method-count:
    config:
      threshold: 20
  method-lines:
    config:
      threshold: 25
exclude_patterns:
  - "node_modules/"
  - "**/*.test.ts"
  - "**/*.spec.ts"
```

#### 9.4 Limitations

- Requires Docker (adds infrastructure complexity)
- Slower than native tools
- Analysis engines run in containers

**Recommendation:** For this project, native tools (ESLint, Lizard, escomplex) are more practical than CodeClimate CLI due to the Docker dependency.

---

### 10. Understand by SciTools

Understand is a commercial static analysis tool with comprehensive complexity metrics.

**Primary Sources:**
- [SciTools Understand](https://scitools.com/understand)
- [Code Metrics Documentation](https://scitools.com/metrics)

#### 10.1 Features

- Cyclomatic complexity, coupling, cohesion, 50+ metrics
- Interactive treemap visualizations
- CodeCheck for automated standards enforcement
- CLI, API, and CI integration
- Python scripting API

#### 10.2 Supported Languages

Ada, C, C++, C#, Fortran, Java, JavaScript, JOVIAL, Pascal, Python, VHDL, Cobol, and web languages.

#### 10.3 Limitations

- **Commercial license required** (not free)
- Desktop application with CLI tools
- Overkill for small to medium projects

**Recommendation:** Not recommended for this project due to commercial licensing. Use free alternatives (Lizard, escomplex, ESLint).

---

### 11. Radon (Python Reference)

Radon is a Python complexity analyzer, included here for comparison since Lizard is also Python-based.

**Primary Sources:**
- [Radon - GitHub](https://github.com/rubik/radon)
- [Radon Documentation](https://radon.readthedocs.io/en/latest/)
- [Radon - PyPI](https://pypi.org/project/radon/)

#### 11.1 Installation

```bash
pip install radon
```

#### 11.2 Commands

```bash
# Cyclomatic complexity
radon cc src/ -a -s

# Raw metrics (SLOC, comments, etc.)
radon raw src/

# Halstead complexity metrics
radon hal src/

# Maintainability Index
radon mi src/
```

#### 11.3 Metrics

| Command | Metrics |
|---------|---------|
| `radon cc` | Cyclomatic Complexity (A-F grades) |
| `radon raw` | SLOC, comments, blanks |
| `radon hal` | Halstead volume, difficulty, effort |
| `radon mi` | Maintainability Index (0-100) |

**Note:** Radon only analyzes Python code. For TypeScript/JavaScript, use Lizard, escomplex, or ESLint.

---

### 12. complexity-report (npm)

A Node.js wrapper around escomplex for JavaScript complexity analysis.

**Primary Sources:**
- [complexity-report - npm](https://www.npmjs.com/package/complexity-report)
- [complexity-report - GitHub](https://github.com/jared-stilwell/complexity-report)

#### 12.1 Status

- **Last published:** 10 years ago (2.0.0-alpha)
- **Status:** Unmaintained

#### 12.2 Installation

```bash
npm install -g complexity-report
```

#### 12.3 Usage

```bash
# Analyze file
cr -f json src/index.js

# Set cyclomatic complexity threshold
cr -C 10 src/
```

**Recommendation:** Not recommended. Use escomplex directly (already installed in this project) or typhonjs-escomplex for better TypeScript support.

---

### 13. Tool Comparison Matrix

#### 13.1 Lizard vs ESLint Complexity Rules

| Aspect | Lizard | ESLint `complexity` Rule |
|--------|--------|--------------------------|
| **Language Support** | 25+ languages | JavaScript/TypeScript only |
| **Integration** | CLI, CI pipelines | Editor, build process, CI |
| **Feedback Speed** | Batch analysis | Real-time in editor |
| **Additional Metrics** | NLOC, tokens, params, nesting | None (complexity only) |
| **Configuration** | CLI flags, thresholds | ESLint config files |
| **Inline Suppression** | Comment-based forgiveness | `eslint-disable` comments |
| **Duplicate Detection** | Yes (extension) | No |
| **Best For** | Multi-language, CI gates | Single-language, editor feedback |

#### 13.2 Lizard vs SonarQube

| Aspect | Lizard | SonarQube |
|--------|--------|-----------|
| **Complexity Types** | Cyclomatic only | Cyclomatic + Cognitive |
| **Setup Effort** | pip install | Server deployment |
| **Cost** | Free | Free (Community) / Paid (Enterprise) |
| **Additional Analysis** | Duplicate detection | Security, bugs, code smells |
| **Dashboard** | None (CLI output) | Web-based dashboards |
| **Best For** | Quick complexity checks | Enterprise code quality |

#### 13.3 Lizard vs escomplex

| Aspect | Lizard | escomplex |
|--------|--------|-----------|
| **Language Support** | 25+ languages | JavaScript/TypeScript |
| **Metrics** | CCN, NLOC, tokens, params | CCN, Halstead, MI, effort |
| **Installation** | pip (Python) | npm (Node.js) |
| **Maintainability Index** | No | Yes |
| **Halstead Metrics** | No | Yes |
| **Best For** | Multi-language CCN | Deep JS/TS analysis |

#### 13.4 When to Use Each Tool

| Scenario | Recommended Tool |
|----------|-----------------|
| Quick complexity check | `lizard -C 10 src/` |
| Editor real-time feedback | ESLint `complexity` rule |
| Maintainability analysis | escomplex |
| Cognitive complexity | eslint-plugin-sonarjs |
| Multi-language codebase | Lizard |
| Enterprise dashboards | SonarQube |
| CI gate for complexity | Lizard or ESLint |

---

### 14. Output Interpretation

#### 14.1 Lizard Output Example

```
================================================
  NLOC    CCN   token  PARAM  length  location
------------------------------------------------
      15     3     120      2      20  handleRequest@12-31@src/api.ts
      25    12     280      5      35  processData@40-74@src/domain.ts
      10     1      80      1      12  validate@80-91@src/utils.ts
------------------------------------------------
2 file(s) analyzed.
==============================================================
No thresholds exceeded (cyclomatic_complexity > 15)
==============================================================
```

**Column Meanings:**
- **NLOC:** Non-comment lines of code in the function
- **CCN:** Cyclomatic Complexity Number
- **token:** Total token count
- **PARAM:** Number of parameters
- **length:** Total lines including comments/blanks
- **location:** function@start-end@file

#### 14.2 Warning Output

When thresholds are exceeded:

```
!!!! Warnings (cyclomatic_complexity > 10) !!!!
================================================
  NLOC    CCN   token  PARAM  length  location
------------------------------------------------
      25    12     280      5      35  processData@40-74@src/domain.ts
================================================
```

---

### 15. Recommended Setup for This Codebase

#### 15.1 Hybrid Approach

Use multiple tools for comprehensive coverage:

1. **ESLint** - Real-time editor feedback for cyclomatic and cognitive complexity
2. **Lizard** - CI gate for complexity thresholds (language-agnostic)
3. **escomplex** - Deep analysis with maintainability index

#### 15.2 Updated npm Scripts

```json
{
  "scripts": {
    "complexity": "node --experimental-strip-types scripts/run-complexity.ts src/**/*.ts",
    "complexity:lizard": "lizard -C 10 -a 4 src/ netlify/ -x'./src/**/*.types.ts' -x'./src/**/*.dto.ts' -x'./src/**/*.port.ts'",
    "complexity:check": "eslint src netlify --rule 'complexity: [error, 10]'",
    "quality": "npm run lint && npm run complexity:lizard && npm run coverage"
  }
}
```

#### 15.3 CI Pipeline Integration

```yaml
# GitHub Actions workflow
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.x'

      - name: Install dependencies
        run: |
          npm ci
          pip install lizard

      - name: Lint
        run: npm run lint

      - name: Complexity Check (Lizard)
        run: lizard -C 10 -a 4 src/ netlify/ -x"./src/**/*.types.ts"

      - name: Test with Coverage
        run: npm run coverage
```

---

### 16. Additional Primary Source Citations

#### Official Documentation

14. **Lizard - GitHub**: [https://github.com/terryyin/lizard](https://github.com/terryyin/lizard)
15. **Lizard - PyPI**: [https://pypi.org/project/lizard/](https://pypi.org/project/lizard/)
16. **Lizard README**: [https://github.com/terryyin/lizard/blob/master/README.rst](https://github.com/terryyin/lizard/blob/master/README.rst)
17. **CodeClimate CLI**: [https://github.com/codeclimate/codeclimate](https://github.com/codeclimate/codeclimate)
18. **SciTools Understand**: [https://scitools.com/understand](https://scitools.com/understand)
19. **SciTools Metrics**: [https://scitools.com/metrics](https://scitools.com/metrics)
20. **Radon - GitHub**: [https://github.com/rubik/radon](https://github.com/rubik/radon)
21. **Radon Documentation**: [https://radon.readthedocs.io/en/latest/](https://radon.readthedocs.io/en/latest/)
22. **complexity-report - npm**: [https://www.npmjs.com/package/complexity-report](https://www.npmjs.com/package/complexity-report)

#### Comparison Resources

23. **SonarQube vs ESLint**: [https://stackshare.io/stackups/eslint-vs-sonarqube](https://stackshare.io/stackups/eslint-vs-sonarqube)
24. **Lizard on Codacy**: [https://blog.codacy.com/lizard-codacys-new-code-complexity-analysis-tool](https://blog.codacy.com/lizard-codacys-new-code-complexity-analysis-tool)
