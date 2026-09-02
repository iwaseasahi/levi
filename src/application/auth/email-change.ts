import { z } from "zod";

export class EmailChangeInputError extends Error {}
export class EmailChangeAuthorizationError extends Error {}
export class EmailChangeConflictError extends Error {}
export class EmailChangeRateLimitError extends Error {}
export class EmailChangeFailedError extends Error {}

const emailSchema = z.string().trim().toLowerCase().email().max(320);

export interface EmailChangeDependencies {
  consumeRequest(userId: string): Promise<boolean>;
  createVerificationUrl(input: {
    currentEmail: string;
    newEmail: string;
  }): Promise<string>;
  findCredential(userId: string): Promise<{
    email: string;
    name: string;
    passwordHash: string;
  } | null>;
  isEmailInUse(email: string): Promise<boolean>;
  sendVerificationMail(input: {
    name: string;
    to: string;
    verificationUrl: string;
  }): Promise<void>;
  verifyPassword(input: { hash: string; password: string }): Promise<boolean>;
}

function parseInput(input: {
  confirmation: unknown;
  currentPassword: unknown;
  newEmail: unknown;
}) {
  const newEmail = emailSchema.safeParse(input.newEmail);
  const confirmation = emailSchema.safeParse(input.confirmation);
  if (
    !newEmail.success ||
    !confirmation.success ||
    newEmail.data !== confirmation.data ||
    typeof input.currentPassword !== "string" ||
    input.currentPassword.length < 1 ||
    input.currentPassword.length > 128
  ) {
    throw new EmailChangeInputError();
  }
  return {
    currentPassword: input.currentPassword,
    newEmail: newEmail.data,
  };
}

export function createEmailChangeService(
  dependencies: EmailChangeDependencies,
) {
  return {
    async requestChange(input: {
      confirmation: unknown;
      currentPassword: unknown;
      newEmail: unknown;
      userId: string;
    }) {
      const parsed = parseInput(input);
      try {
        if (!(await dependencies.consumeRequest(input.userId)))
          throw new EmailChangeRateLimitError();

        const credential = await dependencies.findCredential(input.userId);
        if (
          !credential ||
          !(await dependencies.verifyPassword({
            hash: credential.passwordHash,
            password: parsed.currentPassword,
          }))
        ) {
          throw new EmailChangeAuthorizationError();
        }
        if (
          credential.email.toLowerCase() === parsed.newEmail ||
          (await dependencies.isEmailInUse(parsed.newEmail))
        ) {
          throw new EmailChangeConflictError();
        }

        const verificationUrl = await dependencies.createVerificationUrl({
          currentEmail: credential.email,
          newEmail: parsed.newEmail,
        });
        await dependencies.sendVerificationMail({
          name: credential.name,
          to: parsed.newEmail,
          verificationUrl,
        });
      } catch (error) {
        if (
          error instanceof EmailChangeAuthorizationError ||
          error instanceof EmailChangeConflictError ||
          error instanceof EmailChangeRateLimitError
        ) {
          throw error;
        }
        throw new EmailChangeFailedError();
      }
    },
  };
}
