# Netlify Functions Local Development Research

**Status**: Complete
**Date**: 2026-11-02
**Sources**: Official Netlify Documentation (Primary Sources Only)

---

## Executive Summary

Netlify functions **can be run locally** using the Netlify CLI's `netlify dev` command. The `netlify.toml` file plays a central role in configuring both production and local development environments, including function directory location, bundling options, and local dev server settings.

---

## 1. Can Netlify Functions Be Run Locally?

**Yes.** Netlify provides multiple approaches for local function development:

### Option A: Framework-Native Development (Recommended for Vite-based frameworks)

For Vite-based frameworks (Astro, Nuxt, TanStack Start, React Router), install the Netlify Vite plugin:

```bash
npm install @netlify/vite-plugin
```

Then run the standard framework dev server:

```bash
npm run dev
```

> "The plugin emulates the Netlify platform locally, so functions, edge functions, blobs, environment variables, and other primitives behave identically to production."
>
> Source: [Netlify Functions Get Started](https://docs.netlify.com/functions/get-started/)

### Option B: Netlify CLI (Recommended for Next.js and non-Vite frameworks)

Install the Netlify CLI:

```bash
npm install -D @netlify/cli
```

Run local development:

```bash
netlify dev
```

> "The CLI starts a framework server (if detected), handles redirects and proxy rules, manages environment variables, and emulates Netlify Functions through a simulated Netlify production environment."
>
> Source: [Netlify Functions Get Started](https://docs.netlify.com/functions/get-started/)

---

## 2. Role of `netlify.toml` in Local Function Development

The `netlify.toml` file is the primary configuration mechanism for both production deployments and local development. It contains two key sections relevant to functions:

### The `[functions]` Block

Configures function behavior for both local and production environments:

```toml
[functions]
  # Custom directory for functions (default: netlify/functions)
  directory = "netlify/functions"

  # Bundle method: esbuild (faster) or zisi (default for JS)
  node_bundler = "esbuild"

  # Node modules to exclude from bundling
  external_node_modules = ["mongoose", "mongodb"]

  # Additional files to include in function bundles
  included_files = ["files/*.md"]
```

> Source: [Netlify File-Based Configuration](https://docs.netlify.com/configure-builds/file-based-configuration/)

### Function-Specific Configuration

You can configure individual functions or use pattern matching:

```toml
# Pattern-based configuration
[functions."api_*"]
  external_node_modules = ["package-2"]

# Specific function configuration
[functions.api_payment]
  external_node_modules = ["package-3", "package-4"]
  region = "dub"
```

> Source: [Netlify Functions Optional Configuration](https://docs.netlify.com/functions/optional-configuration/)

### The `[dev]` Block

Configures **local development specifically**:

```toml
[dev]
  # Command to start your development server
  command = "yarn start"

  # Port for Netlify Dev access (default: 8888)
  port = 8888

  # Port for your application server/framework
  targetPort = 3000

  # Port where Netlify Dev serves functions
  functionsPort = 3001

  # Path to static content folder
  publish = "dist"

  # Framework detection: #auto, #static, or #custom
  framework = "#custom"

  # Auto-launch browser
  autoLaunch = true

  # JWT configuration for local dev
  jwtRolePath = "app_metadata.authorization.roles"
  jwtSecret = "MY_JWT_SECRET_VALUE"

  # HTTPS for local development
  [dev.https]
    certFile = "cert.pem"
    keyFile = "key.pem"
```

> Source: [Netlify File-Based Configuration](https://docs.netlify.com/configure-builds/file-based-configuration/)

---

## 3. CLI Commands for Running Functions Locally

### Primary Command: `netlify dev`

```bash
netlify dev
```

This command:
- Starts a local development server
- Proxies requests with edge logic
- Applies custom headers and redirects
- Loads environment variables
- Serves Netlify Functions

> "This command starts a local development server that brings Netlify production functionality to your local machine, including Netlify Functions."
>
> Source: [Netlify CLI Local Development](https://docs.netlify.com/cli/local-development/)

### Running with Different Deploy Context

```bash
netlify dev --context production
```

> Source: [Netlify CLI Local Development](https://docs.netlify.com/cli/local-development/)

### Executing Commands in Dev Environment

```bash
netlify dev:exec YOUR_SHELL_COMMAND
```

> Source: [Netlify CLI Local Development](https://docs.netlify.com/cli/local-development/)

### Invoking Functions Directly

```bash
netlify functions:invoke <function-name>
```

> "This invokes the function once immediately for debugging."
>
> Source: [Netlify Scheduled Functions](https://docs.netlify.com/functions/scheduled-functions/)

### Monorepo Support

```bash
netlify dev --filter website
netlify dev --filter packages/website
```

> Source: [Netlify CLI Get Started](https://docs.netlify.com/cli/get-started/)

### Debugging

```bash
# macOS/Linux
DEBUG=* netlify dev

# Windows PowerShell
$env:DEBUG='*'; netlify dev
```

> Source: [Netlify CLI Get Started](https://docs.netlify.com/cli/get-started/)

---

## 4. Local Development vs. Deployed Environment Differences

### Environment Variables

| Aspect | Local Development | Production |
|--------|-------------------|------------|
| Context | `Local development` context | `Production`, `Deploy Preview`, or `Branch deploy` context |
| Secret marking | Cannot be marked as secret | Can be marked as secret |
| Source | From linked site + `[context.dev.environment]` in netlify.toml | From Netlify UI/CLI/API + netlify.toml |

> "The `Local development` context is specifically for developers using `netlify dev`."
>
> Source: [Netlify Environment Variables Overview](https://docs.netlify.com/environment-variables/overview/)

### Context Object Availability

| Property | Local Dev | Production |
|----------|-----------|------------|
| `context.user` | **Not available** | Available (for functions deployed after October 5, 2026) |
| `context.geo` | Simulated/limited | Full geolocation data |
| `context.site` | Available | Available |
| `context.params` | Available | Available |

> "`user` context is available for functions deployed after October 5, 2026; not available locally with Netlify CLI"
>
> Source: [Netlify Functions API](https://docs.netlify.com/functions/api/)

### Scheduled Functions

| Aspect | Local Development | Production |
|--------|-------------------|------------|
| Automatic scheduling | **Does not run on schedule** | Runs on configured schedule |
| Manual invocation | Via `netlify functions:invoke` | Via "Run now" button in UI |
| Deploy context | N/A | Only published deploys (not previews) |

> "Scheduled functions do not run on a schedule during local development."
>
> Source: [Netlify Scheduled Functions](https://docs.netlify.com/functions/scheduled-functions/)

### Function Execution

| Aspect | Local Development | Production |
|--------|-------------------|------------|
| Cold starts | Faster (local process) | AWS Lambda cold start applies |
| Region | Local machine | Configured region (default: `cmh`) |
| Memory/vCPU | Local resources | Configured limits (default: 1024 MB) |
| Logging | Console output | Netlify logging system with retention |

### Bundling

| Aspect | Local Development | Production |
|--------|-------------------|------------|
| esbuild bundling | Applied | Applied |
| External modules | Respected | Respected |
| Included files | Respected | Respected |

---

## 5. Configuration Options Specifically for Local Development

### `[dev]` Block Options

| Option | Description | Default |
|--------|-------------|---------|
| `command` | Command to start your dev server | Auto-detected |
| `port` | Port for Netlify Dev access | `8888` |
| `targetPort` | Port for application server | Auto-detected |
| `functionsPort` | Port for serving functions | `3001` |
| `publish` | Path to static content folder | From `[build]` |
| `framework` | Framework detection override | `#auto` |
| `autoLaunch` | Auto-launch browser | `true` |
| `jwtRolePath` | Object path for JWT role values | N/A |
| `jwtSecret` | Secret for JWT verification | N/A |

> Source: [Netlify File-Based Configuration](https://docs.netlify.com/configure-builds/file-based-configuration/)

### Local Development Environment Variables

Use the `[context.dev.environment]` block (NOT `[dev.environment]`):

```toml
[context.dev.environment]
  NODE_ENV = "development"
  API_BASE_URL = "http://localhost:8888"
```

> "Use `[context.dev.environment]` for local Netlify Dev variables, NOT `[dev.environment]` (which doesn't exist)."
>
> Source: [Netlify File-Based Configuration](https://docs.netlify.com/configure-builds/file-based-configuration/)

### HTTPS Configuration

```toml
[dev]
  [dev.https]
    certFile = "cert.pem"
    keyFile = "key.pem"
```

> Source: [Netlify CLI Local Development](https://docs.netlify.com/cli/local-development/)

---

## Function File Structure

Functions can be organized with several naming patterns:

```
netlify/functions/
  hello.mts              # TypeScript ES module
  hello.mjs              # JavaScript ES module
  hello/index.mts        # Directory with index file
  hello/hello.mts        # Directory with named file
```

### In-Code Configuration (Functions v2)

```typescript
import type { Config, Context } from "@netlify/functions"

export default async (req: Request, context: Context) => {
  return new Response("Hello, world!")
}

export const config: Config = {
  path: "/api/hello",
  method: ["GET", "POST"],
}
```

> Source: [Netlify Functions Get Started](https://docs.netlify.com/functions/get-started/)

---

## Current Project Configuration

The existing `netlify.toml` in this repository:

```toml
[build]
  command = "npm run typecheck"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
  external_node_modules = ["mongoose", "mongodb"]
```

### Recommended Additions for Local Development

```toml
[dev]
  port = 8888
  functionsPort = 9999
  autoLaunch = false

[context.dev.environment]
  NODE_ENV = "development"
```

---

## References

All citations are from official Netlify documentation:

1. [Netlify CLI Local Development](https://docs.netlify.com/cli/local-development/)
2. [Netlify Functions Get Started](https://docs.netlify.com/functions/get-started/)
3. [Netlify File-Based Configuration](https://docs.netlify.com/configure-builds/file-based-configuration/)
4. [Netlify Functions Overview](https://docs.netlify.com/functions/overview/)
5. [Netlify Environment Variables Overview](https://docs.netlify.com/environment-variables/overview/)
6. [Netlify Functions API](https://docs.netlify.com/functions/api/)
7. [Netlify Functions Optional Configuration](https://docs.netlify.com/functions/optional-configuration/)
8. [Netlify Scheduled Functions](https://docs.netlify.com/functions/scheduled-functions/)
9. [Netlify CLI Get Started](https://docs.netlify.com/cli/get-started/)
