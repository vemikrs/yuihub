---
doc_type: plan
status: draft
owner: vemikrs
created: 2025-09-21
related:
  - meta/MANIFESTO.md
  - meta/FOCUS.md
  - meta/ETHICS.md
  - meta/appendix/lexicon.md
---

# Ph2b 計画：YuiHub with YuiFlow Framework PoC

- 日付: 2025-09-21
- 目的: **GPTs ⇄ YuiHub ⇄ AI Agent** の疎通をミニマムで成立させる。同時に「結」の思想に基づき、**YuiFlow Framework** の最小要素を併走で設計・実装する。
- 方針キーワード: **分けて進める / 最小で確かめる / OSS流で刻む**

---

## Tracks（併走の分け方）

- **Track-A: YuiFlow Framework（思想→最小設計）**
  - 「結」の思想を**流れ（Flow）**に落とすための最小コア。
  - 成果物: `docs/yuiflow/` にミニマム仕様（I/Oスキーマ、用語、インターフェイス境界）。
- **Track-B: PoC Integration（疎通の実装）**
  - GPTs→YuiHub→Agent の**最短配線**で疎通デモを成立。
  - 成果物: 既存 `yuihub_api/` とスクリプト群の**部分再利用**＋最小改修。

> 並走だが、**設計（Track-A）で決めた“入口/出口(I/O)”をTrack-Bが即反映**する、小さな往復を繰り返す。

---

## 成功条件

- **MSC（Minimum Success Criteria）**
  1) GPTs→YuiHub で **保存/検索** が通る  
  2) YuiHub→AI Agent で **最小トリガ** が通る  
  3) すべての痕跡が **YAML/Markdown** に残り、再現可能
- **FSC（Nice-to-have）**
  - MCP/HTTPの**両経路**で再現
  - **日本語検索の簡易補正**（terms補正など）
  - 最小の**メタ（Thread ID/意図）**をI/Oに付与

---

## Step 1: アーカイブ確定（完了扱い／残タスクのみ）
- [x] **残作業**: `ARCHIVE_MANIFEST.yml` 作成／`FREEZE-LOG.md` 追記／機密ワードスキャン
- [x] **注意**: `node_modules` は履歴から除外、`chatlogs/data/index` は rsync 退避（未追跡のまま）

---

## Step 2: 構想設計（YuiFlow最小仕様＋新概念ドキュメント化）

**目的**

* 「型（YuiFlow）／場（YuiHub）」の**役割分離**を“仕様の一次正”として固定し、以降の実装判断のぶれを抑止する。

**新規アウトプット（必須）**

1. `docs/yuiflow/00_min-spec.md`

   * 語彙（Flow/Fragment/Knot/Thread）
   * I/Oスキーマ初版：`input.message.yaml` / `record.entry.yaml` / `agent.trigger.yaml`
   * 非目標（UI/可視化は範囲外、検索高度化は簡易補正まで）

2. `docs/yuiflow/02_hub-vs-flow-separation.md`  ← **新概念の一次正**

   * 一行定義：**YuiHub＝場（実装・API・保存/検索）／YuiFlow＝型（語彙・スキーマ・コントラクト）**
   * 責務マトリクス（何をどちらに置くか）
   * 依存の向き（FlowなしでHubは動くが、**Flow準拠**で使うと思想保証）
   * 置き場所（ディレクトリ分割規範）
   * アンチゴール（混同防止の禁止事項）

3. `docs/yuiflow/contracts/README.md`

   * コントラクトテストの位置づけ（**定義はFlow、実行はHub**）
   * コントラクトの更新手順（差分Knotの戻り条件）

**テンプレ（貼付）**

