import type {
  ChurchAccess,
  ChurchScope,
} from "@/application/auth/church-access";

export type ChurchAccessResolver = (headers: Headers) => Promise<ChurchAccess>;

export type ChurchApiAccess = { scope: ChurchScope } | { response: Response };

export function noStoreJson(body: unknown, status = 200) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function resolveChurchApiAccess(
  headers: Headers,
  getChurchAccess: ChurchAccessResolver,
): Promise<ChurchApiAccess> {
  const access = await getChurchAccess(headers);
  if (access.status === "unauthenticated")
    return {
      response: noStoreJson({ error: { code: "UNAUTHENTICATED" } }, 401),
    };
  if (access.status !== "authorized" || access.mustChangePassword)
    return {
      response: noStoreJson({ error: { code: "FORBIDDEN" } }, 403),
    };
  return { scope: access.scope };
}
