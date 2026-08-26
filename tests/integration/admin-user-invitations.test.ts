import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AdminUserInvitationAuthorizationError,
  AdminUserInvitationDuplicateError,
  AdminUserInvitationFailedError,
} from "@/application/admin/invite-admin-user";
import { createAdminUserInvitationService } from "@/infrastructure/auth/admin-user-invitations";
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
      email: `${namespace}${randomUUID()}@example.com`,
      loginId: `${namespace}${randomUUID()}`,
      name: "Inviting administrator",
      status: "ACTIVE",
    },
  });
}

beforeEach(clear);
afterEach(clear);
afterAll(() => prisma.$disconnect());

describe("admin user invitations", () => {
  const sent: string[] = [];
  const inviteAdminUser = createAdminUserInvitationService(async (email) => {
    sent.push(email);
  });

  beforeEach(() => sent.splice(0));

  it("stores Better Auth credentials and invitation metadata", async () => {
    const inviter = await actor();
    const result = await inviteAdminUser(inviter.id, {
      email: `${namespace}new@example.com`,
      loginId: `${namespace}NEW`,
      name: "New administrator",
    });
    const record = await prisma.adminUser.findUniqueOrThrow({
      where: { id: result.adminUserId },
    });
    expect(record).toMatchObject({
      invitedByAdminUserId: inviter.id,
      email: `${namespace}new@example.com`,
      loginId: `${namespace}new`,
      name: "New administrator",
      status: "INVITED",
    });
    expect(record.invitedAt).toBeInstanceOf(Date);
    await expect(
      prisma.adminAccount.count({ where: { userId: record.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.adminAccount.findFirstOrThrow({ where: { userId: record.id } }),
    ).resolves.toMatchObject({
      accountId: record.id,
      providerId: "credential",
    });
    expect(sent).toEqual([result.email]);
  });

  it("removes an invitation when email delivery fails", async () => {
    const inviter = await actor();
    const failingService = createAdminUserInvitationService(async () => {
      throw new Error("SMTP unavailable");
    });
    const loginId = `${namespace}mail-failure`;

    await expect(
      failingService(inviter.id, {
        email: `${namespace}mail-failure@example.com`,
        loginId,
        name: "Mail failure",
      }),
    ).rejects.toBeInstanceOf(AdminUserInvitationFailedError);
    await expect(prisma.adminUser.count({ where: { loginId } })).resolves.toBe(
      0,
    );
  });

  it("rejects case-insensitive duplicates", async () => {
    const inviter = await actor();
    await inviteAdminUser(inviter.id, {
      email: `${namespace}duplicate@example.com`,
      loginId: `${namespace}duplicate`,
      name: "First",
    });
    await expect(
      inviteAdminUser(inviter.id, {
        email: `${namespace}other@example.com`,
        loginId: `${namespace}DUPLICATE`,
        name: "Second",
      }),
    ).rejects.toBeInstanceOf(AdminUserInvitationDuplicateError);
  });

  it("rejects a non-managing actor", async () => {
    const suspended = await prisma.adminUser.create({
      data: {
        email: `${namespace}suspended@example.com`,
        loginId: `${namespace}suspended`,
        name: "Suspended",
        status: "SUSPENDED",
      },
    });
    await expect(
      inviteAdminUser(suspended.id, {
        email: `${namespace}denied@example.com`,
        loginId: `${namespace}denied`,
        name: "Denied",
      }),
    ).rejects.toBeInstanceOf(AdminUserInvitationAuthorizationError);
  });
});
