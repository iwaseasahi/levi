import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  activateInvitedAdminUserAfterPasswordReset,
  adminAuth,
} from "@/infrastructure/auth/admin-server";
import { getAdminSessionAccess } from "@/infrastructure/auth/admin-session";
import { prisma } from "@/infrastructure/database/client";

const namespace = "test.admin-session.";
const password = "valid-admin-password";
const origin = "http://localhost:3000";

async function clear() {
  await prisma.adminUser.deleteMany({
    where: { email: { startsWith: namespace } },
  });
  await prisma.adminRateLimit.deleteMany();
}

async function createAdmin(
  status: "ACTIVE" | "INVITED" | "SUSPENDED" = "ACTIVE",
) {
  const id = randomUUID();
  const email = `${namespace}${id}@example.com`;
  return prisma.adminUser.create({
    data: {
      activatedAt: status === "ACTIVE" ? new Date() : null,
      email,
      id,
      name: "Session test administrator",
      status,
      accounts: {
        create: {
          accountId: id,
          issuer: "local:credential",
          password: await hashPassword(password),
          providerId: "credential",
        },
      },
    },
  });
}

async function signIn(email: string, selectedPassword = password) {
  const response = await adminAuth.api.signInEmail({
    asResponse: true,
    body: { email, password: selectedPassword },
    headers: new Headers({ origin }),
  });
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  return { cookie, response };
}

beforeEach(clear);
afterEach(clear);
afterAll(() => prisma.$disconnect());

describe("administrator Better Auth sessions", () => {
  it("authenticates an active administrator with an isolated 30-day session", async () => {
    const admin = await createAdmin();
    const login = await signIn(admin.email.toUpperCase());

    expect(login.response.status).toBe(200);
    expect(login.cookie).toContain("levi-admin-auth.session_token=");
    const record = await prisma.adminSession.findFirstOrThrow({
      where: { userId: admin.id },
    });
    expect(record.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 29 * 24 * 60 * 60 * 1_000,
    );
    await expect(
      getAdminSessionAccess(new Headers({ cookie: login.cookie })),
    ).resolves.toMatchObject({
      adminUserId: admin.id,
      status: "authorized",
    });
  });

  it("rejects invalid credentials and suspended administrators", async () => {
    const active = await createAdmin();
    const invalid = await signIn(active.email, "wrong-password");
    expect(invalid.response.status).toBe(401);

    const suspended = await createAdmin("SUSPENDED");
    const denied = await signIn(suspended.email);
    expect(denied.response.status).toBeGreaterThanOrEqual(400);
  });

  it("invalidates an existing session as soon as the administrator is suspended", async () => {
    const admin = await createAdmin();
    const login = await signIn(admin.email);
    expect(login.response.status).toBe(200);

    await prisma.adminUser.update({
      data: { status: "SUSPENDED" },
      where: { id: admin.id },
    });
    await expect(
      getAdminSessionAccess(new Headers({ cookie: login.cookie })),
    ).resolves.toEqual({ status: "unauthenticated" });
  });

  it("activates only an invited administrator after password setup", async () => {
    const invited = await createAdmin("INVITED");
    const suspended = await createAdmin("SUSPENDED");

    await activateInvitedAdminUserAfterPasswordReset(invited.id);
    await activateInvitedAdminUserAfterPasswordReset(suspended.id);

    await expect(
      prisma.adminUser.findUniqueOrThrow({ where: { id: invited.id } }),
    ).resolves.toMatchObject({
      activatedAt: expect.any(Date),
      status: "ACTIVE",
    });
    await expect(
      prisma.adminUser.findUniqueOrThrow({ where: { id: suspended.id } }),
    ).resolves.toMatchObject({ activatedAt: null, status: "SUSPENDED" });
  });
});
