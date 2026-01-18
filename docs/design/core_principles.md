---
doc_type: design
status: stable
owner: vemikrs
created: 2026-01-17
---

# Core Principles: Semantic Memory Layer

## 1. The Problem: "Context Hollow" (文脈の空洞化)

LLM を用いた自律エージェント開発において、最大の課題は「コード（Result）」のみが残り、**「なぜその決定に至ったか」という思考プロセス（Process）が揮発してしまう**ことにある。これを **"Context Hollow"** と定義する。

文脈が空洞化した状態では、エージェントは過去の経緯を参照できず、部分最適に陥るか、同じ議論を繰り返すコスト（Re-learning Cost）が発生する。

## 2. The Solution: "Decision Anchor" (意思決定のアンカリング)

YuiHub は、この揮発性コンテキストを永続化するための **Semantic Memory Layer** である。
単なるログ収集ではなく、**「意思決定の確定ポイント（Decision Anchor）」** を明示的に構造化することで、エージェントが正確に文脈を再構築（Recall）できる状態を担保する。

### Cognitive Engineering Approach

YuiHub は以下の認知工学的要件を満たすよう設計される。

1.  **Volatile Cognitive Log (Entry)**

    - 脳内に浮かぶ流動的な思考や、エージェントとの対話の断片を、**Entry** として即座にキャプチャする。
    - これは「作業メモリ」であり、揮発性が高い。

2.  **Context Anchoring (Checkpoint)**

    - 思考が発散する前に、明確な合意形成や意思決定の地点を **Checkpoint** として固定する。
    - これにより、文脈の後戻りを防ぎ、エージェントへの入力コンテキスト（Prompt Context）として利用可能な信頼できる基準点を作る。

3.  **Traceability of Intent (Session)**
    - 一連の Checkpoint を繋ぐことで、**「意図の筋（Session）」** を可視化する。
    - 結果（コード）から、その原因（意図・議論）へ遡行可能にする。

## 3. Design Philosophy

### Continuity over Velocity

**速度よりも、文脈の連続性を優先する。**
一時的な開発速度を犠牲にしてでも、Context Packet を生成し、文脈を保存することを強制する。これは、長期的には「迷子になるコスト」を削減し、トータルの生産性を最大化するためである。

### Intent > Implementation

**実装は、意図の従属物である。**
コードそのものよりも、その背後にある「意図（Intent）」の保存を重視する。意図が保存されていれば、実装はいつでも再現・修正可能であるためである。

### Local-First Privacy (Private Mode)

**未精査の思考プロセス（Raw Thoughts）を保護する。**
思考の初期段階は脆弱であり、外部への公開を前提とすると認知負荷が高まる。
YuiHub はデフォルトで **Private Mode** で動作し、ローカル完結でセマンティック検索を提供する。これにより、開発者は心理的安全性を確保した状態で、思考を外部化できる。
