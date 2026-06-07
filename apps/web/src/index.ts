import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@edagent/config";
import { notFoundResponse } from "@edagent/shared";
import { appStyles } from "./client/styles.js";

const distRoot = fileURLToPath(new URL(".", import.meta.url));
const clientRoot = path.join(distRoot, "client");

function renderHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EdAgent Workspace</title>
    <style>${appStyles}</style>
    <script>
      window.__EDAGENT_CONFIG__ = ${JSON.stringify({
        apiBaseUrl: "/api",
        appName: env.APP_NAME || "EdAgent Workspace"
      })};
    </script>
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react",
          "react/jsx-runtime": "https://esm.sh/react/jsx-runtime",
          "react-dom/client": "https://esm.sh/react-dom/client?deps=react"
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/client/main.js"></script>
  </body>
</html>`;
}

function getContentType(filePath: string): string {
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".map")) {
    return "application/json; charset=utf-8";
  }
  return "text/plain; charset=utf-8";
}

async function proxyApiRequest(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  pathname: string,
  search: string
): Promise<void> {
  const target = new URL(`${pathname.replace(/^\/api/, "")}${search}`, env.API_BASE_URL);
  const body =
    req.method && req.method !== "GET" && req.method !== "HEAD"
      ? Buffer.concat(
          await (async () => {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            return chunks;
          })()
        )
      : undefined;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || key === "host" || key === "connection" || key === "content-length") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    headers.set(key, value);
  }

  const response = await fetch(target, {
    method: req.method ?? "GET",
    headers,
    ...(body ? { body } : {})
  });

  const payload = Buffer.from(await response.arrayBuffer());
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "content-encoding") {
      return;
    }
    responseHeaders[key] = value;
  });

  res.writeHead(response.status, responseHeaders);
  res.end(payload);
}

async function serveClientAsset(res: ServerResponse<IncomingMessage>, pathname: string): Promise<void> {
  const filePath = path.join(clientRoot, pathname.replace(/^\/client\//, ""));
  const content = await readFile(filePath);
  res.writeHead(200, { "content-type": getContentType(filePath) });
  res.end(content);
}

function main(): void {
  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://localhost:${env.PORT}`);
      const pathname = url.pathname;

      if (pathname.startsWith("/api/")) {
        await proxyApiRequest(req, res, pathname, url.search);
        return;
      }

      if (pathname.startsWith("/client/")) {
        try {
          await serveClientAsset(res, pathname);
        } catch {
          const payload = notFoundResponse(pathname);
          res.writeHead(payload.statusCode, payload.headers);
          res.end(payload.body);
        }
        return;
      }

      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderHtml());
    })().catch((error: unknown) => {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify(
          {
            error: "web_runtime_error",
            message: error instanceof Error ? error.message : "Unknown web error"
          },
          null,
          2
        )
      );
    });
  });

  server.listen(env.PORT, () => {
    console.log(`[web] react dashboard is listening on port ${env.PORT}`);
  });
}

main();
