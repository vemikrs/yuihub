---
doc_type: delta
status: draft
owner: vemikrs
created: 2025-09-22
updated: 2025-09-23
concept_version: c0.2
doc_version: none
target_code_tag: v0.2.0-prototype.1
---

# Δ-Knots (差分記録)

## Ph2-S2-P0 構想設計計画

### DK-2025-09-21-01
- **mode=shelter をコントラクト固定**（PoC段階）。Signal 等は次フェーズで拡張。

### DK-2025-09-21-02
- **RecordEntry.controls を仮置き許容**。visibility/detail/external_io の3項目。

### DK-2025-09-21-03
- **検索規範**: AND 既定、前方一致。擬似コードを ja-terms-guideline.md に明文化。

### DK-2025-09-22-01
- **OpenAPI vs YAML 差分**: thread 必須/任意差、セキュリティ方式差。Step2.5で整合処理。

---

## Ph2b-S2-P1 構想設計

## DK-2025-09-23-01 Ph2b-S2 P1
- 00_min-spec: Mode を必須・固定（Shelter/Signal）として追記
- 00_min-spec: `record.entry.controls` を暫定導入（プレースホルダ、厳格化は後続）
- 00_min-spec: Thread 必須化（thread_id 無し保存不可）
- 00_min-spec: `kind = fragment|knot` と JA/EN 例を明記
- 00_min-spec: Context Packet を定義（I/O は Packet 経由）
- 修正: `ja-terms-guideline.md` GAP対応（適用範囲／正規化指針／役割分担／テスト観点／更新注記）

## DK-2025-09-23-02 Ph2b-S2 P2
- 新規: `contracts/README.md` ひな形作成（Flow→Hubの順序／Δ-Knot戻り条件）
- 新規: `CONSISTENCY.md` 作成（Flow↔OpenAPI 整合の記録表）
- SoT宣言: Flow=一次正（00_min-spec / 02_hub-vs-flow-separation / ja-terms-guideline）、Hub=OpenAPI
- 実行順序: Flow定義更新→契約テスト→Hub実装→整合記録→Δ-Knots反映
- 役割: Flow Maintainer=一次正保持／Hub Maintainer=契約実装保持
- 初票: `/records` POST thread_id 必須不一致を記録（OpenAPIを必須に揃える）
- 初票: `/search` GET OR露出を例外扱いに記録（仕様の非既定として注記）

## DK-2025-09-23-03 Ph2b-S2 P3
- 既定：検索AND（例外はΔ-Knot起票）
- controls：`record.entry.controls` を暫定（緩和検証）
- OpenAPI差分：`CONSISTENCY.md` に初票を登録

