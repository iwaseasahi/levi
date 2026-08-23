import type { Prisma } from "@/generated/prisma/client";

export async function lockChurch(
  transaction: Prisma.TransactionClient,
  churchId: string,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "churches" WHERE "id" = ${churchId}::uuid FOR UPDATE
  `;
  return rows.length === 1;
}

export async function lockFolder(
  transaction: Prisma.TransactionClient,
  churchId: string,
  folderId: string,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "folders"
    WHERE "id" = ${folderId}::uuid AND "church_id" = ${churchId}::uuid
    FOR UPDATE
  `;
  return rows.length === 1;
}
