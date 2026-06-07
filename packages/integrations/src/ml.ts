import { env } from "@edagent/config";
import type { AdaptiveRecommendation, AdaptiveRecommendationStats } from "@edagent/domain";
import type { MlEvaluationItem, MlEvaluationResult } from "./types.js";

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, env.ML_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function getMlServiceHealth(): Promise<{
  status: "ok";
  service: string;
  version: string;
  remoteRecommenderEnabled: boolean;
}> {
  const response = await fetchWithTimeout(`${env.ML_SERVICE_URL}/health`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`ML service health check failed with status ${response.status}.`);
  }

  return (await response.json()) as {
    status: "ok";
    service: string;
    version: string;
    remoteRecommenderEnabled: boolean;
  };
}

export async function requestRemoteAdaptiveRecommendation(input: {
  scope: "company" | "global";
  stats: AdaptiveRecommendationStats;
}): Promise<AdaptiveRecommendation> {
  const response = await fetchWithTimeout(`${env.ML_SERVICE_URL}/recommend/adaptive`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const details = (await response.text().catch(() => "")).slice(0, 240);
    throw new Error(`ML recommendation failed with status ${response.status}. ${details}`.trim());
  }

  return (await response.json()) as AdaptiveRecommendation;
}

export async function runRemoteAdaptiveEvaluation(input: {
  items: MlEvaluationItem[];
}): Promise<MlEvaluationResult> {
  const response = await fetchWithTimeout(`${env.ML_SERVICE_URL}/evaluate/adaptive`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const details = (await response.text().catch(() => "")).slice(0, 240);
    throw new Error(`ML evaluation failed with status ${response.status}. ${details}`.trim());
  }

  return (await response.json()) as MlEvaluationResult;
}
