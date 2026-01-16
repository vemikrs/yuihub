---
doc_type: design
status: draft
owner: vemikrs
created: 2025-09-21
updated: 2026-01-16
concept_version: c0.3
doc_version: 0.3.0-doc.1
target_code_tag: v0.3.0-prototype.1
---

# YuiFlow Technical Design

## 1. Local RAG アーキテクチャ（Shelter-First）

> [!IMPORTANT]
> YuiHub の検索基盤は **ローカル完結型 RAG (Retrieval-Augmented Generation)** を採用する。
> 外部サーバーへの依存なしに、自律的な文脈想起を実現する。

### 1.1 検索エンジン

> [!IMPORTANT] > **LanceDB を正式採用**。`lancedb` npm パッケージを使用し、Lunr.js から移行する。

| 項目         | 旧（廃止）                     | 新（採用）                 |
| ------------ | ------------------------------ | -------------------------- |
| 検索方式     | Lunr.js (静的転置インデックス) | **LanceDB** (ベクトル検索) |
| パッケージ   | `lunr`                         | **`lancedb`** (npm)        |
| インデックス | 事前生成のキーワード索引       | Embedding による意味検索   |
| 更新方式     | バッチ再生成                   | リアルタイム増分更新       |
| 移行難易度   | -                              | 低（API 互換性高）         |

### 1.2 チャンク戦略（Semantic Chunking）

| 項目       | 旧（廃止）            | 新（採用）                       |
| ---------- | --------------------- | -------------------------------- |
| 分割方式   | 行数ベースの単純分割  | **Tree-sitter** による意味的分割 |
| 分割単位   | 固定行数（50 行など） | 関数・クラス・メソッド単位       |
| メタデータ | ファイルパスのみ      | シンボル名・型情報・スコープ     |

### 1.3 Embedding モデル

- **ローカルモデル**: Sentence-BERT 系の軽量モデル（例: `all-MiniLM-L6-v2`）
- **外部 API 不要**: ネットワーク接続なしで動作すること

---

## 2. ICD（境界）

- GPTs → Hub（/save）: `InputMessage{ …, mode: "shelter" }` を POST。Hub は `RecordEntry{ …, mode: "shelter" }` を返す。
- Client → Hub（/search）: **ベクトル検索 + キーワードフィルタ**。返却 `RecordEntry[]{ …, mode: "shelter" }`。
- Hub → Agent（/trigger）: `AgentTrigger{ …, mode: "shelter" }` を POST。`{ ok, ref }`。

### エラーモデル（最小）

- `400` Validation Error（`mode` 欠落 or `shelter` 以外）
- `401` Missing/Bad Bearer
- `429` Rate Limit
- `500` Unexpected

## 3. HTTP API（最小）

- POST /save
- GET /search?q=...&tag=...&thread=...
- POST /trigger

## 4. セキュリティ

- AUTH_TOKEN (Bearer)
- レートリミット（ゆるく）

## 5. コントラクトテスト

- contracts/\*.json に定義
- 実行は yuihub_api/tests/contract/
