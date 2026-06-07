import { jsonResponse } from "@edagent/shared";
import { handleOutreachController } from "../controllers/outreach-controller.js";
import type { RouteContext } from "./types.js";
import type { OutreachServiceDeps } from "../services/outreach-service.js";

export async function handleOutreachRoutes(
  context: RouteContext,
  deps: OutreachServiceDeps & {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
  }
): Promise<boolean> {
  return handleOutreachController(context, deps);
}
