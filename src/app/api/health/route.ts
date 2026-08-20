import { env } from "@/config/env";
import { writeLog } from "@/infrastructure/observability/logger";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const requestId =
    request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
  writeLog({ event: "liveness.checked", level: "info", requestId });

  return Response.json(
    {
      environment: env.nodeEnv,
      service: "levi",
      status: "ok",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        [REQUEST_ID_HEADER]: requestId,
      },
    },
  );
}
