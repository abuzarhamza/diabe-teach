/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-stays-pure",
      comment:
        "Domain Ring (src/domain) must remain 100% pure and cannot import from Application, Adapters, Netlify, or external packages.",
      severity: "error",
      from: { path: "^src/domain/" },
      to: {
        pathNot: "^src/domain/",
      },
    },
    {
      name: "application-depends-only-on-domain",
      comment:
        "Application Ring (src/application) may only import from src/application and src/domain.",
      severity: "error",
      from: { path: "^src/application/" },
      to: {
        pathNot: "^(src/application/|src/domain/)",
      },
    },
    {
      name: "no-inbound-to-outbound-adapter-imports",
      comment:
        "Inbound Adapters (src/adapters/inbound) must not import Outbound Adapters (src/adapters/outbound) directly.",
      severity: "error",
      from: { path: "^src/adapters/inbound/" },
      to: { path: "^src/adapters/outbound/" },
    },
    {
      name: "no-outbound-to-inbound-adapter-imports",
      comment:
        "Outbound Adapters (src/adapters/outbound) must not import Inbound Adapters (src/adapters/inbound) directly.",
      severity: "error",
      from: { path: "^src/adapters/outbound/" },
      to: { path: "^src/adapters/inbound/" },
    },
    {
      name: "mongodb-isolated-to-outbound-adapters",
      comment:
        "The mongodb driver and mongo-client-singleton may only be imported inside Outbound Adapters (src/adapters/outbound).",
      severity: "error",
      from: {
        pathNot: "^src/adapters/outbound/",
      },
      to: {
        path: "(node_modules/mongodb|^src/adapters/outbound/mongo-client-singleton)",
      },
    },
    {
      name: "config-is-only-composition-root-in-src",
      comment:
        "Domain, Application, Inbound Adapters, and Outbound Adapters must never import from src/config/.",
      severity: "error",
      from: {
        path: "^src/(domain|application|adapters)/",
      },
      to: {
        path: "^src/config/",
      },
    },
    {
      name: "netlify-sdk-isolated-to-composition-root",
      comment:
        "@netlify/functions may only be imported inside netlify/functions/** and never inside src/**.",
      severity: "error",
      from: {
        path: "^src/",
      },
      to: {
        path: "node_modules/@netlify/functions",
      },
    },
    {
      name: "no-circular",
      comment: "Circular dependencies are forbidden across all rings.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
