import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PasswordLifecycleAuthorizationError } from "@/application/auth/password-lifecycle";
import { auth } from "@/infrastructure/auth/server";
import {
  completeForcedPasswordChange,
  resetChurchPassword,
} from "@/infrastructure/auth/password-lifecycle";
import { prisma } from "@/infrastructure/database/client";

const prefix = "test.password45";
const originalPassword = "o".repeat(16);
const selectedPassword = "n".repeat(16);

async function clear() {
  await prisma.adminUser.deleteMany({
    where: { email: { startsWith: prefix } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.church.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.rateLimit.deleteMany();
}

async function fixture() {
  const operatorId = randomUUID();
  const userId = randomUUID();
  const email = `${prefix}.${randomUUID()}@example.invalid`;
  const hash = await hashPassword(originalPassword);
  const church = await prisma.$transaction(async (tx) => {
    await tx.adminUser.create({
      data: {
        id: operatorId,
        email: `${prefix}.operator.${operatorId}@example.com`,
        name: "Administrator",
        status: "ACTIVE",
      },
    });
    const target = await tx.church.create({
      data: { name: `${prefix}.${randomUUID()}` },
    });
    await tx.user.create({
      data: { actorState: "ACTIVE", email, id: userId, name: "Member" },
    });
    await tx.churchMembership.create({ data: { churchId: target.id, userId } });
    await tx.account.create({
      data: {
        accountId: userId,
        issuer: "local:credential",
        password: hash,
        providerId: "credential",
        userId,
      },
    });
    return target;
  });
  return { churchId: church.id, email, operatorId, userId };
}

async function signIn(email: string, password: string) {
  await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: "http://localhost:3000" }),
  });
}

beforeEach(clear);
afterAll(async () => {
  await clear();
  await prisma.$disconnect();
});

describe("operator reset and forced password change", () => {
  it("replaces the hash, marks forced change, and revokes every session", async () => {
    const target = await fixture();
    await signIn(target.email, originalPassword);
    const result = await resetChurchPassword(
      target.operatorId,
      target.churchId,
    );
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: target.userId },
      include: { accounts: true, sessions: true },
    });
    expect(user.mustChangePassword).toBe(true);
    expect(user.sessions).toEqual([]);
    await expect(
      verifyPassword({
        hash: user.accounts[0]?.password ?? "",
        password: result.temporaryPassword,
      }),
    ).resolves.toBe(true);
    await expect(
      verifyPassword({
        hash: user.accounts[0]?.password ?? "",
        password: originalPassword,
      }),
    ).resolves.toBe(false);
  });

  it("denies a Church user at the reset use-case boundary", async () => {
    const target = await fixture();
    await expect(
      resetChurchPassword(target.userId, target.churchId),
    ).rejects.toBeInstanceOf(PasswordLifecycleAuthorizationError);
  });

  it("safely reissues reset and invalidates the earlier temporary password", async () => {
    const target = await fixture();
    const first = await resetChurchPassword(target.operatorId, target.churchId);
    const second = await resetChurchPassword(
      target.operatorId,
      target.churchId,
    );
    const account = await prisma.account.findFirstOrThrow({
      where: { userId: target.userId, providerId: "credential" },
    });

    await expect(
      verifyPassword({
        hash: account.password ?? "",
        password: first.temporaryPassword,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyPassword({
        hash: account.password ?? "",
        password: second.temporaryPassword,
      }),
    ).resolves.toBe(true);
  });

  it("uses the authenticated session, clears the gate, and keeps only the current session", async () => {
    const target = await fixture();
    const reset = await resetChurchPassword(target.operatorId, target.churchId);
    await signIn(target.email, reset.temporaryPassword);
    await signIn(target.email, reset.temporaryPassword);
    const sessions = await prisma.session.findMany({
      where: { userId: target.userId },
      orderBy: { createdAt: "asc" },
    });
    await completeForcedPasswordChange({
      newPassword: selectedPassword,
      confirmation: selectedPassword,
      sessionId: sessions[0]!.id,
      userId: target.userId,
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: target.userId },
      include: { accounts: true, sessions: true },
    });
    expect(user.mustChangePassword).toBe(false);
    expect(user.sessions.map((session) => session.id)).toEqual([
      sessions[0]!.id,
    ]);
    await expect(
      verifyPassword({
        hash: user.accounts[0]?.password ?? "",
        password: selectedPassword,
      }),
    ).resolves.toBe(true);
  });

  it("completes concurrent resets and forced changes for different churches", async () => {
    const targets = [await fixture(), await fixture()];
    for (const target of targets) await signIn(target.email, originalPassword);

    const resets = await Promise.all(
      targets.map((target) =>
        resetChurchPassword(target.operatorId, target.churchId),
      ),
    );
    for (const [index, target] of targets.entries()) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: target.userId },
        include: { accounts: true, sessions: true },
      });
      expect(user.mustChangePassword).toBe(true);
      expect(user.sessions).toEqual([]);
      await expect(
        verifyPassword({
          hash: user.accounts[0]?.password ?? "",
          password: resets[index]!.temporaryPassword,
        }),
      ).resolves.toBe(true);
    }

    for (const [index, target] of targets.entries()) {
      await signIn(target.email, resets[index]!.temporaryPassword);
      await signIn(target.email, resets[index]!.temporaryPassword);
    }
    const sessions = await Promise.all(
      targets.map((target) =>
        prisma.session.findMany({
          where: { userId: target.userId },
          orderBy: { createdAt: "asc" },
        }),
      ),
    );

    await Promise.all(
      targets.map((target, index) =>
        completeForcedPasswordChange({
          newPassword: selectedPassword,
          confirmation: selectedPassword,
          sessionId: sessions[index]![0]!.id,
          userId: target.userId,
        }),
      ),
    );

    for (const [index, target] of targets.entries()) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: target.userId },
        include: { accounts: true, sessions: true },
      });
      expect(user.mustChangePassword).toBe(false);
      expect(user.sessions.map(({ id }) => id)).toEqual([
        sessions[index]![0]!.id,
      ]);
      await expect(
        verifyPassword({
          hash: user.accounts[0]?.password ?? "",
          password: selectedPassword,
        }),
      ).resolves.toBe(true);
    }
  });

  it("rejects a stale session", async () => {
    const target = await fixture();
    await resetChurchPassword(target.operatorId, target.churchId);
    await expect(
      completeForcedPasswordChange({
        newPassword: selectedPassword,
        confirmation: selectedPassword,
        sessionId: randomUUID(),
        userId: target.userId,
      }),
    ).rejects.toBeInstanceOf(PasswordLifecycleAuthorizationError);
  });

  it("rejects a completed password-change replay", async () => {
    const target = await fixture();
    const reset = await resetChurchPassword(target.operatorId, target.churchId);
    await signIn(target.email, reset.temporaryPassword);
    const session = await prisma.session.findFirstOrThrow({
      where: { userId: target.userId },
    });
    const input = {
      newPassword: selectedPassword,
      confirmation: selectedPassword,
      sessionId: session.id,
      userId: target.userId,
    };

    await completeForcedPasswordChange(input);
    await expect(completeForcedPasswordChange(input)).rejects.toBeInstanceOf(
      PasswordLifecycleAuthorizationError,
    );
  });
});
