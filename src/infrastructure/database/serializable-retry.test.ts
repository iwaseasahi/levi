import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  runWithSerializableRetry,
  SERIALIZABLE_TRANSACTION_MAX_ATTEMPTS,
} from "./serializable-retry";

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("synthetic test error", {
    clientVersion: "test",
    code,
  });
}

function driverAdapterWriteConflict() {
  const error = new Error("TransactionWriteConflict", {
    cause: { kind: "TransactionWriteConflict" },
  });
  error.name = "DriverAdapterError";
  return error;
}

describe("runWithSerializableRetry", () => {
  it("retries P2034 and returns the successful transaction result", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(prismaError("P2034"))
      .mockResolvedValue("committed");

    await expect(runWithSerializableRetry(operation)).resolves.toBe(
      "committed",
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("stops after the bounded number of P2034 attempts", async () => {
    const error = prismaError("P2034");
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(runWithSerializableRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(
      SERIALIZABLE_TRANSACTION_MAX_ATTEMPTS,
    );
  });

  it("retries a driver adapter transaction write conflict", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(driverAdapterWriteConflict())
      .mockResolvedValue("committed");

    await expect(runWithSerializableRetry(operation)).resolves.toBe(
      "committed",
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a different Prisma error", prismaError("P2025")],
    ["an unclassified error", new Error("P2034")],
    [
      "a different driver adapter error",
      Object.assign(new Error("ConnectionClosed"), {
        cause: { kind: "ConnectionClosed" },
        name: "DriverAdapterError",
      }),
    ],
  ])("does not retry %s", async (_label, error) => {
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(runWithSerializableRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
