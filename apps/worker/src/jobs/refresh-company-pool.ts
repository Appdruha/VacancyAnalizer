import { database } from "@edagent/database";
import type { BackgroundJob } from "@edagent/domain";
import { calculateDiscoveryScore, deriveStageFromScore, estimateCompanySize } from "@edagent/scoring";
import { createSystemAuditEntry } from "../services/audit.js";

function toPartnershipContactName(companyName: string): string {
  return `${companyName} Partnerships`;
}

function slugifyCompanyName(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "partner-company";
}

function inferCompanyWebsite(companyName: string): string {
  return `https://${slugifyCompanyName(companyName)}.example`;
}

function inferCompanyEmail(companyName: string): string {
  return `partnerships@${slugifyCompanyName(companyName)}.example`;
}

function inferCompanyContactTitle(vacancyTitles: string[]): string {
  const titleHint = vacancyTitles.join(" ").toLowerCase();

  if (titleHint.includes("hr") || titleHint.includes("recruit")) {
    return "HR Partnerships Lead";
  }
  if (titleHint.includes("product")) {
    return "Product Partnerships Lead";
  }
  if (titleHint.includes("education") || titleHint.includes("learning") || titleHint.includes("teacher")) {
    return "Academic Partnerships Lead";
  }

  return "Partnership Lead";
}

function toMostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let winner: string | null = null;
  let max = -1;
  for (const [value, count] of counts.entries()) {
    if (count > max) {
      winner = value;
      max = count;
    }
  }

  return winner;
}

export async function handleRefreshCompanyPoolJob(job: BackgroundJob): Promise<void> {
  const industryId = String(job.payload.industryId ?? "");
  const limit = Number(job.payload.limit ?? 50);

  if (!industryId) {
    throw new Error("Company discovery job payload is incomplete.");
  }

  const [vacancies, programCompetencies, industries, settings] = await Promise.all([
    database.getVacanciesByIndustry(industryId),
    database.getProgramCompetencies(),
    database.getIndustries(),
    database.getSettings()
  ]);
  const existingCompanies = await database.getCompanies({ industryId });

  const industry = industries.find((item) => item.id === industryId);
  const minimumApprovalScore = Number(
    settings.find((item) => item.key === "scoring.minimumApprovalScore")?.value ?? "75"
  );

  const vacancyGroups = new Map<
    string,
    Array<{
      title: string;
      areaName?: string;
      competencyIds: string[];
    }>
  >();

  for (const vacancy of vacancies) {
    const bucket = vacancyGroups.get(vacancy.companyName) ?? [];
    const nextItem: {
      title: string;
      areaName?: string;
      competencyIds: string[];
    } = {
      title: vacancy.title,
      competencyIds: vacancy.competencyIds
    };
    if (vacancy.areaName !== undefined) {
      nextItem.areaName = vacancy.areaName;
    }
    bucket.push(nextItem);
    vacancyGroups.set(vacancy.companyName, bucket);
  }

  let processedCompanies = 0;
  const programCompetencyIds = new Set(programCompetencies.map((item) => item.competencyId));

  for (const [companyName, companyVacancies] of Array.from(vacancyGroups.entries()).slice(0, limit)) {
    const competencyIds = new Set(companyVacancies.flatMap((item) => item.competencyIds));
    const matchedProgramCompetencies = Array.from(competencyIds).filter((id) => programCompetencyIds.has(id)).length;
    const vacancyTitles = companyVacancies.map((item) => item.title);
    const region =
      toMostCommon(
        companyVacancies
          .map((item) => item.areaName)
          .filter((value): value is string => Boolean(value))
      ) ?? "Remote";
    const size = estimateCompanySize(companyVacancies.length);
    const website = inferCompanyWebsite(companyName);
    const contactTitle = inferCompanyContactTitle(vacancyTitles);

    const provisionalScore = calculateDiscoveryScore({
      companyName,
      industryName: industry?.name ?? "Unknown industry",
      size,
      vacancyCount: companyVacancies.length,
      matchedProgramCompetencies,
      totalCompanyCompetencies: competencyIds.size,
      contactCount: 1,
      hasWebsite: true,
      region
    });
    const currentCompany = existingCompanies.find((item) => item.name === companyName);
    const stage =
      currentCompany &&
      ["shortlisted", "approved", "contacted", "replied", "partnered"].includes(currentCompany.stage)
        ? currentCompany.stage
        : deriveStageFromScore(provisionalScore.total, minimumApprovalScore);

    const company = await database.upsertCompany({
      name: companyName,
      industryId,
      region,
      size,
      stage,
      website
    });

    await database.upsertCompanyContact({
      companyId: company.id,
      fullName: toPartnershipContactName(companyName),
      title: contactTitle,
      email: inferCompanyEmail(companyName)
    });

    await database.createCompanyScore({
      ...provisionalScore,
      companyId: company.id
    });

    await createSystemAuditEntry("company.discovered", "company", company.id);

    processedCompanies += 1;
  }

  console.log(
    JSON.stringify({
      scope: "worker.company_discovery",
      status: "completed",
      jobId: job.id,
      industryId,
      processedCompanies,
      discoveredFromVacancies: vacancies.length,
      minimumApprovalScore
    })
  );
}
