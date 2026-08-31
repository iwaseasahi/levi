import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  createChurchUserDeleter,
  ChurchUserDeletionAuthorizationError,
  ChurchUserDeletionConfirmationError,
  ChurchUserDeletionNotFoundError,
  ChurchUserDeletionFailedError,
} from "@/application/admin/delete-church-user";
import {
  createChurchUserDeletionStore,
  deleteChurchUser,
} from "@/infrastructure/auth/church-user-deletion";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { auth } from "@/infrastructure/auth/server";
import { prisma } from "@/infrastructure/database/client";
import {
  createSyntheticBibleFixture,
  clearSyntheticBibleFixture,
} from "../helpers/synthetic-bible-fixture";

const prefix = "test.delete-church-user.";
const password = "synthetic-deletion-password";
const ids: string[] = [];
afterEach(async () => {
  await prisma.verification.deleteMany({ where: { value: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.church.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.adminUser.deleteMany({
    where: { email: { startsWith: prefix } },
  });
  await clearSyntheticBibleFixture(prisma, {
    bookCodes: ["TDCU"],
    deleteTranslationCodes: ["TDCUJ"],
  });
  ids.splice(0);
});
afterAll(() => prisma.$disconnect());

async function fixture(actorState: "ACTIVE" | "PENDING" = "ACTIVE") {
  const suffix = randomUUID();
  const actor = await prisma.adminUser.create({
    data: {
      email: `${prefix}${suffix}.admin@example.invalid`,
      name: "Synthetic administrator",
      status: "ACTIVE",
    },
  });
  const church = await prisma.church.create({
    data: { name: `${prefix}${suffix}` },
  });
  const user = await prisma.user.create({
    data: {
      id: suffix,
      email: `${prefix}${suffix}@example.invalid`,
      name: "Synthetic member",
      actorState,
      churchMembership: { create: { churchId: church.id } },
      accounts: {
        create: {
          accountId: suffix,
          issuer: "local:credential",
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });
  ids.push(user.id);
  await auth.api.requestPasswordReset({ body: { email: user.email } });
  const verification = await prisma.verification.findFirstOrThrow({
    where: { value: user.id },
  });
  return { actor, church, user, verification };
}

async function signIn(email: string) {
  const response = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: "http://localhost:3000" }),
    returnHeaders: true,
  });
  return new Headers({
    cookie: (response.headers.get("set-cookie") ?? "").split(";")[0]!,
  });
}

describe("administrator deletion of an individual church user", () => {
  it.each(["ACTIVE", "PENDING"] as const)(
    "removes %s credentials and links but preserves the church and shared content",
    async (status) => {
      const { actor, church, user, verification } = await fixture(status);
      const other = await prisma.user.create({
        data: {
          email: `${prefix}other@example.invalid`,
          name: "Preserved member",
          actorState: "ACTIVE",
          churchMembership: { create: { churchId: church.id } },
        },
      });
      const foreign = await fixture();
      const bible = await createSyntheticBibleFixture(prisma, {
        books: [
          {
            canonicalCode: "TDCU",
            canonicalOrder: 81,
            names: { TDCUJ: { name: "利用者削除試験書" } },
            testament: "NEW",
            verses: [
              {
                chapterNumber: 1,
                verseNumber: 1,
                texts: { TDCUJ: "利用者削除用の合成本文" },
              },
            ],
          },
        ],
        translations: [{ code: "TDCUJ", displayOrder: 81, languageTag: "ja" }],
        sourceReference: "individual church user deletion synthetic fixture",
      });
      const folder = await prisma.folder.create({
        data: { churchId: church.id, name: "Preserved folder", position: 0 },
      });
      const bookmark = await prisma.bookmark.create({
        data: {
          churchId: church.id,
          folderId: folder.id,
          title: "Preserved bookmark",
          position: 0,
          scripture: {
            create: {
              bookId: bible.books.get("TDCU")!.id,
              chapterNumber: 1,
              startVerse: 1,
              primaryTranslationId: bible.translations.get("TDCUJ")!.id,
            },
          },
        },
      });
      const bibleCount = await prisma.bibleVerse.count();
      const sessions =
        status === "ACTIVE"
          ? [await signIn(user.email), await signIn(user.email)]
          : [];
      for (const headers of sessions)
        expect(await getChurchAccess(headers)).toMatchObject({
          status: "authorized",
        });

      await deleteChurchUser(
        actor.id,
        church.id,
        user.id,
        user.email.toUpperCase(),
      );

      expect(
        await prisma.user.findUnique({ where: { id: user.id } }),
      ).toBeNull();
      expect(await prisma.account.count({ where: { userId: user.id } })).toBe(
        0,
      );
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(
        0,
      );
      expect(
        await prisma.churchMembership.count({ where: { userId: user.id } }),
      ).toBe(0);
      expect(
        await prisma.verification.count({ where: { value: user.id } }),
      ).toBe(0);
      for (const headers of sessions)
        expect(await getChurchAccess(headers)).toMatchObject({
          status: "unauthenticated",
        });
      await expect(signIn(user.email)).rejects.toThrow();
      await expect(
        auth.api.resetPassword({
          body: {
            token: verification.identifier.slice("reset-password:".length),
            newPassword: "synthetic-replacement-password",
          },
        }),
      ).rejects.toThrow();
      expect(
        await prisma.church.findUnique({ where: { id: church.id } }),
      ).not.toBeNull();
      expect(
        await prisma.user.findUnique({ where: { id: other.id } }),
      ).not.toBeNull();
      expect(
        await prisma.user.findUnique({ where: { id: foreign.user.id } }),
      ).not.toBeNull();
      expect(
        await prisma.verification.findUnique({
          where: { id: foreign.verification.id },
        }),
      ).not.toBeNull();
      expect(
        await prisma.adminUser.findUnique({ where: { id: actor.id } }),
      ).not.toBeNull();
      expect(
        await prisma.folder.findUnique({ where: { id: folder.id } }),
      ).not.toBeNull();
      expect(
        await prisma.bookmark.findUnique({ where: { id: bookmark.id } }),
      ).not.toBeNull();
      expect(await prisma.bibleVerse.count()).toBe(bibleCount);
    },
  );

  it("preserves an empty church after deleting its last user", async () => {
    const { actor, church, user } = await fixture("PENDING");
    await deleteChurchUser(actor.id, church.id, user.id, user.email);
    expect(
      await prisma.church.findUnique({ where: { id: church.id } }),
    ).not.toBeNull();
    expect(
      await prisma.churchMembership.count({ where: { churchId: church.id } }),
    ).toBe(0);
  });

  it("rechecks actor, membership and confirmation without mutating on rejection", async () => {
    const { actor, church, user, verification } = await fixture();
    await expect(
      deleteChurchUser(actor.id, randomUUID(), user.id, user.email),
    ).rejects.toBeInstanceOf(ChurchUserDeletionNotFoundError);
    await expect(
      deleteChurchUser(actor.id, church.id, randomUUID(), user.email),
    ).rejects.toBeInstanceOf(ChurchUserDeletionNotFoundError);
    await expect(
      deleteChurchUser(actor.id, church.id, user.id, "wrong@example.invalid"),
    ).rejects.toBeInstanceOf(ChurchUserDeletionConfirmationError);
    await prisma.adminUser.update({
      where: { id: actor.id },
      data: { status: "INVITED" },
    });
    await expect(
      deleteChurchUser(actor.id, church.id, user.id, user.email),
    ).rejects.toBeInstanceOf(ChurchUserDeletionAuthorizationError);
    expect(
      await prisma.user.findUnique({ where: { id: user.id } }),
    ).not.toBeNull();
    expect(
      await prisma.verification.findUnique({ where: { id: verification.id } }),
    ).not.toBeNull();
  });

  it("rolls back credentials, sessions, membership and links if the transaction fails", async () => {
    const { actor, church, user, verification } = await fixture();
    const headers = await signIn(user.email);
    const failingDelete = createChurchUserDeleter({
      runTransaction(operation) {
        return prisma.$transaction(async (transaction) => {
          await operation(createChurchUserDeletionStore(transaction));
          throw new Error("Synthetic failure before commit");
        });
      },
    });
    await expect(
      failingDelete(actor.id, church.id, user.id, user.email),
    ).rejects.toBeInstanceOf(ChurchUserDeletionFailedError);
    expect(
      await prisma.user.findUnique({ where: { id: user.id } }),
    ).not.toBeNull();
    expect(
      await prisma.verification.findUnique({ where: { id: verification.id } }),
    ).not.toBeNull();
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(1);
    expect(
      await prisma.churchMembership.count({ where: { userId: user.id } }),
    ).toBe(1);
    expect(await getChurchAccess(headers)).toMatchObject({
      status: "authorized",
    });
  });
});
