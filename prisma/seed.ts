import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.backgroundJob.deleteMany();
  await prisma.ingestionRun.deleteMany();
  await prisma.industrySource.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.agentMemoryEvent.deleteMany();
  await prisma.projectCompetency.deleteMany();
  await prisma.projectBrief.deleteMany();
  await prisma.partnerAgreement.deleteMany();
  await prisma.reply.deleteMany();
  await prisma.messageDraft.deleteMany();
  await prisma.outreachCampaign.deleteMany();
  await prisma.companyScore.deleteMany();
  await prisma.companyContact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.vacancyCompetency.deleteMany();
  await prisma.vacancy.deleteMany();
  await prisma.programCompetency.deleteMany();
  await prisma.competency.deleteMany();
  await prisma.industry.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: "admin@edagent.local",
      fullName: "Platform Admin",
      role: "admin"
    }
  });

  const operator = await prisma.user.create({
    data: {
      email: "operator@edagent.local",
      fullName: "Outreach Operator",
      role: "operator"
    }
  });

  const edtech = await prisma.industry.create({
    data: {
      name: "EdTech",
      priority: 1,
      approvedByUserId: admin.id
    }
  });

  const aiProducts = await prisma.industry.create({
    data: {
      name: "AI Products",
      priority: 2,
      approvedByUserId: admin.id
    }
  });

  const ts = await prisma.competency.create({
    data: {
      name: "TypeScript",
      category: "engineering"
    }
  });

  const da = await prisma.competency.create({
    data: {
      name: "Data Analysis",
      category: "analytics"
    }
  });

  const pe = await prisma.competency.create({
    data: {
      name: "Prompt Engineering",
      category: "ai"
    }
  });

  await prisma.programCompetency.createMany({
    data: [
      {
        programName: "Project Learning",
        competencyId: ts.id,
        coverageScore: 78
      },
      {
        programName: "Project Learning",
        competencyId: da.id,
        coverageScore: 66
      }
    ]
  });

  const vacancy = await prisma.vacancy.create({
    data: {
      externalId: "7760476",
      source: "hh",
      title: "Junior TypeScript Developer",
      companyName: "SkillMatrix",
      areaName: "Moscow",
      employmentName: "Full time",
      experienceName: "No experience",
      requirement: "TypeScript, REST API, SQL",
      industryId: edtech.id,
      collectedAt: new Date()
    }
  });

  const hhSource = await prisma.industrySource.create({
    data: {
      industryId: edtech.id,
      source: "hh",
      status: "active",
      config: {
        query: "typescript edtech",
        area: "1",
        perPage: 20
      }
    }
  });

  await prisma.industrySource.create({
    data: {
      industryId: edtech.id,
      source: "linkedin",
      status: "disabled",
      config: {}
    }
  });

  await prisma.vacancyCompetency.createMany({
    data: [
      { vacancyId: vacancy.id, competencyId: ts.id },
      { vacancyId: vacancy.id, competencyId: pe.id }
    ]
  });

  const company1 = await prisma.company.create({
    data: {
      name: "SkillMatrix",
      industryId: edtech.id,
      region: "Moscow",
      size: "mid_market",
      stage: "shortlisted",
      website: "https://example.com/skillmatrix"
    }
  });

  const company2 = await prisma.company.create({
    data: {
      name: "Vector AI Labs",
      industryId: aiProducts.id,
      region: "Yekaterinburg",
      size: "startup",
      stage: "discovered",
      website: "https://example.com/vector-ai"
    }
  });

  const contact = await prisma.companyContact.create({
    data: {
      companyId: company1.id,
      fullName: "Irina Petrova",
      title: "HR Director",
      email: "irina@example.com"
    }
  });

  await prisma.companyScore.createMany({
    data: [
      {
        companyId: company1.id,
        total: 84,
        competencyFit: 88,
        reputation: 80,
        educationReadiness: 79
      },
      {
        companyId: company2.id,
        total: 73,
        competencyFit: 77,
        reputation: 70,
        educationReadiness: 71
      }
    ]
  });

  await prisma.outreachCampaign.create({
    data: {
      name: "Pilot EdTech Outreach",
      channel: "email",
      status: "draft"
    }
  });

  await prisma.messageDraft.create({
    data: {
      companyId: company1.id,
      contactId: contact.id,
      subject: "Partnership proposal with Project Learning",
      body: "We would like to discuss a project-based partnership format.",
      tone: "formal",
      approved: false
    }
  });

  await prisma.agentMemoryEvent.create({
    data: {
      companyId: company1.id,
      eventType: "company_shortlisted",
      payload: { score: 84 }
    }
  });

  await prisma.systemSetting.createMany({
    data: [
      { key: "outreach.followUpDays", value: "10" },
      { key: "scoring.minimumApprovalScore", value: "75" }
    ]
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "industry.approved",
      entityType: "industry",
      entityId: edtech.id
    }
  });

  await prisma.backgroundJob.create({
    data: {
      queue: "company-discovery",
      type: "refresh-company-pool",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      payload: { industryId: edtech.id }
    }
  });

  await prisma.ingestionRun.create({
    data: {
      industryId: edtech.id,
      sourceId: hhSource.id,
      status: "completed",
      query: "typescript edtech",
      page: 0,
      perPage: 20,
      totalFound: 1,
      processedCount: 1,
      competencyCount: 2,
      startedAt: new Date(),
      finishedAt: new Date()
    }
  });

  console.log(`Seed completed for users ${admin.email} and ${operator.email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
