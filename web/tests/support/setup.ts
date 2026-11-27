import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Real jsdom storage, emptied between tests so no Account Token leaks from one test into the next.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
