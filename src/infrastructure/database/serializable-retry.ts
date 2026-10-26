export const SERIALIZABLE_TRANSACTION_MAX_ATTEMPTS = 3;

function isRetryableSerializableConflict(error: unknown) {
  return (
    // Prisma's CJS and ESM entry points have distinct error constructors.
    // Match the known-error metadata rather than one module's class identity.
    (error instanceof Error &&
      error.name === "PrismaClientKnownRequestError" &&
      "code" in error &&
      error.code === "P2034" &&
      "clientVersion" in error &&
      typeof error.clientVersion === "string") ||
    (error instanceof Error &&
      error.name === "DriverAdapterError" &&
      typeof error.cause === "object" &&
      error.cause !== null &&
      "kind" in error.cause &&
      error.cause.kind === "TransactionWriteConflict")
  );
}

export async function runWithSerializableRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  for (
    let attempt = 1;
    attempt <= SERIALIZABLE_TRANSACTION_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await operation();
    } catch (error) {
      if (
        !isRetryableSerializableConflict(error) ||
        attempt === SERIALIZABLE_TRANSACTION_MAX_ATTEMPTS
      )
        throw error;
    }
  }

  throw new Error("Unreachable serializable retry state");
}
