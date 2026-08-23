import { seedOperatorFixtures, seedScriptureFixture } from "./operator-fixture";
import { prisma } from "@/infrastructure/database/client";
import { assertDedicatedTestEnvironment } from "@/infrastructure/database/test-database-guard";

export default async function globalSetup() {
  assertDedicatedTestEnvironment(process.env);
  try {
    await seedOperatorFixtures();
    await seedScriptureFixture();
  } finally {
    await prisma.$disconnect();
  }
}
