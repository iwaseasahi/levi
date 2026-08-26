import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ADMIN_SESSION_COOKIE,
  hashAdminSessionToken,
} from "@/domain/admin/admin-session";
import {
  changeAdminPassword,
  getAdminSessionAccess,
  loginAdminUser,
  logoutAdminSession,
} from "@/infrastructure/auth/admin-session";
import { prisma } from "@/infrastructure/database/client";

const namespace = "test.admin-session.";
const password = "valid-admin-password";

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
  await prisma.rateLimit.deleteMany();
}

async function createAdmin(
  status: "ACTIVE" | "INVITED" | "SUSPENDED" = "ACTIVE",
) {
  const inviter =
    status === "INVITED"
      ? await prisma.adminUser.create({
          data: {
            loginId: `${namespace}inviter.${randomUUID()}`,
            mustChangePassword: false,
            name: "Session test inviter",
            passwordHash: await hashPassword(password),
            status: "ACTIVE",
          },
        })
      : null;
  return prisma.adminUser.create({
    data: {
      ...(inviter
        ? { invitedAt: new Date(), invitedByAdminUserId: inviter.id }
        : {}),
      loginId: `${namespace}${randomUUID()}`,
      mustChangePassword: status === "INVITED",
      name: "Session test administrator",
      passwordHash: await hashPassword(password),
      status,
    },
  });
}

function sessionHeaders(token: string) {
  return new Headers({ cookie: `${ADMIN_SESSION_COOKIE}=${token}` });
}

beforeEach(clear);
afterEach(clear);
afterAll(() => prisma.$disconnect());

describe("administrator database sessions", () => {
  it("stores only a token hash and authenticates the 30-day session", async () => {
    const admin = await createAdmin();
    const login = await loginAdminUser(admin.loginId.toUpperCase(), password);
    expect(login.status).toBe("success");
    if (login.status !== "success") return;

    const record = await prisma.adminSession.findFirstOrThrow({
      where: { adminUserId: admin.id },
    });
    expect(record.tokenHash).toBe(hashAdminSessionToken(login.token));
    expect(record.tokenHash).not.toBe(login.token);
    expect(record.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 29 * 24 * 60 * 60 * 1_000,
    );
    await expect(
      getAdminSessionAccess(sessionHeaders(login.token)),
    ).resolves.toMatchObject({
      adminUserId: admin.id,
      mustChangePassword: false,
      status: "authorized",
    });

    await logoutAdminSession(sessionHeaders(login.token));
    await expect(
      getAdminSessionAccess(sessionHeaders(login.token)),
    ).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("rejects expired sessions and immediately rejects suspended administrators", async () => {
    const admin = await createAdmin();
    const expired = await loginAdminUser(admin.loginId, password);
    expect(expired.status).toBe("success");
    if (expired.status !== "success") return;
    await prisma.adminSession.updateMany({
      data: { expiresAt: new Date(Date.now() - 1_000) },
      where: { adminUserId: admin.id },
    });
    await expect(
      getAdminSessionAccess(sessionHeaders(expired.token)),
    ).resolves.toEqual({
      status: "unauthenticated",
    });

    const active = await loginAdminUser(admin.loginId, password);
    expect(active.status).toBe("success");
    if (active.status !== "success") return;
    await prisma.adminUser.update({
      data: { status: "SUSPENDED" },
      where: { id: admin.id },
    });
    await expect(
      getAdminSessionAccess(sessionHeaders(active.token)),
    ).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("activates an invited administrator and revokes their other sessions", async () => {
    const admin = await createAdmin("INVITED");
    const current = await loginAdminUser(admin.loginId, password);
    const other = await loginAdminUser(admin.loginId, password);
    expect(current.status).toBe("success");
    expect(other.status).toBe("success");
    if (current.status !== "success" || other.status !== "success") return;
    const access = await getAdminSessionAccess(sessionHeaders(current.token));
    expect(access.status).toBe("authorized");
    if (access.status !== "authorized") return;

    const newPassword = "newly-activated-admin-password";
    await expect(
      changeAdminPassword({
        adminUserId: admin.id,
        confirmation: newPassword,
        newPassword,
        sessionId: access.sessionId,
      }),
    ).resolves.toEqual({ status: "success" });
    await expect(
      getAdminSessionAccess(sessionHeaders(other.token)),
    ).resolves.toEqual({
      status: "unauthenticated",
    });
    await expect(
      loginAdminUser(admin.loginId, password),
    ).resolves.toMatchObject({
      status: "invalid",
    });
    await expect(
      loginAdminUser(admin.loginId, newPassword),
    ).resolves.toMatchObject({
      mustChangePassword: false,
      status: "success",
    });
    await expect(
      prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } }),
    ).resolves.toMatchObject({
      mustChangePassword: false,
      status: "ACTIVE",
    });
  });

  it("rate limits repeated invalid passwords without exposing identity existence", async () => {
    const admin = await createAdmin();
    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(
        loginAdminUser(admin.loginId, "wrong-password"),
      ).resolves.toEqual({
        status: "invalid",
      });
    }
    await expect(
      loginAdminUser(admin.loginId, "wrong-password"),
    ).resolves.toEqual({
      status: "rate-limited",
    });
    await expect(loginAdminUser(admin.loginId, password)).resolves.toEqual({
      status: "rate-limited",
    });
  });
});
