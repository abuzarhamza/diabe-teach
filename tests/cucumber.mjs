/**
 * Cucumber.js ESM configuration for TypeScript support.
 * @see https://github.com/cucumber/cucumber-js/blob/main/docs/esm.md
 */
export default {
  import: [
    "tests/support/**/*.ts",
    "tests/step-definitions/**/*.ts",
  ],
  format: [
    "progress-bar",
    "summary",
  ],
  paths: ["tests/features/**/*.feature"],
  requireModule: [],
  publishQuiet: true,
};
