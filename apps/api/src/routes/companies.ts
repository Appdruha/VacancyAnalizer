import { jsonResponse } from "@edagent/shared";
import { handleCompaniesController } from "../controllers/companies-controller.js";
import type { RouteContext } from "./types.js";
import type { CompanyServiceDeps } from "../services/companies-service.js";

export async function handleCompanyRoutes(
  context: RouteContext,
  deps: CompanyServiceDeps & {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
  }
): Promise<boolean> {
  return handleCompaniesController(context, deps);
}
