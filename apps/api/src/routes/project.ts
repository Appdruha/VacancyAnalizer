import { jsonResponse } from "@edagent/shared";
import { handleProjectController } from "../controllers/project-controller.js";
import type { RouteContext } from "./types.js";
import type { ProjectServiceDeps } from "../services/project-service.js";

export async function handleProjectRoutes(
  context: RouteContext,
  deps: ProjectServiceDeps & {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
  }
): Promise<boolean> {
  return handleProjectController(context, deps);
}
