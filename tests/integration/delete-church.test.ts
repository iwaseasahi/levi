import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { deleteChurch } from "@/infrastructure/auth/church-deletion";
import { prisma } from "@/infrastructure/database/client";
import {
  clearSyntheticBibleFixture,
  createSyntheticBibleFixture,
} from "../helpers/synthetic-bible-fixture";

const namespace = "test.delete-church";
const bibleCleanup = {
  bookCodes: ["TDCH"],
  deleteTranslationCodes: ["TDCHJ"],
};

async function clearFixture() {
  await prisma.verification.deleteMany({
    where: { identifier: { startsWith: namespace } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: namespace } },
  });
  await prisma.church.deleteMany({
    where: { name: { startsWith: namespace } },
  });
  await prisma.adminUser.deleteMany({
    where: { email: { startsWith: namespace } },
  });
  await clearSyntheticBibleFixture(prisma, bibleCleanup);
}

beforeEach(clearFixture);
afterEach(clearFixture);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("administrator church deletion", () => {
  it("deletes the complete tenant aggregate while preserving shared and foreign data", async () => {
    const bible = await createSyntheticBibleFixture(prisma, {
      books: [
        {
          canonicalCode: "TDCH",
          canonicalOrder: 80,
          names: { TDCHJ: { name: "削除試験書" } },
          testament: "NEW",
          verses: [
            {
              chapterNumber: 1,
              texts: { TDCHJ: "削除試験用の合成本文" },
              verseNumber: 1,
            },
          ],
        },
      ],
      sourceReference: "church deletion integration fixture",
      translations: [{ code: "TDCHJ", displayOrder: 80, languageTag: "ja" }],
    });
    const book = bible.books.get("TDCH")!;
    const translation = bible.translations.get("TDCHJ")!;
    const actor = await prisma.adminUser.create({
      data: {
        email: `${namespace}.admin@example.invalid`,
        name: "Deletion Administrator",
        status: "ACTIVE",
      },
    });
    const targetChurch = await prisma.church.create({
      data: { name: `${namespace} target` },
    });
    const preservedChurch = await prisma.church.create({
      data: { name: `${namespace} preserved` },
    });
    const passwordHash = await hashPassword("test-only-password");
    const targetUsers = await Promise.all(
      ["first", "second"].map(async (key) => {
        const user = await prisma.$transaction(async (transaction) => {
          const created = await transaction.user.create({
            data: {
              email: `${namespace}.${key}@example.invalid`,
              name: `Target ${key}`,
            },
          });
          await transaction.churchMembership.create({
            data: { churchId: targetChurch.id, userId: created.id },
          });
          return transaction.user.update({
            data: { actorState: "ACTIVE" },
            where: { id: created.id },
          });
        });
        await prisma.account.create({
          data: {
            accountId: user.id,
            issuer: "local:credential",
            password: passwordHash,
            providerId: "credential",
            userId: user.id,
          },
        });
        await prisma.session.create({
          data: {
            expiresAt: new Date("2099-01-01T00:00:00Z"),
            token: `${namespace}.${key}.${randomUUID()}`,
            userId: user.id,
          },
        });
        await prisma.verification.create({
          data: {
            expiresAt: new Date("2099-01-01T00:00:00Z"),
            identifier: `${namespace}.reset-password.${key}`,
            value: user.id,
          },
        });
        return user;
      }),
    );
    const preservedUser = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: `${namespace}.preserved@example.invalid`,
          name: "Preserved Member",
        },
      });
      await transaction.churchMembership.create({
        data: { churchId: preservedChurch.id, userId: user.id },
      });
      return transaction.user.update({
        data: { actorState: "ACTIVE" },
        where: { id: user.id },
      });
    });
    const folder = await prisma.folder.create({
      data: {
        churchId: targetChurch.id,
        name: "Deletion folder",
        position: 0,
      },
    });
    const bookmark = await prisma.$transaction(async (transaction) => {
      const created = await transaction.bookmark.create({
        data: {
          churchId: targetChurch.id,
          folderId: folder.id,
          position: 0,
          title: "Deletion bookmark",
        },
      });
      await transaction.scriptureBookmark.create({
        data: {
          bookmarkId: created.id,
          bookId: book.id,
          chapterNumber: 1,
          primaryTranslationId: translation.id,
          startVerse: 1,
        },
      });
      return created;
    });
    const sharedBibleCount = await prisma.bibleVerse.count();
    const adminCount = await prisma.adminUser.count();

    await deleteChurch(actor.id, targetChurch.id, targetChurch.name);

    await expect(
      prisma.church.findUnique({ where: { id: targetChurch.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.user.count({
        where: { id: { in: targetUsers.map(({ id }) => id) } },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.account.count({
        where: { userId: { in: targetUsers.map(({ id }) => id) } },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.session.count({
        where: { userId: { in: targetUsers.map(({ id }) => id) } },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.verification.count({
        where: { identifier: { startsWith: namespace } },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.folder.findUnique({ where: { id: folder.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.bookmark.findUnique({ where: { id: bookmark.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.church.findUnique({ where: { id: preservedChurch.id } }),
    ).resolves.toMatchObject({ name: preservedChurch.name });
    await expect(
      prisma.user.findUnique({ where: { id: preservedUser.id } }),
    ).resolves.toMatchObject({ email: preservedUser.email });
    await expect(prisma.bibleVerse.count()).resolves.toBe(sharedBibleCount);
    await expect(prisma.adminUser.count()).resolves.toBe(adminCount);
  });
});
