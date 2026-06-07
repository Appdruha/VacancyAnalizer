import { env } from "@edagent/config";
import { database } from "@edagent/database";
import { requestRemoteAdaptiveRecommendation } from "@edagent/integrations";

export async function resolveAdaptiveRecommendation(companyId?: string) {
  const localRecommendation = await database.getAdaptiveRecommendation(companyId);
  if (!env.ML_USE_REMOTE_RECOMMENDER) {
    return localRecommendation;
  }

  try {
    const stats = await database.getAdaptiveRecommendationStats(companyId);
    return await requestRemoteAdaptiveRecommendation({
      scope: companyId ? "company" : "global",
      stats
    });
  } catch {
    return localRecommendation;
  }
}
