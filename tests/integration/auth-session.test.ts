import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { POST } from "@/app/api/auth/[...all]/route";
import { auth } from "@/infrastructure/auth/server";
import { prisma } from "@/infrastructure/database/client";

const prefix = "test.auth44";
const password = "a".repeat(16);
const originHeaders = new Headers({ origin: "http://localhost:3000" });

async function clear() {
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.church.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.rateLimit.deleteMany();
}

async function createMember(status: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
  const userId = randomUUID();
  const email = `${prefix}.${randomUUID()}@example.invalid`;
  const hash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const church = await tx.church.create({
      data: {
        name: `${prefix}.${randomUUID()}`,
        status,
        ...(status === "SUSPENDED" ? { suspendedAt: new Date() } : {}),
      },
    });
    await tx.user.create({
      data: { actorState: "ACTIVE", email, id: userId, name: "Auth Test" },
    });
    await tx.churchMembership.create({ data: { churchId: church.id, userId } });
    await tx.account.create({
      data: {
        accountId: userId,
        issuer: "local:credential",
        password: hash,
        providerId: "credential",
        userId,
      },
    });
  });
  return { email, userId };
}

async function createPendingIdentity() {
  const userId = randomUUID();
  const email = `${prefix}.pending.${randomUUID()}@example.invalid`;
  const hash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        actorState: "PENDING",
        email,
        id: userId,
        name: "Synthetic pending",
      },
    });
    await tx.account.create({
      data: {
        accountId: userId,
        issuer: "local:credential",
        password: hash,
        providerId: "credential",
        userId,
      },
    });
  });
  return { email, userId };
}

async function signIn(email: string) {
  const result = await auth.api.signInEmail({
    body: { email, password },
    headers: originHeaders,
    returnHeaders: true,
  });
  const raw = result.headers.get("set-cookie") ?? "";
  return { cookie: raw.split(";")[0] ?? "", result };
}

beforeEach(clear);
afterAll(async () => {
  await clear();
  await prisma.$disconnect();
});

describe("Church authentication session lifecycle", () => {
  it("creates a tenant-authorized 30-day database session", async () => {
    const member = await createMember();
    const { cookie } = await signIn(member.email);
    const headers = new Headers({ cookie });
    const access = await getChurchAccess(headers);
    expect(access).toMatchObject({
      status: "authorized",
      userId: member.userId,
    });
    const session = await prisma.session.findFirstOrThrow({
      where: { userId: member.userId },
    });
    expect(
      session.expiresAt.getTime() - session.createdAt.getTime(),
    ).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });

  it("denies a suspended Church before creating a session", async () => {
    const member = await createMember("SUSPENDED");
    await expect(signIn(member.email)).rejects.toThrow();
    await expect(
      prisma.session.count({ where: { userId: member.userId } }),
    ).resolves.toBe(0);
  });

  it("denies an existing session immediately after Church suspension", async () => {
    const member = await createMember();
    const { cookie } = await signIn(member.email);
    await prisma.church.updateMany({
      where: { membership: { userId: member.userId } },
      data: { status: "SUSPENDED", suspendedAt: new Date() },
    });
    await expect(getChurchAccess(new Headers({ cookie }))).resolves.toEqual({
      status: "forbidden",
      userId: member.userId,
    });
  });

  it("does not create a session for a pending identity", async () => {
    const pending = await createPendingIdentity();
    await expect(signIn(pending.email)).rejects.toThrow();
    await expect(
      prisma.session.count({ where: { userId: pending.userId } }),
    ).resolves.toBe(0);
  });

  it("rejects expired and explicitly revoked sessions at the tenant boundary", async () => {
    const member = await createMember();
    const { cookie } = await signIn(member.email);
    const headers = new Headers({ cookie });
    await prisma.session.updateMany({
      where: { userId: member.userId },
      data: {
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    await expect(getChurchAccess(headers)).resolves.toEqual({
      status: "unauthenticated",
    });
    await prisma.session.deleteMany({ where: { userId: member.userId } });
    await expect(getChurchAccess(headers)).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("logout deletes the current session", async () => {
    const member = await createMember();
    const { cookie } = await signIn(member.email);
    await auth.api.signOut({
      headers: new Headers({ cookie, origin: "http://localhost:3000" }),
    });
    await expect(
      prisma.session.count({ where: { userId: member.userId } }),
    ).resolves.toBe(0);
  });

  it("rate limits repeated email login failures in PostgreSQL", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await POST(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          body: JSON.stringify({
            email: `${prefix}.missing@example.invalid`,
            password,
          }),
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          method: "POST",
        }),
      );
      statuses.push(response.status);
    }
    const firstLimitedAttempt = statuses.indexOf(429);
    expect(firstLimitedAttempt).toBeGreaterThan(0);
    expect(firstLimitedAttempt).toBeLessThanOrEqual(10);
    expect(
      statuses.slice(firstLimitedAttempt).every((status) => status === 429),
    ).toBe(true);
    await expect(prisma.rateLimit.count()).resolves.toBeGreaterThan(0);
  });
});
