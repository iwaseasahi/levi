import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ChurchUserInvitationAuthorizationError,
  ChurchUserInvitationFailedError,
} from "@/application/admin/invite-church-user";
import { inviteChurchUser } from "@/infrastructure/auth/church-user-invitations";
import { prisma } from "@/infrastructure/database/client";

const namespace = "test.church-user-invitation";

async function clear() {
  await prisma.adminUser.deleteMany({
    where: { email: { startsWith: namespace } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: namespace } },
  });
  await prisma.church.deleteMany({
    where: { name: { startsWith: namespace } },
  });
}

async function createOperator() {
  const id = randomUUID();
  await prisma.adminUser.create({
    data: {
      email: `${namespace}.${id}@example.invalid`,
      id,
      name: "Invitation Operator",
      status: "ACTIVE",
    },
  });
  return id;
}

beforeEach(clear);
afterEach(clear);
afterAll(async () => prisma.$disconnect());

describe("administrator church user invitation", () => {
  it("adds a second pending credential to an existing active church", async () => {
    const operatorId = await createOperator();
    const church = await prisma.church.create({
      data: { name: `${namespace} active church` },
    });
    const firstUserId = randomUUID();
    await prisma.$transaction([
      prisma.user.create({
        data: {
          actorState: "ACTIVE",
          email: `${namespace}.first@example.invalid`,
          id: firstUserId,
          name: "First Member",
        },
      }),
      prisma.churchMembership.create({
        data: { churchId: church.id, userId: firstUserId },
      }),
    ]);

    const result = await inviteChurchUser(operatorId, {
      accountName: "Second Member",
      churchId: church.id,
      email: `${namespace}.SECOND@EXAMPLE.INVALID`,
    });
    const memberships = await prisma.churchMembership.findMany({
      include: { user: { include: { accounts: true, sessions: true } } },
      orderBy: { createdAt: "asc" },
      where: { churchId: church.id },
    });

    expect(memberships).toHaveLength(2);
    expect(memberships[1]?.user).toMatchObject({
      actorState: "PENDING",
      email: `${namespace}.second@example.invalid`,
      id: result.userId,
    });
    expect(memberships[1]?.user.accounts[0]).toMatchObject({
      providerId: "credential",
    });
    expect(memberships[1]?.user.sessions).toEqual([]);
    await expect(
      prisma.verification.count({
        where: {
          identifier: { startsWith: "reset-password:" },
          value: result.userId,
        },
      }),
    ).resolves.toBe(1);
  });

  it("rejects duplicate email, suspended church, and a non-admin actor", async () => {
    const operatorId = await createOperator();
    const suspended = await prisma.church.create({
      data: {
        name: `${namespace} suspended church`,
        status: "SUSPENDED",
        suspendedAt: new Date(),
      },
    });
    const existing = await prisma.user.create({
      data: {
        email: `${namespace}.duplicate@example.invalid`,
        name: "Existing",
      },
    });
    const active = await prisma.church.create({
      data: { name: `${namespace} duplicate church` },
    });

    await expect(
      inviteChurchUser(operatorId, {
        accountName: "Duplicate",
        churchId: active.id,
        email: existing.email,
      }),
    ).rejects.toBeInstanceOf(ChurchUserInvitationFailedError);
    await expect(
      inviteChurchUser(operatorId, {
        accountName: "Suspended",
        churchId: suspended.id,
        email: `${namespace}.suspended@example.invalid`,
      }),
    ).rejects.toBeInstanceOf(ChurchUserInvitationFailedError);
    await expect(
      inviteChurchUser(existing.id, {
        accountName: "Denied",
        churchId: active.id,
        email: `${namespace}.denied@example.invalid`,
      }),
    ).rejects.toBeInstanceOf(ChurchUserInvitationAuthorizationError);

    await expect(
      prisma.churchMembership.count({
        where: { churchId: { in: [active.id, suspended.id] } },
      }),
    ).resolves.toBe(0);
  });
});
