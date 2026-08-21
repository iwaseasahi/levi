import { seedOperatorFixtures } from "./operator-fixture";
import { prisma } from "@/infrastructure/database/client";

export default async function globalSetup() {
  try {
    await seedOperatorFixtures();
  } finally {
    await prisma.$disconnect();
  }
}
