import { env } from "@edagent/config";
import { database } from "@edagent/database";
import type { AdaptiveRecommendation, AgentMemoryEvent, AuditLog } from "@edagent/domain";
import { createId } from "@edagent/shared";
import { appendAuditLog, memoryEvents } from "./runtime-state.js";

export async function tryDatabase<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch {
    return null;
  }
}

export async function getAuditActorUserId(): Promise<string | null> {
  const adminUser = await tryDatabase(() => database.findUserByEmail(env.ADMIN_EMAIL));
  return adminUser?.id ?? null;
}

export async function createAuditEntry(entry: Omit<AuditLog, "id" | "createdAt">): Promise<void> {
  await tryDatabase(() => database.createAuditLog(entry));
  appendAuditLog(entry);
}

export async function createMemoryEntry(entry: Omit<AgentMemoryEvent, "id" | "createdAt">): Promise<void> {
  await tryDatabase(() => database.createMemoryEvent(entry));
  memoryEvents.unshift({
    id: createId("mem"),
    createdAt: new Date().toISOString(),
    ...entry
  });
}

export async function resolveAdaptiveRecommendation(companyId?: string): Promise<AdaptiveRecommendation | null> {
  const localRecommendation = await tryDatabase(() => database.getAdaptiveRecommendation(companyId));
  if (!env.ML_USE_REMOTE_RECOMMENDER) {
    return localRecommendation;
  }

  const stats = await tryDatabase(() => database.getAdaptiveRecommendationStats(companyId));
  if (!stats) {
    return localRecommendation;
  }

  try {
    const { requestRemoteAdaptiveRecommendation } = await import("@edagent/integrations");
    return await requestRemoteAdaptiveRecommendation({
      scope: companyId ? "company" : "global",
      stats
    });
  } catch {
    return localRecommendation;
  }
}

export async function ensurePlatformBootstrap(): Promise<void> {
  await database.ensureSystemBootstrap({
    adminEmail: env.ADMIN_EMAIL,
    operatorEmail: "operator@edagent.local",
    defaultPasswordSettings: [
      { key: "outreach.followUpDays", value: "10" },
      { key: "scoring.minimumApprovalScore", value: "75" }
    ]
  });
}
