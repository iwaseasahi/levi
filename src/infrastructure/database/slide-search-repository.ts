import type { ChurchScope } from "@/application/auth/church-access";
import type { SlideSearchRepository } from "@/application/slides/search-slides";
import {
  slideSearchPattern,
  type SlideSearch,
  type SlideSummary,
} from "@/domain/slides/search";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./client";

export function slideSearchSql(scope: ChurchScope, search: SlideSearch) {
  const cursor = search.cursor;
  return Prisma.sql`
    SELECT id, title, author, revision, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM slides
    WHERE church_id = ${scope.churchId}::uuid
      ${search.q ? Prisma.sql`AND translate(body COLLATE "C", 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') LIKE ${slideSearchPattern(search.q)} COLLATE "C" ESCAPE chr(92)` : Prisma.empty}
      ${cursor ? Prisma.sql`AND (created_at, id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)` : Prisma.empty}
    ORDER BY ${search.mode === "recent" ? Prisma.sql`updated_at DESC` : Prisma.sql`created_at DESC`}, id DESC
    LIMIT ${search.mode === "recent" ? 10 : 21}`;
}

type Row = Omit<SlideSummary, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};
export const slideSearchRepository: SlideSearchRepository = {
  async search(scope, search) {
    const rows = await prisma.$queryRaw<Row[]>(slideSearchSql(scope, search));
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  },
};
