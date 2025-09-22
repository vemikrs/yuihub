# 実装GAP監査レポート - YuiHub Ph2b

## 1. APIギャップ表（HTTP）

| Endpoint | 期待仕様(OpenAPI) | 実装（関数名/ファイル:行） | 入力/出力差分 | ステータスコード差分 | 優先度 |
|----------|------------------|-------------------------|--------------|-------------------|---------|
| `POST /save` | InputMessage→RecordEntry | `server.js:50-71` | 入力:`frontmatter`/`body`形式、出力:`{ok,data,timestamp}` | 200のみ（400/500エラー未定義） | **P1** |
| `GET /search` | query params(q,tag,thread) | `server.js:73-97` | `tag`/`thread`フィルタ**未実装**、`q`のみ対応 | 200/500のみ | **P1** |
| `POST /trigger` | AgentTrigger→{ok,ref} | **未実装** | エンドポイント自体が存在しない | - | **P1** |
| `GET /recent` | 仕様外だが存在 | `server.js:99-127` | 決定事項フィルタ付き（`n`パラメータ） | - | P3 |
| `GET /health` | 仕様外だが存在 | `server.js:42-44` | `{ok:true,timestamp}` | - | P3 |

## 2. MCPギャップ表

| Tool | 期待仕様（name/args/returns） | 実装（ファイル:行） | 差分 | 優先度 |
|------|---------------------------|------------------|------|---------|
| `save_note` | InputMessage準拠の引数 | `yuihub_mcp/src/server.js:50-92` | 引数:`frontmatter`/`body`形式、`InputMessage`非準拠 | **P1** |
| `search_notes` | query,tag,thread対応 | `yuihub_mcp/src/server.js:94-128` | `query`/`limit`のみ、tag/thread**未対応** | **P1** |
| `get_recent_decisions` | 仕様外 | `yuihub_mcp/src/server.js:130-163` | Step2仕様に存在しない | P3 |
| `trigger_agent` | AgentTrigger対応 | **未実装** | MCPツール自体が存在しない | **P1** |

## 3. I/Oスキーマ適合性チェック

| Artifact | 期待（00_min-spec） | 実装の実際 | 差分 | 影響度 |
|----------|------------------|-----------|------|--------|
| InputMessage | `{id,when,source,author,text,tags,thread,meta}` | `storage.js:27-56`で`frontmatter`/`body`分離形式 | 必須フィールド(`source`,`author`)が任意扱い | **High** |
| RecordEntry | `{id,when,thread,source,text,terms,tags,links}` | `storage.js:36`で`{...frontmatter,body}`形式 | `terms`/`links`が生成されない、形式不一致 | **High** |
| AgentTrigger | `{id,when,type,payload,reply_to}` | **未実装** | エンドポイントなし | **High** |
| ID形式 | ULID想定 | `storage.js:38`で`ulid()`使用 | ✓適合 | Low |
| when形式 | ISO8601 | `storage.js:39`で`new Date().toISOString()` | ✓適合 | Low |

## 4. 検索ロジック／日本語処理ギャップ

| 論点 | 実装（text-ja.js等:行） | 期待（01_technical-design） | GAP | テスト示唆 |
|------|----------------------|------------------------|-----|----------|
| 日本語トークン化 | `text-ja.js:42-78`文字種2+抽出 | 形態素解析の代替として明記 | ✓概ね適合 | `"結の思想"→["結","思想"]` |
| ストップワード | `text-ja.js:10-36`60語定義済み | 最小セット案と差異 | 実装の方が充実 | - |
| AND/OR既定 | `search.js:47-48`Lunr.jsデフォルト（OR） | AND想定の可能性 | **OR動作、仕様未明確** | `"思想 設計"`→両方含むか片方か |
| tag/threadフィルタ | **未実装** | フィルタ必須（OpenAPI定義） | **完全欠落** | `?tag=flow`→該当のみ返却 |
| terms生成 | `build_terms.mjs:93-108`バッチ処理のみ | リアルタイム生成想定 | **保存時の自動生成なし** | `/save`→`terms`フィールド生成 |

## 5. セキュリティ＆運用ギャップ

| 項目 | 実装 | 期待 | GAP | 優先度 |
|------|------|------|-----|---------|
| AUTH_TOKEN検証 | `server.js:34-40`Bearer Token実装済み | Bearer Token方式 | ✓適合（ただし全エンドポイント一律） | Low |
| Rate Limit | **未実装** | 最小レート制限 | 完全欠落 | P2 |
| ログPIIマスク | **未実装** | 個人情報マスキング | ログに生データ出力 | P2 |
| 環境変数管理 | `config.js:3-14`dotenv使用 | 外だし管理 | ✓適合 | Low |
| エラーハンドリング | `server.js:60-70`try-catch最小 | 構造化エラー | エラーコード体系なし | P2 |

## 6. 即時パッチ提案（最小差分）

### パッチ1: `/search`にtag/threadフィルタ追加

````javascript
// ...existing code... (line 73-97)
fastify.get('/search', async (request, reply) => {
  try {
    const { q, tag, thread, limit = 10 } = request.query;
    let results = await searchService.search(q, limit);
    
    // 新規追加: フィルタリング
    if (tag) {
      results = results.filter(r => r.tags?.includes(tag));
    }
    if (thread) {
      results = results.filter(r => r.thread === thread);
    }
    
    return { ok: true, data: results, timestamp: new Date().toISOString() };
  } catch (error) {
    // ...existing code...
  }
});
````
**影響テスト**: `curl "localhost:3000/search?q=test&tag=flow"` → flow タグのみ返却確認

### パッチ2: `/trigger`エンドポイント追加（Echo実装）

````javascript
// ...existing code... (after line 127)
fastify.post('/trigger', async (request, reply) => {
  try {
    const { id, when, type, payload, reply_to } = request.body;
    
    // 最小Echo実装
    fastify.log.info({ trigger: { id, type, payload } }, 'Agent trigger received');
    
    return { 
      ok: true, 
      ref: `echo-${id}`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    reply.code(500);
    return { ok: false, error: error.message };
  }
});
````
**影響テスト**: `curl -X POST localhost:3000/trigger -H "Content-Type: application/json" -d '{"id":"test","type":"echo","payload":{}}'`

### パッチ3: 保存時のterms自動生成

````javascript
// ...existing code... (line 27-56)
import { TokenizerJa } from './text-ja.js';

async save(frontmatter, body) {
  // ...existing code... (line 36-45)
  
  // 新規追加: terms生成
  const tokenizer = new TokenizerJa();
  const terms = tokenizer.tokenize(body);
  
  const document = {
    ...enrichedFrontmatter,
    body,
    terms: [...new Set(terms.slice(0, 20))]  // 上位20語
  };
  
  // ...existing code...
}
````
**影響テスト**: `/save`後に返却データの`terms`フィールド存在確認

---

**結論**: 主要GAPは **1) `/trigger`未実装**、**2) tag/threadフィルタ欠落**、**3) I/Oスキーマ不整合** の3点。P1項目の修正で最小MSC達成可能。
