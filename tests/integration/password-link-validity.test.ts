import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { auth } from "@/infrastructure/auth/server";
import { adminAuth } from "@/infrastructure/auth/admin-server";
import { prisma } from "@/infrastructure/database/client";

const prefix = "test.password-link-376.";
const ids: string[] = [];
const hour = 60 * 60 * 1000;

afterEach(async () => {
  await prisma.verification.deleteMany({ where: { value: { in: ids } } });
  await prisma.adminVerification.deleteMany({ where: { value: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.church.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.adminUser.deleteMany({
    where: { email: { startsWith: prefix } },
  });
  ids.splice(0);
});
afterAll(() => prisma.$disconnect());

describe.each(["church", "admin"] as const)(
  "%s password link lifetime",
  (audience) => {
    it.each([48, 73])(
      "enforces three-day expiry after %i hours and single use",
      async (age) => {
        const id = randomUUID();
        ids.push(id);
        const email = `${prefix}${id}@example.invalid`;
        const data = { id, name: "Synthetic invited user", email };
        const credential = {
          accountId: id,
          userId: id,
          providerId: "credential",
          issuer: "local:credential",
          password: await hashPassword("synthetic-initial-password"),
        };
        if (audience === "church") {
          await prisma.user.create({
            data: {
              ...data,
              actorState: "PENDING",
              churchMembership: {
                create: { church: { create: { name: `${prefix}${id}` } } },
              },
            },
          });
          await prisma.account.create({ data: credential });
        } else {
          await prisma.adminUser.create({
            data: { ...data, status: "INVITED" },
          });
          await prisma.adminAccount.create({ data: credential });
        }
        const api = audience === "church" ? auth.api : adminAuth.api;
        const before = Date.now();
        await api.requestPasswordReset({ body: { email } });
        const tokenRecord =
          audience === "church"
            ? await prisma.verification.findFirstOrThrow({
                where: { value: id },
              })
            : await prisma.adminVerification.findFirstOrThrow({
                where: { value: id },
              });
        expect(tokenRecord.expiresAt.getTime()).toBeGreaterThanOrEqual(
          before + 72 * hour - 1000,
        );
        expect(tokenRecord.expiresAt.getTime()).toBeLessThanOrEqual(
          Date.now() + 72 * hour,
        );
        const token = tokenRecord.identifier.slice("reset-password:".length);
        const body = { token, newPassword: "synthetic-selected-password" };
        // Age the persisted token, not the process clock: Prisma transaction
        // deadlines must continue to use real time during the auth request.
        const agedExpiry = new Date(
          tokenRecord.expiresAt.getTime() - age * hour,
        );
        if (audience === "church") {
          await prisma.verification.update({
            where: { id: tokenRecord.id },
            data: {
              createdAt: new Date(before - age * hour),
              expiresAt: agedExpiry,
            },
          });
        } else {
          await prisma.adminVerification.update({
            where: { id: tokenRecord.id },
            data: { expiresAt: agedExpiry },
          });
        }
        if (age > 72) {
          await expect(api.resetPassword({ body })).rejects.toThrow();
        } else {
          await expect(api.resetPassword({ body })).resolves.toMatchObject({
            status: true,
          });
          await expect(api.resetPassword({ body })).rejects.toThrow();
          const record =
            audience === "church"
              ? await prisma.user.findUniqueOrThrow({ where: { id } })
              : await prisma.adminUser.findUniqueOrThrow({ where: { id } });
          expect(record).toMatchObject(
            audience === "church"
              ? { actorState: "ACTIVE" }
              : { status: "ACTIVE" },
          );
        }
      },
    );
  },
);
