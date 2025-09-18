# YuiHub PoC — 日本語検索 MUST 対応 指示書

⚠️ 注意事項  
この文書は **実際のプログラム内部を知らない ChatGPT が PoCレポートを前提に作成した「実装イメージ」** です。  
あくまでこぱたん（GitHub Copilot）に作業をさせる際の **指示書・道しるべ** として利用してください。  
実際のコード構造や依存関係はリポジトリに合わせて調整が必要です。

---

## 🎯 目的（DoD）
- **日本語クエリで `/search` が 200 OK を返し、妥当なヒットが得られること。**
- ChatGPT Actions（GPTs）から日本語検索が失敗しないこと。  
- これにより **PoCの受け入れ条件（DoD）を満たす**。

---

## 0) 依存追加（想定）
軽量ライブラリ **tiny-segmenter** を利用するイメージ。

```bash
npm i tiny-segmenter
````

---

## 1) テキスト処理ユーティリティ（実装イメージ）

```js
// yuihub_api/src/text-ja.js （新規想定）
import TinySegmenter from 'tiny-segmenter';

const seg = new TinySegmenter();
const STOPWORDS = new Set(['は','が','の','に','を','と','も','で','する','なる','ある']);

export function normalizeJa(text = '') {
  return String(text ?? '').trim().normalize('NFKC').replace(/\s+/g, ' ');
}

export function tokenizeJa(text = '') {
  const s = normalizeJa(text);
  if (!s) return '';
  const tokens = seg.segment(s).filter(t => !STOPWORDS.has(t));
  return tokens.join(' ');
}

export function tokenizeQuery(q = '') {
  return tokenizeJa(q);
}
```

> 実際のフォルダ構成や import パスは Copilot が補完。

---

## 2) インデックス生成時の適用（実装イメージ）

```js
// scripts/chunk_and_lunr.mjs 内の登録直前など
import { tokenizeJa } from '../yuihub_api/src/text-ja.js';

idx.add({
  id: doc.id,
  title: tokenizeJa(doc.title || ''),
  body: tokenizeJa(doc.body || '')
});
```

---

## 3) `/search` ハンドラ修正（実装イメージ）

```js
import { tokenizeQuery, normalizeJa } from './text-ja.js';

export async function handleSearch(req, reply) {
  try {
    const raw = req.query?.q ?? '';
    const decoded = decodeURIComponent(raw);
    const qNorm = normalizeJa(decoded);
    if (!qNorm) return reply.code(400).send({ ok: false, error: 'q is required' });

    const qTokenized = tokenizeQuery(qNorm);
    const results = index.search(qTokenized);

    return reply.send({ hits: results });
  } catch (err) {
    req.log.error({ err }, 'search failed');
    return reply.code(500).send({ ok: false, error: 'Search error' });
  }
}
```

---

## 4) OpenAPI の確認

`/search` の `q` パラメータは `string` のままでよい。
`allowReserved: false` を明記してもよい。

---

## 5) テスト手順（スモーク）

### curl

```bash
# 日本語クエリ（例: "API設計 決定"）
curl -s "http://localhost:3000/search?q=$(python -c "import urllib.parse;print(urllib.parse.quote('API設計 決定'))")" | jq
```

### ChatGPT Actions

GPTsから「API設計 決定 を検索して」と入力 → 200 OK & ヒットを確認。

---

## 6) DoD チェックリスト

* 日本語クエリで 400 エラーが再現しない
* 200 OK が返り、`hits[].title/snippet` に日本語を含む結果がある
* ChatGPT Actions からも成功する

---

## 7) 備考

* **これは実装イメージ**。実際の `server.js` / `search.js` の構造や import 方法は Copilot が補完する前提。
* 検索精度は最低限の分かち書き対応で保証。品質向上は後続フェーズでシノニム・文境界処理を追加予定。
* 今回の修正で **DoDとしての日本語対応はMUSTクリア**。

```
