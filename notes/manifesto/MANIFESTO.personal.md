---
doc_type: notes
status: draft
owner: vemikrs
created: 2025-09-20
updated: 2025-09-21
related:
  - meta/MANIFESTO.md
  - meta/appendix/lexicon.md
---

# Manifesto (for Personal Use)

## Chapter 1 — 出発点：痛みと背景
AIとの即興的な対話は価値を生む一方で、判断の文脈は散逸しやすい。  
その結果、  
- 思考の痕跡が抜け落ち、**連続性が断絶する**  
- 決定理由が辿れず、**判断が再利用できない**  
- 成果物だけが残り、**思想、決定の過程が空洞化**する  

この状態を**「思想の空洞化」**と呼ぶ。  
この状況を突破したい。これがYuiHubの出発点である。  
**「思想が一本の筋として続いている」**ことがわたしの安心条件であり、そこには**根拠への即時参照**と**再現性**が欠かせない。  

> 皮肉にも、当プロジェクトのPoCにおいても同じ摩擦が起きた。PhaseのDoD評価時に「思想の筋」が見えず、構想のズレ⇒思想の忘却？という強い不安に駆られた。  

一段抽象度を上げて振り返ると、この痛みは開発や設計の場でも繰り返し起きてきた。  
会議や設計の発想、思想は断片的にしか残らず、あとで振り返ると「なぜこの道を選んだか」が見えなくなる。  
この空虚を埋めることで、創造活動はより豊かになると信じる。  

---

## Chapter 2 — 必然性：Why Now
どうして今なのか。  

- **技術的な背景**：AI活用が一気に広まり、即興的な成果は得やすくなったものの、思想が置き去りになる危険が高まっている。  
- **文化的な背景**：特に開発の現場では、思想を伝搬させる仕組みが弱く、空洞化が常態化している。  
- **自分自身の背景**：膨大化した思想設計・思考ログを外に置くことがわたしにとって安心の基盤になる。  

この3つが重なった今だからこそ、この「YuiHub」は必要になった。  

（メモ：あれ？なんでmem0aiではなくYuiHubなのか？？？）  

---

## Chapter 3 — 橋渡し：現在の方法
わたしは「[思想ファースト](/meta/appendix/lexicon.md#思想ファースト-idea-first)」で進めたい。  
思想から決定までの過程を**思想の痕跡**として外部化する。連続した痕跡があってこそ、価値ある「表現」は生まれる。  

### 3.1 [Fragment](/meta/appendix/lexicon.md#fragment断片) / [Knot](/meta/appendix/lexicon.md#knot結節) / [Thread](/meta/appendix/lexicon.md#thread筋)
- **Fragment（断片）**：即興的な気づき、アイデア、直感  
- **Knot（結節）**：断片から抽出された判断や選択理由のまとまり  
- **Thread（筋）**：結節がつながり、一貫した流れ  

ChatGPTはFragment生成に強い。  
CopilotはThreadに沿った実装に強い。  
その間にKnotを置くことで翻訳不全を防ぐ。  

### 3.2 [Context Packet](/meta/appendix/lexicon.md#context-packet)
各タスクやPoCにはPacketを残す。  
中身は Intent / Prior Decisions / Constraints / Evidence / Open Questions / Next Action。  

チャットAI（ChatGPT,Perplexityなど）でまとめ → Packet化 → Coding Agent AIに渡す。  
翻訳不全を抑えて、再訪や再利用ができるようにする。  

---

## Chapter 4 — 世界観：未来像と「結」
YuiHubは「[結（Yui）](/meta/appendix/lexicon.md#結yui)」を核に据える。  

- **結ぶ**：断片を結び直し、筋へ編む  
- **残す**：結び目を外に置き、再訪・再利用を可能にする  
- **ひらく**：必要なときに他者へ渡し、物語を共有する  

### 4.1 [Modes](/meta/appendix/lexicon.md#modes)
- **Shelter Mode（避難所）**  
  自分の安心と安定を守る。  
  Fragment→Knot→Threadに集中し、筋を切らさない。  
  今はこのモードを優先する。  

- **Signal Mode（ひらかれた手）**  
  外に伝えることを目的にする。  
  PacketやThreadを翻訳し、OSSの貢献や協働へつなげる。  
  Shelterが安定したら切り替える。  

### 4.2 [創造一般](/meta/appendix/lexicon.md#創造一般-general-creativity)への拡張
この仕組みはプログラムに限らない。  
絵も、音楽も、言葉も。  
「発想⇔構想・思考⇔決定⇔表現」という流れはどの創作作業にもあてはまる。  
YuiHubが思想の連続性を支えられれば、ここはエンジニアリングを越えた創造の拠点になれる。  

---

## Principles（→ [Lexicon参照](/meta/appendix/lexicon.md#principles関連)）
1. **Continuity over Velocity** — 速度よりも連続性を優先する  
2. **Traceability by Design** — 辿れる形で記録する  
3. **Small-to-Stable** — 小さく残し、安定させてから広げる  
4. **Intent > Implementation** — 実装は意図の従属物  
5. **Revisit is a Feature** — 見返せることを機能価値とみなす  

---

## DoD（→ [Lexicon参照](/meta/appendix/lexicon.md#dod-definition-of-done受け渡し規格)）
- **Context Packetをつける**：各タスクに必須  
- **成果物とPacketを照合する**：ズレがあれば理由を記録  
- **重要な判断はKnot化する**：根拠や除外理由を明確に  

---

### アンチゴール
YuiHubは「思想ファースト」を守るための仕組みであり、短期的な速度最大化や場当たり的ハックは対象外とする。また、完全自動化を目的とはしない。思想の翻訳・連続性が保証される範囲に限って設計する。

### 不変条件（Invariants）
- 判断は根拠に即時参照可能であること。  
- 再訪によって結論が再現可能であること。  
この二つが保たれない場合、思想の筋は途切れたと見なす。

### 前提と依存
技術前提（LLM, MCP, VCSなど）と社会制度前提（OSSガバナンス、ライセンス）を切り分けて扱う。思想そのものは前提に依存せず、あくまで「結ぶ」という枠組みに根ざす。

### 語彙の境界
- Fragment = 即興の断片（Issueやログとは異なる）  
- Knot = 意思決定の結び目（ADRに近いが軽量で頻度高い）  
- Thread = 意図の連なり（PRDや設計書よりも流動的で再訪可能）  
