import {
  parseProvisioningInput,
  type ProvisioningFieldErrors,
} from "./provisioning-input";

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
  constructor(cause?: unknown) {
    super("Church provisioning failed", { cause });
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

export interface ProvisionChurchTransaction {
  activateUser(userId: string): Promise<void>;
  createChurch(name: string): Promise<{ id: string; name: string }>;
  createChurchMembership(churchId: string, userId: string): Promise<void>;
  createCredential(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ userId: string }>;
  findActiveOperator(userId: string): Promise<boolean>;
  isPendingUser(userId: string): Promise<boolean>;
}

export interface ProvisionChurchDependencies {
  generatePassword(): string;
  runTransaction<T>(
    operation: (transaction: ProvisionChurchTransaction) => Promise<T>,
  ): Promise<T>;
}

export function createChurchProvisioner(
  dependencies: ProvisionChurchDependencies,
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
    if (!input.success) throw new ProvisioningInputError(input.errors);
    const temporaryPassword = dependencies.generatePassword();

    try {
      return await dependencies.runTransaction(async (transaction) => {
        if (!(await transaction.findActiveOperator(operatorUserId)))
          throw new ProvisioningAuthorizationError();
        const credential = await transaction.createCredential({
          email: input.data.email,
          name: input.data.accountName,
          password: temporaryPassword,
        });
        if (!(await transaction.isPendingUser(credential.userId)))
          throw new ProvisioningFailedError();
        const church = await transaction.createChurch(input.data.churchName);
        await transaction.createChurchMembership(church.id, credential.userId);
        await transaction.activateUser(credential.userId);
        return {
          churchId: church.id,
          churchName: church.name,
          email: input.data.email,
          temporaryPassword,
          userId: credential.userId,
        };
      });
    } catch (error) {
      if (error instanceof ProvisioningAuthorizationError) throw error;
      throw new ProvisioningFailedError(error);
    }
  };
}
