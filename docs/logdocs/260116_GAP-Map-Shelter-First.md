# GAP-Map: Shelter-First Policy 再定義

> **作成日**: 2026-01-16  
> **目的**: YuiHub アーキテクチャ方針を「Shelter-First Policy」へピボットするための GAP 分析

---

## 1. Critical GAP（最優先解決項目）

| GAP ID      | 分類         | 期待状態                       | 現状                                 | 影響度       | 優先度 |
| ----------- | ------------ | ------------------------------ | ------------------------------------ | ------------ | ------ |
| **GAP-001** | 検索精度     | ベクトル検索による意味的な想起 | Lunr.js による静的キーワード検索のみ | **Critical** | **P0** |
| **GAP-002** | 文脈保持     | 作業中の変更をリアルタイム監視 | 手動での Context 更新のみ            | **Critical** | **P0** |
| **GAP-003** | チャンク戦略 | 関数・クラス単位の意味的分割   | 行数ベースの単純分割                 | **High**     | **P0** |

---

## 2. P0 解決策: Local RAG (Vector Store) 導入

> [!IMPORTANT] > **Local RAG の導入が YuiHub Shelter-First Policy 実現の最優先事項である。**

### 2.1 技術選定

> [!IMPORTANT] > **LanceDB を正式採用**。`lancedb` npm パッケージを使用し、Lunr.js から移行する。

| コンポーネント    | 選定技術                | 選定理由                                               |
| ----------------- | ----------------------- | ------------------------------------------------------ |
| Vector Store      | **LanceDB** (`lancedb`) | ローカル完結、ファイルベース、軽量、npm で容易に導入可 |
| Embedding Model   | **all-MiniLM-L6-v2**    | 軽量、高速、オフライン動作可                           |
| Semantic Chunking | **Tree-sitter**         | 言語横断的、構文認識、意味的分割                       |

### 2.2 実装ロードマップ

| Phase   | 目標                    | 成果物                        |
| ------- | ----------------------- | ----------------------------- |
| Phase 1 | Vector Store 基盤構築   | `lancedb` npm 統合            |
| Phase 2 | Semantic Chunking 実装  | Tree-sitter パーサー統合      |
| Phase 3 | Watcher 機能実装        | Git Diff / File 監視          |
| Phase 4 | Context Packet 自動生成 | Working/Long-term Memory 統合 |

---

## 3. Secondary GAP（次フェーズ）

| GAP ID  | 分類        | 期待状態               | 現状   | 優先度           |
| ------- | ----------- | ---------------------- | ------ | ---------------- |
| GAP-101 | Signal Mode | 外部 Mira への発信機能 | 未実装 | P2（次フェーズ） |
| GAP-102 | OSS 協働    | Thread の外部共有      | 未実装 | P2（次フェーズ） |

> [!NOTE]
> Signal Mode 関連の GAP は、Shelter 基盤完成後に対応する。

---

## 4. 旧 GAP からの継承項目

以下の GAP は従来から存在し、引き続き有効である：

| 旧 GAP                  | 状態 | 対応    |
| ----------------------- | ---- | ------- |
| `/trigger` 未実装       | 継続 | P1 維持 |
| tag/thread フィルタ欠落 | 継続 | P1 維持 |
| I/O スキーマ不整合      | 継続 | P1 維持 |

---

## 5. 次のステップ

1. **即時**: `01_technical-design.md` に LanceDB/Tree-sitter 仕様を追記 ✅
2. **即時**: `context.packet.yaml` スキーマ定義作成 ✅
3. **次**: LanceDB 統合の PoC 実装
4. **次**: Tree-sitter パーサー統合
