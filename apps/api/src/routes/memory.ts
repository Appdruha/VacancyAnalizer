import { jsonResponse } from "@edagent/shared";
import { handleMemoryController } from "../controllers/memory-controller.js";
import type { RouteContext } from "./types.js";
import type { MemoryServiceDeps } from "../services/memory-service.js";

export async function handleMemoryRoutes(
  context: RouteContext,
  deps: MemoryServiceDeps & {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
  }
): Promise<boolean> {
  return handleMemoryController(context, deps);
}
