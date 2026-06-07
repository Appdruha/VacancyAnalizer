import type { AuditLog, BackgroundJob, SystemSetting, User } from "@edagent/domain";
import { getPrismaClient } from "../client.js";
import { toBackgroundJob } from "../mappers.js";

export async function getUsers(): Promise<User[]> {
  const rows = await getPrismaClient().user.findMany({
    orderBy: { createdAt: "asc" }
  });

  return rows.map((row: any) => ({
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role
  }));
}

export async function ensureSystemBootstrap(input: {
  adminEmail: string;
  operatorEmail: string;
  defaultPasswordSettings?: Array<{
    key: string;
    value: string;
  }>;
}): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.user.upsert({
    where: { email: input.adminEmail },
    update: {
      fullName: "Platform Admin",
      role: "admin"
    },
    create: {
      email: input.adminEmail,
      fullName: "Platform Admin",
      role: "admin"
    }
  });

  await prisma.user.upsert({
    where: { email: input.operatorEmail },
    update: {
      fullName: "Outreach Operator",
      role: "operator"
    },
    create: {
      email: input.operatorEmail,
      fullName: "Outreach Operator",
      role: "operator"
    }
  });

  for (const setting of input.defaultPasswordSettings ?? []) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value
      },
      create: {
        key: setting.key,
        value: setting.value
      }
    });
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const row = await getPrismaClient().user.findUnique({
    where: { email }
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role
  };
}

export async function upsertUserByEmail(input: {
  email: string;
  fullName: string;
  role: User["role"];
}): Promise<User> {
  const row = await getPrismaClient().user.upsert({
    where: { email: input.email },
    update: {
      fullName: input.fullName,
      role: input.role
    },
    create: {
      email: input.email,
      fullName: input.fullName,
      role: input.role
    }
  });

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role
  };
}

export async function getSettings(): Promise<SystemSetting[]> {
  const rows = await getPrismaClient().systemSetting.findMany({
    orderBy: { key: "asc" }
  });

  return rows.map((row: any) => ({
    key: row.key,
    value: row.value,
    updatedAt: row.updatedAt.toISOString()
  }));
}

export async function upsertSetting(key: string, value: string): Promise<SystemSetting> {
  const row = await getPrismaClient().systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });

  return {
    key: row.key,
    value: row.value,
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const rows = await getPrismaClient().auditLog.findMany({
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => ({
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function createAuditLog(entry: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
  const row = await getPrismaClient().auditLog.create({
    data: entry
  });

  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString()
  };
}

export async function getJobs(): Promise<BackgroundJob[]> {
  const rows = await getPrismaClient().backgroundJob.findMany({
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toBackgroundJob(row));
}

export async function createJob(input: Omit<BackgroundJob, "id" | "createdAt" | "updatedAt">): Promise<BackgroundJob> {
  const row = await getPrismaClient().backgroundJob.create({
    data: {
      queue: input.queue,
      type: input.type,
      status: input.status,
      attempts: input.attempts,
      maxAttempts: input.maxAttempts,
      payload: input.payload as never,
      lastError: input.lastError ?? null
    }
  });

  return toBackgroundJob(row);
}

export async function claimNextJob(): Promise<BackgroundJob | null> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx: any) => {
    const candidate = await tx.backgroundJob.findFirst({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" }
    });

    if (!candidate) {
      return null;
    }

    const updated = await tx.backgroundJob.updateMany({
      where: {
        id: candidate.id,
        status: "queued"
      },
      data: {
        status: "running",
        attempts: { increment: 1 }
      }
    });

    if (updated.count === 0) {
      return null;
    }

    const claimed = await tx.backgroundJob.findUnique({
      where: { id: candidate.id }
    });

    return claimed ? toBackgroundJob(claimed) : null;
  });
}

export async function completeJob(jobId: string): Promise<BackgroundJob | null> {
  const row = await getPrismaClient().backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      lastError: null
    }
  });

  return toBackgroundJob(row);
}

export async function failJob(jobId: string, errorMessage: string): Promise<BackgroundJob | null> {
  const prisma = getPrismaClient();
  const current = await prisma.backgroundJob.findUnique({
    where: { id: jobId }
  });

  if (!current) {
    return null;
  }

  const shouldRetry = current.attempts < current.maxAttempts;
  const row = await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: shouldRetry ? "queued" : "failed",
      lastError: errorMessage
    }
  });

  return toBackgroundJob(row);
}

export async function getJobStats(): Promise<Record<BackgroundJob["status"], number>> {
  const grouped = await getPrismaClient().backgroundJob.groupBy({
    by: ["status"],
    _count: { status: true }
  });

  return (grouped as Array<{ status: BackgroundJob["status"]; _count: { status: number } }>).reduce(
    (acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    },
    {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0
    }
  );
}
