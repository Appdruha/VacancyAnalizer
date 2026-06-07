import { recommendAdaptiveStrategy } from "@edagent/ai";
import type {
  AdaptiveRecommendation,
  AdaptiveRecommendationStats,
  AgentMemoryEvent,
  MemoryOverview
} from "@edagent/domain";
import { getPrismaClient } from "../client.js";
import { toMemoryEvent } from "../mappers.js";
import { getReplies } from "./outreach.js";

export async function createMemoryEvent(input: {
  companyId?: string;
  eventType: string;
  payload: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await getPrismaClient().agentMemoryEvent.create({
    data: {
      companyId: input.companyId ?? null,
      eventType: input.eventType,
      payload: input.payload as never
    }
  });
}

export async function getMemoryEvents(input?: {
  companyId?: string;
  eventType?: string;
  limit?: number;
}): Promise<AgentMemoryEvent[]> {
  const rows = await getPrismaClient().agentMemoryEvent.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.eventType ? { eventType: input.eventType } : {})
    },
    orderBy: { createdAt: "desc" },
    ...(input?.limit ? { take: input.limit } : {})
  });

  return rows.map((row: any) => toMemoryEvent(row));
}

export function buildAdaptiveStatsFromEvents(events: AgentMemoryEvent[]): AdaptiveRecommendationStats {
  const stats: AdaptiveRecommendationStats = {
    eventCount: events.length,
    totalReplies: 0,
    positiveReplies: 0,
    meetingReplies: 0,
    declineReplies: 0,
    questionReplies: 0,
    outreachSent: 0,
    followUpsSent: 0,
    positiveByTone: {} as Partial<Record<"formal" | "neutral" | "friendly", number>>,
    negativeByTone: {} as Partial<Record<"formal" | "neutral" | "friendly", number>>
  };

  for (const event of events) {
    if (event.eventType === "outreach_delivered") {
      stats.outreachSent += 1;
    }
    if (event.eventType === "follow_up_sent") {
      stats.followUpsSent += 1;
    }
    if (event.eventType === "reply_received") {
      stats.totalReplies += 1;
      const category = typeof event.payload.category === "string" ? event.payload.category : "";
      const positive = event.payload.positive === true;
      const tone =
        typeof event.payload.tone === "string" &&
        ["formal", "neutral", "friendly"].includes(event.payload.tone)
          ? (event.payload.tone as "formal" | "neutral" | "friendly")
          : null;

      if (positive) {
        stats.positiveReplies += 1;
      }
      if (category === "meeting") {
        stats.meetingReplies += 1;
      } else if (category === "decline") {
        stats.declineReplies += 1;
      } else if (category === "question") {
        stats.questionReplies += 1;
      }

      if (tone) {
        if (positive) {
          stats.positiveByTone[tone] = (stats.positiveByTone[tone] ?? 0) + 1;
        } else {
          stats.negativeByTone[tone] = (stats.negativeByTone[tone] ?? 0) + 1;
        }
      }
    }
  }

  return stats;
}

export function buildRecommendationFromStats(
  scope: "company" | "global",
  stats: AdaptiveRecommendationStats
): AdaptiveRecommendation {
  const recommendation = recommendAdaptiveStrategy(stats);
  return {
    scope,
    recommendedTone: recommendation.recommendedTone,
    recommendedFollowUpDays: recommendation.recommendedFollowUpDays,
    confidence: recommendation.confidence,
    basedOnEvents: stats.eventCount,
    totalReplies: stats.totalReplies,
    positiveReplyRate: recommendation.positiveReplyRate,
    meetingRate: recommendation.meetingRate,
    reasons: recommendation.reasons
  };
}

export async function getAdaptiveRecommendationStats(companyId?: string): Promise<AdaptiveRecommendationStats> {
  const events = companyId ? await getMemoryEvents({ companyId, limit: 200 }) : await getMemoryEvents({ limit: 400 });
  return buildAdaptiveStatsFromEvents(events);
}

export async function getAdaptiveRecommendation(companyId?: string): Promise<AdaptiveRecommendation> {
  const companyEvents = companyId ? await getMemoryEvents({ companyId, limit: 200 }) : [];
  if (companyEvents.length > 0) {
    return buildRecommendationFromStats("company", buildAdaptiveStatsFromEvents(companyEvents));
  }

  const globalEvents = await getMemoryEvents({ limit: 400 });
  return buildRecommendationFromStats("global", buildAdaptiveStatsFromEvents(globalEvents));
}

export async function getMemoryOverview(companyId?: string): Promise<MemoryOverview> {
  const [allEvents, recentEvents, replies, recommendation] = await Promise.all([
    getMemoryEvents(companyId ? { companyId, limit: 400 } : { limit: 400 }),
    getMemoryEvents(companyId ? { companyId, limit: 12 } : { limit: 12 }),
    getReplies(companyId ? { companyId } : undefined),
    getAdaptiveRecommendation(companyId)
  ]);

  const counts = new Map<string, number>();
  for (const event of allEvents) {
    counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
  }

  const topEventTypes = Array.from(counts.entries())
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((left, right) => right.count - left.count || left.eventType.localeCompare(right.eventType))
    .slice(0, 8);

  return {
    ...(companyId ? { companyId } : {}),
    eventCount: allEvents.length,
    replyCount: replies.length,
    recentEvents,
    topEventTypes,
    recommendation
  };
}
