---
doc_type: meta
status: stable
owner: vemikrs
created: 2025-09-20
updated: 2025-09-21
related:
  - meta/ETHICS.md
  - meta/FOCUS.md
  - meta/DOD.md
  - meta/appendix/lexicon.md
---

# YuiHub Manifesto

## Why

AI との対話や開発の過程で、思考は一瞬で流れ去り、根拠や判断は散逸する。  
その結果、成果物は残っても思想は途切れ、物語は失われる――**思想の空洞化**。  
YuiHub は、この空洞を埋め、**「思想が一本の筋として続いている」**状態を守るために生まれた。

## How

YuiHub は「思想ファースト」の立場から、断片を結び直し、物語として残す。

- **Fragment**（断片）をすくい、
- **Knot**（結節）で判断を結び、
- **Thread**（筋）として連続させる。  
  さらに **Context Packet** によって、意図や根拠を外部化し、後から再訪・再利用できるようにする。  
  （用語は _meta/appendix/lexicon.md_ を参照）

## What

YuiHub は「**結（Yui）**」を核に据える。

- **結ぶ**：断片を筋へ編み、思想を連続させる
- **残す**：結び目を外に置き、再訪と再利用を可能にする
- **ひらく**：必要に応じて他者と共有し、協働の物語を育てる

### Modes

> [!IMPORTANT] > **Shelter Mode は YuiHub の本質的価値であり、Default Mode である。**  
> 外部（Mira/Server）に依存せず、ローカルだけで思考の結び目（Knot）と文脈（Context）を完結させることが、YuiHub の根幹をなす。

- **Shelter Mode（避難所）** — **Default Mode**  
  自分の安心と安定を守るモード。  
  Fragment→Knot→Thread に集中し、筋を切らさない。  
  設計的には「内部に留める」ことを優先し、公開範囲は _internal_ を既定とする。

  **ローカル完結の原則:**

  - **Local Vector Store** により、自身の過去の思考とコード文脈を即座に想起できる
  - **Watcher** により、作業中の変更（Diff）をリアルタイムに監視し、常に最新の Context Packet を維持できる
  - 外部ネットワークへの依存なしに、自律的な思考支援を実現する

- **Signal Mode（発信）** — **次フェーズ**  
  外に伝えるモード。  
  Packet や Thread を翻訳し、OSS 貢献や協働へつなげる。  
  設計的には「外に出す」ことを優先し、公開範囲は _partner / public_ を既定とする。

  > [!NOTE]
  > Signal Mode は Shelter の基盤が完成するまでの間、次フェーズ扱いとする。

---

YuiHub は、思想を守る **避難所（Shelter）** を第一義とする。  
Shelter Mode の完成後に、次の創造を開く **発信の場（Signal）** へと拡張する。

PoC では **Shelter Mode を Default** として、ローカル完結型の自律思考エージェントを構築する。  
将来的には「情報の粒度（detail）」や「外部送信方針（external_io）」も組み込み、  
安心のための二層的なモード設計へと拡張していく。

---

## Appendix（軽量・可変）

> Manifesto 本文は安定、Appendix は進化する領域とする。

### A. アンチゴール

- 速度だけを最大化する短期ハックは対象外。
- 完全自動化は目的ではない。思想の翻訳と連続性を優先する。

### B. 不変条件（Invariants）

- 判断は**根拠に即時参照**できること。
- 再訪すれば**結論が再現**できること。  
  （この二つが欠ければ、思想の筋は断絶したとみなす）

### C. 前提と依存

- 技術前提：LLM / MCP / VCS 等
- 社会前提：OSS ガバナンス / ライセンス  
  ※ 思想の枠組み（**結ぶ**）は前提に依存しない。

### D. 語彙の境界（概要）

- Fragment = 即興の断片（Issue/ログとは異なる）
- Knot = 意思決定の結び目（軽量 ADR）
- Thread = 意図の連なり（PRD より流動的）  
  → 詳細は _meta/appendix/lexicon.md_ を参照。
