import { jsonResponse, parseJson } from "@edagent/shared";
import type { RouteContext } from "../routes/types.js";
import type { ProjectServiceDeps } from "../services/project-service.js";
import { createProjectService } from "../services/project-service.js";
import type { CommunicationPackage, PartnerAgreement } from "@edagent/domain";

type CreateAgreementPayload = {
  companyId: string;
  status?: PartnerAgreement["status"];
};

type UpdateAgreementStatusPayload = {
  status: PartnerAgreement["status"];
};

type GenerateProjectBriefPayload = {
  partnerAgreementId: string;
  title?: string;
};

type GenerateCommunicationPackagesPayload = {
  companyId: string;
  partnerAgreementId?: string;
};

export async function handleProjectController(
  context: RouteContext,
  deps: ProjectServiceDeps & {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
  }
): Promise<boolean> {
  const service = createProjectService(deps);
  const { req, res, url, pathname } = context;

  if (req.method === "GET" && pathname === "/agreements") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const status = (url.searchParams.get("status") as PartnerAgreement["status"] | null) ?? undefined;
    const result = await service.listAgreements({
      ...(companyId ? { companyId } : {}),
      ...(status ? { status } : {})
    });
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "POST" && pathname === "/agreements") {
    const payload = parseJson<CreateAgreementPayload>(await deps.readBody(req));
    const result = await service.createAgreement(payload ?? undefined);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data, result.status ?? 201));
    return true;
  }

  if (req.method === "PUT" && /^\/agreements\/[^/]+\/status$/.test(pathname)) {
    const agreementId = pathname.split("/")[2] ?? "";
    const payload = parseJson<UpdateAgreementStatusPayload>(await deps.readBody(req));
    const result = await service.updateAgreementStatus(agreementId, payload ?? undefined);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && pathname === "/project-briefs") {
    const partnerAgreementId = url.searchParams.get("partnerAgreementId") ?? undefined;
    const result = await service.listProjectBriefs(partnerAgreementId);
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && pathname === "/communication-packages") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const partnerAgreementId = url.searchParams.get("partnerAgreementId") ?? undefined;
    const kind = (url.searchParams.get("kind") as CommunicationPackage["kind"] | null) ?? undefined;
    const result = await service.listCommunicationPackages({
      ...(companyId ? { companyId } : {}),
      ...(partnerAgreementId ? { partnerAgreementId } : {}),
      ...(kind ? { kind } : {})
    });
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "POST" && pathname === "/communication-packages/generate") {
    const payload = parseJson<GenerateCommunicationPackagesPayload>(await deps.readBody(req));
    const result = await service.generateCommunicationPackages(payload ?? undefined);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data, result.status ?? 201));
    return true;
  }

  if (req.method === "POST" && pathname === "/project-briefs/generate") {
    const payload = parseJson<GenerateProjectBriefPayload>(await deps.readBody(req));
    const result = await service.generateProjectBrief(payload ?? undefined);
    if (!result.ok) {
      deps.send(res, jsonResponse({ error: result.error, message: result.message }, result.status));
      return true;
    }
    deps.send(res, jsonResponse(result.data, result.status ?? 201));
    return true;
  }

  if (req.method === "GET" && pathname === "/projects/catalog") {
    const result = await service.getProjectCatalog();
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  if (req.method === "GET" && pathname === "/users") {
    const result = await service.getUsers();
    deps.send(res, jsonResponse(result.data));
    return true;
  }

  return false;
}
