import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

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

async function prismaErrorFromAnotherEntryPoint(code: string) {
  const require = createRequire(import.meta.url);
  const commonJsRuntime =
    require("@prisma/client/runtime/client") as typeof import("@prisma/client/runtime/client");
  const runtimePath = require.resolve("@prisma/client/runtime/client");
  const esmRuntime: typeof import("@prisma/client/runtime/client") =
    await import(
      /* @vite-ignore */ pathToFileURL(runtimePath.replace(/\.js$/, ".mjs"))
        .href
    );
  const ErrorConstructor = [
    commonJsRuntime.PrismaClientKnownRequestError,
    esmRuntime.PrismaClientKnownRequestError,
  ].find((constructor) => constructor !== Prisma.PrismaClientKnownRequestError);
  if (!ErrorConstructor)
    throw new Error("Expected distinct Prisma runtime entry points");
  const error = new ErrorConstructor("synthetic alternate-runtime error", {
    clientVersion: "test",
    code,
  });
  expect(error).not.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
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

  it("retries a genuine P2034 from a different Prisma runtime entry point", async () => {
    const error = await prismaErrorFromAnotherEntryPoint("P2034");
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValue("committed");
    await expect(runWithSerializableRetry(operation)).resolves.toBe(
      "committed",
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("keeps the same attempt limit for another Prisma runtime entry point", async () => {
    const error = await prismaErrorFromAnotherEntryPoint("P2034");
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);
    await expect(runWithSerializableRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(
      SERIALIZABLE_TRANSACTION_MAX_ATTEMPTS,
    );
  });

  it("does not retry another error code from a different Prisma runtime entry point", async () => {
    const error = await prismaErrorFromAnotherEntryPoint("P2025");
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);
    await expect(runWithSerializableRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
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
      "an unclassified error with a retry code",
      Object.assign(new Error("synthetic"), { code: "P2034" }),
    ],
    [
      "an error missing Prisma version metadata",
      Object.assign(new Error("synthetic"), {
        name: "PrismaClientKnownRequestError",
        code: "P2034",
      }),
    ],
    [
      "plain metadata instead of an error",
      { name: "PrismaClientKnownRequestError", code: "P2034" },
    ],
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
