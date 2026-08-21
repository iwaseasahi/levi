import { getChurchAccess } from "@/infrastructure/auth/church-session";

export async function GET(request: Request) {
  const access = await getChurchAccess(request.headers);
  const status =
    access.status === "unauthenticated"
      ? 401
      : access.status !== "authorized" || access.mustChangePassword
        ? 403
        : 204;
  return new Response(null, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
