# YuiHub PoC Ph2b Step3: 統合実装計画書

**作成日**: 2024-09-24  
**対象**: YuiHub Min Bundle PoC Ph2b  
**目標**: GPTs⇄Copilot 橋渡しコア機能実装  
**制約**: Shelter Mode 完全遵守

---

## 🎯 実装目標と非目標

**✅ やること（目標）**:
- GPTs → YuiHub → Copilot の手動橋渡し機能実装
- YuiFlowスキーマ完全準拠
- Context Packet生成によるCopilot投入準備
- Agent Trigger記録（Shelter mode）

**❌ やらないこと（非目標）**:
- YuiHub⇄Copilot 完全自動化
- 外部API自動実行（手作業でCopilotに投入）
- Signal mode実装（将来Phase）

---

## 📊 GAP分析サマリー

### 1. **API実装のGAP**

| 項目 | 期待仕様 | 現状 | GAP | 優先度 |
|------|----------|------|-----|---------|
| **スキーマ検証** | YuiFlow準拠のzod検証 | 検証なし | server.js に検証層なし | **P1** |
| **データ形式** | InputMessage/Fragment/Knot/Thread | 独自形式 | YuiFlow語彙未実装 | **P1** |
| **トリガー機能** | `/trigger` エンドポイント | 未実装 | Agent連携不可 | **P1** |
| **OpenAPI整合** | poc.yaml 準拠 | 旧仕様 | スキーマ不一致 | **P1** |
| **Context Packet** | 翻訳層の実装 | 未実装 | GPTs⇄Copilot橋渡し不可 | **P2** |

### 2. **MCP実装のGAP**

| 項目 | 期待仕様 | 現状 | GAP | 優先度 |
|------|----------|------|-----|---------|
| **save_note引数** | InputMessage準拠 | frontmatter/body形式 | `yuihub_mcp/src/server.js:50-92` 非準拠 | **P1** |
| **search_notes** | query/tag/thread対応 | queryのみ | tag/thread検索不可 | **P1** |
| **trigger_agent** | Agent起動Tool | 未実装 | Agent連携不可 | **P1** |

## 🎯 統合実装アプローチ

### 実装戦略
1. **GAP優先解消**: P1（必須）項目を優先実装
2. **段階的統合**: Phase A→B→Cの順次実装
3. **品質優先**: Shelter Mode制約と検証を徹底
4. **手動橋渡し**: 自動化せず、確実な疎通を優先

### 成功条件 (DoD)
```bash
# 1. YuiFlowスキーマ準拠保存
curl -X POST http://localhost:3000/save -d '{"id":"msg-001","when":"2024-09-24T10:00:00+09:00","source":"gpts","thread":"th-001","author":"user","text":"test"}'
# → 200 OK

# 2. Agent trigger記録
curl -X POST http://localhost:3000/trigger -d '{"type":"echo","payload":{"text":"hello"},"reply_to":"th-001"}'
# → 200 OK (shelter mode: recorded only)

# 3. Context Packet生成
curl http://localhost:3000/export/context/th-001
# → JSON Context Packet

# 4. Copilot用Markdown出力
curl http://localhost:3000/export/markdown/th-001
# → Human-readable thread history
```

---

### **Phase A: スキーマ準拠（2日）**

## 📋 統合実装計画：Phase A-C

### **Phase A: スキーマ準拠実装（2日）** ⚡ P1

**目標**: YuiFlow完全準拠とAPI検証層実装  
**対応GAP**: スキーマ検証、データ形式、save_note引数

#### A-1: YuiFlow型定義実装
**ファイル**: `yuihub_api/src/schemas/yuiflow.js` (新規作成)

