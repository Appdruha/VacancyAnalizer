import { createServer } from "node:http";
import { env } from "@edagent/config";
import { database } from "@edagent/database";
import { jsonResponse, readinessProbe } from "@edagent/shared";
import { processNextJob } from "./runner.js";
import { runtimeState } from "./runtime-state.js";

function main(): void {
  const server = createServer((_, res) => {
    void (async () => {
      const jobStats = await database.getJobStats().catch(() => ({
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0
      }));

      const payload = jsonResponse({
        ...readinessProbe("worker"),
        mode: runtimeState.mode,
        processedCount: runtimeState.processedCount,
        lastProcessedAt: runtimeState.lastProcessedAt,
        lastError: runtimeState.lastError,
        pollMs: env.WORKER_POLL_MS,
        jobs: jobStats
      });

      res.writeHead(payload.statusCode, payload.headers);
      res.end(payload.body);
    })();
  });

  server.listen(env.WORKER_PORT, () => {
    const status = readinessProbe("worker");
    console.log(`[worker] ${status.service} is listening on port ${env.WORKER_PORT}`);
  });

  void processNextJob();
  setInterval(() => {
    void processNextJob();
  }, env.WORKER_POLL_MS);
}

main();
