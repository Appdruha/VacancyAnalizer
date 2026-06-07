import { PrismaClient } from "@prisma/client";

declare global {
  var __edagentPrisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!globalThis.__edagentPrisma) {
    globalThis.__edagentPrisma = new PrismaClient();
  }

  return globalThis.__edagentPrisma;
}
