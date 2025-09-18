# Copilot 実装指示書: YuiHub PoC にトークン認証を追加する

## 🎯 目的
- すべてのAPI（`/health` を除く）に **APIトークン必須** を導入する
- ChatGPT Actions 等から安全に叩けるようにする
- PoC段階なので最小限で安全・再現性重視

---

## 0. 前提・方針
- ヘッダ名: `x-yuihub-token`
- トークン値: `process.env.API_TOKEN`（**未設定なら起動失敗**）
- 例外: `GET /health` は無認証（疎通確認用）
- 失敗応答:
  - ヘッダ欠如: **401 Unauthorized**
  - 誤トークン: **403 Forbidden**

---

## 1. 依存追加
```bash
npm i @fastify/cors
# 任意（雑アクセス対策をしたい場合）
npm i @fastify/rate-limit
````

---

## 2. 環境変数

`.env.example` に追記:

```
API_TOKEN=change-me-long-random-string
ALLOWED_ORIGINS=*
```

* `API_TOKEN` が未設定 or 短すぎる場合は起動失敗
* `ALLOWED_ORIGINS` はPoC中は `*`、本番は制限

---

## 3. Fastify 実装（`yuihub_api/src/server.js`）

### 3.1 CORS 登録

```js
import cors from '@fastify/cors';

await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) ?? ['*'],
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','x-yuihub-token'],
});
```

### 3.2 起動時チェック

```js
const token = process.env.API_TOKEN;
if (!token || token.trim().length < 16) {
  app.log.error('API_TOKEN is missing or too short');
  process.exit(1);
}
```

### 3.3 認証フック

```js
import { timingSafeEqual } from 'crypto';

function safeEquals(a, b) {
  const A = Buffer.from(String(a ?? ''));
  const B = Buffer.from(String(b ?? ''));
  if (A.length !== B.length) return false;
  try { return timingSafeEqual(A, B); } catch { return false; }
}

app.addHook('onRequest', async (req, res) => {
  if (req.method === 'OPTIONS') return;
  if (req.method === 'GET' && req.url.startsWith('/health')) return;

  const header = req.headers['x-yuihub-token'];
  if (!header) {
    res.code(401).send({ ok: false, error: 'Missing x-yuihub-token' });
    return;
  }
  if (!safeEquals(header, token)) {
    req.log.warn({ ip: req.ip, url: req.url }, 'Forbidden: invalid token');
    res.code(403).send({ ok: false, error: 'Forbidden' });
    return;
  }
});
```

### 3.4 任意: レート制御

```js
import rateLimit from '@fastify/rate-limit';
await app.register(rateLimit, {
  max: 120, timeWindow: '1 minute',
  allowList: ['127.0.0.1']
});
```

---

## 4. OpenAPI (`yuihub_api/openapi.yml`)

### 4.1 securitySchemes と global security

```yaml
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: x-yuihub-token

security:
  - ApiKeyAuth: []
```

### 4.2 `/health` を無認証に

```yaml
/health:
  get:
    security: []
```

### 4.3 `/save` のステータス拡張

```yaml
/save:
  post:
    responses:
      '201':
        description: Created
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SaveResponse'
      '400': ...
      '401': ...
      '403': ...
      '429': ...
      '500': ...
```

---

## 5. 動作確認例

```bash
# OK: health（無認証）
curl -s http://localhost:3000/health | jq

# NG: 認証なし
curl -i "http://localhost:3000/search?q=test"

# OK: 認証あり
curl -s "http://localhost:3000/search?q=test" \
  -H "x-yuihub-token: $API_TOKEN" | jq

# 保存（201 Created）
curl -s -X POST http://localhost:3000/save \
  -H "Content-Type: application/json" \
  -H "x-yuihub-token: $API_TOKEN" \
  -d '{
    "frontmatter": { "topic": "PoC token test", "actors":["chatgpt"], "tags":["poc"] },
    "body": "# test\nok"
  }' | jq
```

---

## 6. VS Code Tasks（任意）

```json
{
  "label": "YuiHub: API (dev)",
  "type": "shell",
  "command": "node yuihub_api/src/server.js",
  "options": {
    "env": { "API_TOKEN": "${env:API_TOKEN}", "ALLOWED_ORIGINS": "*" }
  },
  "problemMatcher": []
}
```

---

## 7. DoD（受け入れ条件）

* `/health` は無認証で成功
* `/save` `/search` `/recent` は:

  * 正しいトークン → 成功
  * 欠如 → 401
  * 誤り → 403
* OpenAPI に `ApiKeyAuth` が定義済み
* CORS で `x-yuihub-token` が許可されている
* 任意: レート制御で過負荷時に 429 が返る

---

## 8. コミット粒度

1. `feat(api): add API token guard and CORS`
2. `docs(api): openapi add ApiKeyAuth and status codes`
3. `chore: add .env.example and curl examples`
4. （任意）`feat(api): add rate limit for public tunnel`

```
