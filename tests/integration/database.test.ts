import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

import { prisma } from "@/infrastructure/database/client";
import { buildSystemSetting } from "../helpers/system-setting-factory";

async function clearTestRecords() {
  await prisma.user.deleteMany({
    where: { email: { startsWith: "test." } },
  });
  await prisma.church.deleteMany({
    where: { name: { startsWith: "test." } },
  });
  await prisma.verification.deleteMany({
    where: { identifier: { startsWith: "test." } },
  });
  await prisma.rateLimit.deleteMany({
    where: { key: { startsWith: "test." } },
  });
  await prisma.systemSetting.deleteMany({
    where: { key: { startsWith: "test." } },
  });
}

beforeEach(clearTestRecords);
afterEach(clearTestRecords);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("database foundation", () => {
  it("persists and reads an isolated fixture", async () => {
    const fixture = buildSystemSetting();

    await prisma.systemSetting.create({ data: fixture });

    await expect(
      prisma.systemSetting.findUnique({ where: { id: fixture.id } }),
    ).resolves.toMatchObject(fixture);
  });

  it("starts without records left by another test", async () => {
    await expect(
      prisma.systemSetting.count({ where: { key: { startsWith: "test." } } }),
    ).resolves.toBe(0);
  });
});

describe("auth and tenant constraints", () => {
  const pendingUser = (email: string) => ({
    id: randomUUID(),
    name: "Test Church User",
    email,
  });

  it("enforces normalized case-insensitive global email uniqueness", async () => {
    await prisma.user.create({
      data: pendingUser("test.email@example.invalid"),
    });

    await expect(
      prisma.user.create({ data: pendingUser("Test.upper@example.invalid") }),
    ).rejects.toThrow();
    await expect(
      prisma.user.create({ data: pendingUser("test.email@example.invalid") }),
    ).rejects.toThrow();
  });

  it("allows only complete exclusive active actor assignments", async () => {
    const operator = pendingUser("test.operator@example.invalid");
    await prisma.$transaction(async (transaction) => {
      await transaction.user.create({
        data: { ...operator, actorState: "ACTIVE" },
      });
      await transaction.platformOperator.create({
        data: { userId: operator.id },
      });
    });

    await expect(
      prisma.user.create({
        data: {
          ...pendingUser("test.unassigned@example.invalid"),
          actorState: "ACTIVE",
        },
      }),
    ).rejects.toThrow();

    const mixed = pendingUser("test.mixed@example.invalid");
    await expect(
      prisma.$transaction(async (transaction) => {
        const church = await transaction.church.create({
          data: { name: "test.mixed church" },
        });
        await transaction.user.create({
          data: { ...mixed, actorState: "ACTIVE" },
        });
        await transaction.platformOperator.create({
          data: { userId: mixed.id },
        });
        await transaction.churchMembership.create({
          data: { churchId: church.id, userId: mixed.id },
        });
      }),
    ).rejects.toThrow();

    const member = pendingUser("test.reassigned-member@example.invalid");
    await prisma.$transaction(async (transaction) => {
      const church = await transaction.church.create({
        data: { name: "test.reassigned church" },
      });
      await transaction.user.create({
        data: { ...member, actorState: "ACTIVE" },
      });
      await transaction.churchMembership.create({
        data: { churchId: church.id, userId: member.id },
      });
    });

    await expect(
      prisma.$transaction(async (transaction) => {
        await transaction.platformOperator.delete({
          where: { userId: operator.id },
        });
        await transaction.churchMembership.update({
          where: { userId: member.id },
          data: { userId: operator.id },
        });
      }),
    ).rejects.toThrow();
  });

  it("enforces the initial one-user-per-church membership cardinality", async () => {
    const first = pendingUser("test.first@example.invalid");
    await prisma.$transaction(async (transaction) => {
      const church = await transaction.church.create({
        data: { name: "test.cardinality church" },
      });
      await transaction.user.create({
        data: { ...first, actorState: "ACTIVE" },
      });
      await transaction.churchMembership.create({
        data: { churchId: church.id, userId: first.id },
      });
    });

    const church = await prisma.church.findFirstOrThrow({
      where: { name: "test.cardinality church" },
    });
    const second = pendingUser("test.second@example.invalid");
    await expect(
      prisma.$transaction(async (transaction) => {
        await transaction.user.create({
          data: { ...second, actorState: "ACTIVE" },
        });
        await transaction.churchMembership.create({
          data: { churchId: church.id, userId: second.id },
        });
      }),
    ).rejects.toThrow();
  });

  it("isolates credential hashes from OAuth and session token fields", async () => {
    const user = pendingUser("test.credential@example.invalid");
    const passwordHash = await hashPassword("synthetic-test-password");
    await prisma.user.create({ data: user });
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        issuer: "local:credential",
        password: passwordHash,
      },
    });

    await expect(
      prisma.account.update({
        where: {
          userId_providerId: { userId: user.id, providerId: "credential" },
        },
        data: { password: "plaintext-is-not-an-encoded-scrypt-hash" },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.account.create({
        data: {
          userId: user.id,
          accountId: "oauth-account",
          providerId: "oauth",
          issuer: "https://issuer.example.invalid",
          accessToken: "synthetic-not-a-secret",
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces session and church lifecycle checks", async () => {
    const user = pendingUser("test.session@example.invalid");
    await prisma.user.create({ data: user });

    await expect(
      prisma.session.create({
        data: {
          userId: user.id,
          token: "test.expired-session-token",
          expiresAt: new Date("2000-01-01T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.church.create({
        data: { name: "test.invalid suspension", status: "SUSPENDED" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.rateLimit.create({
        data: { key: "test.invalid-rate-limit", count: -1, lastRequest: 1n },
      }),
    ).rejects.toThrow();
  });

  it("prevents deleting a church while its active user would become unassigned", async () => {
    const user = pendingUser("test.restrict@example.invalid");
    const church = await prisma.$transaction(async (transaction) => {
      const createdChurch = await transaction.church.create({
        data: { name: "test.restrict church" },
      });
      await transaction.user.create({
        data: { ...user, actorState: "ACTIVE" },
      });
      await transaction.churchMembership.create({
        data: { churchId: createdChurch.id, userId: user.id },
      });
      return createdChurch;
    });

    await expect(
      prisma.church.delete({ where: { id: church.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.churchMembership.findUnique({ where: { userId: user.id } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.user.findUnique({ where: { id: user.id } }),
    ).resolves.not.toBeNull();
  });

  it("cascades identity-owned rows without deleting the church", async () => {
    const user = pendingUser("test.cascade@example.invalid");
    const passwordHash = await hashPassword("synthetic-cascade-password");
    const churchId = await prisma.$transaction(async (transaction) => {
      const church = await transaction.church.create({
        data: { name: "test.cascade church" },
      });
      await transaction.user.create({
        data: { ...user, actorState: "ACTIVE" },
      });
      await transaction.churchMembership.create({
        data: { churchId: church.id, userId: user.id },
      });
      await transaction.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          issuer: "local:credential",
          password: passwordHash,
        },
      });
      await transaction.session.create({
        data: {
          userId: user.id,
          token: "test.cascade-session-token",
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      return church.id;
    });

    await prisma.user.delete({ where: { id: user.id } });

    await expect(
      prisma.account.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.session.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.churchMembership.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.church.findUnique({ where: { id: churchId } }),
    ).resolves.not.toBeNull();
  });

  it("installs every raw SQL constraint, index, extension, and actor trigger", async () => {
    const constraints = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE connamespace = current_schema()::regnamespace
    `;
    const indexes = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = current_schema()
    `;
    const extensions = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT extname AS name
      FROM pg_extension
    `;
    const triggers = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT tgname AS name
      FROM pg_trigger
      WHERE NOT tgisinternal
    `;

    expect(constraints.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "users_email_normalized_ck",
        "accounts_credential_only_ck",
        "accounts_password_hash_format_ck",
        "sessions_expiry_order_ck",
        "verifications_expiry_order_ck",
        "rate_limits_count_ck",
        "churches_suspension_ck",
      ]),
    );
    expect(indexes.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "accounts_issuer_account_uk",
        "accounts_user_provider_uk",
        "sessions_user_expires_idx",
        "rate_limits_key_uk",
      ]),
    );
    expect(extensions.map(({ name }) => name)).toContain("citext");
    expect(triggers.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "users_actor_assignment_ck",
        "platform_operators_actor_assignment_ck",
        "church_memberships_actor_assignment_ck",
      ]),
    );
  });
});
