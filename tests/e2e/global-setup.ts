import { seedOperatorFixtures, seedScriptureFixture } from "./operator-fixture";
import { prisma } from "@/infrastructure/database/client";

export default async function globalSetup() {
  try {
    await seedOperatorFixtures();
    await seedScriptureFixture();
  } finally {
    await prisma.$disconnect();
  }
}
