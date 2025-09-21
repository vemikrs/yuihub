# notes — 個人の内省・研究ログ（公式見解ではありません）

**目的（Purpose）**  
作者（vemikrs）の思索・内省・研究・意思決定過程を残します。**公式見解ではありません。** 迷子になったときに自己復元するための“外部記憶”です。

**想定読者（Audience）**  
- 将来の自分  
- 参考として覗きたい読者（※個人見解である点に留意）

**含まれるもの（Scope）**  
- `manifesto/manifesto.personal.md`（理性的ロング版）  
- `research/`（調査ノート）  
- `decisions/`（ADR的な意思決定ログ）  
- `journal/`（短い記録／実験メモ）

> 注意：センシティブ情報・固有名詞の取り扱いに配慮してください。公開が適切でない場合は、リポジトリ外に保管します。

---

## 作法（Conventions）
- ファイル名：`yyyy-mm-dd-title.md` または `kebab-case.md`  
- 先頭YAML（例）：
  ```yaml
  ---
  doc_type: notes
  status: draft # 多くは draft のままでOK
  owner: vemikrs
  created: 2025-09-20
  updated: 2025-09-20
  visibility: public # or private(off-repo)
  related:
    - ../../meta/manifesto.md
  ---
  ```
- 連続的に読む束は `00-`, `10-` の接頭辞で順序保証

## エスカレーション経路
- `notes` で育った内容が「共有価値」になったら → `docs/` へ要約移植  
- 原則・規範に昇格する場合 → `meta/` へ再編集の上で移行

## 免責（Disclaimer）
- ここに記載の内容は**個人の見解**であり、`meta/` の公式文書とは異なります。

## 入口（Quick Links）
- 読ませる入口：`../docs/`  
- 公式の芯：`../meta/`

_Last updated: 2025-09-20_
