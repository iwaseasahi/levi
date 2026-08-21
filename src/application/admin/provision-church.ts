import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import { getAuthRuntimeConfig } from "@/config/env";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { buildAuthOptions } from "@/infrastructure/auth/options";
import {
  parseProvisioningInput,
  type ProvisioningFieldErrors,
} from "./provisioning-input";
import { generateTemporaryPassword } from "./temporary-password";

export class ProvisioningAuthorizationError extends Error {
  constructor() {
    super("Platform operator authorization is required");
    this.name = "ProvisioningAuthorizationError";
  }
}

export class ProvisioningInputError extends Error {
  constructor(readonly fieldErrors: ProvisioningFieldErrors) {
    super("Provisioning input is invalid");
    this.name = "ProvisioningInputError";
  }
}

export class ProvisioningFailedError extends Error {
  constructor() {
    super("Church provisioning failed");
    this.name = "ProvisioningFailedError";
  }
}

export interface ProvisionChurchResult {
  churchId: string;
  churchName: string;
  email: string;
  temporaryPassword: string;
  userId: string;
}

interface ProvisionChurchDependencies {
  generatePassword(): string;
}

function createCredentialProvisioner(transaction: Prisma.TransactionClient) {
  const options = buildAuthOptions(getAuthRuntimeConfig());

  return betterAuth({
    ...options,
    database: prismaAdapter(transaction, {
      provider: "postgresql",
      transaction: false,
    }),
    emailAndPassword: {
      ...options.emailAndPassword,
      disableSignUp: false,
      autoSignIn: false,
    },
  });
}

export function createChurchProvisioner(
  dependencies: ProvisionChurchDependencies = {
    generatePassword: generateTemporaryPassword,
  },
) {
  return async function provisionChurch(
    operatorUserId: string,
    rawInput: {
      accountName: unknown;
      churchName: unknown;
      email: unknown;
    },
  ): Promise<ProvisionChurchResult> {
    const input = parseProvisioningInput(rawInput);
    if (!input.success) {
      throw new ProvisioningInputError(input.errors);
    }

    const temporaryPassword = dependencies.generatePassword();

    try {
      return await prisma.$transaction(
        async (transaction) => {
          const operator = await transaction.platformOperator.findUnique({
            where: { userId: operatorUserId },
            select: { user: { select: { actorState: true } } },
          });
          if (operator?.user.actorState !== "ACTIVE") {
            throw new ProvisioningAuthorizationError();
          }

          const credentialProvisioner =
            createCredentialProvisioner(transaction);
          const authResult = await credentialProvisioner.api.signUpEmail({
            body: {
              email: input.data.email,
              name: input.data.accountName,
              password: temporaryPassword,
            },
          });

          const user = await transaction.user.findUnique({
            where: { id: authResult.user.id },
            select: { actorState: true, id: true },
          });
          if (!user || user.actorState !== "PENDING") {
            throw new ProvisioningFailedError();
          }

          const church = await transaction.church.create({
            data: { name: input.data.churchName },
            select: { id: true, name: true },
          });
          await transaction.churchMembership.create({
            data: { churchId: church.id, userId: user.id },
          });
          await transaction.user.update({
            where: { id: user.id },
            data: { actorState: "ACTIVE", mustChangePassword: true },
          });

          return {
            churchId: church.id,
            churchName: church.name,
            email: input.data.email,
            temporaryPassword,
            userId: user.id,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof ProvisioningAuthorizationError) {
        throw error;
      }
      throw new ProvisioningFailedError();
    }
  };
}

export const provisionChurch = createChurchProvisioner();
