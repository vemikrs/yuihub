# Step2.5 Addendum — 統合方針の明記（2025-09-23）

## 決定事項（差分Knot）
- **ESM統一**：ビルダー/バリデータを `.mjs` に統一済み。
- **既存 `yuihub_api/src` 資産の再利用**：`config.js`, `enhanced-search.js`, `index-manager.js`, `search.js`, `server.js`, `storage.js`, `text-ja.js` は **本筋** とする。
- **/ops/reindex（PoC）**：Step2.5 では軽量 `server.mjs` → `scripts/build-index.mjs` を直呼び（Shelter限定）。

## 影響範囲
- 索引の一次入口は `scripts/build-index.mjs`（front-matter フィルタ対応）。
- 正式API群は `server.js`（Fastify）＋ `index-manager.js` を中核として維持。

## 移行方針（Step3で実施）
1. `/ops/reindex` を **`IndexManager.rebuild()` 呼び出し**に差し替え。
2. `IndexManager._performRebuild()` のビルド呼び出し先を `scripts/build-index.mjs` に統一。
3. 仕様は `OPS_REINDEX_SPEC.md` に追従（localhost, Bearer, dryRun）。

— このAddendumは思想の連続性を守るための“橋渡し”記録です。
