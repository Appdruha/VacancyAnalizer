import { jsonResponse } from "@edagent/shared";
import type { RouteContext } from "../routes/types.js";
import type { MemoryServiceDeps } from "../services/memory-service.js";
import { createMemoryService } from "../services/memory-service.js";

export async function handleMemoryController(
  context: RouteContext,
  deps: MemoryServiceDeps & {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
  }
): Promise<boolean> {
  const service = createMemoryService(deps);
  const { req, res, url, pathname } = context;

  if (req.method === "GET" && pathname === "/memory-events") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const eventType = url.searchParams.get("eventType") ?? undefined;
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const result = await service.listMemoryEvents({
      ...(companyId ? { companyId } : {}),
      ...(eventType ? { eventType } : {}),
      ...(limit ? { limit } : {})
    });
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && pathname === "/memory/recommendations") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const result = await service.getRecommendation(companyId);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && pathname === "/memory/overview") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const result = await service.getOverview(companyId);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && pathname === "/ml/health") {
    const result = await service.getMlHealth();
    if (!result.ok) {
      deps.send(res, jsonResponse(service.degradedMlHealth(result.message), result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "POST" && pathname === "/ml/evaluations/run") {
    const result = await service.runMlEvaluation();
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data, result.status ?? 201));
    return true;
  }

  return false;
}
