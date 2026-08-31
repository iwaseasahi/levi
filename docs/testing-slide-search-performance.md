# Synthetic Slide query-plan baseline

Issue #385, 2026-08-31. Reproduce after the local test database migrations with
`pnpm exec tsx scripts/measure-slide-search.ts`, using `DATABASE_URL` for the
dedicated loopback `levi_test` database. The script rejects other targets, creates
and removes only its synthetic churches, and prints plan summaries without SQL,
tenant IDs or content. Do not run concurrently with integration/E2E database setup.

Each tenant has 100 or 10,000 rows, about 900 code points per body. The script
ANALYZEs the table; measurements below are one local run with warm caches, no
concurrent traffic and no production content. Numbers are observations, not
performance assertions or a production/Sunday SLO. Plan choice may change with
statistics, body lengths, host, cache and tenant distribution.

|   Rows | Operation                | Execution ms | Plan and examined matches                       |
| -----: | ------------------------ | -----------: | ----------------------------------------------- |
|    100 | Recent 10                |        0.031 | Update-order index, 10 rows                     |
|    100 | All 20 + 1               |        0.049 | Creation-order index, 21 rows                   |
|    100 | Frequent ASCII substring |        5.364 | Sequential scan + sort, 100 matches             |
|    100 | Rare substring           |        4.313 | Sequential scan + sort, 1 match / 99 removed    |
|    100 | Absent substring         |        4.257 | Sequential scan + sort, 100 removed             |
| 10,000 | Recent 10                |        0.025 | Update-order index, 10 rows                     |
| 10,000 | All 20 + 1               |        0.027 | Creation-order index, 21 rows                   |
| 10,000 | Frequent ASCII substring |        1.199 | Creation-order index, stops at 21 matches       |
| 10,000 | Rare substring           |      417.503 | Sequential scan + sort, 1 match / 9,999 removed |
| 10,000 | Absent substring         |      405.746 | Sequential scan + sort, 10,000 removed          |

The B-tree serves tenant/order predicates; it does **not** accelerate arbitrary
substring matching. Explicit ASCII translation over long text costs CPU and
rare/no matches must inspect the scoped candidate set. Follow-up
[#397](https://github.com/iwaseasahi/levi/issues/397) records the measured limitation
and requires representative concurrency/body-length measurements and a budget
before selecting an optimization. No new extension, index or provider was added.
The existing Sunday capacity-evidence Issue #302 remains independent and open.
