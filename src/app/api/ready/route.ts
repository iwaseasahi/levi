import { checkDatabaseReadiness } from "@/infrastructure/database/readiness";
import { writeLog } from "@/infrastructure/observability/logger";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId =
    request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

  try {
    await checkDatabaseReadiness();
    writeLog({ event: "readiness.checked", level: "info", requestId });
    return Response.json(
      { checks: { database: "ok" }, service: "levi", status: "ready" },
      {
        headers: {
          "Cache-Control": "no-store",
          [REQUEST_ID_HEADER]: requestId,
        },
      },
    );
  } catch {
    writeLog({
      attributes: { check: "database" },
      event: "readiness.failed",
      level: "error",
      requestId,
    });
    return Response.json(
      {
        checks: { database: "unavailable" },
        service: "levi",
        status: "not-ready",
      },
      {
        headers: {
          "Cache-Control": "no-store",
          [REQUEST_ID_HEADER]: requestId,
        },
        status: 503,
      },
    );
  }
}
