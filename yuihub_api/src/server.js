import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ulid } from 'ulid';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { createStorageAdapter } from './storage.js';
import { SearchService } from './search.js';
import { EnhancedSearchService } from './enhanced-search.js';
import { IndexManager } from './index-manager.js';
import { ConfigManager } from './config.js';
import { ContextBuilder } from './context-builder.js';
import { 
  InputMessageSchema, 
  AgentTriggerSchema, 
  SearchQuerySchema,
  inputMessageToFragment,
  Validators 
} from './schemas/yuiflow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定管理初期化
const configManager = new ConfigManager();
const config = configManager.current;

// 設定検証
const validation = configManager.validate();
if (!validation.valid) {
  console.error('❌ Configuration validation failed:');
  validation.errors.forEach(error => console.error(`   - ${error}`));
  process.exit(1);
}

// 設定サマリー出力
console.log('🔧 YuiHub API Configuration:');
const summary = configManager.getSummary();
Object.entries(summary).forEach(([key, value]) => {
  console.log(`   ${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
});

// Tunnel integration - 設定に基づいて読み込み
let TunnelManager;
if (config.enableTunnel) {
  try {
    const { TunnelManager: TM } = await import('../../.cloudflare/tunnel-manager.js');
    TunnelManager = TM;
  } catch (error) {
    console.warn('⚠️  Tunnel integration failed to load:', error.message);
  }
}

// Fastify アプリケーション初期化
const app = Fastify({ 
  logger: configManager.getFastifyLogLevel(),
  requestIdHeader: 'x-request-id',
  requestTimeout: config.requestTimeout
});

// CORS設定
await app.register(cors, {
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-yuihub-token'],
});

// Rate limiting
await app.register(rateLimit, {
  max: config.rateLimitMax,
  timeWindow: config.rateLimitWindow,
  allowList: ['127.0.0.1', '::1']
});

// 認証ミドルウェア登録
const authMiddleware = configManager.createAuthMiddleware();
app.addHook('onRequest', authMiddleware);

// サービス初期化
const storageAdapter = createStorageAdapter();
const searchService = new EnhancedSearchService();

// ContextBuilder初期化
const contextBuilder = new ContextBuilder(storageAdapter, searchService);

// IndexManager初期化
const indexManager = new IndexManager({
  searchService: searchService,
  indexPath: config.lunrIndexPath,
  termsPath: config.termsIndexPath,
  statsPath: config.statsPath,
  dataRoot: config.dataRoot,
  logger: app.log
});

// Tunnel manager instance (if enabled)
let tunnelManager = null;

// 索引の初期化
const indexInitialized = await indexManager.initialize();
if (indexInitialized && config.termsIndexPath) {
  // 用語インデックスも読み込み
  await searchService.loadTermsIndex(config.termsIndexPath);
}

if (!indexInitialized && config.indexAutoRebuild) {
  app.log.info('🔄 Index missing, triggering rebuild...');
  indexManager.scheduleRebuild();
}

// === API ENDPOINTS ===

// Health check endpoint (enhanced)
app.get('/health', async (req, reply) => {
  const indexStatus = await indexManager.getStatus();
  
  return { 
    ok: true, 
    timestamp: new Date().toISOString(),
    environment: config.env,
    storage: storageAdapter.type,
    searchIndex: indexStatus.status,
    lastIndexBuild: indexStatus.lastBuildAt,
    auth: config.auth ? 'enabled' : 'disabled',
    version: process.env.npm_package_version || '1.0.0'
  };
});

// Index management endpoints
app.get('/index/status', async (req, reply) => {
  return await indexManager.getStatus();
});

app.post('/index/rebuild', async (req, reply) => {
  try {
    app.log.info('📚 Manual index rebuild requested');
    await indexManager.rebuild();
    return { 
      ok: true, 
      status: 'rebuilt', 
      timestamp: new Date().toISOString() 
    };
  } catch (error) {
    app.log.error('Index rebuild failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

app.post('/index/reload', async (req, reply) => {
  try {
    app.log.info('🔄 Manual index reload requested');
    const loaded = await indexManager.reload();
    return { 
      ok: loaded, 
      status: loaded ? 'reloaded' : 'failed',
      timestamp: new Date().toISOString() 
    };
  } catch (error) {
    app.log.error('Index reload failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

// OpenAPI schema endpoint for ChatGPT Actions
app.get('/openapi.yml', async (req, reply) => {
  try {
    const fs = await import('fs/promises');
    const schemaPath = path.join(__dirname, '../openapi.yml');
    app.log.info(`Attempting to load OpenAPI schema from: ${schemaPath}`);
    
    // Load and parse YAML
    const schemaFile = await fs.readFile(schemaPath, 'utf8');
    const schemaObj = yaml.load(schemaFile);
    
    // Dynamic server URL generation based on request headers
    const protocol = req.headers['x-forwarded-proto'] || 
                     (req.headers.host && req.headers.host.includes('.trycloudflare.com')) ? 'https' : 'http';
    const host = req.headers.host || 'localhost:3000';
    
    // Environment-specific server URL logic
    let serverUrl;
    let description;
    
    if (host.includes('localhost')) {
      serverUrl = 'http://localhost:3000';
      description = 'Local development server';
    } else if (host.includes('.trycloudflare.com')) {
      serverUrl = `https://${host}`;
      description = `Cloudflare Quick Tunnel (${host})`;
    } else if (process.env.TUNNEL_BASE_URL) {
      serverUrl = process.env.TUNNEL_BASE_URL;
      description = `Cloudflare Named Tunnel (${process.env.TUNNEL_BASE_URL})`;
    } else if (host.includes('poc-yuihub.vemi.jp')) {
      serverUrl = `https://${host}`;
      description = `YuiHub PoC (${host})`;
    } else if (host.includes('vemi.jp')) {
      serverUrl = `https://${host}`;
      description = `Cloudflare Named Tunnel (${host})`;
    } else {
      serverUrl = `${protocol}://${host}`;
      description = `Runtime server (${host})`;
    }
    
    // Update server info dynamically
    schemaObj.servers = [{ url: serverUrl, description }];
    schemaObj.info = schemaObj.info || {};
    schemaObj.info['x-generated-at'] = new Date().toISOString();
    
    reply.type('application/x-yaml');
    return yaml.dump(schemaObj);
    
  } catch (error) {
    app.log.error(`Failed to load OpenAPI schema: ${error.message}`);
    reply.code(500);
    return { ok: false, error: 'Failed to load OpenAPI schema', details: error.message };
  }
});

