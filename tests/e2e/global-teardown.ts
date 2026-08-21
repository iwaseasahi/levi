import { clearOperatorFixtures } from "./operator-fixture";
import { prisma } from "@/infrastructure/database/client";

export default async function globalTeardown() {
  try {
    await clearOperatorFixtures();
  } finally {
    await prisma.$disconnect();
  }
}
