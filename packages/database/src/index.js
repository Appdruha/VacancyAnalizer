import { PrismaClient } from "@prisma/client";
function getPrismaClient() {
    if (!globalThis.__edagentPrisma) {
        globalThis.__edagentPrisma = new PrismaClient();
    }
    return globalThis.__edagentPrisma;
}
function withOptional(object, key, value) {
    if (value === undefined) {
        return object;
    }
    return {
        ...object,
        [key]: value
    };
}
function toCompanySize(value) {
    if (value === "mid_market") {
        return "mid-market";
    }
    return value;
}
function jsonRecord(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return {};
    }
    const entries = Object.entries(input);
    const result = {};
    for (const [key, value] of entries) {
        if (value === null ||
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean") {
            result[key] = value;
        }
    }
    return result;
}
function toBackgroundJob(row) {
    return withOptional({
        id: row.id,
        queue: row.queue,
        type: row.type,
        status: row.status,
        attempts: row.attempts,
        maxAttempts: row.maxAttempts,
        payload: jsonRecord(row.payload),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
    }, "lastError", row.lastError ?? undefined);
}
async function getIndustries() {
    const prisma = getPrismaClient();
    const rows = await prisma.industry.findMany({
        orderBy: [{ priority: "asc" }, { name: "asc" }]
    });
    return rows.map((row) => withOptional({
        id: row.id,
        name: row.name,
        priority: row.priority
    }, "approvedByUserId", row.approvedByUserId ?? undefined));
}
async function getCompetencies() {
    const prisma = getPrismaClient();
    const rows = await prisma.competency.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }]
    });
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category
    }));
}
async function getProgramCompetencies() {
    const prisma = getPrismaClient();
    const rows = await prisma.programCompetency.findMany({
        orderBy: [{ programName: "asc" }, { createdAt: "asc" }]
    });
    return rows.map((row) => ({
        id: row.id,
        programName: row.programName,
        competencyId: row.competencyId,
        coverageScore: row.coverageScore
    }));
}
async function getVacancies() {
    const prisma = getPrismaClient();
    const rows = await prisma.vacancy.findMany({
        include: {
            competencies: true
        },
        orderBy: { collectedAt: "desc" }
    });
    return rows.map((row) => ({
        id: row.id,
        source: row.source,
        title: row.title,
        companyName: row.companyName,
        industryId: row.industryId,
        competencyIds: row.competencies.map((item) => item.competencyId),
        collectedAt: row.collectedAt.toISOString()
    }));
}
async function getUsers() {
    const prisma = getPrismaClient();
    const rows = await prisma.user.findMany({
        orderBy: { createdAt: "asc" }
    });
    return rows.map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        role: row.role
    }));
}
async function findUserByEmail(email) {
    const prisma = getPrismaClient();
    const row = await prisma.user.findUnique({
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
async function getSettings() {
    const prisma = getPrismaClient();
    const rows = await prisma.systemSetting.findMany({
        orderBy: { key: "asc" }
    });
    return rows.map((row) => ({
        key: row.key,
        value: row.value,
        updatedAt: row.updatedAt.toISOString()
    }));
}
async function upsertSetting(key, value) {
    const prisma = getPrismaClient();
    const row = await prisma.systemSetting.upsert({
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
async function getAuditLogs() {
    const prisma = getPrismaClient();
    const rows = await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        createdAt: row.createdAt.toISOString()
    }));
}
async function createAuditLog(entry) {
    const prisma = getPrismaClient();
    const row = await prisma.auditLog.create({
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
async function getJobs() {
    const prisma = getPrismaClient();
    const rows = await prisma.backgroundJob.findMany({
        orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => toBackgroundJob(row));
}
async function createJob(input) {
    const prisma = getPrismaClient();
    const row = await prisma.backgroundJob.create({
        data: {
            queue: input.queue,
            type: input.type,
            status: input.status,
            attempts: input.attempts,
            maxAttempts: input.maxAttempts,
            payload: input.payload,
            lastError: input.lastError ?? null
        }
    });
    return toBackgroundJob(row);
}
async function claimNextJob() {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
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
                attempts: {
                    increment: 1
                }
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
async function completeJob(jobId) {
    const prisma = getPrismaClient();
    const row = await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
            status: "completed",
            lastError: null
        }
    });
    return toBackgroundJob(row);
}
async function failJob(jobId, errorMessage) {
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
async function getJobStats() {
    const prisma = getPrismaClient();
    const grouped = await prisma.backgroundJob.groupBy({
        by: ["status"],
        _count: {
            status: true
        }
    });
    return grouped.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
    }, {
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0
    });
}
async function getCompanies() {
    const prisma = getPrismaClient();
    const rows = await prisma.company.findMany({
        include: {
            contacts: true,
            scores: {
                orderBy: { createdAt: "desc" },
                take: 1
            }
        },
        orderBy: { createdAt: "asc" }
    });
    return rows.map((row) => ({
        ...withOptional({
            id: row.id,
            name: row.name,
            industryId: row.industryId,
            region: row.region,
            size: toCompanySize(row.size),
            stage: row.stage
        }, "website", row.website ?? undefined),
        contacts: row.contacts.map((contact) => withOptional(withOptional({
            id: contact.id,
            companyId: contact.companyId,
            fullName: contact.fullName,
            title: contact.title
        }, "email", contact.email ?? undefined), "linkedinUrl", contact.linkedinUrl ?? undefined)),
        score: row.scores[0]
            ? {
                companyId: row.scores[0].companyId,
                total: row.scores[0].total,
                competencyFit: row.scores[0].competencyFit,
                reputation: row.scores[0].reputation,
                educationReadiness: row.scores[0].educationReadiness
            }
            : null
    }));
}
async function getSnapshot() {
    const [industries, competencies, programCompetencies, vacancies, users, settings, auditLogs, jobs, companies] = await Promise.all([
        getIndustries(),
        getCompetencies(),
        getProgramCompetencies(),
        getVacancies(),
        getUsers(),
        getSettings(),
        getAuditLogs(),
        getJobs(),
        getCompanies()
    ]);
    const plainCompanies = companies.map(({ contacts: _contacts, score: _score, ...company }) => company);
    const contacts = companies.flatMap((company) => company.contacts);
    const scores = companies.flatMap((company) => (company.score ? [company.score] : []));
    return {
        industries,
        competencies,
        programCompetencies,
        vacancies,
        companies: plainCompanies,
        contacts,
        scores,
        users,
        settings,
        auditLogs,
        jobs
    };
}
export async function canReachDatabase() {
    try {
        const prisma = getPrismaClient();
        await prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch {
        return false;
    }
}
export async function disconnectDatabase() {
    const prisma = getPrismaClient();
    await prisma.$disconnect();
}
export const database = {
    canReachDatabase,
    getIndustries,
    getCompetencies,
    getProgramCompetencies,
    getVacancies,
    getUsers,
    findUserByEmail,
    getSettings,
    upsertSetting,
    getAuditLogs,
    createAuditLog,
    getJobs,
    getJobStats,
    createJob,
    claimNextJob,
    completeJob,
    failJob,
    getCompanies,
    getSnapshot
};
//# sourceMappingURL=index.js.map