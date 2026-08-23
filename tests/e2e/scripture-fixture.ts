import { randomUUID } from "node:crypto";
import { hashPassword, makeSignature } from "better-auth/crypto";

import { prisma } from "@/infrastructure/database/client";
import { expect, test as base } from "./fixtures";
import { E2E_PASSWORD } from "./operator-fixture";

export type ScriptureAccount = {
  churchId: string;
  email: string;
  signedSessionToken: string;
  userId: string;
};

const passwordHash = hashPassword(E2E_PASSWORD);

export const test = base.extend<{ scriptureAccount: ScriptureAccount }>({
  scriptureAccount: async ({}, run) => {
    const churchId = randomUUID();
    const sessionToken = `${randomUUID()}${randomUUID()}`;
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) throw new Error("BETTER_AUTH_SECRET is required for E2E");
    const userId = randomUUID();
    const account: ScriptureAccount = {
      churchId,
      email: `test.e2e.scripture.${userId}@example.invalid`,
      signedSessionToken: `${sessionToken}.${await makeSignature(sessionToken, secret)}`,
      userId,
    };

    await prisma.$transaction(async (transaction) => {
      await transaction.church.create({
        data: { id: churchId, name: `test.e2e scripture ${churchId}` },
      });
      await transaction.user.create({
        data: {
          actorState: "ACTIVE",
          email: account.email,
          id: userId,
          name: "Synthetic Scripture E2E User",
        },
      });
      await transaction.churchMembership.create({
        data: { churchId, userId },
      });
      await transaction.account.create({
        data: {
          accountId: userId,
          issuer: "local:credential",
          password: await passwordHash,
          providerId: "credential",
          userId,
        },
      });
      await transaction.session.create({
        data: {
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
          token: sessionToken,
          userId,
        },
      });
    });

    try {
      await run(account);
    } finally {
      await prisma.$transaction([
        prisma.user.deleteMany({ where: { id: userId } }),
        prisma.church.deleteMany({ where: { id: churchId } }),
      ]);
    }
  },
});

export { expect };
