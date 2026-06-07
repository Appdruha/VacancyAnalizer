import type {
  Company,
  CompanyContact,
  CompanyScore,
  CompanyStage
} from "@edagent/domain";
import { getPrismaClient } from "../client.js";
import { toCompanySize, withOptional } from "../shared.js";

export type CompanyWithRelations = Company & {
  contacts: CompanyContact[];
  score: CompanyScore | null;
};

export function mapCompanyWithRelations(row: any): CompanyWithRelations {
  return {
    id: row.id,
    name: row.name,
    industryId: row.industryId,
    region: row.region,
    size: toCompanySize(row.size),
    stage: row.stage,
    ...(row.website ? { website: row.website } : {}),
    contacts: Array.isArray(row.contacts)
      ? row.contacts.map((contact: any) =>
          withOptional(
            {
              id: contact.id,
              companyId: contact.companyId,
              fullName: contact.fullName,
              title: contact.title
            },
            "email",
            contact.email ?? undefined
          )
        )
      : [],
    score: row.scores?.[0]
      ? {
          companyId: row.id,
          total: row.scores[0].total,
          competencyFit: row.scores[0].competencyFit,
          reputation: row.scores[0].reputation,
          educationReadiness: row.scores[0].educationReadiness
        }
      : null
  };
}

export async function getCompanies(input?: {
  industryId?: string;
  stage?: CompanyStage;
}): Promise<CompanyWithRelations[]> {
  const rows = await getPrismaClient().company.findMany({
    where: {
      ...(input?.industryId ? { industryId: input.industryId } : {}),
      ...(input?.stage ? { stage: input.stage } : {})
    },
    include: {
      contacts: true,
      scores: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => mapCompanyWithRelations(row));
}

export async function upsertCompany(input: {
  name: string;
  industryId: string;
  region: string;
  size: Company["size"];
  stage: Company["stage"];
  website?: string;
}): Promise<Company> {
  const prisma = getPrismaClient();
  const existing = await prisma.company.findFirst({
    where: {
      industryId: input.industryId,
      name: input.name
    }
  });

  const size = (input.size === "mid-market" ? "mid_market" : input.size) as never;
  const data = {
    name: input.name,
    industryId: input.industryId,
    region: input.region,
    size,
    stage: input.stage,
    website: input.website ?? existing?.website ?? null
  };

  const row = existing
    ? await prisma.company.update({
        where: { id: existing.id },
        data
      })
    : await prisma.company.create({
        data
      });

  return withOptional(
    {
      id: row.id,
      name: row.name,
      industryId: row.industryId,
      region: row.region,
      size: toCompanySize(row.size),
      stage: row.stage
    },
    "website",
    row.website ?? undefined
  );
}

export async function updateCompanyStage(companyId: string, stage: CompanyStage): Promise<Company | null> {
  const row = await getPrismaClient().company.update({
    where: { id: companyId },
    data: { stage }
  });

  return withOptional(
    {
      id: row.id,
      name: row.name,
      industryId: row.industryId,
      region: row.region,
      size: toCompanySize(row.size),
      stage: row.stage
    },
    "website",
    row.website ?? undefined
  );
}

export async function upsertCompanyContact(input: {
  companyId: string;
  fullName: string;
  title: string;
  email?: string;
  linkedinUrl?: string;
}): Promise<CompanyContact> {
  const prisma = getPrismaClient();
  const existing = await prisma.companyContact.findFirst({
    where: {
      companyId: input.companyId,
      fullName: input.fullName
    }
  });

  const data = {
    companyId: input.companyId,
    fullName: input.fullName,
    title: input.title,
    email: input.email ?? existing?.email ?? null,
    linkedinUrl: input.linkedinUrl ?? existing?.linkedinUrl ?? null
  };

  const row = existing
    ? await prisma.companyContact.update({
        where: { id: existing.id },
        data
      })
    : await prisma.companyContact.create({
        data
      });

  return withOptional(
    withOptional(
      {
        id: row.id,
        companyId: row.companyId,
        fullName: row.fullName,
        title: row.title
      },
      "email",
      row.email ?? undefined
    ),
    "linkedinUrl",
    row.linkedinUrl ?? undefined
  );
}

export async function createCompanyScore(input: CompanyScore): Promise<CompanyScore> {
  const row = await getPrismaClient().companyScore.create({
    data: {
      companyId: input.companyId,
      total: input.total,
      competencyFit: input.competencyFit,
      reputation: input.reputation,
      educationReadiness: input.educationReadiness
    }
  });

  return {
    companyId: row.companyId,
    total: row.total,
    competencyFit: row.competencyFit,
    reputation: row.reputation,
    educationReadiness: row.educationReadiness
  };
}

export async function getCompanyById(companyId: string): Promise<CompanyWithRelations | null> {
  const row = await getPrismaClient().company.findUnique({
    where: { id: companyId },
    include: {
      contacts: true,
      scores: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return row ? mapCompanyWithRelations(row) : null;
}

export async function getShortlist(input?: {
  industryId?: string;
  minimumScore?: number;
  limit?: number;
}): Promise<CompanyWithRelations[]> {
  const companies = await getCompanies(
    input?.industryId
      ? {
          industryId: input.industryId
        }
      : undefined
  );

  return companies
    .filter((company) => {
      const manuallyShortlisted = company.stage === "shortlisted" || company.stage === "approved";
      return manuallyShortlisted || (company.score?.total ?? 0) >= (input?.minimumScore ?? 75);
    })
    .sort((left, right) => (right.score?.total ?? 0) - (left.score?.total ?? 0))
    .slice(0, input?.limit ?? 10);
}
