import { hashPassword } from "better-auth/crypto";

import { prisma } from "@/infrastructure/database/client";

export const E2E_OPERATOR_EMAIL = "test.e2e.operator@example.invalid";
export const E2E_CHURCH_USER_EMAIL = "test.e2e.member@example.invalid";
export const E2E_AUTH_USER_EMAIL = "test.e2e.auth-member@example.invalid";
export const E2E_PASSWORD_USER_EMAIL =
  "test.e2e.password-member@example.invalid";
export const E2E_PASSWORD = "e".repeat(16);
export const E2E_CREATED_EMAIL = "test.e2e.created@example.invalid";
export const E2E_CREATED_CHURCH = "test.e2e created church";

const E2E_OPERATOR_ID = "00000000-0000-4000-8000-000000004301";
const E2E_CHURCH_USER_ID = "00000000-0000-4000-8000-000000004302";
const E2E_CHURCH_ID = "00000000-0000-4000-8000-000000004303";
export const E2E_AUTH_USER_ID = "00000000-0000-4000-8000-000000004304";
const E2E_AUTH_CHURCH_ID = "00000000-0000-4000-8000-000000004305";
const E2E_PASSWORD_USER_ID = "00000000-0000-4000-8000-000000004306";
const E2E_PASSWORD_CHURCH_ID = "00000000-0000-4000-8000-000000004307";

export async function clearOperatorFixtures() {
  await prisma.rateLimit.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { startsWith: "test.e2e." } },
  });
  await prisma.church.deleteMany({
    where: { name: { startsWith: "test.e2e" } },
  });
}

export async function seedOperatorFixtures() {
  await clearOperatorFixtures();
  const passwordHash = await hashPassword(E2E_PASSWORD);

  await prisma.$transaction(async (transaction) => {
    await transaction.user.create({
      data: {
        actorState: "ACTIVE",
        email: E2E_OPERATOR_EMAIL,
        id: E2E_OPERATOR_ID,
        name: "Synthetic E2E Platform Operator",
      },
    });
    await transaction.platformOperator.create({
      data: { userId: E2E_OPERATOR_ID },
    });
    await transaction.account.create({
      data: {
        accountId: E2E_OPERATOR_ID,
        issuer: "local:credential",
        password: passwordHash,
        providerId: "credential",
        userId: E2E_OPERATOR_ID,
      },
    });

    await transaction.church.create({
      data: { id: E2E_CHURCH_ID, name: "test.e2e member church" },
    });
    await transaction.user.create({
      data: {
        actorState: "ACTIVE",
        email: E2E_CHURCH_USER_EMAIL,
        id: E2E_CHURCH_USER_ID,
        name: "Synthetic E2E Church User",
      },
    });
    await transaction.churchMembership.create({
      data: { churchId: E2E_CHURCH_ID, userId: E2E_CHURCH_USER_ID },
    });
    await transaction.account.create({
      data: {
        accountId: E2E_CHURCH_USER_ID,
        issuer: "local:credential",
        password: passwordHash,
        providerId: "credential",
        userId: E2E_CHURCH_USER_ID,
      },
    });

    await transaction.church.create({
      data: { id: E2E_AUTH_CHURCH_ID, name: "test.e2e auth church" },
    });
    await transaction.user.create({
      data: {
        actorState: "ACTIVE",
        email: E2E_AUTH_USER_EMAIL,
        id: E2E_AUTH_USER_ID,
        name: "Synthetic E2E Auth User",
      },
    });
    await transaction.churchMembership.create({
      data: { churchId: E2E_AUTH_CHURCH_ID, userId: E2E_AUTH_USER_ID },
    });
    await transaction.account.create({
      data: {
        accountId: E2E_AUTH_USER_ID,
        issuer: "local:credential",
        password: passwordHash,
        providerId: "credential",
        userId: E2E_AUTH_USER_ID,
      },
    });

    await transaction.church.create({
      data: { id: E2E_PASSWORD_CHURCH_ID, name: "test.e2e password church" },
    });
    await transaction.user.create({
      data: {
        actorState: "ACTIVE",
        email: E2E_PASSWORD_USER_EMAIL,
        id: E2E_PASSWORD_USER_ID,
        name: "Synthetic E2E Password User",
      },
    });
    await transaction.churchMembership.create({
      data: { churchId: E2E_PASSWORD_CHURCH_ID, userId: E2E_PASSWORD_USER_ID },
    });
    await transaction.account.create({
      data: {
        accountId: E2E_PASSWORD_USER_ID,
        issuer: "local:credential",
        password: passwordHash,
        providerId: "credential",
        userId: E2E_PASSWORD_USER_ID,
      },
    });
  });
}
