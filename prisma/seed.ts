import "dotenv/config";

import { prisma } from "../src/infrastructure/database/client.js";

const FOUNDATION_SETTING_ID = "00000000-0000-4000-8000-000000000001";

async function seed() {
  await prisma.systemSetting.upsert({
    where: { key: "foundation.version" },
    update: {},
    create: {
      id: FOUNDATION_SETTING_ID,
      key: "foundation.version",
      value: "1",
    },
  });
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
