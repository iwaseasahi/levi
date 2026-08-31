import { randomUUID } from "node:crypto";
import type { ChurchScope } from "../src/application/auth/church-access";
import { parseSlideSearch } from "../src/domain/slides/search";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/infrastructure/database/client";
import { slideSearchSql } from "../src/infrastructure/database/slide-search-repository";
import { assertDedicatedTestDatabaseTarget } from "../src/infrastructure/database/test-database-guard";

// Explicit local disposable target, synthetic namespace, no production profiling.
assertDedicatedTestDatabaseTarget(process.env.DATABASE_URL);
type Plan = {
  "Node Type": string;
  "Index Name"?: string;
  "Actual Rows": number;
  "Rows Removed by Filter"?: number;
  Plans?: Plan[];
};
type Explain = Array<{
  "QUERY PLAN": Array<{
    Plan: Plan;
    "Planning Time": number;
    "Execution Time": number;
  }>;
}>;
function nodes(plan: Plan): object[] {
  return [
    {
      node: plan["Node Type"],
      index: plan["Index Name"],
      rows: plan["Actual Rows"],
      filtered: plan["Rows Removed by Filter"],
    },
    ...(plan.Plans ?? []).flatMap(nodes),
  ];
}
try {
  for (const count of [100, 10_000]) {
    const church = await prisma.church.create({
      data: { name: `test.slide-explain.${randomUUID()}` },
    });
    try {
      for (let offset = 0; offset < count; offset += 100) {
        await prisma.slide.createMany({
          data: Array.from(
            { length: Math.min(100, count - offset) },
            (_, index) => ({
              churchId: church.id,
              title: "Synthetic measurement",
              body: `${"日本語 ABC synthetic ".repeat(50)} ${offset + index === 0 ? "rare-match" : "ordinary"}`,
            }),
          ),
        });
      }
      await prisma.$executeRaw`ANALYZE slides`;
      for (const input of [
        { mode: "recent" },
        {},
        { q: "ABC" },
        { q: "rare-match" },
        { q: "no-match" },
      ]) {
        const sql = slideSearchSql(
          { churchId: church.id } as ChurchScope,
          parseSlideSearch(input),
        );
        const [result] = await prisma.$queryRaw<Explain>(
          Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
        );
        const details = result!["QUERY PLAN"][0]!;
        console.log(
          JSON.stringify({
            count,
            scenario: input.mode ?? input.q ?? "all",
            planningMs: details["Planning Time"],
            executionMs: details["Execution Time"],
            nodes: nodes(details.Plan),
          }),
        );
      }
    } finally {
      await prisma.church.delete({ where: { id: church.id } });
    }
  }
} finally {
  await prisma.$disconnect();
}
