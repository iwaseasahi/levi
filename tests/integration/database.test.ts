import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

import { prisma } from "@/infrastructure/database/client";
import { buildSystemSetting } from "../helpers/system-setting-factory";

const namespace = "test.database.";

async function clearTestRecords() {
  await prisma.adminUser.deleteMany({
    where: { loginId: { startsWith: namespace } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: namespace } },
  });
  await prisma.church.deleteMany({
    where: { name: { startsWith: namespace } },
  });
  await prisma.verification.deleteMany({
    where: { identifier: { startsWith: namespace } },
  });
  await prisma.rateLimit.deleteMany({
    where: { key: { startsWith: namespace } },
  });
  await prisma.systemSetting.deleteMany({
    where: { key: { startsWith: namespace } },
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
      prisma.systemSetting.count({ where: { key: { startsWith: namespace } } }),
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
      data: pendingUser("test.database.email@example.invalid"),
    });

    await expect(
      prisma.user.create({
        data: pendingUser("Test.Database.upper@example.invalid"),
      }),
    ).rejects.toThrow();
    await expect(
      prisma.user.create({
        data: pendingUser("test.database.email@example.invalid"),
      }),
    ).rejects.toThrow();
  });

  it("allows only complete active Church member assignments", async () => {
    await expect(
      prisma.user.create({
        data: {
          ...pendingUser("test.database.unassigned@example.invalid"),
          actorState: "ACTIVE",
        },
      }),
    ).rejects.toThrow();

    const member = pendingUser(
      "test.database.reassigned-member@example.invalid",
    );
    await prisma.$transaction(async (transaction) => {
      const church = await transaction.church.create({
        data: { name: "test.database.reassigned church" },
      });
      await transaction.user.create({
        data: { ...member, actorState: "ACTIVE" },
      });
      await transaction.churchMembership.create({
        data: { churchId: church.id, userId: member.id },
      });
    });

    await expect(
      prisma.churchMembership.delete({ where: { userId: member.id } }),
    ).rejects.toThrow();
  });

  it("keeps administrator credentials independent from Church users", async () => {
    const id = randomUUID();
    await prisma.adminUser.create({
      data: {
        id,
        loginId: "test.database.admin",
        mustChangePassword: false,
        name: "Test Administrator",
        passwordHash: "synthetic-hash",
        status: "ACTIVE",
      },
    });

    await expect(prisma.user.findUnique({ where: { id } })).resolves.toBeNull();
    await expect(
      prisma.adminUser.create({
        data: {
          loginId: "TEST.DATABASE.ADMIN",
          name: "Duplicate Administrator",
          passwordHash: "synthetic-hash",
          status: "INVITED",
          invitedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces the initial one-user-per-church membership cardinality", async () => {
    const first = pendingUser("test.database.first@example.invalid");
    await prisma.$transaction(async (transaction) => {
      const church = await transaction.church.create({
        data: { name: "test.database.cardinality church" },
      });
      await transaction.user.create({
        data: { ...first, actorState: "ACTIVE" },
      });
      await transaction.churchMembership.create({
        data: { churchId: church.id, userId: first.id },
      });
    });

    const church = await prisma.church.findFirstOrThrow({
      where: { name: "test.database.cardinality church" },
    });
    const second = pendingUser("test.database.second@example.invalid");
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
    const user = pendingUser("test.database.credential@example.invalid");
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
    const user = pendingUser("test.database.session@example.invalid");
    await prisma.user.create({ data: user });

    await expect(
      prisma.session.create({
        data: {
          userId: user.id,
          token: "test.database.expired-session-token",
          expiresAt: new Date("2000-01-01T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.church.create({
        data: {
          name: "test.database.invalid suspension",
          status: "SUSPENDED",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.rateLimit.create({
        data: {
          key: "test.database.invalid-rate-limit",
          count: -1,
          lastRequest: 1n,
        },
      }),
    ).rejects.toThrow();
  });

  it("prevents deleting a church while its active user would become unassigned", async () => {
    const user = pendingUser("test.database.restrict@example.invalid");
    const church = await prisma.$transaction(async (transaction) => {
      const createdChurch = await transaction.church.create({
        data: { name: "test.database.restrict church" },
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
    const user = pendingUser("test.database.cascade@example.invalid");
    const passwordHash = await hashPassword("synthetic-cascade-password");
    const churchId = await prisma.$transaction(async (transaction) => {
      const church = await transaction.church.create({
        data: { name: "test.database.cascade church" },
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
          token: "test.database.cascade-session-token",
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
        "church_memberships_actor_assignment_ck",
      ]),
    );
  });
});
