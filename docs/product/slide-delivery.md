# Slide delivery child Issues

Parent: [#59](https://github.com/iwaseasahi/levi/issues/59).

#59 completes the contract and decomposition. These children implement and verify
the feature; closing #59 must not mark SLIDE parity as shipped or close #38.

| Issue                                                 | Scope                                                            | Depends on             |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ---------------------- |
| [#382](https://github.com/iwaseasahi/levi/issues/382) | db: 教会所有Slideのschema・制約・物理削除境界を追加する          | #59 contract merge     |
| [#383](https://github.com/iwaseasahi/levi/issues/383) | feat: スライド入力検証・改行正規化・ページ分割domainを実装する   | #59 contract merge     |
| [#394](https://github.com/iwaseasahi/levi/issues/394) | #384 API prerequisite: tenant-scoped CRUD/revision/deletion      | #382, #383             |
| [#384](https://github.com/iwaseasahi/levi/issues/384) | feat: 教会別スライドの作成・編集・preview・物理削除を実装する    | #382, #383, #394       |
| [#385](https://github.com/iwaseasahi/levi/issues/385) | feat: スライド本文検索・最近の更新・cursor paginationを実装する  | #382, #383             |
| [#386](https://github.com/iwaseasahi/levi/issues/386) | refactor: 聖書とスライドが共有する投影接続・状態同期を抽出する   | #59 contract merge     |
| [#387](https://github.com/iwaseasahi/levi/issues/387) | feat: スライドを別windowへ投影してページ選択・前後移動する       | #384, #386             |
| [#388](https://github.com/iwaseasahi/levi/issues/388) | security: Slideのtenant分離・削除・投影失効を横断検証する        | #384, #385, #387       |
| [#389](https://github.com/iwaseasahi/levi/issues/389) | migration: Slideのschema展開・旧データ非移行・復旧を検証する     | #382, #384             |
| [#390](https://github.com/iwaseasahi/levi/issues/390) | test: スライドの作成から検索・投影・削除までChrome E2Eを完成する | #385, #387, #388, #389 |

Each Issue contains Outcome, Context, Constraints, Acceptance criteria, Non-goals
and Verification. Foundational schema and transport are exclusive merge scopes.
Security checks accompany each implementation PR; the security child is an
additional cross-cutting audit, not permission to defer tenant protection.

## Acceptance mapping

| #59 criterion                                                      | Evidence / implementation owner                                                                                                                                                                 |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reconfirm fields/validation from legacy                            | [Pinned field evidence and contract](slide-contract.md#pinned-legacy-evidence); #382–#384                                                                                                       |
| Decide body/EOL/preview/search semantics                           | [Single-page body and search contract](slide-contract.md#single-page-body-and-preview); #383–#385, simplified by #424                                                                           |
| Explicit church aggregate, FK/check/index/delete                   | [ADR 0015](../architecture/0015-church-owned-slides.md); #382, #388                                                                                                                             |
| Separate shared presentation and slide domain                      | ADR 0015 and [projection contract](slide-contract.md#projection); #386, #387                                                                                                                    |
| Split CRUD/search/pagination/projection/security/E2E/migration     | Child Issue table above; #384–#390                                                                                                                                                              |
| Re-evaluate API using first-release evidence before implementation | [Dated post-release re-evaluation](../architecture/0015-church-owned-slides.md#post-release-projection-re-evaluation), #279 workflow record and current source; #386 rechecks before extraction |

## Delivery gates

1. Merge the #59 documentation contract before implementation children.
2. Merge schema and domain, then CRUD/search. Independently land the shared
   transport extraction with the complete existing scripture E2E suite.
3. Add Slide projection using both foundations; review concurrent edits, delete
   propagation and cross-content tab reuse.
4. Complete tenant audit, synthetic migration/restore assessment and acceptance
   E2E. Only then update SLIDE-001/002 to verified and report delivery to #38.
5. Obtain separate exact-operation approval for production schema/application
   rollout. #302 remains the owner of unmeasured Sunday traffic/capacity.

## Runtime acceptance (2026-08-31)

Implementation children have delivered schema, domain, CRUD/preview, search,
shared transport, Slide projection, tenant audit and recovery. #390 adds the
[final executable acceptance map](../testing-slide-e2e.md): local verification
passed 438 unit, 92 component, 132 integration and 32 Chromium E2E tests (zero
retries), dependency/security checks and a 5-second synthetic encrypted restore
rehearsal. Its PR records the final exact-head CI and merge outcome. SLIDE-001/002
are verified for this contract; this does not claim a production deployment,
legacy Slide import, production capacity or Sunday measurement. #397/#302 remain
explicit follow-ups. #59's earlier closure meant decomposition, not this acceptance.