// Save note endpoint (YuiFlow InputMessage format)
app.post('/save', async (req, reply) => {
  try {
    // Validate InputMessage schema
    const validationResult = Validators.inputMessage(req.body);
    
    if (!validationResult.success) {
      reply.code(400);
      return { 
        ok: false, 
        error: 'Invalid InputMessage format', 
        details: validationResult.error.errors ? validationResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        })) : [{ field: 'unknown', message: validationResult.error.message || 'Validation failed' }]
      };
    }
    
    const inputMessage = validationResult.data;
    
    // Convert InputMessage to Fragment format for storage
    const fragment = inputMessageToFragment(inputMessage);
    
    app.log.info(`💾 Saving note with ID: ${fragment.id}`);
    
    // Convert fragment back to frontmatter/body format for storage adapter
    const frontmatter = {
      id: fragment.id,
      date: fragment.when,
      mode: fragment.mode,
      controls: fragment.controls,
      thread: fragment.thread,
      source: fragment.source,
      tags: fragment.tags,
      terms: fragment.terms,
      links: fragment.links,
      kind: fragment.kind
    };
    
    // Save to storage (existing storage adapter expects frontmatter/body format)
    const result = await storageAdapter.save(frontmatter, fragment.text);
    
    // Trigger background index rebuild if enabled
    if (config.indexAutoRebuild) {
      app.log.info('🔄 Triggering background index rebuild...');
      indexManager.scheduleRebuild();
    }
    
    return {
      ok: true,
      data: {
        id: fragment.id,
        thread: fragment.thread,
        when: fragment.when
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    app.log.error('Save operation failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

// Search endpoint (with tag/thread filtering)
app.get('/search', async (req, reply) => {
  try {
    // Validate search query parameters
    const validationResult = Validators.searchQuery(req.query);
    
    if (!validationResult.success) {
      reply.code(400);
      return { 
        ok: false, 
        error: 'Invalid search parameters', 
        details: validationResult.error.errors ? validationResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        })) : [{ field: 'unknown', message: validationResult.error.message || 'Validation failed' }]
      };
    }
    
    const { q: query, tag, thread, limit } = validationResult.data;
    
    // Start with text search if query provided
    let hits = [];
    if (query) {
      hits = await searchService.search(query, limit * 2); // Get more results for filtering
    } else {
      // If no query, we need to get all documents for filtering
      // This is a simple implementation - in production, we'd want better indexing
      hits = await searchService.search('*', 1000); // Get many results for filtering
    }
    
    // Apply tag filter
    if (tag) {
      hits = hits.filter(hit => {
        return hit.tags && Array.isArray(hit.tags) && hit.tags.includes(tag);
      });
    }
    
    // Apply thread filter
    if (thread) {
      hits = hits.filter(hit => {
        return hit.thread === thread;
      });
    }
    
    // Limit results
    hits = hits.slice(0, limit);
    
    app.log.info(`🔍 Search (q:"${query || '*'}", tag:"${tag || ''}", thread:"${thread || ''}") returned ${hits.length} results`);
    
    return {
      ok: true,
      query: query || null,
      filters: { tag: tag || null, thread: thread || null },
      total: hits.length,
      hits,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    app.log.error('Search operation failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

// Recent notes endpoint
app.get('/recent', async (req, reply) => {
  try {
    const { n = 20 } = req.query;
    const limit = Math.min(parseInt(n), 100); // 最大100件
    
    const recentNotes = await storageAdapter.getRecent(limit);
    
    app.log.info(`📋 Retrieved ${recentNotes.length} recent notes`);
    
    return {
      ok: true,
      total: recentNotes.length,
      notes: recentNotes,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    app.log.error('Recent notes retrieval failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

// Agent trigger endpoint (Shelter mode implementation)
app.post('/trigger', async (req, reply) => {
  try {
    // Validate AgentTrigger schema
    const validationResult = Validators.agentTrigger(req.body);
    
    if (!validationResult.success) {
      reply.code(400);
      return { 
        ok: false, 
        error: 'Invalid AgentTrigger format', 
        details: validationResult.error.errors ? validationResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        })) : [{ field: 'unknown', message: validationResult.error.message || 'Validation failed' }]
      };
    }
    
    const trigger = validationResult.data;
    
    // Generate ID and timestamp if not provided
    const triggerId = trigger.id || `trg-${ulid()}`;  
    const when = trigger.when || new Date().toISOString();
    
    app.log.info(`⚡ Agent trigger received: ${trigger.type} (ID: ${triggerId})`);
    
    // In Shelter mode, record the trigger but don't execute
    if (process.env.MODE === 'shelter' && process.env.EXTERNAL_IO === 'blocked') {
      // Save trigger record for audit trail
      const triggerRecord = {
        frontmatter: {
          id: triggerId,
          date: when,
          type: 'agent_trigger',
          trigger_type: trigger.type,
          thread: trigger.reply_to,
          mode: 'shelter',
          controls: {
            visibility: 'internal',
            external_io: 'blocked'
          },
          tags: ['trigger', 'shelter-mode']
        },
        body: `## Agent Trigger (Shelter Mode)

**Type**: ${trigger.type}
**Thread**: ${trigger.reply_to}
**Status**: SIMULATED (not executed due to shelter mode)

### Payload
\`\`\`json
${JSON.stringify(trigger.payload, null, 2)}
\`\`\``
      };
      
      await storageAdapter.save(triggerRecord.frontmatter, triggerRecord.body);
      
      // Trigger index rebuild
      if (config.indexAutoRebuild) {
        indexManager.scheduleRebuild();
      }
      
      return {
        ok: true,
        mode: 'shelter',
        ref: triggerId,
        message: 'Trigger recorded but not executed (shelter mode)',
        timestamp: when
      };
    }
    
    // Future: Signal mode implementation would go here
    reply.code(501);
    return { 
      ok: false, 
      error: 'Agent execution not implemented for current mode',
      mode: process.env.MODE || 'unknown'
    };
    
  } catch (error) {
    app.log.error('Agent trigger failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

// Context Packet export endpoint
app.get('/export/context/:thread', async (req, reply) => {
  try {
    const { thread } = req.params;
    const { intent = 'export' } = req.query;
    
    const packet = await contextBuilder.buildPacket(thread, intent);
    
    reply.type('application/json');
    reply.header('Content-Disposition', `attachment; filename="${thread}-context.json"`);
    return packet;
    
  } catch (error) {
    app.log.error('Context export failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

// Copilot markdown export endpoint
app.get('/export/markdown/:thread', async (req, reply) => {
  try {
    const { thread } = req.params;
    const includeMetadata = req.query.metadata !== 'false';
    const includeKnots = req.query.knots !== 'false';
    
    const markdown = await contextBuilder.generateCopilotMarkdown(thread, {
      includeMetadata,
      includeKnots
    });
    
    reply.type('text/markdown');
    reply.header('Content-Disposition', `attachment; filename="${thread}.md"`);
    return markdown;
    
  } catch (error) {
    app.log.error('Markdown export failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

// VS Code Extension preparation endpoints
app.get('/vscode/threads', async (req, reply) => {
  try {
    // This is a simple implementation - in a real system we'd have better thread management
    // For now, we'll return a placeholder response
    return {
      ok: true,
      threads: [
        {
          id: 'th-example',
          title: 'Example Thread',
          lastActivity: new Date().toISOString(),
          fragmentCount: 0
        }
      ],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    app.log.error('VS Code threads request failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

app.get('/vscode/context/:thread/compact', async (req, reply) => {
  try {
    const { thread } = req.params;
    const summary = await contextBuilder.getThreadSummary(thread);
    
    return {
      ok: true,
      data: summary,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    app.log.error('VS Code context request failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

app.post('/vscode/copilot/context', async (req, reply) => {
  try {
    const { thread, format = 'markdown' } = req.body;
    
    if (!thread) {
      reply.code(400);
      return { ok: false, error: 'thread parameter is required' };
    }
    
    if (format === 'markdown') {
      const markdown = await contextBuilder.generateCopilotMarkdown(thread);
      return {
        ok: true,
        format: 'markdown',
        content: markdown,
        timestamp: new Date().toISOString()
      };
    } else if (format === 'json') {
      const packet = await contextBuilder.buildPacket(thread, 'copilot-context');
      return {
        ok: true,
        format: 'json',
        content: packet,
        timestamp: new Date().toISOString()
      };
    } else {
      reply.code(400);
      return { ok: false, error: 'format must be either "markdown" or "json"' };
    }
  } catch (error) {
    app.log.error('VS Code Copilot context request failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

// Generic error handler
app.setErrorHandler((error, req, reply) => {
  app.log.error(error);
  reply.code(error.statusCode || 500).send({
    ok: false,
    error: error.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  app.log.info(`🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    // Stop tunnel if running
    if (tunnelManager) {
      await tunnelManager.stop();
    }
    
    // Close Fastify
    await app.close();
    app.log.info('✅ Server closed successfully');
    process.exit(0);
  } catch (error) {
    app.log.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    // Start Tunnel if enabled
    if (config.enableTunnel && TunnelManager) {
      tunnelManager = new TunnelManager({
        port: config.port,
        mode: config.tunnelMode,
        logger: app.log
      });
      
      await tunnelManager.start();
    }
    
    // Start HTTP server
    await app.listen({ 
      port: config.port, 
      host: config.host 
    });
    
    app.log.info(`🚀 YuiHub API server listening on ${config.host}:${config.port}`);
    app.log.info(`📂 Data root: ${config.dataRoot}`);
    app.log.info(`🔍 Search index: ${indexManager.status}`);
    
    if (tunnelManager && tunnelManager.url) {
      app.log.info(`🌐 Cloudflare Tunnel: ${tunnelManager.url}`);
    }
    
  } catch (error) {
    console.error('❌ Server startup failed:');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

start();