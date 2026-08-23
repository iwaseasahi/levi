# 並行パスワード変更のSerializable競合を有界再試行する

## Issue

- Issue: #184
- Parent: #158
- Branch: `codex/issue-184`
- Base commit: `77ee8ca`

## Outcome

異なる教会ユーザーのpassword reset/forced changeが並行しても、PostgreSQLが要求するSerializable再試行をLeviのtransaction boundaryで安全に処理し、最終password/session状態を保証する。

## Context

- #170のfull E2Eで2件のforced password changeが同時刻に走り、PostgreSQL COMMITがserialization pivotを1件中断した。
- `src/infrastructure/auth/password-lifecycle.ts`はSerializable transactionを一度だけ実行し、application層はadapter failureを安全な`PasswordLifecycleFailedError`へ変換する。
- Prismaはwrite conflict/deadlockの再試行可能エラーをknown request error `P2034`として公開する。

## Constraints

- authorization再確認、forced-change条件、session revocation、structured auditを維持する。
- Playwright retry 0、Serializable isolation、deferred actor-assignment triggerを維持する。
- `P2034`以外を再試行せず、最大試行回数を固定する。

## Non-goals

- UI/API message、isolation level、DB schema/migration、triggerの変更。
- 全transactionへの一括導入、無制限retry、一般エラーの再試行。

## Plan

1. [x] failure artifact、PostgreSQL log、password transaction/test境界を調査する。
2. [x] Prisma `P2034`だけを最大3試行するpurely bounded helperとunit testを追加する。
3. [x] password lifecycle adapterへhelperを適用し、異なる2教会の並行reset/change integrationを追加する。
4. [ ] exhaustion時のfail-closed controller/audit契約とcanonical checksを検証する。
5. [ ] exact-head required CI後にPRをmergeする。

## Progress

- 2026-08-23 16:49 JST — Started; #184/#158、E2E/PostgreSQL evidence、application/infrastructure/testを確認。
- 2026-08-23 16:51 JST — P2034のみ最大3試行するhelperを追加。retry success/exhaustion/nonretryable unit 4、application/controller 15 passed。
- 2026-08-23 16:52 JST — 2教会のconcurrent reset/changeと最終hash/flag/sessionを追加。full integration 76 passed。
- 2026-08-23 16:53 JST — E2E連続確認3回目で既存bookmark drag同期flakeを検出。原因をpending解除前のdrag開始と特定し #186 に分離。

## Decisions

- 2026-08-23 — transaction全体を最大3試行し、待機は追加しない。
  - Reason: PostgreSQL自身がtransaction全体の再実行を要求し、各試行はrollback済み。最大3回なら有界で、UI timeout内に収まる。固定sleepは競合解消の根拠にならずテスト時間を増やす。
  - Alternatives: isolation level緩和とtrigger変更は整合性を弱めるため不採用。Playwright retryは製品の失敗を隠すため不採用。
- 2026-08-23 — helper適用はpassword lifecycle adapterだけに限定する。
  - Reason: 観測されたfailure boundaryにscopeを絞り、他transactionのidempotencyを暗黙に仮定しない。

## Risks and mitigations

- Risk: 非retryable failureを再実行する。
  - Mitigation: Prisma known request errorかつcode `P2034`だけを分類するunit testを置く。
- Risk: retry exhaustionが無限loopまたは不安全な応答になる。
  - Mitigation:3試行をunit testで固定し、既存application/controller failed mappingを維持する。
- Risk: transaction内のpassword hash生成が再実行される。
  - Mitigation: 各失敗transactionはrollbackされ、新hashはcommitした最終試行だけに保存されることをintegrationでverifyする。

## Verification

- [ ] bounded retry unit tests
- [ ] password lifecycle application/controller unit tests
- [ ] concurrent reset/change integrationとsession/password final state
- [ ] `pnpm test:integration`
- [ ] `pnpm test:e2e` — retry 0
- [ ] `pnpm db:schema:check`
- [ ] `pnpm check`
- [ ] `pnpm security:check`
- [ ] `git diff --check`
- [ ] required CI

## Handoff or blockers

- Completed: retry helper、adapter適用、unit/integration、unrelated E2E root-cause調査。
- Remaining: #186 merge後にmainを統合し、canonical checks、PR、CI、merge。
- Blocker: #186。現行E2Eがbookmark作成のpending解除前にdragを開始し得る。
- Resume with: #186を別branch/PRで修正してmergeする。

## Result

未完了。
