# 18 - Deploying Diabe-Teach to Netlify: Production Deployment Guide & Primary-Source Architecture

Dated research note (**2026-10-25**) establishing the authoritative deployment guide and operational configuration for running the **Diabe-Teach** Hexagonal DDD backend on **Netlify Functions v2** with **MongoDB Atlas**.

---

## 1. Executive Summary & Deployment Architecture

Diabe-Teach is architected as a serverless backend operating entirely via a single Netlify Functions v2 entrypoint ([`netlify/functions/api.ts`](file:///Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/netlify/functions/api.ts)) mounted centrally at `/api/v1/*`.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Netlify Edge Network                          │
│                                                                        │
│   HTTP GET /api/v1/packs/diabe-teach                                   │
│   Headers: x-api-key: <key>, Authorization: Bearer <token>            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│           AWS Lambda MicroVM (Netlify Functions v2 Container)          │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ netlify/functions/api.ts (export default handler)              │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │ src/app-runtime.ts (AppRuntime Composition Root)               │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │ src/adapters/inbound/http/create-app.ts (OpenApiHttpApp)       │   │
│   │ ├─ docs/api/openapi.yaml (included_files via esbuild)          │   │
│   │ ├─ ApiKeyAuth Security Handler (x-api-key)                     │   │
│   │ └─ operationId Dispatch: getCurriculumPackById                 │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │ src/application/use-cases/get-curriculum-pack-by-id.use-case.ts│   │
│   └───────────────┬───────────────────────────────┬────────────────┘   │
│                   │                               │                    │
│                   ▼                               ▼                    │
│   ┌──────────────────────────────┐ ┌───────────────────────────────┐   │
│   │ MongoCurriculumPackRepository│ │ HmacCapabilityTokenAdapter    │   │
│   │ (Mongoose Outbound Adapter)  │ │ (HMAC-SHA256 Token Verifier)  │   │
│   └───────────────┬──────────────┘ └───────────────────────────────┘   │
│                   │                                                    │
│   ┌───────────────▼──────────────┐                                     │
│   │ MongoConnectionManager       │                                     │
│   │ (Warm-Pool Singleton Cache)  │                                     │
│   └───────────────┬──────────────┘                                     │
└───────────────────┼────────────────────────────────────────────────────┘
                    │ SSL/TLS (maxPoolSize: 5)
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      MongoDB Atlas Cloud Cluster                       │
│                                                                        │
│   Database: diabe_teach                                                │
│   Collection: curriculum_packs (seeded with diabe-teach aggregate)     │
│   Collection: game_sessions (optimistic concurrency OCC versioning)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Primary-Source Technical Foundations

All deployment configurations adhere to official first-party documentation:

1. **Netlify Functions v2 Standards ([Netlify Docs: Functions Overview](https://docs.netlify.com/functions/overview/))**:
   - Modern Web Standards: Handlers consume native WHATWG `Request` and return standard `Response`.
   - In-Source Route Declaration: [`export const config: Config`](file:///Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/netlify/functions/api.ts#L6-L9) specifies `{ path: "/api/v1/*", method: ["GET", "POST", "PUT", "PATCH", "DELETE"] }`.
   - Wildcard Catch-All Routing: Netlify forwards all subpaths to [`api.ts`](file:///Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/netlify/functions/api.ts) where [`OpenApiHttpApp`](file:///Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/src/adapters/inbound/http/create-app.ts) dispatches based on the OpenAPI contract.
2. **Dynamic Asset Inclusion ([Netlify Docs: File-Based Configuration](https://docs.netlify.com/configure-builds/file-based-configuration/))**:
   - [`included_files = ["docs/api/openapi.yaml"]`](file:///Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/netlify.toml#L7) directs the `esbuild` bundler to package the OpenAPI definition into the Lambda deployment bundle so [`openapi-backend`](file:///Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/src/adapters/inbound/http/create-app.ts#L44) can parse it at runtime.
3. **Database Driver Isolation ([Netlify Docs: Functions Optional Configuration](https://docs.netlify.com/functions/optional-configuration/#external-node-modules))**:
   - `external_node_modules = ["mongoose", "mongodb"]` prevents `esbuild` from inlining driver internals or breaking CJS dynamic requires.
4. **Serverless Connection Management ([MongoDB Atlas Best Practices](https://www.mongodb.com/docs/atlas/manage-connections-aws-lambda/))**:
   - [`MongoConnectionManager`](file:///Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/src/adapters/outbound/mongo-client-singleton.ts) maintains a cached `Promise<Connection>` with `maxPoolSize: 5` and `serverSelectionTimeoutMS: 5000` to prevent connection storms across container reuses.

---

## 3. Required Environment Variables

Before deploying, configure the following environment variables in the Netlify Dashboard (**Site configuration** $\to$ **Environment variables**) or via the Netlify CLI:

| Variable Name | Required | Default / Example | Purpose |
|---|---|---|---|
| `MONGODB_URI` | **Yes** | `mongodb+srv://<user>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority` | Connection string for MongoDB Atlas cluster. |
| `MONGODB_DB_NAME` | No | `diabe_teach` | Database name within the MongoDB cluster. |
| `CAPABILITY_TOKEN_SECRET` | **Yes** | `c2VjcmV0LWtleS0zMi1jaGFyYWN0ZXJzLWxvbmctZXhhbXBsZQ==` | High-entropy secret for HMAC-SHA256 signature and verification of `instructorToken` and `participantToken`. |
| `API_KEY` | Recommended | `prod-client-api-key-9b7a4f` | Shared client secret validated against the `x-api-key` header (`ApiKeyAuth` security scheme). |
| `NODE_VERSION` | Recommended | `20` or `22` | Node.js runtime version for the Netlify build container and Lambda execution environment. |

> [!IMPORTANT]
> **Fail-Closed Security**: If `API_KEY` is set, all incoming requests without a valid `x-api-key` header are rejected with `401 UNAUTHORIZED_TOKEN` before reaching use-case handlers. If `MONGODB_URI` is omitted, attempts to query packs or mutate sessions fail fast with an explicit error.

---

## 4. Pre-Deployment Step: MongoDB Atlas Setup & Database Seeding

Because `MongoCurriculumPackRepository` operates with **pure database persistence** (no built-in packs hardcoded in memory, Ticket 12), the `curriculum_packs` collection must be seeded before user traffic arrives.

### Step 4.1: MongoDB Atlas Network Access Configuration
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Navigate to **Security** $\to$ **Network Access**.
3. Click **Add IP Address**.
4. Select **Allow Access from Anywhere** (`0.0.0.0/0`).
   > *Note:* AWS Lambda microVMs execute on dynamic IP addresses. For serverless platforms like Netlify, Atlas IP whitelist must allow `0.0.0.0/0`. Security is enforced via strong database user credentials and TLS connection encryption.
5. Navigate to **Security** $\to$ **Database Access** and verify that the database user has `readWrite` access to the `diabe_teach` database.

### Step 4.2: Run the Idempotent Database Seed Script
Run the seed script locally against your Atlas connection URI:

```bash
MONGODB_URI="mongodb+srv://<user>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority" \
MONGODB_DB_NAME="diabe_teach" \
npm run db:seed
```

**Output:**
```
Successfully seeded 1 Curriculum Pack(s) into MongoDB: [diabe-teach]
```

This writes the complete 49-card, 7-domain `DIABE_TEACH_PACK` into the `curriculum_packs` collection using an atomic `replaceOne({ _id: "diabe-teach" }, doc, { upsert: true })`.

---

## 5. Deployment Methods

### Option A: Continuous Deployment via GitHub (Recommended)

1. **Commit and Push Code to GitHub**:
   ```bash
   git add -A
   git commit -m "feat: prepare production deployment"
   git push origin main
   ```

2. **Connect Repository to Netlify**:
   - Go to [app.netlify.com](https://app.netlify.com/) and click **Add new site** $\to$ **Import an existing project**.
   - Authorize GitHub and select the `diabe-teach` repository.

3. **Configure Build Settings**:
   - **Base directory**: (leave blank, project root)
   - **Build command**: `npm run typecheck`
   - **Publish directory**: (leave blank or `.`)
   - **Functions directory**: `netlify/functions` (auto-detected via `netlify.toml`)

4. **Add Environment Variables**:
   - Under **Site configuration** $\to$ **Environment variables**, click **Add a variable** or **Import from .env** and supply:
     - `MONGODB_URI`
     - `MONGODB_DB_NAME` (`diabe_teach`)
     - `CAPABILITY_TOKEN_SECRET`
     - `API_KEY`
     - `NODE_VERSION` (`20`)

5. **Deploy**:
   - Click **Deploy diabe-teach**. Netlify will run `npm run typecheck`, bundle [`netlify/functions/api.ts`](file:///Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/netlify/functions/api.ts) with `esbuild`, include `docs/api/openapi.yaml`, and publish your live endpoint.

---

### Option B: Direct Terminal Deployment via Netlify CLI

If deploying from a terminal or CI pipeline without linking GitHub:

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Authenticate & Link Site**:
   ```bash
   netlify login
   netlify init
   ```

3. **Set Environment Variables on the Linked Site**:
   ```bash
   netlify env:set MONGODB_URI "mongodb+srv://<user>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority"
   netlify env:set MONGODB_DB_NAME "diabe_teach"
   netlify env:set CAPABILITY_TOKEN_SECRET "your-long-secure-secret-here"
   netlify env:set API_KEY "your-production-api-key"
   netlify env:set NODE_VERSION "20"
   ```

4. **Deploy Directly to Production**:
   ```bash
   netlify deploy --build --prod
   ```

---

### Option C: Local Serverless Simulation via Netlify Dev

To test the exact Netlify Functions v2 runtime and OpenAPI routing locally:

```bash
MONGODB_URI="mongodb+srv://..." \
CAPABILITY_TOKEN_SECRET="local-secret" \
API_KEY="local-key" \
npx netlify dev
```

Netlify CLI starts a local HTTP emulator (default: `http://localhost:8888`) compiling TypeScript functions on-the-fly.

---

## 6. Post-Deployment Verification & Smoke Tests

Once deployed, verify the endpoints against your live Netlify site URL (e.g., `https://diabe-teach.netlify.app`):

### 1. Anonymous Access (Role-Aware Answer-Key Redacted)
```bash
curl -i -X GET "https://<your-site>.netlify.app/api/v1/packs/diabe-teach" \
  -H "x-api-key: <your-api-key>"
```

**Expected Response**:
- HTTP `200 OK`
- JSON payload containing 49 cards, 7 domains, adjudication rubric.
- In `assessmentInstrument.questions`, `correctIndex` and `explanation` are redacted (`undefined`).

### 2. Instructor Access (Full Answer-Key Included)
```bash
curl -i -X GET "https://<your-site>.netlify.app/api/v1/packs/diabe-teach" \
  -H "x-api-key: <your-api-key>" \
  -H "Authorization: Bearer <valid-instructor-token>"
```

**Expected Response**:
- HTTP `200 OK`
- Assessment questions contain `correctIndex` and `explanation`.

### 3. Missing API Key Rejection (Fail-Closed Security)
```bash
curl -i -X GET "https://<your-site>.netlify.app/api/v1/packs/diabe-teach"
```

**Expected Response**:
- HTTP `401 Unauthorized`
- Body:
  ```json
  {
    "code": "UNAUTHORIZED_TOKEN",
    "message": "Missing or invalid x-api-key header."
  }
  ```

### 4. Non-Existent Route (Central OpenAPI 404)
```bash
curl -i -X GET "https://<your-site>.netlify.app/api/v1/non-existent-route" \
  -H "x-api-key: <your-api-key>"
```

**Expected Response**:
- HTTP `404 Not Found`

---

## 7. Operational Best Practices & Troubleshooting

### Cold Starts & Warm Invocation Reuse
- Netlify Functions v2 keeps Lambda containers warm for subsequent requests.
- [`MongoConnectionManager`](file:///Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/src/adapters/outbound/mongo-client-singleton.ts) caches the Mongoose connection promise module-wide.
- First invocation takes ~300–600ms (TLS handshake + Mongoose schema registration); subsequent warm invocations execute in **< 15ms**.

### Bundling Configuration Checklist (`netlify.toml`)
Ensure [`netlify.toml`](file:///Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/netlify.toml) includes both `included_files` and `external_node_modules`:

```toml
[build]
  command = "npm run typecheck"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
  included_files = ["docs/api/openapi.yaml"]
  external_node_modules = ["mongoose", "mongodb"]
```

### Common Errors & Resolutions
| Error / Symptom | Root Cause | Fix |
|---|---|---|
| `Cannot find module 'docs/api/openapi.yaml'` | `included_files` missing in `netlify.toml`. | Add `included_files = ["docs/api/openapi.yaml"]` under `[functions]`. |
| `MongoServerSelectionError: connection timed out` | Atlas Network Access blocking Lambda IPs. | In Atlas, add `0.0.0.0/0` to Network Access IP List. |
| `401 UNAUTHORIZED_TOKEN: Missing or invalid x-api-key header` | Client request omitted `x-api-key`. | Pass `x-api-key: <API_KEY>` header in client requests. |
| `404 PACK_NOT_FOUND` on `/api/v1/packs/diabe-teach` | Database has not been seeded. | Run `npm run db:seed` with Atlas `MONGODB_URI`. |
