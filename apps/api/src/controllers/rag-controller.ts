import { jsonResponse, parseJson } from "@edagent/shared";
import type { RouteContext } from "../routes/types.js";
import type { RagServiceDeps } from "../services/rag-service.js";
import { createRagService } from "../services/rag-service.js";

type RagSearchPayload = {
  companyId: string;
  query: string;
  topK?: number;
  reindex?: boolean;
};

type RagReindexPayload = {
  companyId: string;
};

export async function handleRagController(
  context: RouteContext,
  deps: RagServiceDeps & {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
  }
): Promise<boolean> {
  const service = createRagService(deps);
  const { req, res, url, pathname } = context;

  if (req.method === "GET" && pathname === "/rag/search") {
    const companyId = url.searchParams.get("companyId") ?? "";
    const query = url.searchParams.get("query") ?? "";
    const topK = Number(url.searchParams.get("topK") ?? "5");
    const reindex = (url.searchParams.get("reindex") ?? "true") !== "false";
    const result = await service.search({ companyId, query, topK, reindex });
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "POST" && pathname === "/rag/search") {
    const payload = parseJson<RagSearchPayload>(await deps.readBody(req));
    const result = await service.search({
      companyId: payload?.companyId ?? "",
      query: payload?.query ?? "",
      ...(payload?.topK !== undefined ? { topK: payload.topK } : {}),
      ...(payload?.reindex !== undefined ? { reindex: payload.reindex } : {})
    });
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "POST" && pathname === "/rag/reindex") {
    const payload = parseJson<RagReindexPayload>(await deps.readBody(req));
    const result = await service.reindexCompany(payload?.companyId ?? "");
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data, 201));
    return true;
  }

  return false;
}
