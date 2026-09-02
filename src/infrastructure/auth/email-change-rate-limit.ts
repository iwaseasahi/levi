import { EMAIL_CHANGE_MAX_REQUESTS_PER_HOUR } from "@/config/email-change";
import { prisma } from "@/infrastructure/database/client";

const WINDOW_MILLISECONDS = 60 * 60 * 1_000;

export async function consumeEmailChangeRequest(
  userId: string,
  now = Date.now(),
): Promise<boolean> {
  const key = `email-change:${userId}`;
  const timestamp = BigInt(now);
  const windowStart = BigInt(now - WINDOW_MILLISECONDS);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "rate_limits" ("key", "count", "last_request")
    VALUES (${key}, 1, ${timestamp})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limits"."last_request" >= ${windowStart}
          THEN "rate_limits"."count" + 1
        ELSE 1
      END,
      "last_request" = EXCLUDED."last_request"
    RETURNING "count"
  `;
  return (rows[0]?.count ?? 1) <= EMAIL_CHANGE_MAX_REQUESTS_PER_HOUR;
}
