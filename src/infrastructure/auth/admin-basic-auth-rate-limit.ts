import { prisma } from "@/infrastructure/database/client";

const KEY = "admin-basic-auth:global";
const WINDOW_MILLISECONDS = 60_000;
export const ADMIN_BASIC_AUTH_MAX_FAILURES = 5;

export interface AdminBasicAuthFailureStore {
  clear(): Promise<void>;
  isBlocked(now?: number): Promise<boolean>;
  record(now?: number): Promise<number>;
}

export const adminBasicAuthFailureStore: AdminBasicAuthFailureStore = {
  async clear() {
    await prisma.rateLimit.deleteMany({ where: { key: KEY } });
  },

  async isBlocked(now = Date.now()) {
    const failure = await prisma.rateLimit.findUnique({ where: { key: KEY } });
    if (!failure) return false;
    return (
      failure.lastRequest >= BigInt(now - WINDOW_MILLISECONDS) &&
      failure.count >= ADMIN_BASIC_AUTH_MAX_FAILURES
    );
  },

  record(now = Date.now()) {
    const timestamp = BigInt(now);
    const windowStart = BigInt(now - WINDOW_MILLISECONDS);
    return prisma.$queryRaw<Array<{ count: number }>>`
        INSERT INTO "rate_limits" ("key", "count", "last_request")
        VALUES (${KEY}, 1, ${timestamp})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "rate_limits"."last_request" >= ${windowStart}
              THEN "rate_limits"."count" + 1
            ELSE 1
          END,
          "last_request" = EXCLUDED."last_request"
        RETURNING "count"
      `.then((rows) => rows[0]?.count ?? 1);
  },
};
