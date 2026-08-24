# 設定アイコンを円形ボタンの中央へ揃える

## Issue

- Issue: #253
- Branch: `codex/issue-253`
- Base commit: `da32a41`

## Outcome

聖書検索画面右下の設定ボタンで、歯車アイコンの図形中心が円形ボタンの中心と一致する。

## Context

- `src/app/church/scripture-settings-menu.tsx` の既存SVGは外形がviewBoxの右側へ偏っている。
- `src/app/styles/ginmaku-search.css` は20px四方のSVG要素自体を38pxの円形button中央へ配置している。
- ずれはbutton layoutではなくSVG path内の非対称な余白で生じている。

## Constraints

- buttonのサイズ、右下位置、クリック領域、menu動作を維持する。
- 新しいアイコン依存関係を追加しない。
- keyboard、focus、accessible nameを維持する。

## Non-goals

- 設定menuの項目やlogout動作の変更。
- scripture workspace全体の配置変更。

## Plan

1. [x] 歯車SVGを24px viewBox中央に対称なpathへ置き換える。
2. [x] component testとChrome E2Eでmenu動作と図形中心を検証する。
3. [ ] 全検証と必須CIを通過させてマージする。

## Progress

- 2026-08-24 — Issue #253を作成し、button、SVG、CSS、既存テストを確認した。
- 2026-08-24 — button layoutを維持したまま、SVG pathを中央対称な形状へ修正した。
- 2026-08-24 — Chromeでpath中心`12, 12`を検証し、E2E 13件と`mise run check`（unit 254件、component 46件、production buildを含む）が通過した。

## Decisions

- 2026-08-24 — Decision: CSSによる見かけ上のoffsetではなくSVG geometryを修正する。
  - Reason: hoverや表示倍率が変わっても図形中心と要素中心が一致し、原因を局所的に解消できる。
  - Alternatives: `translateX`は非対称なpathを残して補正値へ依存するため採用しない。

## Risks and mitigations

- Risk: アイコン変更でmenu操作やbuttonのhit areaが変わる。
  - Mitigation: button markupとCSSは維持し、既存component/E2Eを実行する。

## Verification

- [x] `mise run check`
- [x] `pnpm test:e2e`
- [x] SVG pathのgeometry中心がviewBoxの`12, 12`と一致する。
- [x] `git diff --check`
- [x] 最終差分をscope、アクセシビリティ、秘密情報の観点で確認する。

## Handoff or blockers

- Completed: Issue、原因特定、SVG修正、geometry E2E、ローカル検証。
- Remaining: PR、CI、merge。
- Blocker: なし。
- Resume with: 最終差分をcommitしてPRを作成する。

## Result

実装とローカル検証は完了。PRと必須CIを待つ。
