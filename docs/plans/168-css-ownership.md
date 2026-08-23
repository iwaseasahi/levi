# CSSを画面所有範囲ごとに分割する

## Issue

- Issue: #168
- Parent: #158
- Branch: `codex/issue-168`
- Base commit: `bf5025e`

## Outcome

単一global CSSをtheme/shared/auth-admin/folders/Ginmaku search/audienceへ分割し、root layoutの一つのentrypointから明示順で読み込む。見た目と操作は変えない。

## Context

- Issue作成時2,120行、着手時`src/app/styles.css`は1,957行。
- selector群は概ねtheme/shared、auth/admin、saved content、Ginmaku search、modern folder、audienceの順にまとまるが、同一selectorの後勝ちoverrideが残る。
- Next.js 16.3.1のinstall artifactに`dist/docs`は含まれない。公式App Router CSS文書（2026-02-27更新）はglobal CSSをroot layoutに置き、予測可能な順序のため一つのentry fileへimportを集約し、production buildでも確認することを推奨する。

## Constraints

- UI redesign、CSS framework、新規dependencyは対象外。
- Ginmaku互換selectorは専用file/scopeに保つ。
- production buildでCSS結合後の見た目を検証する。

## Plan

1. [x] 1280x720 Chromeでhome/login/admin/search/folder/audienceの10状態をsynthetic fixtureからbaseline撮影する。
2. [x] `styles.css`を単一entrypointとし、theme/shared/auth-admin/Ginmaku/folders/audienceへ機械的に分割する。
3. [x] 同一selectorの後勝ちoverrideを所有file内で統合し、scope外へ漏れるselectorをなくす。
4. [x] desktop/mobile/focus/loading/empty/error/disabled/blank、axe、pixel comparison、canonical checksを通す。required CIはPRで確認する。

## Decisions

- 2026-08-23 — CSS Modulesへ移行せず、root layoutのglobal entrypointからowner filesを一度だけimportする。
  - Reason: global class contractを変えず、公式推奨の一つのimport entryで順序を固定できる。
- 2026-08-23 — transient screenshotはsynthetic fixtureだけを使いrepositoryへcommitしない。
  - Reason:視覚比較の証跡を得つつartifact/data境界を守る。

## Risks and mitigations

- Risk: production CSS chunk/mergeでimport順が変わる。
  - Mitigation: root entrypointのみからimportし、`next build`とE2Eで確認する。
- Risk: selector移動でcascade結果が変わる。
  - Mitigation: 10状態のbefore/after pixel SHA-256とcomputed style E2Eを比較する。
- Risk: responsive/focus/blankが通常screenshotから漏れる。
  - Mitigation: 390px E2E、focus screenshot、audience blank screenshot、既存axe/keyboard assertionsを通す。

## Verification

- [x] before/after screenshot 10状態のpixel一致（全状態0 pixel差分）
- [x] `pnpm check`（unit 213件、component 39件、production buildを含む）
- [x] `pnpm test:integration`（73件）
- [x] `pnpm test:e2e`（9件）
- [x] `pnpm security:check`（high以上0件、license 314件承認済み）
- [x] `git diff --check`
- [ ] required CI

## Handoff or blockers

- Completed: Issue intake、公式CSS文書確認、owner file分割、folder selector集約、override整理、10状態pixel比較、canonical checks。
- Remaining: PR、required CI、merge。
- Blocker: なし。
- Resume with: commitを作成してDraft PRを開く。

## Result

単一の1,957行global CSSを6 owner fileへ分割した。root entrypointで読込順を固定し、folder/bookmark selectorをfolder ownerへ集約した。元CSSと分割後CSSを同一synthetic fixtureで撮影した10状態は全て0 pixel差分だった。