```javascript
import { z } from 'zod';

// Fragment定義（最小保存単位）
export const FragmentSchema = z.object({
  id: z.string().regex(/^msg-/, 'ID must start with "msg-"'),
  when: z.string().datetime('Invalid ISO datetime format'),
  source: z.enum(['gpts', 'copilot', 'claude', 'human'], {
    errorMap: () => ({ message: 'Source must be one of: gpts, copilot, claude, human' })
  }),
  thread: z.string().regex(/^th-/, 'Thread ID must start with "th-"'),
  author: z.string().min(1, 'Author is required'),
  text: z.string().min(1, 'Text content is required'),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.any()).optional()
});

// Knot定義（要点束）
export const KnotSchema = z.object({
  id: z.string().regex(/^knot-/, 'Knot ID must start with "knot-"'),
  title: z.string().min(1, 'Title is required'),
  fragments: z.array(z.string()).min(1, 'At least one fragment required'),
  summary: z.string().optional(),
  decision: z.enum(['採用', '保留', '却下']).optional(),
  created_at: z.string().datetime().optional()
});

// Context Packet（橋渡し層）
export const ContextPacketSchema = z.object({
  version: z.literal('1.0.0'),
  intent: z.string().min(1, 'Intent is required'),
  fragments: z.array(FragmentSchema),
  knots: z.array(KnotSchema).optional().default([]),
  thread: z.string().regex(/^th-/, 'Thread ID must start with "th-"'),
  created_at: z.string().datetime().default(() => new Date().toISOString())
});

// Agent Trigger Schema
export const AgentTriggerSchema = z.object({
  id: z.string().regex(/^trg-/, 'Trigger ID must start with "trg-"').optional(),
  when: z.string().datetime().optional(),
  type: z.enum(['echo', 'summarize', 'analyze', 'code_review', 'custom']),
  payload: z.record(z.any()),
  reply_to: z.string().regex(/^th-/, 'reply_to must be a thread ID')
});

export default {
  FragmentSchema,
  KnotSchema,
  ContextPacketSchema,
  AgentTriggerSchema
};
```

#### A-2: API検証層実装
**ファイル**: `yuihub_api/src/server.js` の `/save` エンドポイント修正

```javascript
// 追加する import (ファイル先頭に)
import { FragmentSchema } from './schemas/yuiflow.js';

// 既存の POST /save を以下に置き換え（GAP解消）
fastify.post('/save', async (request, reply) => {
  try {
    // YuiFlowスキーマ検証（GAP対応）
    const validated = FragmentSchema.parse(request.body);
    
    // Front-Matter変換
    const frontmatter = {
      id: validated.id,
      when: validated.when,
      source: validated.source,
      thread: validated.thread,
      author: validated.author,
      tags: validated.tags || [],
      visibility: 'private', // Shelter mode default
      external_io: 'blocked',
      metadata: validated.metadata || {}
    };
    
    // 保存処理
    const result = await storage.save({
      frontmatter,
      body: validated.text
    });
    
    return { success: true, id: result.id, saved_at: new Date().toISOString() };
  } catch (error) {
    if (error.name === 'ZodError') {
      fastify.log.warn('Schema validation failed:', error.errors);
      return reply.code(400).send({ 
        error: 'Invalid schema', 
        details: error.errors,
        expected_format: 'YuiFlow Fragment Schema'
      });
    }
    fastify.log.error('Save operation failed:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});
```

**成果物**: 
- ✅ YuiFlow Fragment Schema完全準拠
- ✅ エラーハンドリング強化
- ✅ Shelter mode default設定

---

### **Phase B: コア機能実装（3日）** ⚡ P1

**目標**: Agent Trigger機能とMCP Tools準拠実装  
**対応GAP**: トリガー機能、OpenAPI整合、search_notes、trigger_agent

#### B-1: トリガーエンドポイント実装
**ファイル**: `yuihub_api/src/server.js` に追加（GAP解消）

```javascript
// 追加する import
import { AgentTriggerSchema } from './schemas/yuiflow.js';
import { randomUUID } from 'crypto';

// POST /trigger エンドポイント追加（未実装GAP対応）
fastify.post('/trigger', async (request, reply) => {
  try {
    const validated = AgentTriggerSchema.parse(request.body);
    const triggerId = validated.id || `trg-${Date.now()}-${randomUUID().substring(0, 8)}`;
    const timestamp = validated.when || new Date().toISOString();
    
    // Shelter modeでは実行をシミュレート（制約遵守）
    if (process.env.MODE === 'shelter' && process.env.EXTERNAL_IO === 'blocked') {
      // トリガー記録のみ保存
      const record = {
        frontmatter: {
          id: triggerId,
          when: timestamp,
          source: 'system',
          type: 'agent_trigger',
          trigger_type: validated.type,
          thread: validated.reply_to,
          external_io: 'blocked',
          status: 'simulated',
          tags: ['agent_trigger', 'shelter_mode']
        },
        body: `## Agent Trigger (Shelter Mode)

