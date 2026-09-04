import type { ChurchScope } from "@/application/auth/church-access";
import type { SlideListRepository } from "@/application/slides/list-slides";
import type { SlideListQuery, SlideSummary } from "@/domain/slides/list";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./client";

export function slideListSql(scope: ChurchScope, query: SlideListQuery) {
  const cursor = query.cursor;
  return Prisma.sql`
    SELECT id, title, content_type AS "contentType", revision,
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM slides
    WHERE church_id = ${scope.churchId}::uuid
      ${cursor ? Prisma.sql`AND (created_at, id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)` : Prisma.empty}
    ORDER BY created_at DESC, id DESC
    LIMIT 21`;
}

type Row = Omit<SlideSummary, "contentType" | "createdAt" | "updatedAt"> & {
  contentType: "TEXT" | "IMAGE";
  createdAt: Date;
  updatedAt: Date;
};
export const slideListRepository: SlideListRepository = {
  async list(scope, query) {
    const rows = await prisma.$queryRaw<Row[]>(slideListSql(scope, query));
    return rows.map((row) => ({
      ...row,
      contentType: row.contentType === "IMAGE" ? "image" : "text",
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  },
};
