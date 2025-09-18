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

// Save note endpoint (enhanced with index auto-rebuild)
app.post('/save', async (req, reply) => {
  try {
    const { frontmatter, body } = req.body;
    
    // Validation
    if (!frontmatter || !body) {
      reply.code(400);
      return { ok: false, error: 'frontmatter and body are required' };
    }
    
    // Ensure required frontmatter fields
    const enrichedFrontmatter = {
      id: ulid(),
      date: new Date().toISOString(),
      ...frontmatter
    };
    
    app.log.info(`💾 Saving note with ID: ${enrichedFrontmatter.id}`);
    
    // Save to storage
    const result = await storageAdapter.save(enrichedFrontmatter, body);
    
    // Trigger background index rebuild if enabled
    if (config.indexAutoRebuild) {
      app.log.info('🔄 Triggering background index rebuild...');
      indexManager.scheduleRebuild();
    }
    
    return result;
    
  } catch (error) {
    app.log.error('Save operation failed:', error);
    reply.code(500);
    return { ok: false, error: error.message };
  }
});

// Search endpoint
app.get('/search', async (req, reply) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query) {
      reply.code(400);
      return { ok: false, error: 'Query parameter q is required' };
    }
    
    const hits = await searchService.search(query, parseInt(limit));
    
    app.log.info(`🔍 Search for "${query}" returned ${hits.length} results`);
    
    return {
      ok: true,
      query,
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