**Type**: ${validated.type}  
**Thread**: ${validated.reply_to}  
**Timestamp**: ${timestamp}

### Payload
\`\`\`json
${JSON.stringify(validated.payload, null, 2)}
\`\`\`

### Status
- ✅ Trigger received and validated
- ⚠️ **SIMULATED** (not executed due to shelter mode)
- 📝 Record saved for audit trail

### Next Steps (Manual)
1. Export context packet for thread: ${validated.reply_to}
2. Feed to Copilot manually
3. Save Copilot response with source='copilot'`
      };
      
      await storage.save(record);
      return { 
        success: true, 
        id: triggerId,
        mode: 'shelter',
        message: 'Trigger recorded but not executed',
        export_url: `/export/context/${validated.reply_to}`
      };
    }
    
    // Signal modeでの実行（将来実装）
    return reply.code(501).send({ 
      error: 'Agent execution not implemented',
      message: 'Set EXTERNAL_IO=unsafe to enable agent execution'
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return reply.code(400).send({ 
        error: 'Invalid trigger schema', 
        details: error.errors 
      });
    }
    fastify.log.error('Trigger operation failed:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});
```

#### B-2: MCP Tools更新
**ファイル**: `yuihub_mcp/src/server.js` 修正（GAP解消）

```javascript
// tools配列の save_note を以下に置き換え（InputMessage準拠GAP対応）
{
  name: "save_note",
  description: "Save a message fragment to YuiHub using YuiFlow schema",
  inputSchema: {
    type: "object",
    properties: {
      id: { 
        type: "string", 
        pattern: "^msg-",
        description: "Fragment ID starting with 'msg-'" 
      },
      when: { 
        type: "string", 
        format: "date-time",
        description: "ISO datetime when message was created" 
      },
      source: { 
        type: "string", 
        enum: ["gpts", "copilot", "claude", "human"],
        description: "Source of the message" 
      },
      thread: { 
        type: "string", 
        pattern: "^th-",
        description: "Thread ID starting with 'th-'" 
      },
      author: { 
        type: "string",
        description: "Author of the message" 
      },
      text: { 
        type: "string",
        description: "Message content" 
      },
      tags: { 
        type: "array", 
        items: { type: "string" },
        description: "Optional tags for categorization"
      },
      metadata: {
        type: "object",
        description: "Optional metadata object"
      }
    },
    required: ["id", "when", "source", "thread", "author", "text"]
  }
}

// search_notes を以下に置き換え（tag/thread対応GAP解消）
{
  name: "search_notes",
  description: "Search messages with filters",
  inputSchema: {
    type: "object",
    properties: {
      query: { 
        type: "string",
        description: "Text search query" 
      },
      tag: { 
        type: "string",
        description: "Filter by specific tag" 
      },
      thread: { 
        type: "string",
        description: "Filter by thread ID" 
      },
      source: {
        type: "string",
        enum: ["gpts", "copilot", "claude", "human"],
        description: "Filter by message source"
      },
      author: {
        type: "string",
        description: "Filter by author"
      },
      limit: { 
        type: "number", 
        default: 10,
        minimum: 1,
        maximum: 100,
        description: "Maximum results to return"
      }
    }
  }
}

// 新規 trigger_agent tool追加（未実装GAP対応）
{
  name: "trigger_agent",
  description: "Trigger an AI agent action (Shelter mode: records only)",
  inputSchema: {
    type: "object",
    properties: {
      type: { 
        type: "string",
        enum: ["echo", "summarize", "analyze", "code_review", "custom"],
        description: "Type of agent action to trigger"
      },
      payload: { 
        type: "object",
        description: "Action-specific parameters"
      },
      reply_to: { 
        type: "string",
        pattern: "^th-",
        description: "Thread to reply to"
      }
    },
    required: ["type", "payload", "reply_to"]
  }
}
```

**成果物**:
- ✅ MCP Tools YuiFlow完全準拠
- ✅ tag/thread検索対応
- ✅ Agent trigger tool実装

---

### **Phase C: 橋渡し機能実装（2日）** ⚡ P2

**目標**: Context Packet生成とCopilot橋渡し準備  
**対応GAP**: Context Packet未実装、GPTs⇄Copilot橋渡し不可

#### C-1: Context Builder実装
**ファイル**: `yuihub_api/src/context-builder.js` (新規作成)

```javascript
import { ContextPacketSchema, KnotSchema } from './schemas/yuiflow.js';

export class ContextBuilder {
  constructor(storage, logger) {
    this.storage = storage;
    this.log = logger;
  }
  
  async buildPacket(thread, intent = 'copilot_handoff') {
    try {
      // スレッドのFragment収集
      const rawMessages = await this.storage.search({ 
        thread, 
        limit: 1000 
      });
      
      // YuiFlow Fragment形式に変換（GAP対応）
      const fragments = rawMessages.map(msg => ({
        id: msg.frontmatter.id,
        when: msg.frontmatter.when,
        source: msg.frontmatter.source,
        thread: msg.frontmatter.thread,
        author: msg.frontmatter.author,
        text: msg.body,
        tags: msg.frontmatter.tags || [],
        metadata: msg.frontmatter.metadata || {}
      }));
      
      // Knot抽出（要点化）
      const knots = await this.extractKnots(fragments);
      
      // Context Packet生成（橋渡し層実装）
      const packet = {
        version: '1.0.0',
        intent,
        fragments,
        knots,
        thread,
        created_at: new Date().toISOString()
      };
      
      return ContextPacketSchema.parse(packet);
    } catch (error) {
      this.log.error(`Failed to build context packet for thread ${thread}:`, error);
      throw error;
    }
  }
  
  async extractKnots(fragments) {
    const knots = [];
    const chunkSize = 5; // 5メッセージごとに要点化
    
    for (let i = 0; i < fragments.length; i += chunkSize) {
      const chunk = fragments.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;
      
      const knot = {
        id: `knot-${Date.now()}-${Math.floor(i / chunkSize)}`,
        title: `要点 ${Math.floor(i / chunkSize) + 1} (${chunk[0].when.substring(0, 10)})`,
        fragments: chunk.map(f => f.id),
        summary: this.generateSummary(chunk),
        created_at: new Date().toISOString()
      };
      
      knots.push(KnotSchema.parse(knot));
    }
    
    return knots;
  }
  
  generateSummary(fragmentChunk) {
    // 簡易要約（各Fragmentの冒頭50文字を結合）
    const previews = fragmentChunk.map(f => {
      const text = f.text.replace(/\n/g, ' ').substring(0, 50);
      return `[${f.author}] ${text}${f.text.length > 50 ? '...' : ''}`;
    });
    
    return previews.join(' | ');
  }
}

export default ContextBuilder;
```

#### C-2: Export機能実装
**ファイル**: `yuihub_api/src/server.js` に追加

```javascript
// 追加する import
import ContextBuilder from './context-builder.js';

// Context Builder初期化（サーバー起動後に）
const contextBuilder = new ContextBuilder(storage, fastify.log);

// Context Packet エクスポート（GPTs⇄Copilot橋渡しGAP対応）
fastify.get('/export/context/:thread', async (request, reply) => {
  try {
    const { thread } = request.params;
    const packet = await contextBuilder.buildPacket(thread, 'copilot_handoff');
    
    reply.type('application/json');
    reply.header('Content-Disposition', `attachment; filename="${thread}-context.json"`);
    return packet;
  } catch (error) {
    fastify.log.error(`Export failed for thread ${request.params.thread}:`, error);
    return reply.code(500).send({ error: 'Export failed' });
  }
});

// Copilot用マークダウン生成（手動橋渡し準備）
fastify.get('/export/markdown/:thread', async (request, reply) => {
  try {
    const { thread } = request.params;
    const packet = await contextBuilder.buildPacket(thread, 'copilot_markdown');
    
    let markdown = `# Thread: ${thread}\n\n`;
    markdown += `**Generated**: ${packet.created_at}  \n`;
    markdown += `**Intent**: ${packet.intent}  \n`;
    markdown += `**Total Fragments**: ${packet.fragments.length}  \n`;
    markdown += `**Total Knots**: ${packet.knots.length}  \n\n`;
    
    // Knots（要点）セクション
    if (packet.knots.length > 0) {
      markdown += `## 📎 要点 (Knots)\n\n`;
      for (const knot of packet.knots) {
        markdown += `### ${knot.title}\n`;
        markdown += `**Summary**: ${knot.summary}\n`;
        markdown += `**Fragments**: ${knot.fragments.join(', ')}\n\n`;
      }
      markdown += `---\n\n`;
    }
    
    // Fragments（詳細）セクション
    markdown += `## 💬 メッセージ履歴 (Fragments)\n\n`;
    for (const frag of packet.fragments) {
      markdown += `### ${frag.when} - ${frag.author}\n`;
      markdown += `**Source**: ${frag.source} | **Thread**: ${frag.thread}\n`;
      markdown += `**Tags**: ${frag.tags.join(', ') || 'none'}\n\n`;
      markdown += `${frag.text}\n\n`;
      markdown += `---\n\n`;
    }
    
    reply.type('text/markdown');
    reply.header('Content-Disposition', `attachment; filename="${thread}.md"`);
    return markdown;
  } catch (error) {
    fastify.log.error(`Markdown export failed for thread ${request.params.thread}:`, error);
    return reply.code(500).send({ error: 'Markdown export failed' });
  }
});

// Thread一覧取得（管理機能）
fastify.get('/threads', async (request, reply) => {
  try {
    const messages = await storage.search({ limit: 1000 });
    const threads = {};
    
    messages.forEach(msg => {
      const threadId = msg.frontmatter.thread;
      if (!threads[threadId]) {
        threads[threadId] = {
          id: threadId,
          first_message: msg.frontmatter.when,
          last_message: msg.frontmatter.when,
          count: 0,
          authors: new Set(),
          sources: new Set()
        };
      }
      
      threads[threadId].count++;
      threads[threadId].authors.add(msg.frontmatter.author);
      threads[threadId].sources.add(msg.frontmatter.source);
      
      if (msg.frontmatter.when > threads[threadId].last_message) {
        threads[threadId].last_message = msg.frontmatter.when;
      }
    });
    
    // Set を配列に変換
    Object.values(threads).forEach(thread => {
      thread.authors = Array.from(thread.authors);
      thread.sources = Array.from(thread.sources);
    });
    
    return Object.values(threads).sort((a, b) => 
      new Date(b.last_message) - new Date(a.last_message)
    );
  } catch (error) {
    fastify.log.error('Thread listing failed:', error);
    return reply.code(500).send({ error: 'Thread listing failed' });
  }
});
```

**成果物**:
- ✅ Context Packet JSON出力
- ✅ Copilot用Markdown出力
- ✅ Thread管理機能
- ✅ GPTs⇄Copilot手動橋渡し準備完了

---

## 📅 統合実装スケジュール

| Phase | 期間 | GAP対応項目 | 実装内容 | 成果物 |
|-------|------|-------------|----------|--------|
| **A** | 2日 | スキーマ検証、データ形式、save_note引数 | YuiFlow型定義、API検証層 | Fragment Schema準拠、エラーハンドリング |
| **B** | 3日 | トリガー機能、OpenAPI整合、search_notes、trigger_agent | /trigger実装、MCP Tools更新 | Agent連携、MCP準拠、監査ログ |
| **C** | 2日 | Context Packet、GPTs⇄Copilot橋渡し | Context Builder、Export機能 | 橋渡し準備完了、手動フロー確立 |

### 実装優先度マトリクス

| 優先度 | 実装項目 | 理由 | ブロッカー |
|--------|----------|------|-----------|
| **P1** | YuiFlow Schema | 全API基盤 | zod導入必須 |
| **P1** | /save検証層 | GPTs保存必須 | Schema完了後 |
| **P1** | /trigger実装 | Agent連携必須 | Schema完了後 |
| **P1** | MCP Tools更新 | Protocol準拠必須 | HTTP API完了後 |
| **P2** | Context Builder | 橋渡し準備 | P1完了後 |
| **P2** | Export機能 | Copilot投入準備 | Context Builder後 |

---

## ✅ 統合DoD（完了条件）

### MSC（必須条件）- 全GAP解消
- [ ] **YuiFlow Schema完全準拠**: Fragment/Knot/ContextPacket/AgentTrigger
- [ ] **GPTs → YuiHub保存**: YuiFlowスキーマでの保存成功
- [ ] **YuiHub → Agent Trigger**: 記録機能動作（Shelter mode）
- [ ] **Thread → Context Packet**: 生成・出力成功
- [ ] **Copilot用Markdown**: 手動投入準備完了
- [ ] **MCP Tools準拠**: save_note/search_notes/trigger_agent YuiFlow対応

### FSC（推奨条件）
- [ ] **高度検索**: tag/thread/source/author フィルタ完全動作
- [ ] **Knot自動抽出**: 要約精度向上
- [ ] **パフォーマンス**: 1000件処理＜2秒
- [ ] **エラー処理**: 全エンドポイント適切なHTTPコード
- [ ] **監査証跡**: 全操作のログ記録

### 動作確認手順
```bash
# 環境準備
cd yuihub_api && npm install zod
npm run dev:api

# 1. YuiFlowスキーマ準拠保存テスト
curl -X POST http://localhost:3000/save \
  -H "Content-Type: application/json" \
  -d '{
    "id": "msg-test-001",
    "when": "2024-09-24T10:00:00+09:00",
    "source": "gpts",
    "thread": "th-test-claude",
    "author": "ChatGPT",
    "text": "YuiFlowスキーマテスト",
    "tags": ["test", "schema"]
  }'
# 期待結果: {"success":true,"id":"msg-test-001","saved_at":"..."}

# 2. Agent Triggerテスト
curl -X POST http://localhost:3000/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "type": "summarize",
    "payload": {"focus": "key_points"},
    "reply_to": "th-test-claude"
  }'
