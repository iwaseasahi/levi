# 再監査で確認した保守性課題を段階的に解消する

## Issue

- Parent Issue: #189
- Child Issues: #190, #191, #192, #193, #194, #195, #200
- Base commit: `27b879bac73d08035ea69e007d662593ef79418c`

## Outcome

初回リリースの挙動と契約を維持しながら、再監査で確認した6つの保守性課題を、独立して検証・rollbackできるPRで解消する。

## Context

- 前回のrefactor epic #158は完了済みで、P0の不具合や設計破綻はない。
- #189が今回の監査結果と完了条件を保持する。
- 各子Issueは直前の子Issueに依存し、merge後の`main`から次のbranchを作る。

## Constraints

- product behavior、URL、API response、DB schema、tenant boundary、認証仕様を変更しない。
- production dependency、migration、test retryを追加しない。
- 1 Issue / 1 branch / 1 PRとし、required CIがexact headで全て成功してからmergeする。

## Non-goals

- UI redesign、新機能、production deploy。
- Ginmaku migration moduleを行数だけで再分割すること。
- coverageやsecurity gateを弱めること。

## Plan

1. [x] #190 unit coverage範囲とsaved-content controller分岐を正確にする。
2. [x] #191 Church API access・response境界を共通化する。
3. [x] #192 Serializable transaction retry policyを統一する。
4. [x] #200 integration fixtureのcleanup namespace衝突を解消する。
5. [x] #193 folder CSSの後勝ちcascadeを整理する。
6. [x] #194 client fetcherのcomponent lifetime契約を統一する。
7. [x] #195 integration用Bible・tenant fixtureを共通化する。
8. [x] #204 教会同時作成時のcredential書き込みを安定化する。
9. [ ] 最終mainのrequired CIを確認し、#189を証跡付きで閉じる。

## Progress

- 2026-08-23 18:00 JST — #189と子Issue #190〜#195を作成し、sub-issueとして関連付けた。
- 2026-08-23 18:15 JST — #190を`codex/issue-190`で開始した。
- 2026-08-23 18:20 JST — #190のcoverage分母を580 statementsから804 statementsへ拡張し、saved-contentの全7 mutation commandを直接検証した。unit 238件、statements 93.28%、branches 88.73%。
- 2026-08-23 18:25 JST — #190のlocal verification完了。`mise run check`、coverage、integration 76件、E2E 13件（既存dev serverを維持するため一時worktreeで実行）、security、diff checkが成功した。
- 2026-08-23 18:30 JST — #191でChurch scopeとdenial responseを返す共通API access境界を導入し、scripture/saved-content controllerの重複認証・JSON helperを統合した。
- 2026-08-23 18:35 JST — #191のlocal verification完了。unit 238件、component 39件、integration 76件、E2E 13件、build、coverage、securityが成功した。
- 2026-08-23 18:40 JST — #192でchurch provisioningのSerializable transactionを既存の有界P2034 retry policyへ統合し、異なる教会の同時作成をintegration testへ追加した。
- 2026-08-23 18:45 JST — #192のlocal verification完了。unit 238件、component 39件、integration 77件、E2E 13件、build、coverage、securityが成功した。
- 2026-08-23 19:00 JST — PR #199のDatabase jobで、database foundation testの広すぎる`test.*` cleanupが並列実行中のprovisioning fixtureを削除する競合を検出し、#200へ分離した。
- 2026-08-23 19:05 JST — #200でdatabase foundation fixtureを専用namespaceへ隔離し、integration 77件を3回連続で成功させた。
- 2026-08-23 19:00 JST — #193でscripture sidebarの旧定義とmodern overrideを単一の宣言群へ統合し、管理画面とのstyle ownershipを明示した。
- 2026-08-23 19:10 JST — #193のlocal verification完了。unit 238件、component 39件、integration 77件、E2E 13件、build、coverage、securityが成功し、desktopと390px幅のfolder画面を実ブラウザで確認した。
- 2026-08-23 19:20 JST — #194でinjected fetcherを初回renderからunmountまで固定する共通hookを導入し、4つのclient hook/componentへ適用した。Hooks lint抑制を削除し、rerender契約とstale catalog guardをcomponent testへ追加した。
- 2026-08-23 19:25 JST — #194のlocal verification完了。unit 238件、component 40件、integration 77件、E2E 13件、build、coverage、securityが成功した。
- 2026-08-23 19:35 JST — #195でsynthetic translation/book/name/verseとexact cleanup targetを扱う共有fixture builderを導入し、saved-content、scripture-search、Bible catalogの重複setupを置換した。対象3 suiteは逆順の単独実行と全integration 77件で成功した。
- 2026-08-23 19:40 JST — #195のlocal verification完了。unit 238件、component 40件、integration 77件、E2E 13件、build、coverage、securityが成功した。
- 2026-08-23 19:45 JST — 最終監査のconcurrent provisioning反復試験で`ProvisioningFailedError`を再現した。Better Auth adapterがinteractive transaction client上でqueryを並行実行する経路を原因候補として#204へ分離した。
- 2026-08-23 20:15 JST — #204でcredential作成を同一transaction内の明示的なUser/Account書き込みへ変更し、Prisma 7 driver adapterの`TransactionWriteConflict`も有界retry対象へ追加した。同時作成30回、unit 240件、component 40件、integration 77件、E2E 13件、build、coverage、securityが成功した。

## Decisions

- 2026-08-23 — Decision: migration import本体は今回の対象外とする。
  - Reason: exactness共通化とrehearsalが完了しており、現在は変更頻度より再分割リスクが高い。
  - Alternatives: parser/validator/writerの全面分割は、dump形式またはtranslation追加時に再評価する。
- 2026-08-23 — Decision: 各子Issueを直列にmergeする。
  - Reason: 共通境界とテスト設定への変更が後続Issueのbaseになるため、独立したrollback境界を保つ。

## Risks and mitigations

- Risk: 構造変更で既存のGinmaku互換操作が変わる。
  - Mitigation: unit/component/integration/E2Eとrequired CIを各PRで実行する。
- Risk: aggregate coverageだけが改善し、重要分岐が未検証のまま残る。
  - Mitigation: #190でsaved-content commandごとのrepository callとresponseを直接検証する。

## Verification

- [ ] `pnpm check`
- [ ] `pnpm test:unit:coverage`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:e2e`
- [ ] `pnpm security:check`
- [ ] `git diff --check`
- [ ] 各PRのQuality / Database / E2E / Securityがexact headで成功

## Handoff or blockers

- Completed: Issue分割と実装順の確定。
- Remaining: #190〜#195の実装・検証・merge。
- Blocker: なし。
- Resume with: #190のcoverage設定とcontroller testを更新する。

## Result

進行中。
