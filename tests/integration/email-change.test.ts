import { randomUUID } from "node:crypto";
import { createEmailVerificationToken } from "better-auth/api";
import { hashPassword } from "better-auth/crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as requestEmailChange } from "@/app/api/account/change-email/route";
import { GET as verifyEmail } from "@/app/api/auth/[...all]/route";
import { EMAIL_CHANGE_EXPIRES_IN_SECONDS } from "@/config/email-change";
import { getAuthRuntimeConfig } from "@/config/env";
import { auth } from "@/infrastructure/auth/server";
import { prisma } from "@/infrastructure/database/client";

const prefix = "test.email-change-457.";
const origin = getAuthRuntimeConfig().baseURL;
const password = "synthetic-password-457";

async function clear() {
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.church.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.rateLimit.deleteMany({
    where: { key: { startsWith: "email-change:" } },
  });
}

async function createMember(email: string) {
  const userId = randomUUID();
  const church = await prisma.church.create({
    data: { name: `${prefix}${randomUUID()}` },
  });
  await prisma.user.create({
    data: {
      actorState: "ACTIVE",
      churchMembership: { create: { churchId: church.id } },
      email,
      id: userId,
      name: "Synthetic Email Change User",
    },
  });
  await prisma.account.create({
    data: {
      accountId: userId,
      issuer: "local:credential",
      password: await hashPassword(password),
      providerId: "credential",
      userId,
    },
  });
  return userId;
}

async function signIn(email: string) {
  const result = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin }),
    returnHeaders: true,
  });
  return result.headers.get("set-cookie")?.split(";")[0] ?? "";
}

function changeRequest(cookie: string, body: object) {
  return requestEmailChange(
    new Request(`${origin}/api/account/change-email`, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        cookie,
        origin,
      },
      method: "POST",
    }),
  );
}

beforeEach(clear);
afterAll(async () => {
  await clear();
  await prisma.$disconnect();
});

describe("church email change", () => {
  it("keeps the old identity until verified, then moves login to the new address", async () => {
    const currentEmail = `${prefix}${randomUUID()}@example.invalid`;
    const newEmail = `${prefix}${randomUUID()}@example.invalid`;
    const usedEmail = `${prefix}${randomUUID()}@example.invalid`;
    const userId = await createMember(currentEmail);
    await createMember(usedEmail);
    const cookie = await signIn(currentEmail);

    expect(
      (
        await changeRequest(cookie, {
          confirmation: newEmail,
          currentPassword: "wrong-password",
          newEmail,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await changeRequest(cookie, {
          confirmation: usedEmail,
          currentPassword: password,
          newEmail: usedEmail,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await changeRequest(cookie, {
          confirmation: newEmail.toUpperCase(),
          currentPassword: password,
          newEmail,
        })
      ).status,
    ).toBe(202);

    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ).resolves.toMatchObject({ email: currentEmail, emailVerified: false });
    await expect(signIn(currentEmail)).resolves.not.toBe("");

    const token = await createEmailVerificationToken(
      getAuthRuntimeConfig().secret,
      currentEmail,
      newEmail,
      EMAIL_CHANGE_EXPIRES_IN_SECONDS,
      { requestType: "change-email-verification" },
    );
    const verificationUrl = new URL(`${origin}/api/auth/verify-email`);
    verificationUrl.searchParams.set("token", token);
    verificationUrl.searchParams.set(
      "callbackURL",
      "/account/change-email?completed=1",
    );
    const verificationResponse = await verifyEmail(
      new Request(verificationUrl, { headers: { cookie } }),
    );
    expect(verificationResponse.status).toBe(302);
    expect(verificationResponse.headers.get("location")).toBe(
      "/account/change-email?completed=1",
    );
    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ).resolves.toMatchObject({ email: newEmail, emailVerified: true });
    await expect(signIn(currentEmail)).rejects.toThrow();
    await expect(signIn(newEmail)).resolves.not.toBe("");

    const replayResponse = await verifyEmail(
      new Request(verificationUrl, { headers: { cookie } }),
    );
    expect(replayResponse.status).toBe(302);
    expect(replayResponse.headers.get("location")).toContain("error=");
    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ).resolves.toMatchObject({ email: newEmail, emailVerified: true });
  });

  it("rejects an expired confirmation token without changing the address", async () => {
    const currentEmail = `${prefix}${randomUUID()}@example.invalid`;
    const newEmail = `${prefix}${randomUUID()}@example.invalid`;
    const userId = await createMember(currentEmail);
    const cookie = await signIn(currentEmail);
    const token = await createEmailVerificationToken(
      getAuthRuntimeConfig().secret,
      currentEmail,
      newEmail,
      -1,
      { requestType: "change-email-verification" },
    );
    const url = new URL(`${origin}/api/auth/verify-email`);
    url.searchParams.set("token", token);
    url.searchParams.set("callbackURL", "/account/change-email");

    const response = await verifyEmail(
      new Request(url, { headers: { cookie } }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=TOKEN_EXPIRED");
    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ).resolves.toMatchObject({ email: currentEmail, emailVerified: false });
  });

  it("rejects unauthenticated and cross-origin requests", async () => {
    const body = {
      confirmation: `${prefix}new@example.invalid`,
      currentPassword: password,
      newEmail: `${prefix}new@example.invalid`,
    };
    expect((await changeRequest("", body)).status).toBe(401);

    const currentEmail = `${prefix}${randomUUID()}@example.invalid`;
    await createMember(currentEmail);
    const cookie = await signIn(currentEmail);
    const response = await requestEmailChange(
      new Request(`${origin}/api/account/change-email`, {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
          cookie,
          origin: "https://attacker.example.invalid",
        },
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
  });
});
