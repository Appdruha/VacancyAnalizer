import type { DraftTone } from "@edagent/ai";
import type { MessageKind, MessageStatus } from "@edagent/domain";
import { jsonResponse, parseJson } from "@edagent/shared";
import type { RouteContext } from "../routes/types.js";
import type { OutreachServiceDeps } from "../services/outreach-service.js";
import { createOutreachService } from "../services/outreach-service.js";

type GenerateDraftPayload = {
  companyId: string;
  contactId?: string;
  tone?: DraftTone;
  kind?: "outreach-email" | "follow-up-email";
};

type UpdateDraftApprovalPayload = {
  approved: boolean;
};

type SendCampaignPayload = {
  name?: string;
  draftIds: string[];
};

type SimulateReplyPayload = {
  messageId: string;
  body: string;
  incomingFrom?: string;
};

type LogNegotiationOutcomePayload = {
  outcome: "meeting_scheduled" | "pilot_agreed" | "follow_up_needed" | "declined_after_call";
  notes?: string;
};

export async function handleOutreachController(
  context: RouteContext,
  deps: OutreachServiceDeps & {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
  }
): Promise<boolean> {
  const service = createOutreachService(deps);
  const { req, res, url, pathname } = context;

  if (req.method === "GET" && pathname === "/drafts") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const contactId = url.searchParams.get("contactId") ?? undefined;
    const approvedRaw = url.searchParams.get("approved");
    const approved = approvedRaw === null ? undefined : approvedRaw === "true";
    const result = await service.listDrafts({
      ...(companyId ? { companyId } : {}),
      ...(contactId ? { contactId } : {}),
      ...(approved !== undefined ? { approved } : {})
    });
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "POST" && pathname === "/drafts/generate") {
    const payload = parseJson<GenerateDraftPayload>(await deps.readBody(req));
    const result = await service.generateDraft(payload ?? { companyId: "" });
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data, result.status ?? 201));
    return true;
  }

  if (req.method === "PUT" && /^\/drafts\/[^/]+\/approval$/.test(pathname)) {
    const draftId = pathname.split("/")[2] ?? "";
    const payload = parseJson<UpdateDraftApprovalPayload>(await deps.readBody(req));
    const result = await service.updateDraftApproval(draftId, payload?.approved);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && pathname === "/campaigns") {
    const result = await service.listCampaigns();
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "POST" && pathname === "/campaigns/send") {
    const payload = parseJson<SendCampaignPayload>(await deps.readBody(req));
    const result = await service.sendCampaign(payload);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data, result.status ?? 201));
    return true;
  }

  if (req.method === "POST" && pathname === "/follow-ups/run") {
    const result = await service.enqueueFollowUps();
    deps.send(res, jsonResponse(result.data, result.status ?? 201));
    return true;
  }

  if (req.method === "GET" && pathname === "/messages") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const campaignId = url.searchParams.get("campaignId") ?? undefined;
    const status = (url.searchParams.get("status") as MessageStatus | null) ?? undefined;
    const kind = (url.searchParams.get("kind") as MessageKind | null) ?? undefined;
    const result = await service.listMessages({
      ...(companyId ? { companyId } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(status ? { status } : {}),
      ...(kind ? { kind } : {})
    });
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && pathname === "/message-events") {
    const messageId = url.searchParams.get("messageId") ?? undefined;
    const result = await service.listMessageEvents(messageId);
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && pathname === "/replies") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const result = await service.listReplies(companyId);
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "POST" && /^\/replies\/[^/]+\/outcome$/.test(pathname)) {
    const replyId = pathname.split("/")[2] ?? "";
    const payload = parseJson<LogNegotiationOutcomePayload>(await deps.readBody(req));
    const result = await service.logReplyOutcome(replyId, payload ?? undefined);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "POST" && pathname === "/replies/simulate") {
    const payload = parseJson<SimulateReplyPayload>(await deps.readBody(req));
    const result = await service.simulateReply(payload ?? undefined);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data, result.status ?? 201));
    return true;
  }

  return false;
}
