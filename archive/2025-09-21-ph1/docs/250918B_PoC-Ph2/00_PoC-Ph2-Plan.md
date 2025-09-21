承知しました。Agent AI（こぱたん）向けの指示文として、PoC磨き込みフェーズの **作業計画書** を整理します。

---

# 📝 YuiHub PoC 磨き込み作業計画書（こぱたん指示文）

## Purpose（目的 / 期待成果）

* PoCの「疎通確認」段階から、**安定した再現性と世界観の体験**へ進化させる。
* 保存→索引→検索が切れずに回り、**会話意思決定レジャー**として成立する状態にする。

---

## Context（前提 / 制約）

* 現状 `/health` が `searchIndex:"missing"` になることがあり、インデックスの鮮度が保証されない。
* chatlogs 配置が `yuihub_api` 配下にあり、**保存先と索引先がズレ**ている。
* dev/prodのプロファイル分離が未実装で、**改修効率が低下**している。
* 日本語検索は Lunr 仕様の限界で取りこぼしが目立つ。
* PoCの本質は「**会話意思決定の外部レジャー × MCP/HTTP二面性 × ゼロ円運用**」。

---

## Options（方式候補とトレードオフ）

1. **索引更新の同期化**

   * save直後にawait索引更新 → 確実性高いがレスポンス遅延
   * 非同期キュー＋検索側リトライ → UX改善だが実装複雑
2. **日本語検索改善**

   * Lunr単独強化 → 限界あり
   * terms.json併用（二段検索） → 精度向上、導入容易
3. **フォルダ構造整理**

   * chatlogsを`data/chatlogs`に統一 → Actions/保存/索引の全体整合性が取れる

---

## Approach（採用方針と高レベル手順）

1. **構造正準化**

   * `data/chatlogs` へ一本化
   * `scripts/build_index.mjs` に名称統一
   * README / Workflow / Tasks を修正
2. **索引API追加**

   * `GET /index/status`
   * `POST /index/rebuild`
   * `POST /index/reload`
   * `/health` を `"ready|building|missing"` の3値化
3. **dev/prod/testプロファイル分離**

   * dev: 認証OFF、ホットリロードON
   * prod: 認証ON、監査ON
   * test: 固定seed、E2Eテスト
4. **日本語検索二段フォールバック**

   * Lunr検索＋terms.json逆引きの結果統合
   * 正規化（全半角/ひらカナ/大小）
5. **可観測性強化**

   * `index/stats.json` に lastBuildAt / elapsed / docs
   * ログに save→index→search の1行タイムライン
6. **UI/世界観PoC**

   * 週次要約をUIで物語化表示
   * actors/tags/topicで結び直しグラフを最小限表示

---

## Acceptance Criteria（DoD / 品質ゲート）

* `/health` が常に `searchIndex:"ready"` を返す。
* 保存→検索で **99%+ ヒット**（テスト再現性あり）。
* 日本語クエリの取りこぼしが terms.json 併用で改善される。
* chatlogs は `data/chatlogs` に統一され、Actionsも同期動作。
* dev/prodのプロファイルで挙動が切り替わる。
* 週次要約と「決定の結び目」が可視化され、**波紋＝世界観PoC**が確認できる。

---

## Risks & Checks（リスクと低減策）

* **索引同期遅延**：save完了前に検索される → API内でawait or version待ち
* **日本語検索の曖昧性**：複合語の取りこぼし → terms.json二段検索必須
* **構造移行ミス**：chatlogs移動でパス崩壊 → CIで path check
* **dev/prod混線**：認証有無が曖昧 → NODE\_ENVで強制切替

---