```md
---
doc_type: concept
status: draft
owner: vemikrs
created: 2025-09-21
---

# YuiHub × YuiFlow 分離原則（一次正）

## 一行定義
- **YuiHub**: 実体（ランタイム／API／保存・検索の“場”）
- **YuiFlow**: 型（思想→仕様→コントラクトの“流れ”）

## 責務マトリクス（抜粋）
- スキーマ・ICD・コントラクトテストの**定義** … **Flow**
- 保存/検索の**実装**・永続化・API … **Hub**
- 日本語 terms 抽出の**規範** … **Flow**（擬似コード）
- 同抽出の**実装** … **Hub**（Flow準拠）

## 依存の向き
- Hub は Flow なしでも最小動作可
- Flow は Hub 非依存（他実装でも準拠可）

## 置き場所
- Flow: `docs/yuiflow/**`（一次正）
- Hub:  `yuihub_api/**`（実装）

## アンチゴール
- Flow に実装依存の最適化を持ち込まない
- Hub に仕様の一次定義を置かない
```

---

## Step 2.5: 技術設計確定（ICD / OpenAPI / コントラクトテスト雛形）

**目的**

* Step2 の概念を\*\*実装コントラクト（機械可読）\*\*に落とす。以降の実装はこのコントラクトに従う。

**新規アウトプット（必須）**

1. `docs/yuiflow/01_technical-design.md`

   * ICD（GPTs↔Hub↔Agent の責務/境界）
   * 検索仕様（AND/filters/順序づけの最小規範）
   * セキュリティ最小原則（PoCは Bearer 1本・最小レート）

2. `docs/yuiflow/openapi/poc.yaml`

   * `POST /save` / `GET /search` / `POST /trigger`
   * リクエスト/レスポンス例（**Step2 の I/O スキーマに準拠**）

3. `docs/yuiflow/contracts/*.json`（または `.schema.json`）

   * `http.save.contract.json`
   * `http.search.contract.json`
   * `http.trigger.contract.json`

4. **Definition of Ready（DoR）** for Step3

   * 下記チェックが**全てOK**になった時点で実装開始可

**DoR チェック（貼付）**

* [ ] `02_hub-vs-flow-separation.md` がレビュー済み（役割分離の合意）
* [ ] OpenAPI `poc.yaml` の 3エンドポイントが揃い、例が最小2ケースずつ
* [ ] コントラクト JSON Schema が存在し、**例が Schema で validate OK**
* [ ] I/O スキーマ（YAML）と OpenAPI（JSON）が**矛盾しない**
* [ ] セキュリティ最小原則とログ出力ルールが記述済み

**OpenAPI 叩き（最小骨子）**

```yaml
openapi: 3.0.3
info:
  title: YuiHub PoC API
  version: 0.1.0
paths:
  /save:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/InputMessage' }
      responses:
        '200':
          description: saved
          content:
            application/json:
              schema: { $ref: '#/components/schemas/RecordEntry' }
  /search:
    get:
      parameters:
        - in: query; name: q; schema: { type: string }
        - in: query; name: tag; schema: { type: string }
        - in: query; name: thread; schema: { type: string }
      responses:
        '200':
          description: results
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/RecordEntry' }
  /trigger:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AgentTrigger' }
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok: { type: boolean }
                  ref: { type: string }

components:
  schemas:
    InputMessage:
      type: object
      required: [id, when, source, author, text]
      properties:
        id: { type: string }
        when: { type: string, format: date-time }
        source: { type: string, enum: [gpts, mcp, cli] }
        thread: { type: string }
        author: { type: string, enum: [user, assistant] }
        text: { type: string }
        tags: { type: array, items: { type: string } }
        meta: { type: object }
    RecordEntry:
      type: object
      required: [id, when, source, text]
      properties:
        id: { type: string }
        when: { type: string, format: date-time }
        thread: { type: string }
        source: { type: string }
        text: { type: string }
        terms: { type: array, items: { type: string } }
        tags: { type: array, items: { type: string } }
        links:
          type: array
          items:
            type: object
            properties:
              type: { type: string }
              ref: { type: string }
    AgentTrigger:
      type: object
      required: [id, when, type, payload]
      properties:
        id: { type: string }
        when: { type: string, format: date-time }
        type: { type: string, enum: [echo, summarize, custom] }
        payload: { type: object }
        reply_to: { type: string }
```

**コントラクトテスト例（雛形：`.http` でも可）**

```http
### save returns RecordEntry
POST http://localhost:8787/save
Content-Type: application/json
Authorization: Bearer {{AUTH_TOKEN}}

{
  "id": "msg-01ABC",
  "when": "2025-09-21T14:00:00+09:00",
  "source": "gpts",
  "author": "user",
  "text": "こんにちは、保存テスト。",
  "tags": ["flow:test"]
}
```

> 実行系は Step3 で `yuihub_api/tests/contract/` から回します。 **定義（Flow）→実行（Hub）** の順を崩さないこと。

---

## Draft: Step 3: 実装 & スモーク（PoC最小）

**実装最小単位**

* HTTP: `/save` `/search` `/trigger` を **Step2.5 のコントラクト**どおり実装
* Agent: **Echo**（payload受→即ログ）
* 記録: `chatlogs/flow-runs/` に 1実験=1ファイルの痕跡

**テスト（smoke）**

* 日本語混在テキストの保存→terms生成→検索ヒット
* Thread/タグ指定の再現
* トリガ往復で200/OK & ログ出力確認

---

## Draft: Step 4: DoD評価 & 差分整理

**DoD**

* MSCの**安定再現**
* **思想準拠**（下記チェック）に全てYes
* `RUNBOOK.md（極小版）` 提示（起動→保存→検索→トリガ→評価の5行）

**差分**

* 未達/保留は `chatlogs/Δ_Knots.md` に列挙（次Threadの起点）

---

## 思想準拠チェック（実装後）

* [x] **中立形式**: 主要I/Oが YAML/Markdown を第一級で扱う
* [x] **移植性**: ベンダ鍵は外だし＆最小権限。依存は疎
* [x] **安心**: 記録はユーザ側に帰属し、削除・閉鎖が容易
* [x] **膨張抑制**: 可視化/UIより**構造**（Flow/ICD/I/O）を優先
* [x] **語彙整合**: Fragment→Knot→Thread で説明可能

---

## 作業の粒度（Issue化の指針／Agile・OSS尊重）

* 1 Issue = 「最小の合意可能な変化」
* ラベル例: `track/yuiflow` `track/poc` `type/spec` `type/impl` `Δ-knot`
* PRは**小さく**、`chatlogs/` に**検証ログを必ず残す**

---

## Draft: Thread（実行順の目安）

* [x] **T0（09/21）**: Step1 残（マニフェスト・ログ・スキャン）
* [x] **T1（～09/22）**: Step2 `00_min-spec.md`
* [x] **T1.5（～09/22）**: Step2.5 `01_technical-design.md`（ICD/コントラクトテスト雛形含む）＋ `openapi/poc.yaml`
* [x] **T2（～09/24）**: Step3 実装・スモーク合格
* [x] **T3（～09/25）**: Step4 DoD & 差分整理

---

## Fragment（記録用）

> **FRAG-2025-09-21-001**: 計画書の見出しに特定名が紛れ込んだインシデント。
> 対応: 計画書は無地化。**Fragmentとして保存**し、語彙/自動適用の線引きを次回Threadの議題とする。
> 保存先案: `docs/logdocs/fragments/2025-09-21-title-incident.md`

---

以上