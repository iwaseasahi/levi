import { createHash } from "node:crypto";

const WINDOW_MILLISECONDS = 60_000;
export const ADMIN_LOGIN_MAX_FAILURES = 5;

function key(loginId: string) {
  const digest = createHash("sha256")
    .update(loginId.trim().toLowerCase(), "utf8")
    .digest("hex");
  return `admin-login:${digest}`;
}

export const adminLoginFailureStore = {
  async clear(loginId: string) {
    const { prisma } = await import("@/infrastructure/database/client");
    await prisma.rateLimit.deleteMany({ where: { key: key(loginId) } });
  },
  async isBlocked(loginId: string, now = Date.now()) {
    const { prisma } = await import("@/infrastructure/database/client");
    const failure = await prisma.rateLimit.findUnique({
      where: { key: key(loginId) },
    });
    return Boolean(
      failure &&
      failure.lastRequest >= BigInt(now - WINDOW_MILLISECONDS) &&
      failure.count >= ADMIN_LOGIN_MAX_FAILURES,
    );
  },
  async record(loginId: string, now = Date.now()) {
    const { prisma } = await import("@/infrastructure/database/client");
    const failureKey = key(loginId);
    const timestamp = BigInt(now);
    const windowStart = BigInt(now - WINDOW_MILLISECONDS);
    return prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "rate_limits" ("key", "count", "last_request")
      VALUES (${failureKey}, 1, ${timestamp})
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
