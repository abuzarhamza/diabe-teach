import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { App } from "../../src/App.tsx";
import { routes } from "../../src/routes.tsx";

// Renders the real app (real routes, real Query client) at `path`, the way a teacher's browser would open it.
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [path],
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const view = render(<App router={router} queryClient={queryClient} />);
  return { ...view, router };
}
