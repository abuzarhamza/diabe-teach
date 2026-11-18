/**
 * Cucumber.js ESM configuration for TypeScript support.
 * @see https://github.com/cucumber/cucumber-js/blob/main/docs/esm.md
 */
export default {
  import: [
    "tests/integration/support/**/*.ts",
    "tests/integration/step-definitions/**/*.ts",
  ],
  format: [
    "progress-bar",
    "summary",
  ],
  paths: ["tests/integration/features/**/*.feature"],
  requireModule: [],
  publishQuiet: true,
};
