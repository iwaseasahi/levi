import { checkDatabaseReadiness } from "@/infrastructure/database/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkDatabaseReadiness();
    return Response.json(
      { database: "ok", service: "levi", status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { database: "unavailable", service: "levi", status: "error" },
      { headers: { "Cache-Control": "no-store" }, status: 503 },
    );
  }
}
