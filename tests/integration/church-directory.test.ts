import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/infrastructure/database/client";
import { listChurches } from "@/infrastructure/database/church-directory";

const namespace = "test.church-directory";

async function clearDirectoryRecords() {
  await prisma.user.deleteMany({
    where: { email: { startsWith: namespace } },
  });
  await prisma.church.deleteMany({
    where: { name: { startsWith: namespace } },
  });
}

beforeEach(clearDirectoryRecords);
afterEach(clearDirectoryRecords);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("administrator church directory", () => {
  it("returns churches in stable order with only the display identity", async () => {
    const userId = randomUUID();
    const olderChurch = await prisma.church.create({
      data: {
        createdAt: new Date("2026-08-27T00:00:00Z"),
        name: `${namespace} older`,
        status: "SUSPENDED",
        suspendedAt: new Date("2026-08-27T01:00:00Z"),
      },
    });
    await prisma.$transaction([
      prisma.user.create({
        data: {
          actorState: "PENDING",
          email: `${namespace}.member@example.invalid`,
          id: userId,
          name: "Directory Member",
        },
      }),
      prisma.churchMembership.create({
        data: { churchId: olderChurch.id, userId },
      }),
      prisma.church.create({
        data: {
          createdAt: new Date("2026-08-28T00:00:00Z"),
          name: `${namespace} newer`,
        },
      }),
    ]);

    const entries = (await listChurches()).filter(({ name }) =>
      name.startsWith(namespace),
    );

    expect(entries.map(({ name }) => name)).toEqual([
      `${namespace} older`,
      `${namespace} newer`,
    ]);
    expect(entries[0]).toEqual({
      createdAt: new Date("2026-08-27T00:00:00Z"),
      id: olderChurch.id,
      name: `${namespace} older`,
      status: "SUSPENDED",
      user: {
        email: `${namespace}.member@example.invalid`,
        name: "Directory Member",
        status: "PENDING",
      },
    });
    expect(entries[1]?.user).toBeNull();
    expect(Object.keys(entries[0]?.user ?? {}).sort()).toEqual([
      "email",
      "name",
      "status",
    ]);
  });
});
