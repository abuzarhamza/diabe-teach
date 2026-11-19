// Tiny static server for the Concept Chain prototype. Node built-ins only.
// Run: node claudPoc/concept-chain/server.mjs   (PORT=9000 to change the port)
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "127.0.0.1";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname === "/") {
    res.writeHead(302, { Location: "/login.html" }).end();
    return;
  }
  const file = normalize(join(ROOT, decodeURIComponent(pathname)));
  if (!file.startsWith(ROOT)) { // ROOT ends with "/", so "../" escapes are refused
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store", // always serve the latest edit, no hard reload needed
    });
    res.end(body);
  }
  catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
  process.stdout.write(`${res.statusCode} ${req.method} ${pathname}\n`);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Concept Chain prototype: http://localhost:${PORT}/login.html\n`);
});