# 期待結果: {"success":true,"mode":"shelter","message":"Trigger recorded...","export_url":"..."}

# 3. Context Packet出力
curl http://localhost:3000/export/context/th-test-claude
# 期待結果: JSON Context Packet

# 4. Copilot用Markdown出力
curl http://localhost:3000/export/markdown/th-test-claude
# 期待結果: Markdown formatted thread

# 5. Thread一覧確認
curl http://localhost:3000/threads
# 期待結果: Thread summary list
```

---

## 🚀 即時アクション計画

### Step 1: 環境準備（5分）
```bash
# 依存関係導入
cd yuihub_api && npm install zod

# ディレクトリ構造準備
mkdir -p yuihub_api/src/schemas
mkdir -p yuihub_api/tests

# テンプレートファイル作成
touch yuihub_api/src/schemas/yuiflow.js
touch yuihub_api/src/context-builder.js
touch yuihub_api/tests/schema.test.js
```

### Step 2: 実装検証（各Phase後）
```bash
# Phase A完了後
npm run dev:api
curl -X POST http://localhost:3000/save -d '{"id":"msg-001","when":"2024-09-24T10:00:00+09:00","source":"gpts","thread":"th-001","author":"test","text":"test"}'

# Phase B完了後
curl -X POST http://localhost:3000/trigger -d '{"type":"echo","payload":{"text":"test"},"reply_to":"th-001"}'

