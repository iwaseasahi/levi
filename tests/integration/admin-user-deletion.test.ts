import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { deleteAdminUser } from "@/infrastructure/auth/admin-user-deletion";
import { prisma } from "@/infrastructure/database/client";

const namespace = "test.delete-admin.";

async function clear() {
  await prisma.adminUser.updateMany({
    data: { invitedByAdminUserId: null },
    where: { loginId: { startsWith: namespace } },
  });
  await prisma.adminUser.deleteMany({
    where: { loginId: { startsWith: namespace } },
  });
}

async function createAdmin(status: "ACTIVE" | "INVITED" = "ACTIVE") {
  return prisma.adminUser.create({
    data: {
      loginId: `${namespace}${randomUUID()}`,
      mustChangePassword: status === "INVITED",
      name: "Deletion test administrator",
      passwordHash: "synthetic",
      status,
    },
  });
}

beforeEach(clear);
afterEach(clear);
afterAll(() => prisma.$disconnect());

describe("admin user deletion", () => {
  it("physically deletes the administrator and sessions while preserving invitees", async () => {
    const actor = await createAdmin();
    const target = await createAdmin();
    const invitee = await prisma.adminUser.create({
      data: {
        invitedAt: new Date(),
        invitedByAdminUserId: target.id,
        loginId: `${namespace}${randomUUID()}`,
        mustChangePassword: true,
        name: "Preserved invitee",
        passwordHash: "synthetic",
        status: "INVITED",
      },
    });
    await prisma.adminSession.create({
      data: {
        adminUserId: target.id,
        expiresAt: new Date(Date.now() + 60_000),
        tokenHash: "a".repeat(64),
      },
    });

    await deleteAdminUser(actor.id, target.id);

    await expect(
      prisma.adminUser.findUnique({ where: { id: target.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.adminSession.count({ where: { adminUserId: target.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.adminUser.findUniqueOrThrow({ where: { id: invitee.id } }),
    ).resolves.toMatchObject({ invitedByAdminUserId: null });
  });
});
