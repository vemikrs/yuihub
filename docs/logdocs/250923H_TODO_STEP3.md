# Step3 TODO（方針承認済み）

- [ ] `/ops/reindex` を `IndexManager.rebuild()` 経由にリプレース
- [ ] `IndexManager._performRebuild()` のビルド先を `scripts/build-index.mjs` に統一
- [ ] `/save` `/search` `/trigger` の最小実装 & スモーク
- [ ] `npm run schema:check` を pre-commit に接続（任意）
