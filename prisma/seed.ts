import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: {
      email: "admin@edagent.local"
    },
    update: {
      fullName: "Platform Admin",
      role: "admin"
    },
    create: {
      email: "admin@edagent.local",
      fullName: "Platform Admin",
      role: "admin"
    }
  });

  await prisma.user.upsert({
    where: {
      email: "operator@edagent.local"
    },
    update: {
      fullName: "Outreach Operator",
      role: "operator"
    },
    create: {
      email: "operator@edagent.local",
      fullName: "Outreach Operator",
      role: "operator"
    }
  });

  for (const setting of [
    { key: "outreach.followUpDays", value: "10" },
    { key: "scoring.minimumApprovalScore", value: "75" }
  ]) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting
    });
  }

  console.log("Minimal bootstrap seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
