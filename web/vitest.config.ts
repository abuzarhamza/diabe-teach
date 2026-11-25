import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

// The web package's tests: React screens rendered in jsdom. The root `npm run test` runs them as the
// "web" project of its Vitest workspace; the backend tests keep their own node environment.
export default defineProject({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    react(),
  ],
  test: {
    name: "web",
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "./tests/support/jsdom-environment.ts",
    setupFiles: ["./tests/support/setup.ts"],
  },
});
