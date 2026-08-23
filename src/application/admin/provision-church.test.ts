import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  betterAuth: vi.fn(),
  buildAuthOptions: vi.fn(() => ({
    emailAndPassword: { enabled: true },
  })),
  getAuthRuntimeConfig: vi.fn(() => ({})),
  prisma: { $transaction: vi.fn() },
  prismaAdapter: vi.fn(() => "adapter"),
  signUpEmail: vi.fn(),
}));

vi.mock("better-auth", () => ({ betterAuth: mocks.betterAuth }));
vi.mock("@better-auth/prisma-adapter", () => ({
  prismaAdapter: mocks.prismaAdapter,
}));
vi.mock("@/config/env", () => ({
  getAuthRuntimeConfig: mocks.getAuthRuntimeConfig,
}));
vi.mock("@/infrastructure/auth/options", () => ({
  buildAuthOptions: mocks.buildAuthOptions,
}));
vi.mock("@/infrastructure/database/client", () => ({ prisma: mocks.prisma }));

import {
  createChurchProvisioner,
  ProvisioningAuthorizationError,
  ProvisioningFailedError,
  ProvisioningInputError,
} from "./provision-church";

const operatorId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const input = {
  accountName: "教会利用者",
  churchName: "テスト教会",
  email: "church@example.invalid",
};

function transaction() {
  return {
    church: {
      create: vi
        .fn()
        .mockResolvedValue({ id: "church-id", name: input.churchName }),
    },
    churchMembership: { create: vi.fn() },
    platformOperator: {
      findUnique: vi.fn().mockResolvedValue({ user: { actorState: "ACTIVE" } }),
    },
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ actorState: "PENDING", id: userId }),
      update: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.betterAuth.mockReturnValue({ api: { signUpEmail: mocks.signUpEmail } });
  mocks.signUpEmail.mockResolvedValue({ user: { id: userId } });
});

describe("createChurchProvisioner", () => {
  it("rejects invalid input before generating credentials", async () => {
    const generatePassword = vi.fn();
    const provision = createChurchProvisioner({ generatePassword });

    await expect(
      provision(operatorId, { ...input, churchName: " " }),
    ).rejects.toBeInstanceOf(ProvisioningInputError);
    expect(generatePassword).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates one active church account with a forced password change", async () => {
    const tx = transaction();
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback(tx),
    );
    const provision = createChurchProvisioner({
      generatePassword: () => "t".repeat(24),
    });

    await expect(provision(operatorId, input)).resolves.toEqual({
      churchId: "church-id",
      churchName: input.churchName,
      email: input.email,
      temporaryPassword: "t".repeat(24),
      userId,
    });
    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      body: {
        email: input.email,
        name: input.accountName,
        password: "t".repeat(24),
      },
    });
    expect(tx.churchMembership.create).toHaveBeenCalledWith({
      data: { churchId: "church-id", userId },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      data: { actorState: "ACTIVE", mustChangePassword: true },
      where: { id: userId },
    });
  });

  it("preserves authorization failures and masks invalid persistence state", async () => {
    const unauthorized = transaction();
    unauthorized.platformOperator.findUnique.mockResolvedValueOnce({
      user: { actorState: "SUSPENDED" },
    });
    mocks.prisma.$transaction.mockImplementationOnce(async (callback) =>
      callback(unauthorized),
    );
    const provision = createChurchProvisioner({
      generatePassword: () => "t".repeat(24),
    });
    await expect(provision(operatorId, input)).rejects.toBeInstanceOf(
      ProvisioningAuthorizationError,
    );

    const invalidUser = transaction();
    invalidUser.user.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.$transaction.mockImplementationOnce(async (callback) =>
      callback(invalidUser),
    );
    await expect(provision(operatorId, input)).rejects.toBeInstanceOf(
      ProvisioningFailedError,
    );

    mocks.prisma.$transaction.mockRejectedValueOnce(new Error("db"));
    await expect(provision(operatorId, input)).rejects.toBeInstanceOf(
      ProvisioningFailedError,
    );
  });
});
