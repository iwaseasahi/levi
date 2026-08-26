import { hashPassword, verifyPassword } from "better-auth/crypto";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  hashAdminSessionToken,
  readCookie,
} from "@/domain/admin/admin-session";
import { prisma } from "@/infrastructure/database/client";
import {
  ADMIN_LOGIN_MAX_FAILURES,
  adminLoginFailureStore,
} from "./admin-login-rate-limit";

export type AdminSessionAccess =
  | {
      adminUserId: string;
      mustChangePassword: boolean;
      name: string;
      sessionId: string;
      status: "authorized";
    }
  | { status: "unauthenticated" };

export type AdminLoginResult =
  | { status: "invalid" | "rate-limited" | "unavailable" }
  | {
      expiresAt: Date;
      mustChangePassword: boolean;
      status: "success";
      token: string;
    };

const DUMMY_PASSWORD_HASH =
  "a0a5959054d2cd4ede705ac000fa4db4:b052793ed3d580cf7848da3dd6bcde96561effe5f2ebd6323a024311c946bf70be863bd4d4dbd33c948b069bdb6435df14f4784b44ef1e138e9c93daa97356e7";

function expiresAt(now = new Date()) {
  return new Date(now.getTime() + ADMIN_SESSION_MAX_AGE_SECONDS * 1_000);
}

export async function getAdminSessionAccess(
  headers: Headers,
): Promise<AdminSessionAccess> {
  const token = readCookie(headers.get("cookie"), ADMIN_SESSION_COOKIE);
  if (!token) return { status: "unauthenticated" };
  const session = await prisma.adminSession.findUnique({
    select: {
      adminUser: {
        select: {
          id: true,
          mustChangePassword: true,
          name: true,
          status: true,
        },
      },
      expiresAt: true,
      id: true,
    },
    where: { tokenHash: hashAdminSessionToken(token) },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    !["ACTIVE", "INVITED"].includes(session.adminUser.status)
  )
    return { status: "unauthenticated" };
  return {
    adminUserId: session.adminUser.id,
    mustChangePassword: session.adminUser.mustChangePassword,
    name: session.adminUser.name,
    sessionId: session.id,
    status: "authorized",
  };
}

export async function loginAdminUser(
  loginIdInput: unknown,
  passwordInput: unknown,
): Promise<AdminLoginResult> {
  const loginId =
    typeof loginIdInput === "string" ? loginIdInput.trim().toLowerCase() : "";
  const password = typeof passwordInput === "string" ? passwordInput : "";
  if (!loginId || !password || loginId.length > 100 || password.length > 256)
    return { status: "invalid" };
  try {
    if (await adminLoginFailureStore.isBlocked(loginId))
      return { status: "rate-limited" };
    const adminUser = await prisma.adminUser.findUnique({
      select: {
        id: true,
        mustChangePassword: true,
        passwordHash: true,
        status: true,
      },
      where: { loginId },
    });
    const passwordMatches = await verifyPassword({
      hash: adminUser?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    });
    const valid = Boolean(
      adminUser?.passwordHash &&
      ["ACTIVE", "INVITED"].includes(adminUser.status) &&
      passwordMatches,
    );
    if (!valid || !adminUser) {
      const count = await adminLoginFailureStore.record(loginId);
      return {
        status: count >= ADMIN_LOGIN_MAX_FAILURES ? "rate-limited" : "invalid",
      };
    }
    const token = createAdminSessionToken();
    const expiry = expiresAt();
    await prisma.$transaction([
      prisma.adminSession.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      }),
      prisma.adminSession.create({
        data: {
          adminUserId: adminUser.id,
          expiresAt: expiry,
          tokenHash: hashAdminSessionToken(token),
        },
      }),
    ]);
    await adminLoginFailureStore.clear(loginId);
    return {
      expiresAt: expiry,
      mustChangePassword: adminUser.mustChangePassword,
      status: "success",
      token,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function logoutAdminSession(headers: Headers) {
  const token = readCookie(headers.get("cookie"), ADMIN_SESSION_COOKIE);
  if (!token) return;
  await prisma.adminSession.deleteMany({
    where: { tokenHash: hashAdminSessionToken(token) },
  });
}

export async function changeAdminPassword(input: {
  confirmation: unknown;
  newPassword: unknown;
  sessionId: string;
  adminUserId: string;
}) {
  if (
    typeof input.newPassword !== "string" ||
    input.newPassword.length < 12 ||
    input.newPassword.length > 128 ||
    input.newPassword !== input.confirmation
  )
    return { status: "invalid" } as const;
  const passwordHash = await hashPassword(input.newPassword);
  const result = await prisma.$transaction(async (transaction) => {
    const session = await transaction.adminSession.findUnique({
      select: {
        adminUser: { select: { mustChangePassword: true, status: true } },
        adminUserId: true,
        expiresAt: true,
      },
      where: { id: input.sessionId },
    });
    if (
      !session ||
      session.adminUserId !== input.adminUserId ||
      session.expiresAt <= new Date() ||
      !session.adminUser.mustChangePassword ||
      session.adminUser.status !== "INVITED"
    )
      return false;
    await transaction.adminUser.update({
      data: {
        activatedAt: new Date(),
        mustChangePassword: false,
        passwordHash,
        status: "ACTIVE",
      },
      where: { id: input.adminUserId },
    });
    await transaction.adminSession.deleteMany({
      where: { adminUserId: input.adminUserId, id: { not: input.sessionId } },
    });
    return true;
  });
  return { status: result ? "success" : "unauthorized" } as const;
}
