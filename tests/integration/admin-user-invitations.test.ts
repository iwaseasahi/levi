import { randomUUID } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AdminUserInvitationAuthorizationError,
  AdminUserInvitationDuplicateError,
} from "@/application/admin/invite-admin-user";
import { inviteAdminUser } from "@/infrastructure/auth/admin-user-invitations";
import { prisma } from "@/infrastructure/database/client";

const namespace = "test.invite.";

async function clear() {
  await prisma.adminUser.deleteMany({
    where: {
      invitedByAdminUserId: { not: null },
      loginId: { startsWith: namespace },
    },
  });
  await prisma.adminUser.deleteMany({
    where: { loginId: { startsWith: namespace } },
  });
}

async function actor() {
  return prisma.adminUser.create({
    data: {
      loginId: `${namespace}${randomUUID()}`,
      mustChangePassword: false,
      name: "Inviting administrator",
      passwordHash: "synthetic",
      status: "ACTIVE",
    },
  });
}

beforeEach(clear);
afterEach(clear);
afterAll(() => prisma.$disconnect());

describe("admin user invitations", () => {
  it("stores only a hash and invitation metadata", async () => {
    const inviter = await actor();
    const result = await inviteAdminUser(inviter.id, {
      loginId: `${namespace}NEW`,
      name: "New administrator",
    });
    const record = await prisma.adminUser.findUniqueOrThrow({
      where: { id: result.adminUserId },
    });
    expect(record).toMatchObject({
      invitedByAdminUserId: inviter.id,
      loginId: `${namespace}new`,
      mustChangePassword: true,
      name: "New administrator",
      status: "INVITED",
    });
    expect(record.invitedAt).toBeInstanceOf(Date);
    expect(record.passwordHash).not.toBe(result.temporaryPassword);
    await expect(
      verifyPassword({
        hash: record.passwordHash ?? "",
        password: result.temporaryPassword,
      }),
    ).resolves.toBe(true);
  });

  it("rejects case-insensitive duplicates", async () => {
    const inviter = await actor();
    await inviteAdminUser(inviter.id, {
      loginId: `${namespace}duplicate`,
      name: "First",
    });
    await expect(
      inviteAdminUser(inviter.id, {
        loginId: `${namespace}DUPLICATE`,
        name: "Second",
      }),
    ).rejects.toBeInstanceOf(AdminUserInvitationDuplicateError);
  });

  it("rejects a non-managing actor", async () => {
    const suspended = await prisma.adminUser.create({
      data: {
        loginId: `${namespace}suspended`,
        name: "Suspended",
        status: "SUSPENDED",
      },
    });
    await expect(
      inviteAdminUser(suspended.id, {
        loginId: `${namespace}denied`,
        name: "Denied",
      }),
    ).rejects.toBeInstanceOf(AdminUserInvitationAuthorizationError);
  });
});
