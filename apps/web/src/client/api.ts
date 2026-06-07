import type {
  IndustryBootstrapItem,
  AgreementItem,
  AuthSession,
  BootstrapResponse,
  CommunicationPackageItem,
  DashboardData,
  DraftItem,
  GapItem,
  MemoryOverview,
  MessageItem,
  MlEvaluation,
  MlHealth,
  ProjectBriefItem,
  ProjectCatalogItem,
  ReplyItem,
  SessionUser,
  ShortlistItem,
  WebRuntimeConfig
} from "./types.js";

function getConfig(): WebRuntimeConfig {
  return window.__EDAGENT_CONFIG__ ?? {
    apiBaseUrl: "/api",
    appName: "EdAgent Workspace"
  };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getConfig().apiBaseUrl}${path}`, {
    ...init,
    headers
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as T | { message?: string })
    : ((await response.text()) as T);

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : response.statusText;
    throw new Error(message || "Request failed.");
  }

  return payload as T;
}

export async function loadDashboardData(token: string): Promise<DashboardData> {
  const [
    me,
    health,
    bootstrap,
    companies,
    shortlist,
    drafts,
    messages,
    replies,
    agreements,
    briefs,
    projectCatalog,
    communicationPackages,
    memoryOverview,
    mlHealth,
    mlEvaluation,
    competencyGap
  ] = await Promise.all([
    apiFetch<{ user: SessionUser }>("/auth/me", {}, token),
    apiFetch<{ databaseReady?: boolean }>("/health"),
    apiFetch<BootstrapResponse>("/platform/bootstrap", {}, token),
    apiFetch<{ items: ShortlistItem[] }>("/companies", {}, token),
    apiFetch<{ items: ShortlistItem[] }>("/companies/shortlist?limit=6", {}, token),
    apiFetch<{ items: DraftItem[] }>("/drafts", {}, token),
    apiFetch<{ items: MessageItem[] }>("/messages", {}, token),
    apiFetch<{ items: ReplyItem[] }>("/replies", {}, token),
    apiFetch<{ items: AgreementItem[] }>("/agreements", {}, token),
    apiFetch<{ items: ProjectBriefItem[] }>("/project-briefs", {}, token),
    apiFetch<{ items: ProjectCatalogItem[] }>("/projects/catalog", {}, token),
    apiFetch<{ items: CommunicationPackageItem[] }>("/communication-packages", {}, token),
    apiFetch<MemoryOverview>("/memory/overview", {}, token),
    apiFetch<MlHealth>("/ml/health", {}, token),
    apiFetch<MlEvaluation>("/ml/evaluations/run", { method: "POST" }, token),
    apiFetch<{ items: GapItem[] }>("/analytics/competency-gap", {}, token)
  ]);

  return {
    me,
    health,
    bootstrap,
    companies,
    shortlist,
    drafts,
    messages,
    replies,
    agreements,
    briefs,
    projectCatalog,
    communicationPackages,
    memoryOverview,
    mlHealth,
    mlEvaluation,
    competencyGap
  };
}

export async function signInLocal(email: string, password: string): Promise<AuthSession> {
  return apiFetch<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function signInWithGoogle(idToken: string): Promise<AuthSession> {
  return apiFetch<AuthSession>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken })
  });
}

export async function getGoogleConfig(): Promise<{
  enabled: boolean;
  clientIdConfigured: boolean;
  allowedDomain: string | null;
  clientId?: string | null;
}> {
  return apiFetch("/auth/google/config");
}

export type BootstrapIndustryPayload = {
  industryName: string;
  priority?: number;
  query: string;
  area?: string;
  perPage?: number;
  programName: string;
  competencies: Array<{
    name: string;
    category?: string;
    coverageScore: number;
  }>;
};

export type HhIngestionPayload = {
  industryId: string;
  query: string;
  page?: number;
  perPage?: number;
  area?: string;
};

export type CompanyDiscoveryPayload = {
  industryId: string;
  limit?: number;
};

export type DraftGenerationPayload = {
  companyId: string;
  contactId?: string;
  tone?: "formal" | "neutral" | "friendly";
  kind?: "outreach-email" | "follow-up-email";
};

export type CampaignSendPayload = {
  name?: string;
  draftIds: string[];
};

export async function bootstrapIndustry(payload: BootstrapIndustryPayload, token: string): Promise<{
  industry: IndustryBootstrapItem;
}> {
  return apiFetch("/setup/bootstrap-industry", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function enqueueHhIngestion(payload: HhIngestionPayload, token: string): Promise<unknown> {
  return apiFetch("/vacancies/ingest/hh", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function enqueueCompanyDiscovery(payload: CompanyDiscoveryPayload, token: string): Promise<unknown> {
  return apiFetch("/companies/discover", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function generateDraftAction(payload: DraftGenerationPayload, token: string): Promise<unknown> {
  return apiFetch("/drafts/generate", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function sendCampaignAction(payload: CampaignSendPayload, token: string): Promise<unknown> {
  return apiFetch("/campaigns/send", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function approveDraftAction(draftId: string, approved: boolean, token: string): Promise<unknown> {
  return apiFetch(`/drafts/${draftId}/approval`, { method: "PUT", body: JSON.stringify({ approved }) }, token);
}

export async function updateCompanyStageAction(
  companyId: string,
  stage: string,
  token: string
): Promise<unknown> {
  return apiFetch(`/companies/${companyId}/stage`, { method: "PUT", body: JSON.stringify({ stage }) }, token);
}

export async function createAgreementAction(
  payload: { companyId: string; status?: string },
  token: string
): Promise<unknown> {
  return apiFetch("/agreements", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function generateBriefAction(
  payload: { partnerAgreementId: string; title?: string },
  token: string
): Promise<unknown> {
  return apiFetch("/project-briefs/generate", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function generateMaterialsAction(
  payload: { companyId: string; partnerAgreementId?: string },
  token: string
): Promise<unknown> {
  return apiFetch("/communication-packages/generate", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function simulateReplyAction(
  payload: { messageId: string; body: string; incomingFrom?: string },
  token: string
): Promise<unknown> {
  return apiFetch("/replies/simulate", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function logReplyOutcomeAction(
  replyId: string,
  payload: {
    outcome: "meeting_scheduled" | "pilot_agreed" | "follow_up_needed" | "declined_after_call";
    notes?: string;
  },
  token: string
): Promise<unknown> {
  return apiFetch(`/replies/${replyId}/outcome`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function runFollowUpsAction(token: string): Promise<unknown> {
  return apiFetch("/follow-ups/run", { method: "POST" }, token);
}

export async function updateAgreementStatusAction(
  agreementId: string,
  status: string,
  token: string
): Promise<unknown> {
  return apiFetch(`/agreements/${agreementId}/status`, { method: "PUT", body: JSON.stringify({ status }) }, token);
}
