import type { User } from "@edagent/domain";

export function canAccessRoute(user: User, method: string, pathname: string): boolean {
  if (user.role === "admin") {
    return true;
  }

  const normalizedMethod = method.toUpperCase();
  const operatorAllowedPrefixes = [
    "/platform/bootstrap",
    "/companies",
    "/companies/shortlist",
    "/companies/",
    "/vacancies",
    "/industry-sources",
    "/ingestion-runs",
    "/analytics/competency-gap",
    "/analytics/competency-extraction/preview",
    "/drafts",
    "/campaigns",
    "/messages",
    "/message-events",
    "/replies",
    "/memory-events",
    "/memory/recommendations",
    "/memory/overview",
    "/project-briefs",
    "/communication-packages",
    "/projects/catalog",
    "/agreements",
    "/ml/health",
    "/ml/evaluations/run",
    "/auth/me"
  ];

  if (user.role === "operator") {
    if (normalizedMethod === "GET") {
      return operatorAllowedPrefixes.some((prefix) => pathname.startsWith(prefix));
    }

    return (
      pathname === "/drafts/generate" ||
      pathname === "/analytics/competency-extraction/preview" ||
      pathname === "/communication-packages/generate"
    );
  }

  if (user.role === "manager") {
    const adminOnlyPrefixes = ["/settings", "/jobs", "/industry-sources", "/users"];
    if (adminOnlyPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      return false;
    }
    return true;
  }

  return false;
}
