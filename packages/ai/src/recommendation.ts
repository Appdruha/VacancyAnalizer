import type { AdaptiveRecommendation } from "@edagent/domain";
import type {
  AdaptiveRecommendationDecision,
  AdaptiveRecommendationDecisionInput,
  DraftTone
} from "./types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function recommendAdaptiveStrategy(input: {
  eventCount: number;
  totalReplies: number;
  positiveReplies: number;
  meetingReplies: number;
  declineReplies: number;
  questionReplies: number;
  outreachSent: number;
  followUpsSent: number;
  positiveByTone: Record<string, number>;
  negativeByTone: Record<string, number>;
}): {
  recommendedTone: DraftTone;
  recommendedFollowUpDays: number;
  confidence: number;
  positiveReplyRate: number;
  meetingRate: number;
  reasons: string[];
} {
  const positiveReplyRate = input.totalReplies > 0 ? input.positiveReplies / input.totalReplies : 0;
  const meetingRate = input.totalReplies > 0 ? input.meetingReplies / input.totalReplies : 0;

  const toneCandidates: DraftTone[] = ["formal", "neutral", "friendly"];
  const toneScores = Object.fromEntries(
    toneCandidates.map((tone) => {
      const positive = input.positiveByTone[tone] ?? 0;
      const negative = input.negativeByTone[tone] ?? 0;
      const score = positive * 2 - negative;
      return [tone, score];
    })
  ) as Record<DraftTone, number>;

  let recommendedTone: DraftTone = "formal";
  let bestToneScore = Number.NEGATIVE_INFINITY;
  for (const tone of toneCandidates) {
    const score = toneScores[tone];
    if (score > bestToneScore) {
      recommendedTone = tone;
      bestToneScore = score;
    }
  }

  if (bestToneScore <= 0) {
    if (positiveReplyRate >= 0.5 || meetingRate >= 0.3) {
      recommendedTone = "friendly";
    } else if (input.declineReplies > input.positiveReplies) {
      recommendedTone = "neutral";
    } else {
      recommendedTone = "formal";
    }
  }

  let recommendedFollowUpDays = 10;
  if (input.meetingReplies >= 1) {
    recommendedFollowUpDays = 4;
  } else if (input.totalReplies >= 2 && positiveReplyRate >= 0.5) {
    recommendedFollowUpDays = 5;
  } else if (input.questionReplies >= 1) {
    recommendedFollowUpDays = 6;
  } else if (input.declineReplies >= 2 && input.positiveReplies === 0) {
    recommendedFollowUpDays = 12;
  } else if (input.followUpsSent > 0 && input.totalReplies === 0) {
    recommendedFollowUpDays = 8;
  }

  const reasons: string[] = [];
  if (input.totalReplies === 0) {
    reasons.push("No reply history yet, so the strategy stays conservative.");
  } else {
    reasons.push(`Observed ${input.totalReplies} replies with ${(positiveReplyRate * 100).toFixed(0)}% positive rate.`);
  }

  if (input.meetingReplies > 0) {
    reasons.push(`Meeting intent appeared ${input.meetingReplies} time(s), so faster follow-up is preferred.`);
  }

  if ((input.positiveByTone[recommendedTone] ?? 0) > 0) {
    reasons.push(`${recommendedTone} tone has the strongest positive reply signal so far.`);
  }

  if (input.declineReplies > input.positiveReplies) {
    reasons.push("History includes more declines than positive replies, so the recommendation stays measured.");
  }

  const confidence = clamp(
    Math.round(
      Math.min(0.95, 0.25 + input.eventCount * 0.05 + input.totalReplies * 0.1 + input.meetingReplies * 0.08) * 100
    ) / 100,
    0.2,
    0.95
  );

  return {
    recommendedTone,
    recommendedFollowUpDays,
    confidence,
    positiveReplyRate: Math.round(positiveReplyRate * 100) / 100,
    meetingRate: Math.round(meetingRate * 100) / 100,
    reasons
  };
}

export function decideAdaptiveRecommendationSource(input: AdaptiveRecommendationDecisionInput): AdaptiveRecommendationDecision {
  const { stats, localRecommendation, remoteRecommendation } = input;
  const followUpDelta = Math.abs(
    remoteRecommendation.recommendedFollowUpDays - localRecommendation.recommendedFollowUpDays
  );
  const meaningfulChange =
    remoteRecommendation.recommendedTone !== localRecommendation.recommendedTone ||
    followUpDelta >= 2 ||
    (stats.meetingReplies > 0 &&
      remoteRecommendation.recommendedFollowUpDays < localRecommendation.recommendedFollowUpDays);
  const enoughData =
    stats.totalReplies >= 2 ||
    stats.meetingReplies >= 1 ||
    stats.eventCount >= 6 ||
    (stats.questionReplies >= 1 && stats.outreachSent >= 2);
  const confidenceGap = Math.round((remoteRecommendation.confidence - localRecommendation.confidence) * 100) / 100;
  const reasons: string[] = [];

  let recommendedSource: AdaptiveRecommendationDecision["recommendedSource"] = "local";

  if (!enoughData) {
    reasons.push("There is not enough reply history yet, so the local baseline stays safer.");
  } else if (remoteRecommendation.confidence < Math.max(0.55, localRecommendation.confidence)) {
    reasons.push("The remote recommendation is not confident enough to override the local baseline.");
  } else if (!meaningfulChange && confidenceGap < 0.08) {
    reasons.push("The remote output is too close to the local baseline to justify a switch.");
  } else {
    recommendedSource = "remote";
    reasons.push("The remote recommender has enough data and offers a materially different recommendation.");
  }

  if (stats.meetingReplies > 0) {
    reasons.push("Meeting signals are present, so follow-up cadence matters more than in a cold-start scenario.");
  }
  if (stats.declineReplies > stats.positiveReplies) {
    reasons.push("Decline-heavy history keeps the policy conservative unless the remote confidence is clearly higher.");
  }

  return {
    recommendedSource,
    enoughData,
    meaningfulChange,
    confidenceGap,
    reasons
  };
}
