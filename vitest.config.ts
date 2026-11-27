import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/support/vitest-setup.ts"],
    environment: "node",
    // Two projects: "api" (the backend tests above, inherited with `extends: true`, in node) and "web"
    // (the standalone web/ package's React screen tests in jsdom, web/vitest.config.ts). `npm run test` runs both.
    workspace: [
      {
        extends: true,
        test: { name: "api" },
      },
      "web/vitest.config.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "netlify/**/*.ts"],
      exclude: ["**/*.types.ts", "**/*.dto.ts", "**/*.port.ts"],
    },
  },
});
