import { createServer } from "node:http";
import { env } from "@edagent/config";
import { readinessProbe, jsonResponse } from "@edagent/shared";
import { ensurePlatformBootstrap } from "./lib/platform.js";
import { route } from "./router.js";

function main(): void {
  void ensurePlatformBootstrap().catch(() => undefined);

  const server = createServer((req, res) => {
    route(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      const payload = jsonResponse(
        {
          error: "internal_error",
          message
        },
        500
      );
      res.writeHead(payload.statusCode, payload.headers);
      res.end(payload.body);
    });
  });

  server.listen(env.API_PORT, () => {
    const status = readinessProbe("api");
    console.log(`[api] ${status.service} is listening on port ${env.API_PORT}`);
  });
}

main();
