import { hashPassword } from "better-auth/crypto";

import {
  BASIC_BOOTSTRAP_ADMIN_NAME,
  BASIC_BOOTSTRAP_ADMIN_USER_ID,
} from "@/domain/admin/admin-user";
import { prisma } from "@/infrastructure/database/client";

export const E2E_ADMIN_BASIC_USERNAME = "test-e2e-admin";
export const E2E_CHURCH_USER_EMAIL = "test.e2e.member@example.invalid";
export const E2E_AUTH_USER_EMAIL = "test.e2e.auth-member@example.invalid";
export const E2E_PASSWORD_USER_EMAIL =
  "test.e2e.password-member@example.invalid";
export const E2E_PASSWORD = "e".repeat(16);
export const E2E_CREATED_EMAIL = "test.e2e.created@example.invalid";
export const E2E_CREATED_CHURCH = "test.e2e created church";
export const E2E_ADDITIONAL_CHURCH_USER_EMAIL =
  "test.e2e.additional.member@example.invalid";
export const E2E_INVITED_ADMIN_EMAIL = "test.e2e.invited.admin@example.invalid";
export const E2E_ACTIVE_ADMIN_EMAIL = "test.e2e.active.admin@example.invalid";
export const E2E_INITIAL_ADMIN_EMAIL = "test.e2e.initial.admin@example.invalid";
export const E2E_INITIAL_ADMIN_PASSWORD = "temporary-admin-password";

const E2E_CHURCH_USER_ID = "00000000-0000-4000-8000-000000004302";
const E2E_CHURCH_ID = "00000000-0000-4000-8000-000000004303";
export const E2E_AUTH_USER_ID = "00000000-0000-4000-8000-000000004304";
const E2E_AUTH_CHURCH_ID = "00000000-0000-4000-8000-000000004305";
export const E2E_FOREIGN_FOLDER_ID = "00000000-0000-4000-8000-000000004355";
const E2E_PASSWORD_USER_ID = "00000000-0000-4000-8000-000000004306";
const E2E_PASSWORD_CHURCH_ID = "00000000-0000-4000-8000-000000004307";
const E2E_SCRIPTURE_BOOK_ID = "00000000-0000-4000-8000-000000004350";
const E2E_NEXT_SCRIPTURE_BOOK_ID = "00000000-0000-4000-8000-000000004351";
const E2E_ACTIVE_ADMIN_ID = "00000000-0000-4000-8000-000000004360";
const E2E_INITIAL_ADMIN_ID = "00000000-0000-4000-8000-000000004361";

export async function clearScriptureFixture() {
  await prisma.bibleVerse.deleteMany({
    where: { book: { canonicalCode: { in: ["GEN", "EXO", "TST"] } } },
  });
  await prisma.bibleBookName.deleteMany({
    where: { book: { canonicalCode: { in: ["GEN", "EXO", "TST"] } } },
  });
  await prisma.bibleBook.deleteMany({
    where: { canonicalCode: { in: ["GEN", "EXO", "TST"] } },
  });
  await prisma.bibleTranslation.updateMany({
    where: { code: { in: ["JSS3", "NKJV"] } },
    data: {
      rightsNotice: null,
      sourceReference: null,
    },
  });
}

export async function seedScriptureFixture() {
  await clearScriptureFixture();
  const [japanese, english] = await Promise.all([
    prisma.bibleTranslation.upsert({
      where: { code: "JSS3" },
      update: {
        rightsNotice: "synthetic E2E fixture only",
        sourceReference: "synthetic E2E fixture",
      },
      create: {
        code: "JSS3",
        displayOrder: 1,
        languageTag: "ja",
        name: "Synthetic Japanese translation",
        rightsNotice: "synthetic E2E fixture only",
        sourceReference: "synthetic E2E fixture",
      },
    }),
    prisma.bibleTranslation.upsert({
      where: { code: "NKJV" },
      update: {
        rightsNotice: "synthetic E2E fixture only",
        sourceReference: "synthetic E2E fixture",
      },
      create: {
        code: "NKJV",
        displayOrder: 2,
        languageTag: "en",
        name: "Synthetic English translation",
        rightsNotice: "synthetic E2E fixture only",
        sourceReference: "synthetic E2E fixture",
      },
    }),
  ]);
  await prisma.bibleBook.createMany({
    data: [
      {
        canonicalCode: "GEN",
        canonicalOrder: 1,
        id: E2E_SCRIPTURE_BOOK_ID,
        testament: "OLD",
      },
      {
        canonicalCode: "EXO",
        canonicalOrder: 2,
        id: E2E_NEXT_SCRIPTURE_BOOK_ID,
        testament: "OLD",
      },
    ],
  });
  await prisma.bibleBookName.createMany({
    data: [
      {
        bookId: E2E_SCRIPTURE_BOOK_ID,
        name: "創世記",
        translationId: japanese.id,
      },
      {
        bookId: E2E_SCRIPTURE_BOOK_ID,
        name: "Genesis",
        translationId: english.id,
      },
      {
        bookId: E2E_NEXT_SCRIPTURE_BOOK_ID,
        name: "出エジプト記",
        translationId: japanese.id,
      },
      {
        bookId: E2E_NEXT_SCRIPTURE_BOOK_ID,
        name: "Exodus",
        translationId: english.id,
      },
    ],
  });
  await prisma.bibleVerse.createMany({
    data: [
      { chapter: 1, verse: 1 },
      { chapter: 1, verse: 2 },
      { chapter: 1, verse: 3 },
      { chapter: 2, verse: 1 },
      { chapter: 2, verse: 2 },
    ].flatMap(({ chapter, verse }) => [
      {
        bookId: E2E_SCRIPTURE_BOOK_ID,
        chapterNumber: chapter,
        text:
          chapter === 1 && verse === 1
            ? "初めに、神が天と地を創造した。"
            : `E2E用日本語本文 ${chapter}:${verse}`,
        translationId: japanese.id,
        verseNumber: verse,
      },
      {
        bookId: E2E_SCRIPTURE_BOOK_ID,
        chapterNumber: chapter,
        text:
          chapter === 1 && verse === 1
            ? "In the beginning God created the heavens and the earth."
            : `E2E English test text ${chapter}:${verse}`,
        translationId: english.id,
        verseNumber: verse,
      },
    ]),
  });
  await prisma.bibleVerse.createMany({
    data: [japanese, english].map(({ id: translationId }, index) => ({
      bookId: E2E_NEXT_SCRIPTURE_BOOK_ID,
      chapterNumber: 1,
      text:
        index === 0
          ? "E2E用日本語本文 出エジプト記 1:1"
          : "E2E English test text Exodus 1:1",
      translationId,
      verseNumber: 1,
    })),
  });
}

