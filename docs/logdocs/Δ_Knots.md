---
doc_type: delta
status: draft
owner: vemikrs
created: 2025-09-22
concept_version: c0.2
doc_version: 0.2.0-doc.1
target_code_tag: v0.2.0-prototype.1
---

# Δ-Knots (差分記録)

## Ph2-S2-P0 構想設計計画

### Δ-2025-09-21-01
- **mode=shelter をコントラクト固定**（PoC段階）。Signal 等は次フェーズで拡張。

### Δ-2025-09-21-02
- **RecordEntry.controls を仮置き許容**。visibility/detail/external_io の3項目。

### Δ-2025-09-21-03
- **検索規範**: AND 既定、前方一致。擬似コードを ja-terms-guideline.md に明文化。

### Δ-2025-09-22-01
- **OpenAPI vs YAML 差分**: thread 必須/任意差、セキュリティ方式差。Step2.5で整合処理。

---

## Ph2b-S2-P1 構想設計

## 2025-09-23 (Ph2b-S2 Step2-P1)
- 00_min-spec: Mode を必須・固定（Shelter/Signal）として追記
- 00_min-spec: `record.entry.controls` を暫定導入（プレースホルダ、厳格化は後続）
- 00_min-spec: Thread 必須化（thread_id 無し保存不可）
- 00_min-spec: `kind = fragment|knot` と JA/EN 例を明記
- 00_min-spec: Context Packet を定義（I/O は Packet 経由）
- 修正: `ja-terms-guideline.md` GAP対応（適用範囲／正規化指針／役割分担／テスト観点／更新注記）

