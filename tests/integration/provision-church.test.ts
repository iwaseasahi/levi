import { randomUUID } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ProvisioningAuthorizationError,
  ProvisioningFailedError,
  ProvisioningInputError,
  provisionChurch,
} from "@/application/admin/provision-church";
import { auth } from "@/infrastructure/auth/server";
import { prisma } from "@/infrastructure/database/client";

const namespace = "test.provision";

async function clearProvisioningRecords() {
  await prisma.user.deleteMany({
    where: { email: { startsWith: namespace } },
  });
  await prisma.church.deleteMany({
    where: { name: { startsWith: namespace } },
  });
}

async function createOperator() {
  const userId = randomUUID();
  await prisma.$transaction(async (transaction) => {
    await transaction.user.create({
      data: {
        actorState: "ACTIVE",
        email: `${namespace}.operator@example.invalid`,
        id: userId,
        name: "Test Platform Operator",
      },
    });
    await transaction.platformOperator.create({ data: { userId } });
  });
  return userId;
}

async function createChurchUser() {
  const userId = randomUUID();
  await prisma.$transaction(async (transaction) => {
    const church = await transaction.church.create({
      data: { name: `${namespace} existing actor church` },
    });
    await transaction.user.create({
      data: {
        actorState: "ACTIVE",
        email: `${namespace}.member@example.invalid`,
        id: userId,
        name: "Test Church Member",
      },
    });
    await transaction.churchMembership.create({
      data: { churchId: church.id, userId },
    });
  });
  return userId;
}

beforeEach(clearProvisioningRecords);
afterEach(clearProvisioningRecords);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("platform operator church provisioning", () => {
  it("atomically creates an active forced-change credential account", async () => {
    const operatorUserId = await createOperator();
    const result = await provisionChurch(operatorUserId, {
      accountName: "Test Church User",
      churchName: `${namespace} successful church`,
      email: `${namespace}.NEW@EXAMPLE.INVALID`,
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { accounts: true, churchMembership: true, sessions: true },
    });
    const credential = user.accounts[0];

    expect(user).toMatchObject({
      actorState: "ACTIVE",
      email: `${namespace}.new@example.invalid`,
      mustChangePassword: true,
    });
    expect(user.churchMembership?.churchId).toBe(result.churchId);
    expect(user.sessions).toEqual([]);
    expect(credential).toMatchObject({
      accountId: user.id,
      issuer: "local:credential",
      providerId: "credential",
    });
    expect(credential?.password).not.toBe(result.temporaryPassword);
    await expect(
      verifyPassword({
        hash: credential?.password ?? "",
        password: result.temporaryPassword,
      }),
    ).resolves.toBe(true);
  });

  it("denies a church user at the transaction data boundary", async () => {
    const churchUserId = await createChurchUser();

    await expect(
      provisionChurch(churchUserId, {
        accountName: "Denied User",
        churchName: `${namespace} denied church`,
        email: `${namespace}.denied@example.invalid`,
      }),
    ).rejects.toBeInstanceOf(ProvisioningAuthorizationError);
    await expect(
      prisma.user.count({
        where: { email: `${namespace}.denied@example.invalid` },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.church.count({
        where: { name: `${namespace} denied church` },
      }),
    ).resolves.toBe(0);
  });

  it("rolls back every partial row and remains safely retryable", async () => {
    const operatorUserId = await createOperator();
    const input = {
      accountName: "Retry User",
      churchName: `${namespace} retry church`,
      email: `${namespace}.retry@example.invalid`,
    };

    await provisionChurch(operatorUserId, input);
    await expect(provisionChurch(operatorUserId, input)).rejects.toBeInstanceOf(
      ProvisioningFailedError,
    );

    await expect(
      prisma.user.count({ where: { email: input.email } }),
    ).resolves.toBe(1);
    await expect(
      prisma.church.count({ where: { name: input.churchName } }),
    ).resolves.toBe(1);
    await expect(
      prisma.account.count({
        where: { user: { email: input.email } },
      }),
    ).resolves.toBe(1);
  });

  it("rejects invalid input before any database mutation", async () => {
    const operatorUserId = await createOperator();

    await expect(
      provisionChurch(operatorUserId, {
        accountName: " ",
        churchName: `${namespace} invalid church`,
        email: "invalid",
      }),
    ).rejects.toBeInstanceOf(ProvisioningInputError);
    await expect(
      prisma.church.count({
        where: { name: `${namespace} invalid church` },
      }),
    ).resolves.toBe(0);
  });

  it("keeps the public Better Auth sign-up endpoint disabled", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          email: `${namespace}.public@example.invalid`,
          name: "Public User",
          password: "p".repeat(16),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.user.count({
        where: { email: `${namespace}.public@example.invalid` },
      }),
    ).resolves.toBe(0);
  });
});
