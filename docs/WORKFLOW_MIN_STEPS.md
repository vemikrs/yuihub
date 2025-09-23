---
doc_type: guide
status: draft
owner: vemikrs
created: 2025-09-23
version: 0.2.0
---

# ミニマム作業手順（WSL/VS Code / Shelter）

## 0. 前提
- このZIPを PoC リポジトリ直下に展開
- `npm` が使える環境（Node 20+）

## 1. 初期化
```bash
npm init -y || true
npm i lunr js-yaml
```

## 2. VS Code タスク登録
- `.vscode/tasks.json` を配置済み。コマンドパレット → **Run Task → YuiHub: Reindex** で実行可能。

## 3. pre-commit 設定（任意）
```bash
cp scripts/hooks/pre-commit.sample .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## 4. ドキュメント投入
- `logdocs/` または `notes/` に MD+YAML を保存（front-matterは `mode/visibility/detail/external_io` を付与）。

## 5. 索引再生成
- 手動：`npm run reindex` または VS Code タスク  
- commit 時自動：pre-commit を有効化しておけば自動実行される

## 6. 運用API（ローカル）
- `docs/openapi.yml` を参照。`/ops/reindex` はローカル限定。curl例：
```bash
curl -s -H "Authorization: Bearer $LOCAL_OPS_TOKEN" -H "Content-Type: application/json"   -d '{"paths":["notes/","logdocs/"]}' http://127.0.0.1:3000/ops/reindex
```

## 7. （任意）Signal段階でActionsを有効化
- `.github/workflows/reindex.yml` のコメントを外し、CIで `index/lunr.idx.json` を再生成
