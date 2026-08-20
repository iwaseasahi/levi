import { PrismaPg } from "@prisma/adapter-pg";

import { getDatabaseUrl } from "@/config/env";
import { PrismaClient } from "@/generated/prisma/client";

const globalDatabase = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalDatabase.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalDatabase.prisma = prisma;
}
