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
      name: "no-driving-to-driven-adapter-imports",
      comment:
        "Driving Adapters (src/adapters/driving) must not import Driven Adapters (src/adapters/driven) directly.",
      severity: "error",
      from: { path: "^src/adapters/driving/" },
      to: { path: "^src/adapters/driven/" },
    },
    {
      name: "no-driven-to-driving-adapter-imports",
      comment:
        "Driven Adapters (src/adapters/driven) must not import Driving Adapters (src/adapters/driving) directly.",
      severity: "error",
      from: { path: "^src/adapters/driven/" },
      to: { path: "^src/adapters/driving/" },
    },
    {
      name: "mongodb-isolated-to-driven-adapters-and-composition-root",
      comment:
        "The mongodb driver may only be imported inside Driven Adapters or the Netlify Composition Root.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: "^src/adapters/driven/",
      },
      to: {
        path: "node_modules/mongodb",
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