export async function clearOperatorFixtures() {
  await prisma.rateLimit.deleteMany();
  await prisma.adminRateLimit.deleteMany();
  await prisma.adminUser.deleteMany({
    where: { email: { startsWith: "test.e2e." } },
  });
  await prisma.adminUser.deleteMany({
    where: { id: BASIC_BOOTSTRAP_ADMIN_USER_ID },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "test.e2e." } },
  });
  await prisma.church.deleteMany({
    where: { name: { startsWith: "test.e2e" } },
  });
}

export async function seedOperatorFixtures() {
  await clearOperatorFixtures();
  const passwordHash = await hashPassword(E2E_PASSWORD);
  const initialAdminPasswordHash = await hashPassword(
    E2E_INITIAL_ADMIN_PASSWORD,
  );

  await prisma.$transaction(async (transaction) => {
    await transaction.adminUser.create({
      data: {
        id: BASIC_BOOTSTRAP_ADMIN_USER_ID,
        email: "basic-bootstrap@pending.invalid",
        name: BASIC_BOOTSTRAP_ADMIN_NAME,
        status: "BOOTSTRAP",
      },
    });
    await transaction.adminUser.create({
      data: {
        activatedAt: new Date(),
        email: E2E_ACTIVE_ADMIN_EMAIL,
        id: E2E_ACTIVE_ADMIN_ID,
        name: "Synthetic Active Administrator",
        status: "ACTIVE",
        accounts: {
          create: {
            accountId: E2E_ACTIVE_ADMIN_ID,
            issuer: "local:credential",
            password: passwordHash,
            providerId: "credential",
          },
        },
      },
    });
    await transaction.adminUser.create({
      data: {
        email: E2E_INITIAL_ADMIN_EMAIL,
        id: E2E_INITIAL_ADMIN_ID,
        invitedAt: new Date(),
        invitedByAdminUserId: E2E_ACTIVE_ADMIN_ID,
        name: "Synthetic Initial Administrator",
        status: "INVITED",
        accounts: {
          create: {
            accountId: E2E_INITIAL_ADMIN_ID,
            issuer: "local:credential",
            password: initialAdminPasswordHash,
            providerId: "credential",
          },
        },
      },
    });

    await transaction.church.create({
      data: { id: E2E_CHURCH_ID, name: "test.e2e member church" },
    });
    await transaction.user.create({
      data: {
        actorState: "ACTIVE",
        email: E2E_CHURCH_USER_EMAIL,
        id: E2E_CHURCH_USER_ID,
        name: "Synthetic E2E Church User",
      },
    });
    await transaction.churchMembership.create({
      data: { churchId: E2E_CHURCH_ID, userId: E2E_CHURCH_USER_ID },
    });
    await transaction.account.create({
      data: {
        accountId: E2E_CHURCH_USER_ID,
        issuer: "local:credential",
        password: passwordHash,
        providerId: "credential",
        userId: E2E_CHURCH_USER_ID,
      },
    });

    await transaction.church.create({
      data: { id: E2E_AUTH_CHURCH_ID, name: "test.e2e auth church" },
    });
    await transaction.user.create({
      data: {
        actorState: "ACTIVE",
        email: E2E_AUTH_USER_EMAIL,
        id: E2E_AUTH_USER_ID,
        name: "Synthetic E2E Auth User",
      },
    });
    await transaction.churchMembership.create({
      data: { churchId: E2E_AUTH_CHURCH_ID, userId: E2E_AUTH_USER_ID },
    });
    await transaction.folder.create({
      data: {
        churchId: E2E_AUTH_CHURCH_ID,
        id: E2E_FOREIGN_FOLDER_ID,
        name: "Synthetic foreign tenant folder",
        position: 0,
      },
    });
    await transaction.account.create({
      data: {
        accountId: E2E_AUTH_USER_ID,
        issuer: "local:credential",
        password: passwordHash,
        providerId: "credential",
        userId: E2E_AUTH_USER_ID,
      },
    });

    await transaction.church.create({
      data: { id: E2E_PASSWORD_CHURCH_ID, name: "test.e2e password church" },
    });
    await transaction.user.create({
      data: {
        actorState: "ACTIVE",
        email: E2E_PASSWORD_USER_EMAIL,
        id: E2E_PASSWORD_USER_ID,
        name: "Synthetic E2E Password User",
      },
    });
    await transaction.churchMembership.create({
      data: { churchId: E2E_PASSWORD_CHURCH_ID, userId: E2E_PASSWORD_USER_ID },
    });
    await transaction.account.create({
      data: {
        accountId: E2E_PASSWORD_USER_ID,
        issuer: "local:credential",
        password: passwordHash,
        providerId: "credential",
        userId: E2E_PASSWORD_USER_ID,
      },
    });
  });
}
