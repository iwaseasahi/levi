import { hashPassword, verifyPassword } from "better-auth/crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { generateTemporaryPassword } from "@/application/admin/temporary-password";

export class PasswordLifecycleAuthorizationError extends Error {}
export class PasswordLifecycleInputError extends Error {}
export class PasswordLifecycleFailedError extends Error {}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ResetChurchPasswordResult {
  churchId: string;
  churchName: string;
  email: string;
  temporaryPassword: string;
  userId: string;
}

function validPassword(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const length = Array.from(value).length;
  return length >= 12 && length <= 128;
}

export async function resetChurchPassword(
  operatorUserId: string,
  churchId: string,
): Promise<ResetChurchPasswordResult> {
  if (!UUID_PATTERN.test(churchId)) throw new PasswordLifecycleInputError();
  if (!UUID_PATTERN.test(operatorUserId))
    throw new PasswordLifecycleAuthorizationError();

  let operatorIsActive = false;
  try {
    const operator = await prisma.platformOperator.findUnique({
      where: { userId: operatorUserId },
      select: { user: { select: { actorState: true } } },
    });
    operatorIsActive = operator?.user.actorState === "ACTIVE";
  } catch {
    throw new PasswordLifecycleFailedError();
  }
  if (!operatorIsActive) throw new PasswordLifecycleAuthorizationError();

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const operator = await tx.platformOperator.findUnique({
          where: { userId: operatorUserId },
          select: { user: { select: { actorState: true } } },
        });
        if (operator?.user.actorState !== "ACTIVE")
          throw new PasswordLifecycleAuthorizationError();

        const church = await tx.church.findFirst({
          where: { id: churchId, status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            membership: {
              select: {
                user: { select: { actorState: true, email: true, id: true } },
              },
            },
          },
        });
        const user = church?.membership?.user;
        if (!church || !user || user.actorState !== "ACTIVE")
          throw new PasswordLifecycleFailedError();

        const updated = await tx.account.updateMany({
          where: { userId: user.id, providerId: "credential" },
          data: { password: passwordHash },
        });
        if (updated.count !== 1) throw new PasswordLifecycleFailedError();
        await tx.user.update({
          where: { id: user.id },
          data: { mustChangePassword: true },
        });
        await tx.session.deleteMany({ where: { userId: user.id } });
        return {
          churchId: church.id,
          churchName: church.name,
          email: user.email,
          temporaryPassword,
          userId: user.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof PasswordLifecycleAuthorizationError) throw error;
    throw new PasswordLifecycleFailedError();
  }
}

export async function completeForcedPasswordChange(input: {
  currentPassword: unknown;
  newPassword: unknown;
  confirmation: unknown;
  sessionId: string;
  userId: string;
}) {
  if (
    !validPassword(input.currentPassword) ||
    !validPassword(input.newPassword) ||
    input.newPassword !== input.confirmation
  )
    throw new PasswordLifecycleInputError();
  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;
  try {
    await prisma.$transaction(
      async (tx) => {
        const session = await tx.session.findFirst({
          where: {
            id: input.sessionId,
            userId: input.userId,
            expiresAt: { gt: new Date() },
          },
        });
        const user = await tx.user.findFirst({
          where: {
            id: input.userId,
            actorState: "ACTIVE",
            mustChangePassword: true,
            churchMembership: { church: { status: "ACTIVE" } },
          },
          select: {
            accounts: {
              where: { providerId: "credential" },
              select: { id: true, password: true },
            },
          },
        });
        const account = user?.accounts[0];
        if (!session || !account?.password)
          throw new PasswordLifecycleAuthorizationError();
        if (
          !(await verifyPassword({
            hash: account.password,
            password: currentPassword,
          }))
        )
          throw new PasswordLifecycleFailedError();
        const newHash = await hashPassword(newPassword);
        await tx.account.update({
          where: { id: account.id },
          data: { password: newHash },
        });
        await tx.user.update({
          where: { id: input.userId },
          data: { mustChangePassword: false },
        });
        await tx.session.deleteMany({
          where: { userId: input.userId, id: { not: input.sessionId } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof PasswordLifecycleInputError) throw error;
    if (error instanceof PasswordLifecycleAuthorizationError) throw error;
    throw new PasswordLifecycleFailedError();
  }
}
