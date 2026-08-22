import { hashPassword } from "better-auth/crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  INTERNAL_PLATFORM_OPERATOR_EMAIL,
  INTERNAL_PLATFORM_OPERATOR_ID,
  INTERNAL_PLATFORM_OPERATOR_NAME,
} from "@/domain/admin/platform-operator";
import { authenticateAdminBasic } from "@/infrastructure/auth/admin-basic-auth";
import { prisma } from "@/infrastructure/database/client";

const username = "test-integration-admin";
const password = "integration-admin-password";

function authorization(selectedPassword: string) {
  return `Basic ${Buffer.from(`${username}:${selectedPassword}`).toString("base64")}`;
}

async function clearFixture() {
  await prisma.rateLimit.deleteMany({
    where: { key: "admin-basic-auth:global" },
  });
  await prisma.user.deleteMany({
    where: { id: INTERNAL_PLATFORM_OPERATOR_ID },
  });
}

beforeEach(async () => {
  await clearFixture();
  process.env.ADMIN_BASIC_AUTH_USERNAME = username;
  process.env.ADMIN_BASIC_AUTH_PASSWORD_HASH = await hashPassword(password);
  await prisma.$transaction(async (transaction) => {
    await transaction.user.create({
      data: {
        actorState: "ACTIVE",
        email: INTERNAL_PLATFORM_OPERATOR_EMAIL,
        id: INTERNAL_PLATFORM_OPERATOR_ID,
        name: INTERNAL_PLATFORM_OPERATOR_NAME,
      },
    });
    await transaction.platformOperator.create({
      data: { userId: INTERNAL_PLATFORM_OPERATOR_ID },
    });
  });
});

afterEach(clearFixture);
afterAll(async () => prisma.$disconnect());

describe("administration Basic authentication database boundary", () => {
  it("authorizes the configured secret as the credential-free internal actor", async () => {
    await expect(
      authenticateAdminBasic(authorization(password)),
    ).resolves.toEqual({
      status: "authorized",
      userId: INTERNAL_PLATFORM_OPERATOR_ID,
    });
    await expect(
      prisma.account.count({
        where: { userId: INTERNAL_PLATFORM_OPERATOR_ID },
      }),
    ).resolves.toBe(0);
  });

  it("persists a global failure bucket and blocks the fifth failure", async () => {
    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(
        authenticateAdminBasic(authorization("incorrect-password")),
      ).resolves.toEqual({ status: "unauthenticated" });
    }
    await expect(
      authenticateAdminBasic(authorization("incorrect-password")),
    ).resolves.toEqual({ status: "rate-limited" });

    await expect(
      prisma.rateLimit.findUnique({
        where: { key: "admin-basic-auth:global" },
        select: { count: true },
      }),
    ).resolves.toEqual({ count: 5 });
  });
});
