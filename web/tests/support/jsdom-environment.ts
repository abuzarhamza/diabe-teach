// A jsdom test environment that loads jsdom from web/node_modules.
//
// Vitest's built-in "jsdom" environment imports jsdom from Vitest's own location (the root node_modules),
// but jsdom is a dependency of the standalone web/ package only. This file is loaded through Vite, so its
// `import "jsdom"` resolves from web/. It mirrors the built-in environment: one JSDOM window per test file,
// its globals copied onto Node's global with Vitest's populateGlobal, and Node's fetch family kept.
import type { Environment } from "vitest/environments";
import { JSDOM } from "jsdom";
import { populateGlobal } from "vitest/environments";

const NODE_GLOBALS_KEPT = [
  "structuredClone",
  "fetch",
  "Request",
  "Response",
  "Headers",
  "AbortController",
  "AbortSignal",
  "TextEncoder",
  "TextDecoder",
] as const;

const environment: Environment = {
  name: "web-jsdom",
  transformMode: "web",
  setup(global: Record<string | symbol, unknown>) {
    const dom = new JSDOM("<!DOCTYPE html>", { url: "http://localhost:5173/", pretendToBeVisual: true });
    const window = dom.window as unknown as Record<string, unknown>;
    for (const name of NODE_GLOBALS_KEPT) {
      if (global[name] !== undefined)
        window[name] = global[name];
    }
    const { keys, originals } = populateGlobal(global, dom.window, { bindFunctions: true });
    return {
      teardown(teardownGlobal: Record<string | symbol, unknown>) {
        keys.forEach(key => delete teardownGlobal[key]);
        originals.forEach((value, key) => {
          teardownGlobal[key] = value;
        });
        dom.window.close();
      },
    };
  },
};

export default environment;
