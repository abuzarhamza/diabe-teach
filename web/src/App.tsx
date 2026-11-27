import type { QueryClient } from "@tanstack/react-query";
import type { DataRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";

interface AppProps {
  router: DataRouter;
  queryClient: QueryClient;
}

// The app shell: the Query client for server calls and the router for the screens (routes.tsx).
export function App({ router, queryClient }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
