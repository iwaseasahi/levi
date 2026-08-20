import { prisma } from "@/infrastructure/database/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
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
