import "dotenv/config";

import { INTERNAL_PLATFORM_OPERATOR_ID } from "../src/domain/admin/platform-operator.js";
import { prisma } from "../src/infrastructure/database/client.js";

try {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "foundation.version" },
  });

  if (setting?.id !== "00000000-0000-4000-8000-000000000001") {
    throw new Error("Deterministic foundation seed is missing");
  }

  const operator = await prisma.platformOperator.findUnique({
    where: { userId: INTERNAL_PLATFORM_OPERATOR_ID },
    select: {
      user: {
        select: { accounts: { select: { id: true } }, actorState: true },
      },
    },
  });
  if (
    operator?.user.actorState !== "ACTIVE" ||
    operator.user.accounts.length !== 0
  ) {
    throw new Error("Credential-free internal operator seed is missing");
  }

  const translations = await prisma.bibleTranslation.findMany({
    where: { code: { in: ["JSS3", "NKJV"] } },
    orderBy: { displayOrder: "asc" },
    select: { code: true, rightsStatus: true },
  });
  if (
    JSON.stringify(translations) !==
    JSON.stringify([
      { code: "JSS3", rightsStatus: "PENDING" },
      { code: "NKJV", rightsStatus: "PENDING" },
    ])
  ) {
    throw new Error("Deterministic pending Bible translation seed is missing");
  }

  const result = await prisma.$queryRaw<
    Array<{ result: number }>
  >`SELECT 1 AS result`;
  if (result[0]?.result !== 1) {
    throw new Error("Database connectivity check returned an unexpected value");
  }
} finally {
  await prisma.$disconnect();
}
