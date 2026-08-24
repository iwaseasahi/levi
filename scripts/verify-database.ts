import "dotenv/config";

import { BASIC_BOOTSTRAP_ADMIN_USER_ID } from "../src/domain/admin/admin-user.js";
import { prisma } from "../src/infrastructure/database/client.js";

try {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "foundation.version" },
  });

  if (setting?.id !== "00000000-0000-4000-8000-000000000001") {
    throw new Error("Deterministic foundation seed is missing");
  }

  const administrator = await prisma.adminUser.findUnique({
    where: { id: BASIC_BOOTSTRAP_ADMIN_USER_ID },
    select: { passwordHash: true, status: true },
  });
  if (administrator?.status !== "BOOTSTRAP" || administrator.passwordHash) {
    throw new Error("Credential-free bootstrap administrator seed is missing");
  }

  const translations = await prisma.bibleTranslation.findMany({
    where: { code: { in: ["JSS3", "NKJV"] } },
    orderBy: { displayOrder: "asc" },
    select: { code: true },
  });
  if (
    JSON.stringify(translations) !==
    JSON.stringify([{ code: "JSS3" }, { code: "NKJV" }])
  ) {
    throw new Error("Deterministic Bible translation seed is missing");
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
