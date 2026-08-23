import "dotenv/config";

import {
  INTERNAL_PLATFORM_OPERATOR_EMAIL,
  INTERNAL_PLATFORM_OPERATOR_ID,
  INTERNAL_PLATFORM_OPERATOR_NAME,
} from "../src/domain/admin/platform-operator.js";
import { prisma } from "../src/infrastructure/database/client.js";

const FOUNDATION_SETTING_ID = "00000000-0000-4000-8000-000000000001";
const JSS3_TRANSLATION_ID = "00000000-0000-4000-8000-000000000101";
const NKJV_TRANSLATION_ID = "00000000-0000-4000-8000-000000000102";

async function seed() {
  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: "foundation.version" },
      update: {},
      create: {
        id: FOUNDATION_SETTING_ID,
        key: "foundation.version",
        value: "1",
      },
    }),
    prisma.user.upsert({
      where: { id: INTERNAL_PLATFORM_OPERATOR_ID },
      update: {
        actorState: "ACTIVE",
        email: INTERNAL_PLATFORM_OPERATOR_EMAIL,
        mustChangePassword: false,
        name: INTERNAL_PLATFORM_OPERATOR_NAME,
      },
      create: {
        actorState: "ACTIVE",
        email: INTERNAL_PLATFORM_OPERATOR_EMAIL,
        id: INTERNAL_PLATFORM_OPERATOR_ID,
        name: INTERNAL_PLATFORM_OPERATOR_NAME,
      },
    }),
    prisma.platformOperator.upsert({
      where: { userId: INTERNAL_PLATFORM_OPERATOR_ID },
      update: {},
      create: { userId: INTERNAL_PLATFORM_OPERATOR_ID },
    }),
    prisma.bibleTranslation.upsert({
      where: { code: "JSS3" },
      update: {},
      create: {
        id: JSS3_TRANSLATION_ID,
        code: "JSS3",
        name: "新改訳聖書第3版",
        languageTag: "ja",
        displayOrder: 1,
      },
    }),
    prisma.bibleTranslation.upsert({
      where: { code: "NKJV" },
      update: {},
      create: {
        id: NKJV_TRANSLATION_ID,
        code: "NKJV",
        name: "New King James Version",
        languageTag: "en",
        displayOrder: 2,
      },
    }),
  ]);
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
