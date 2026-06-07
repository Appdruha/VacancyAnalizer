import { database } from "@edagent/database";
import { dispatchJob } from "./job-dispatcher.js";
import { runtimeState } from "./runtime-state.js";

export async function processNextJob(): Promise<void> {
  try {
    const reachable = await database.canReachDatabase();
    if (!reachable) {
      runtimeState.mode = "idle";
      runtimeState.lastError = "Database is not reachable.";
      return;
    }

    runtimeState.mode = "database";
    const job = await database.claimNextJob();
    if (!job) {
      return;
    }

    await dispatchJob(job);
    await database.completeJob(job.id);
    runtimeState.processedCount += 1;
    runtimeState.lastProcessedAt = new Date().toISOString();
    runtimeState.lastError = null;

    console.log(
      JSON.stringify({
        scope: "worker.job",
        status: "completed",
        jobId: job.id,
        queue: job.queue,
        type: job.type
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    runtimeState.lastError = message;
    console.error(
      JSON.stringify({
        scope: "worker.runtime",
        status: "failed",
        message
      })
    );

    const jobs = await database.getJobs().catch(() => []);
    const activeJob = jobs.find((job) => job.status === "running");
    if (activeJob) {
      await database.failJob(activeJob.id, message).catch(() => undefined);
    }
  }
}
