import type { ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_TARGET = "http://localhost:8888";

// Dev only. When the API is not running, Vite's proxy would answer an empty 500, so fetch would not
// reject and screens would say "Request failed (500)." Answer instead with the error body the HTTP
// client already reads (web/src/api/http-client.ts), so every screen shows its "can't reach the API"
// sentence. This listener is registered in `configure`, before Vite's own, which then sees the
// response already sent and only logs.
function answerApiUnreachable(res: ServerResponse): void {
  if (res.headersSent || res.writableEnded)
    return;
  res.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({
    code: "NETWORK_ERROR",
    message: `Can't reach the API at ${API_TARGET}. Start it with \`npm run dev:local\`.`,
    details: null,
  }));
}

export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (_error, _req, res) => {
            // `res` is a ServerResponse for HTTP requests and a Socket for WebSocket upgrades.
            if (res && "writeHead" in res)
              answerApiUnreachable(res);
          });
        },
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
