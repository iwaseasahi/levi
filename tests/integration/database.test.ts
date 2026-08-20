import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/infrastructure/database/client";
import { buildSystemSetting } from "../helpers/system-setting-factory";

async function clearTestRecords() {
  await prisma.systemSetting.deleteMany({
    where: { key: { startsWith: "test." } },
  });
}

beforeEach(clearTestRecords);
afterEach(clearTestRecords);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("database foundation", () => {
  it("persists and reads an isolated fixture", async () => {
    const fixture = buildSystemSetting();

    await prisma.systemSetting.create({ data: fixture });

    await expect(
      prisma.systemSetting.findUnique({ where: { id: fixture.id } }),
    ).resolves.toMatchObject(fixture);
  });

  it("starts without records left by another test", async () => {
    await expect(
      prisma.systemSetting.count({ where: { key: { startsWith: "test." } } }),
    ).resolves.toBe(0);
  });
});
