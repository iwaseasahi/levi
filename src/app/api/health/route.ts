import { env } from "@/config/env";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      environment: env.nodeEnv,
      service: "levi",
      status: "ok",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
