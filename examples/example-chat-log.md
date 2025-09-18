---
id: 01EXAMPLE123456789DEMO001
date: 2025-09-18T09:00:00+09:00
actors: [demo]
topic: YuiHub使用例
tags: [demo, example, usage]
decision: 採用
links: []
---
## 要点（3行）
- YuiHubの基本的な使用例を示すデモファイル
- チャットログの保存形式（YAML Front-Matter + Markdown）を説明
- プライベートなチャットログは実際にはgitignoreで除外される

## 本文

これはYuiHubの使用例を示すデモファイルです。

### 保存形式
- **Front-Matter**: YAML形式でメタデータを記録
- **本文**: Markdown形式で会話内容や根拠を記録

### セキュリティ
実際の使用では、`chatlogs/`フォルダ内のファイルは`.gitignore`で除外され、
プライベートな会話内容が公開リポジトリに漏洩することを防ぎます。

### データの永続性  
- ローカルファイルシステム or GitHub private repo
- Markdown形式による長期保存と可読性
- 検索インデックスによる高速アクセス