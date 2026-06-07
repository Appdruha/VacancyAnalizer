import type { CompanyStage } from "@edagent/domain";
import { jsonResponse, parseJson } from "@edagent/shared";
import type { RouteContext } from "../routes/types.js";
import type { CompanyServiceDeps } from "../services/companies-service.js";
import { createCompaniesService } from "../services/companies-service.js";

type TriggerCompanyDiscoveryPayload = {
  industryId: string;
  limit?: number;
};

type UpdateCompanyStagePayload = {
  stage: CompanyStage;
};

export async function handleCompaniesController(
  context: RouteContext,
  deps: CompanyServiceDeps & {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
  }
): Promise<boolean> {
  const service = createCompaniesService(deps);
  const { req, res, url, pathname } = context;

  if (req.method === "GET" && pathname === "/companies") {
    const industryId = url.searchParams.get("industryId") ?? undefined;
    const stage = (url.searchParams.get("stage") as CompanyStage | null) ?? undefined;
    const result = await service.listCompanies({ ...(industryId ? { industryId } : {}), ...(stage ? { stage } : {}) });
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && /^\/companies\/[^/]+\/profile-summary$/.test(pathname)) {
    const companyId = pathname.split("/")[2] ?? "";
    const result = await service.getProfileSummary(companyId);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && /^\/companies\/[^/]+\/score-breakdown$/.test(pathname)) {
    const companyId = pathname.split("/")[2] ?? "";
    const result = await service.getScoreBreakdown(companyId);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && pathname === "/companies/shortlist") {
    const industryId = url.searchParams.get("industryId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? "10");
    const minimumScore = Number(url.searchParams.get("minimumScore") ?? "75");
    const result = await service.getShortlist({ ...(industryId ? { industryId } : {}), limit, minimumScore });
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "POST" && pathname === "/companies/discover") {
    const payload = parseJson<TriggerCompanyDiscoveryPayload>(await deps.readBody(req));
    const result = await service.enqueueDiscovery(payload ?? { industryId: "" });
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data, result.status ?? 201));
    return true;
  }

  if (req.method === "PUT" && /^\/companies\/[^/]+\/stage$/.test(pathname)) {
    const companyId = pathname.split("/")[2] ?? "";
    const payload = parseJson<UpdateCompanyStagePayload>(await deps.readBody(req));
    const result = await service.updateStage(companyId, payload?.stage);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  return false;
}
