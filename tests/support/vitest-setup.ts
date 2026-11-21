import process from "node:process";

// Default vitest runs to silent API logging unless the caller sets LOG_LEVEL
// (for example `LOG_LEVEL=debug npx vitest run ...` while debugging a test).
process.env.LOG_LEVEL ??= "silent";
