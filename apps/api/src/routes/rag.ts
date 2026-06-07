import { jsonResponse } from "@edagent/shared";
import { handleRagController } from "../controllers/rag-controller.js";
import type { RouteContext } from "./types.js";
import type { RagServiceDeps } from "../services/rag-service.js";

export async function handleRagRoutes(
  context: RouteContext,
  deps: RagServiceDeps & {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
  }
): Promise<boolean> {
  return handleRagController(context, deps);
}
