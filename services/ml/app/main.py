from __future__ import annotations

from collections import Counter
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

Tone = Literal["formal", "neutral", "friendly"]
Scope = Literal["company", "global"]


class AdaptiveRecommendationStats(BaseModel):
    eventCount: int = 0
    totalReplies: int = 0
    positiveReplies: int = 0
    meetingReplies: int = 0
    declineReplies: int = 0
    questionReplies: int = 0
    outreachSent: int = 0
    followUpsSent: int = 0
    positiveByTone: dict[Tone, int] = Field(default_factory=dict)
    negativeByTone: dict[Tone, int] = Field(default_factory=dict)


class AdaptiveRecommendationRequest(BaseModel):
    scope: Scope
    stats: AdaptiveRecommendationStats


class AdaptiveRecommendationResponse(BaseModel):
    scope: Scope
    recommendedTone: Tone
    recommendedFollowUpDays: int
    confidence: float
    basedOnEvents: int
    totalReplies: int
    positiveReplyRate: float
    meetingRate: float
    reasons: list[str]


class MlEvaluationItem(BaseModel):
    companyId: str | None = None
    stats: AdaptiveRecommendationStats
    baselineTone: Tone | None = None
    baselineFollowUpDays: int | None = None


class MlEvaluationRequest(BaseModel):
    items: list[MlEvaluationItem]


class MlEvaluationResponse(BaseModel):
    engine: str
    itemsEvaluated: int
    averageConfidence: float
    recommendedToneDistribution: dict[str, int]
    averageFollowUpDays: float
    recommendedChanges: int
    notes: list[str]


app = FastAPI(title="edagent-ml-service", version="0.2.0")


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def score_tone(stats: AdaptiveRecommendationStats, tone: Tone) -> float:
    positive = stats.positiveByTone.get(tone, 0)
    negative = stats.negativeByTone.get(tone, 0)

    score = positive * 2.0 - negative * 1.2
    if tone == "friendly" and stats.meetingReplies > 0:
        score += 0.6
    if tone == "neutral" and stats.questionReplies > 0:
        score += 0.4
    if tone == "formal" and stats.declineReplies > stats.positiveReplies:
        score += 0.5
    return score


def recommend_from_stats(scope: Scope, stats: AdaptiveRecommendationStats) -> AdaptiveRecommendationResponse:
    total_replies = max(stats.totalReplies, 0)
    positive_rate = round(stats.positiveReplies / total_replies, 2) if total_replies else 0.0
    meeting_rate = round(stats.meetingReplies / total_replies, 2) if total_replies else 0.0

    tone_scores = {tone: score_tone(stats, tone) for tone in ("formal", "neutral", "friendly")}
    recommended_tone: Tone = max(tone_scores, key=tone_scores.get)

    if tone_scores[recommended_tone] <= 0:
        if meeting_rate >= 0.3 or positive_rate >= 0.5:
            recommended_tone = "friendly"
        elif stats.declineReplies > stats.positiveReplies:
            recommended_tone = "formal"
        else:
            recommended_tone = "neutral"

    follow_up_days = 10
    if stats.meetingReplies >= 1:
        follow_up_days = 3
    elif positive_rate >= 0.5 and total_replies >= 1:
        follow_up_days = 5
    elif stats.questionReplies >= 1:
        follow_up_days = 6
    elif stats.declineReplies >= 2 and stats.positiveReplies == 0:
        follow_up_days = 12
    elif stats.followUpsSent > 0 and total_replies == 0:
        follow_up_days = 8

    reasons: list[str] = []
    if total_replies == 0:
        reasons.append("No reply history yet, so the remote recommender stays conservative.")
    else:
        reasons.append(f"Observed {total_replies} replies with {round(positive_rate * 100)}% positive rate.")
    if stats.meetingReplies > 0:
        reasons.append("Meeting intent is present, so faster human follow-up is preferred.")
    if stats.followUpsSent > 0 and total_replies == 0:
        reasons.append("Follow-ups were already sent without replies, so the cadence stays tighter.")
    reasons.append(f"{recommended_tone} is currently the highest-scoring tone in the ML heuristic.")

    confidence = round(
        clamp(
            0.3
            + stats.eventCount * 0.04
            + total_replies * 0.12
            + stats.meetingReplies * 0.08
            + stats.outreachSent * 0.01,
            0.2,
            0.96,
        ),
        2,
    )

    return AdaptiveRecommendationResponse(
        scope=scope,
        recommendedTone=recommended_tone,
        recommendedFollowUpDays=follow_up_days,
        confidence=confidence,
        basedOnEvents=stats.eventCount,
        totalReplies=stats.totalReplies,
        positiveReplyRate=positive_rate,
        meetingRate=meeting_rate,
        reasons=reasons,
    )


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "service": "edagent-ml-service",
        "version": "0.2.0",
        "remoteRecommenderEnabled": True,
    }


@app.post("/recommend/adaptive", response_model=AdaptiveRecommendationResponse)
def recommend_adaptive(payload: AdaptiveRecommendationRequest) -> AdaptiveRecommendationResponse:
    return recommend_from_stats(payload.scope, payload.stats)


@app.post("/evaluate/adaptive", response_model=MlEvaluationResponse)
def evaluate_adaptive(payload: MlEvaluationRequest) -> MlEvaluationResponse:
    recommendations = [
        recommend_from_stats("company" if item.companyId else "global", item.stats) for item in payload.items
    ]

    if not recommendations:
        return MlEvaluationResponse(
            engine="python-heuristic-v0.2.0",
            itemsEvaluated=0,
            averageConfidence=0.0,
            recommendedToneDistribution={},
            averageFollowUpDays=0.0,
            recommendedChanges=0,
            notes=["No evaluation items were supplied."],
        )

    tone_distribution = Counter(item.recommendedTone for item in recommendations)
    average_confidence = round(sum(item.confidence for item in recommendations) / len(recommendations), 2)
    average_follow_up_days = round(
        sum(item.recommendedFollowUpDays for item in recommendations) / len(recommendations), 2
    )

    changed = 0
    for source, recommendation in zip(payload.items, recommendations):
        if source.baselineTone and source.baselineTone != recommendation.recommendedTone:
            changed += 1
            continue
        if (
            source.baselineFollowUpDays is not None
            and source.baselineFollowUpDays != recommendation.recommendedFollowUpDays
        ):
            changed += 1

    notes = [
        "Evaluation compares the remote Python heuristic against the current TS baseline recommendation.",
        "A changed recommendation means either the preferred tone or the follow-up cadence differs from the baseline.",
    ]

    if any(item.meetingRate > 0 for item in recommendations):
        notes.append("Meeting-heavy histories are biased toward faster follow-up windows.")

    return MlEvaluationResponse(
        engine="python-heuristic-v0.2.0",
        itemsEvaluated=len(recommendations),
        averageConfidence=average_confidence,
        recommendedToneDistribution=dict(tone_distribution),
        averageFollowUpDays=average_follow_up_days,
        recommendedChanges=changed,
        notes=notes,
    )
