import { hashPassword } from "better-auth/crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BASIC_BOOTSTRAP_ADMIN_LOGIN_ID,
  BASIC_BOOTSTRAP_ADMIN_NAME,
  BASIC_BOOTSTRAP_ADMIN_USER_ID,
} from "@/domain/admin/admin-user";
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
  await prisma.adminUser.deleteMany({
    where: { id: BASIC_BOOTSTRAP_ADMIN_USER_ID },
  });
}

beforeEach(async () => {
  await clearFixture();
  process.env.ADMIN_BASIC_AUTH_USERNAME = username;
  process.env.ADMIN_BASIC_AUTH_PASSWORD_HASH = await hashPassword(password);
  await prisma.$transaction(async (transaction) => {
    await transaction.adminUser.create({
      data: {
        id: BASIC_BOOTSTRAP_ADMIN_USER_ID,
        loginId: BASIC_BOOTSTRAP_ADMIN_LOGIN_ID,
        mustChangePassword: false,
        name: BASIC_BOOTSTRAP_ADMIN_NAME,
        status: "BOOTSTRAP",
      },
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
      adminUserId: BASIC_BOOTSTRAP_ADMIN_USER_ID,
    });
    await expect(
      prisma.adminUser.count({
        where: { id: BASIC_BOOTSTRAP_ADMIN_USER_ID, passwordHash: null },
      }),
    ).resolves.toBe(1);
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
