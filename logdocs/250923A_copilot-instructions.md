# logdocs/250923A_copilot-instructions.md

## Copilot 作業指示 (Ph2b-S2 Step2-P1)

### Fragment: 作業範囲
- 更新: `docs/yuiflow/00_min-spec.md`（末尾に追記・既存見出しと衝突しないよう新規節として追加）
- 新規: `docs/yuiflow/ja-terms-guideline.md`
- 差分記録: `docs/yuiflow/Δ_Knots.md`（Step2-P1 分を**簡潔に**追記）

### Knot: 作業内容
1. `00_min-spec.md`
   - Mode 固定必須を追記
   - `record.entry.controls` を仮置きで追記（プレースホルダ、将来 Δ-Knot で更新）
   - Thread 必須化を追記
   - `kind: fragment|knot` の規定と JA/EN 例を追記
   - Context Packet の定義文を追記

2. `ja-terms-guideline.md`
   - 日本語処理規範（目的／範囲／擬似コード／ストップワード例／正規化指針／テスト観点／Flow vs Hub の役割）を作成

3. `Δ_Knots.md`
   - 2025-09-23 の項目として Step2-P1 の一次正更新を**1行箇条書き**で追記（冗長説明禁止）

### Thread: 出力形式
- すべて **unified diff** で提示すること（`---` / `+++` / `@@` を含む）
- `00_min-spec.md` は**追記（append）前提のdiff**とする（既存本文は変更しない）
- `Δ_Knots.md` 追記は短く（箇条書きのみ）。説明段落は作らない

---

## Expected Diffs（適用想定差分）
以下のパッチを順に適用してください。

### 1) docs/yuiflow/00_min-spec.md（末尾に新規節を追記）
```

\*\*\* Begin Patch
\*\*\* Update File: docs/yuiflow/00\_min-spec.md
@@
+## Mode 固定必須
+- すべての `record.entry` は **Mode** を必須とする。
+- 許可値は `Shelter` / `Signal` のみ。将来の拡張は Δ-Knot で検討し、一次正（Flow）に先行させない。
\+
+## Controls（仮置き）
+- `record.entry.controls` を **暫定**に導入する（プレースホルダ）。
+- 具体項目は未確定。利用は**任意**、検証は**緩和**。正式決定は Δ-Knot → Flow 反映後に厳格化する。
\+
+## Thread 必須化
+- すべての記録は **Thread** に属さなければならない。
+- `thread_id` が無い `fragment` は保存不可（Hub 側バリデーション対象）。
\+
+## Kind の規定
+- `kind` は必須。許可値は `fragment` / `knot`。
+- 例:

* * JA: `kind: fragment` → 「これは試験的なメモです」
* * EN: `kind: knot` → "This entry represents a consolidated knot."
*

+## Context Packet の定義
+- **Context Packet** ＝ Mode / Thread / Entry 群を束ねる最小の交換単位。
+- Hub 側 I/O は Context Packet を介して受け渡しする（個別 Entry の**直交送受信を禁止**）。
+- Flow（一次正）は Context Packet の構造を規定し、Hub はそれを**満たす**実装に徹する。
\*\*\* End Patch

```

### 2) docs/yuiflow/ja-terms-guideline.md（新規ファイル）
```

\*\*\* Begin Patch
\*\*\* Add File: docs/yuiflow/ja-terms-guideline.md
+---
+doc\_type: guideline
+status: draft
+owner: vemikrs
+created: 2025-09-23
+scope: "YuiFlow JA terms extraction"
+---
\+
+# 日本語処理規範（JA Terms Guideline）
\+
+## 目的
+日本語テキストから用語（terms）を抽出・正規化するための共通規範を定義し、Flow（思想→仕様）と Hub（実装）間の乖離を防ぐ。
\+
+## 適用範囲
+- YuiFlow が一次定義する規範。Hub は本規範を**参照実装**として順守する。
\+
+## 擬似コード（最小）
+`
+tokens = tokenize(input_text)
+tokens = remove_stopwords(tokens)
+tokens = normalize(tokens)   # 表記ゆれ・品詞ベースの正規化（名詞・固有名詞を優先）
+terms  = select_terms(tokens) # 頻度・重要度ヒューリスティクス（将来拡張）
+return terms
+`
\+
+## ストップワード例（最小）
+- 「こと」「ような」「的」「これ」「それ」「あれ」
+- 補助動詞・助詞・終助詞（は・が・を・に・で・ます・です など）
\+
+## 正規化の指針（最小）
+- 全角／半角・大文字／小文字の統一
+- 記号（句読点・括弧・長音）のトリム
+- 見出し語は**基本形**に寄せる（例: 「結び」「結ぶ」→「結」）
\+
+## 役割分担
+- **Flow**：規範の一次定義・更新。テストケース（擬似コード準拠）を付与。
+- **Hub**：規範に従った抽出実装。速度・記憶域などの最適化はしても、規範を改変しない。
\+
+## テスト観点（最小）
+- ストップワードが terms に混入しないこと
+- 同義表記が同一の見出し語に正規化されること
+- 英数・記号混在語の扱いが一貫していること
\+
+> 注: 本ガイドラインは PoC 期間中に Δ-Knot を通じて更新されうる。更新は常に Flow 起点で行う。
\+
\*\*\* End Patch

```

### 3) docs/yuiflow/Δ_Knots.md（Step2-P1 追記のみ／簡潔）
```

\*\*\* Begin Patch
\*\*\* Update File: docs/yuiflow/Δ\_Knots.md
@@
+## 2025-09-23 (Ph2b-S2 Step2-P1)
+- 00\_min-spec: Mode を必須・固定（Shelter/Signal）として追記
+- 00\_min-spec: `record.entry.controls` を暫定導入（プレースホルダ、厳格化は後続）
+- 00\_min-spec: Thread 必須化（thread\_id 無し保存不可）
+- 00\_min-spec: `kind = fragment|knot` と JA/EN 例を明記
+- 00\_min-spec: Context Packet を定義（I/O は Packet 経由）
+- 新規: `ja-terms-guideline.md` を追加（擬似コード／SW例／正規化指針／テスト観点）
\*\*\* End Patch

```
