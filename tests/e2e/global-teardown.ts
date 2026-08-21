import {
  clearOperatorFixtures,
  clearScriptureFixture,
} from "./operator-fixture";
import { prisma } from "@/infrastructure/database/client";

export default async function globalTeardown() {
  try {
    await clearOperatorFixtures();
    await clearScriptureFixture();
  } finally {
    await prisma.$disconnect();
  }
}
