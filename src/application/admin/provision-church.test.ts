import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createChurchProvisioner,
  ProvisioningAuthorizationError,
  ProvisioningFailedError,
  ProvisioningInputError,
  type ProvisionChurchTransaction,
} from "./provision-church";

const operatorId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const input = {
  accountName: "教会利用者",
  churchName: "テスト教会",
  email: "church@example.invalid",
};

function transaction(): ProvisionChurchTransaction {
  return {
    activateUser: vi.fn(),
    createChurch: vi
      .fn()
      .mockResolvedValue({ id: "church-id", name: input.churchName }),
    createChurchMembership: vi.fn(),
    createCredential: vi.fn().mockResolvedValue({ userId }),
    findActiveOperator: vi.fn().mockResolvedValue(true),
    isPendingUser: vi.fn().mockResolvedValue(true),
  };
}

function dependencies(tx = transaction()) {
  return {
    generatePassword: vi.fn(() => "t".repeat(24)),
    runTransaction: vi.fn(async (operation) => operation(tx)),
    tx,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("createChurchProvisioner", () => {
  it("rejects invalid input before opening a transaction", async () => {
    const deps = dependencies();
    const provision = createChurchProvisioner(deps);
    await expect(
      provision(operatorId, { ...input, churchName: " " }),
    ).rejects.toBeInstanceOf(ProvisioningInputError);
    expect(deps.generatePassword).not.toHaveBeenCalled();
    expect(deps.runTransaction).not.toHaveBeenCalled();
  });

  it("creates one active church account through application ports", async () => {
    const deps = dependencies();
    const provision = createChurchProvisioner(deps);
    await expect(provision(operatorId, input)).resolves.toEqual({
      churchId: "church-id",
      churchName: input.churchName,
      email: input.email,
      temporaryPassword: "t".repeat(24),
      userId,
    });
    expect(deps.tx.createCredential).toHaveBeenCalledWith({
      email: input.email,
      name: input.accountName,
      password: "t".repeat(24),
    });
    expect(deps.tx.createChurchMembership).toHaveBeenCalledWith(
      "church-id",
      userId,
    );
    expect(deps.tx.activateUser).toHaveBeenCalledWith(userId);
  });

  it("preserves authorization failures and masks adapter failures", async () => {
    const denied = dependencies();
    vi.mocked(denied.tx.findActiveOperator).mockResolvedValue(false);
    await expect(
      createChurchProvisioner(denied)(operatorId, input),
    ).rejects.toBeInstanceOf(ProvisioningAuthorizationError);

    const invalidUser = dependencies();
    vi.mocked(invalidUser.tx.isPendingUser).mockResolvedValue(false);
    await expect(
      createChurchProvisioner(invalidUser)(operatorId, input),
    ).rejects.toBeInstanceOf(ProvisioningFailedError);

    const failed = dependencies();
    failed.runTransaction.mockRejectedValue(new Error("db"));
    await expect(
      createChurchProvisioner(failed)(operatorId, input),
    ).rejects.toBeInstanceOf(ProvisioningFailedError);
  });
});
