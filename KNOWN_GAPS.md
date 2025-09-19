# KNOWN_GAPS — YuiHub v0.2.0-freeze
更新日: 2025-09-19 (UTC+09:00)
状態: Phase 2a freeze 中（meta/*, docs/*, CHANGELOG.md, KNOWN_GAPS.md, FREEZE のみ変更可）

## 技術的ギャップ
- 索引管理APIが openapi.yml に未反映 → GPTs から呼べない
- Lunr検索 + terms.json の二段検索、統合未了
- 保存直後に検索結果へ反映されない瞬間がある（強整合性未解決）

## 運用・セキュリティギャップ
- dev環境で認証オフ → READMEに注意不足
- 削除・匿名化の最小手順が未整備（meta/ETHICS.md で補完予定）

## ドキュメントギャップ
- MANIFESTO / DIFFERENTIATORS / ETHICS 未配置（思想注入タスク）
- README の About セクションが思想と連動していない