# Phase C完了後
curl http://localhost:3000/export/context/th-001
curl http://localhost:3000/export/markdown/th-001
```

### Step 3: GAP検証（最終確認）
```bash
# 全GAP項目の動作確認
bash tests/smoke/run-all-tests.sh
npm run test:contract  # スキーマ検証
npm run test:api:compat  # I/O互換性
```

---

## 📋 Claude Code移譲チェックリスト

### 事前準備完了
- [x] **GAP分析完了**: 全未実装項目の特定
- [x] **統合実装計画策定**: Phase A-C詳細化
- [x] **成功条件明確化**: MSC/FSC定義
- [x] **技術制約整理**: Shelter Mode制約
- [x] **実装指示書作成**: `CLAUDE_CODE_INSTRUCTIONS.md`

### 移譲時提供資料
1. **本統合実装計画書** (`docs/logdocs/250924A_Ph2b-S3_IMPLEMENTATION_PLAN.md`)
2. **詳細実装指示書** (`CLAUDE_CODE_INSTRUCTIONS.md`)
3. **プロジェクトガイド** (`AGENT.md`)
4. **実装計画書** (`IMPLEMENTATION_PLAN.md`)
5. **技術仕様** (`docs/yuiflow/**`)
6. **現在のコードベース** (`yuihub_api/`, `yuihub_mcp/`)

### Claude Code確認事項
- [x] **GAP分析**: 8つの主要GAPの認識
- [x] **Phase依存関係**: A→B→Cの実装順序
- [x] **Shelter Mode制約**: 外部IO遮断の徹底
- [x] **YuiFlow語彙**: Fragment/Knot/Thread/ContextPacketの咀嚼
- [x] **手動橋渡し**: 自動化しない方針の確認

---

## 🎯 最終成果物

この統合実装により、以下の手動橋渡しフローが確立されます：

```
1. GPTs → YuiHub
   POST /save (YuiFlow Fragment Schema)
   
2. YuiHub → Context Packet
   GET /export/context/:thread
   GET /export/markdown/:thread
   
3. Context Packet → Copilot
   [手動] Markdownを Copilot に投入
   
4. Copilot → YuiHub  
   POST /save (source='copilot')
```

**これにより、GAP完全解消とGPTs⇄Copilot橋渡しコア機能の実装が完了します。**

---

## 🔮 将来Phase（VS Code Extension統合）の整合性検証

### Ph3（将来）統合計画との整合性 ✅ **完全互換**

**Ph2b（現在実装）** と **Ph3（VS Code Extension統合）** の疎通パス比較：

```
Ph2b（手動橋渡し）:
GPTs → YuiHub API → Context Packet → [手動コピー] → Copilot Chat

Ph3（自動統合）:
GPTs → YuiHub API → Context Packet → VS Code Extension → Copilot Chat
                                            ↑
                                     新規追加レイヤー
```

**結論**: 現在の HTTP API + Context Packet 設計は**そのまま活用可能**

### 🔧 Ph3準備のためのミニマム仕込み（今回実装に含める）

#### 1. **VS Code Extension互換エンドポイント追加** ⚡ P2
**ファイル**: `yuihub_api/src/server.js` に追加

```javascript
// VS Code Extension用エンドポイント群（将来準備）
// GET /vscode/threads - VS Code Extension用Thread一覧
fastify.get('/vscode/threads', async (request, reply) => {
  try {
    const threads = await contextBuilder.getThreadSummary();
    return {
      threads: threads.map(t => ({
        id: t.id,
        title: t.title || `Thread ${t.id}`,
        lastActivity: t.last_message,
        messageCount: t.count,
        participants: t.authors,
        hasContext: t.count > 0
      }))
    };
  } catch (error) {
    fastify.log.error('VS Code threads listing failed:', error);
    return reply.code(500).send({ error: 'Thread listing failed' });
  }
});

// GET /vscode/context/:thread/compact - VS Code Extension用コンパクト形式
fastify.get('/vscode/context/:thread/compact', async (request, reply) => {
  try {
    const { thread } = request.params;
    const packet = await contextBuilder.buildPacket(thread, 'vscode_extension');
    
    // VS Code Extension用にコンパクト化
    const compact = {
      thread: packet.thread,
      intent: packet.intent,
      summary: packet.knots.map(k => k.summary).join('\n'),
      recentMessages: packet.fragments.slice(-5).map(f => ({
        author: f.author,
        text: f.text.substring(0, 200),
        timestamp: f.when
      })),
      contextUrl: `/export/markdown/${thread}`
    };
    
    return compact;
  } catch (error) {
    fastify.log.error(`VS Code compact export failed for thread ${request.params.thread}:`, error);
    return reply.code(500).send({ error: 'Compact export failed' });
  }
});

// POST /vscode/copilot/context - VS Code Extension用Copilot連携準備
fastify.post('/vscode/copilot/context', async (request, reply) => {
  try {
    const { thread, intent = 'copilot_integration' } = request.body;
    
    // Context Packet生成
    const packet = await contextBuilder.buildPacket(thread, intent);
    
    // VS Code Extension → Copilot Chat Participant 形式
    const copilotFormat = {
      type: 'context_handoff',
      metadata: {
        thread: packet.thread,
        fragmentCount: packet.fragments.length,
        knotCount: packet.knots.length,
        generatedAt: packet.created_at
      },
      context: {
        summary: packet.knots.map(k => `${k.title}: ${k.summary}`).join('\n\n'),
        conversation: packet.fragments.map(f => `[${f.author}@${f.when}]: ${f.text}`).join('\n\n')
      },
      instructions: {
        role: 'You are GitHub Copilot receiving context from YuiHub',
        task: 'Use this conversation context to assist with implementation',
        format: 'Maintain context awareness throughout the session'
      }
    };
    
    return copilotFormat;
  } catch (error) {
    fastify.log.error('VS Code Copilot integration failed:', error);
    return reply.code(500).send({ error: 'Copilot integration failed' });
  }
});
```

#### 2. **Context Builder拡張** - VS Code Extension対応
**ファイル**: `yuihub_api/src/context-builder.js` に追加

```javascript
export class ContextBuilder {
  // ...existing code...
  
  // VS Code Extension用Thread要約生成
  async getThreadSummary() {
    try {
      const messages = await this.storage.search({ limit: 1000 });
      const threads = {};
      
      messages.forEach(msg => {
        const threadId = msg.frontmatter.thread;
        if (!threads[threadId]) {
          threads[threadId] = {
            id: threadId,
            title: this.generateThreadTitle(msg),
            first_message: msg.frontmatter.when,
            last_message: msg.frontmatter.when,
            count: 0,
            authors: new Set(),
            sources: new Set(),
            tags: new Set()
          };
        }
        
        threads[threadId].count++;
        threads[threadId].authors.add(msg.frontmatter.author);
        threads[threadId].sources.add(msg.frontmatter.source);
        (msg.frontmatter.tags || []).forEach(tag => threads[threadId].tags.add(tag));
        
        if (msg.frontmatter.when > threads[threadId].last_message) {
          threads[threadId].last_message = msg.frontmatter.when;
        }
      });
      
      // Set を配列に変換
      return Object.values(threads).map(thread => ({
        ...thread,
        authors: Array.from(thread.authors),
        sources: Array.from(thread.sources),
        tags: Array.from(thread.tags)
      })).sort((a, b) => new Date(b.last_message) - new Date(a.last_message));
      
    } catch (error) {
      this.log.error('Thread summary generation failed:', error);
      throw error;
    }
  }
  
  // Thread title自動生成（VS Code Extension表示用）
  generateThreadTitle(firstMessage) {
    const text = firstMessage.body.replace(/\n/g, ' ').trim();
    const words = text.split(/\s+/).slice(0, 8).join(' ');
    return words.length > 0 ? `${words}...` : `Thread ${firstMessage.frontmatter.thread}`;
  }
  
  // ...existing code...
}
```

#### 3. **OpenAPI仕様更新** - VS Code Extension endpoints
**ファイル**: `docs/yuiflow/openapi/poc.yaml` または `yuihub_api/openapi.yml` に追加

```yaml
# VS Code Extension準備endpoints
/vscode/threads:
  get:
    summary: Get thread list for VS Code Extension
    tags: [vscode]
    responses:
      200:
        description: VS Code compatible thread list
        content:
          application/json:
            schema:
              type: object
              properties:
                threads:
                  type: array
                  items:
                    type: object
                    properties:
                      id: { type: string }
                      title: { type: string }
                      lastActivity: { type: string, format: date-time }
                      messageCount: { type: integer }
                      participants: { type: array, items: { type: string } }
                      hasContext: { type: boolean }

/vscode/context/{thread}/compact:
  get:
    summary: Get compact context for VS Code Extension
    tags: [vscode]
    parameters:
      - name: thread
        in: path
        required: true
        schema: { type: string }
    responses:
      200:
        description: Compact context format
        content:
          application/json:
            schema:
              type: object
              properties:
                thread: { type: string }
                intent: { type: string }
                summary: { type: string }
                recentMessages: { type: array }
                contextUrl: { type: string }
```

### 📋 Ph3準備実装の優先度・位置づけ

| 実装項目 | 優先度 | Phase配置 | 理由 |
|---------|--------|-----------|------|
| **VS Code endpoints** | P2 | Phase C後 | 現機能に影響なし・将来投資 |
| **Thread title生成** | P3 | 任意 | UX向上のみ |
| **OpenAPI拡張** | P2 | Phase C後 | 仕様整合性確保 |

**実装方針**: Phase A-C完了後の**追加実装**として位置づけ、現在のDoD達成を最優先とする。