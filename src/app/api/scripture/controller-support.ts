import type { ChurchAccess } from "@/application/auth/church-access";

export type ChurchAccessResolver = (headers: Headers) => Promise<ChurchAccess>;

export function noStoreJson(body: unknown, status: number) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function churchAccessFailure(
  headers: Headers,
  getChurchAccess: ChurchAccessResolver,
) {
  const access = await getChurchAccess(headers);
  if (access.status === "unauthenticated")
    return noStoreJson({ error: { code: "UNAUTHENTICATED" } }, 401);
  if (access.status !== "authorized" || access.mustChangePassword)
    return noStoreJson({ error: { code: "FORBIDDEN" } }, 403);
  return null;
}
