---
doc_type: meta
status: stable
owner: vemikrs
created: 2025-09-21
updated: 2025-09-21
related:
  - meta/MANIFESTO.md
  - meta/ETHICS.md
---

# FOCUS — PoC における焦点と DoD

## 1. 焦点（Focus）

YuiHub PoC の焦点は、**思想の筋を途切れさせないこと**と、  
そのための仕組みとして **Context Packet を生成し、Agent AI（例: Copilot）へ伝搬できる UX を確認すること** にある。

---

## 2. DoD（Definition of Done）

以下の 3 点を満たすことをもって PoC の成功とする。

> [!IMPORTANT] > **Shelter Mode（ローカル完結型）の達成が YuiHub PoC の最優先目標である。**

1. **Local Vector Store による即時想起**

   - **LanceDB**（`lancedb` npm パッケージ）により、自身の過去の思考とコード文脈を即座に想起できること。
   - 外部ネットワークへの依存なしに、セマンティック検索が機能すること。

2. **Watcher によるリアルタイム Context 維持**

   - 作業中の変更（Diff）をリアルタイムに監視し、常に最新の Context Packet を維持できること。
   - Git 差分、開いているファイル、直近の会話が自動的に Working Memory に反映されること。

3. **Context Packet の自律生成**
   - Fragment→Knot→Thread を整理し、Context Packet が自動生成されること。
   - 過去の設計判断（Long-term Memory）が Vector Search で取得され、Packet に統合されること。

---

## 3. スコープ外（Out of Scope / Anti-Goals）

- **短期速度ハック**：速度最大化のために思想を省略する開発は対象外。
- **完全自動化**：思想の翻訳・連続性が保証されない全自動ワークフローは PoC の範囲外。
- **思想なき実装**：成果物だけが残り、根拠や判断過程が欠落する状態は避ける。

---

## 4. フェーズ計画

- **Phase 1（現在）**: **Shelter Mode** を優先し、ローカル完結型の自律思考基盤を構築する。
- **Phase 2（次フェーズ）**: Signal Mode（外部発信）を実装し、OSS 貢献や協働へ拡張する。

> [!NOTE]
> Signal Mode（外部発信）は Shelter の基盤が完成するまでの間、次フェーズ扱いとする。
