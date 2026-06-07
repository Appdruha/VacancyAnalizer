import { database } from "@edagent/database";

export async function buildCompanyProfile(companyId: string) {
  const [company, industries, competencies, vacancies] = await Promise.all([
    database.getCompanyById(companyId),
    database.getIndustries(),
    database.getCompetencies(),
    database.getVacancies()
  ]);

  if (!company) {
    return null;
  }

  const industry = industries.find((item) => item.id === company.industryId);
  const topCompetencyIds = vacancies
    .filter((vacancy) => vacancy.companyName === company.name)
    .flatMap((vacancy) => vacancy.competencyIds);
  const topCompetencies = Array.from(new Set(topCompetencyIds))
    .map((id) => competencies.find((item) => item.id === id)?.name)
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);
  const primaryContact = company.contacts[0];

  return {
    company,
    primaryContact,
    profile: {
      companyName: company.name,
      industryName: industry?.name ?? "Unknown industry",
      region: company.region,
      stage: company.stage,
      score: company.score,
      topCompetencies,
      ...(company.website ? { website: company.website } : {}),
      ...(primaryContact?.fullName ? { contactName: primaryContact.fullName } : {}),
      ...(primaryContact?.title ? { contactTitle: primaryContact.title } : {})
    }
  };
}
