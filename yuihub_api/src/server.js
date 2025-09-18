import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ulid } from 'ulid';
import path from 'path';
import { fileURLToPath } from 'url';
import { createStorageAdapter } from './storage.js';
import { SearchService } from './search.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Tunnel integration - only load if enabled
let TunnelManager;
if (process.env.ENABLE_TUNNEL === 'true') {
  try {
    const { TunnelManager: TM } = await import('../../.cloudflare/tunnel-manager.js');
    TunnelManager = TM;
  } catch (error) {
    console.warn('⚠️  Tunnel integration failed to load:', error.message);
  }
}

const app = Fastify({ 
  logger: true,
  requestIdHeader: 'x-request-id'
});

await app.register(cors, { origin: true });

// Initialize services
const storageAdapter = createStorageAdapter();
const searchService = new SearchService();

// Tunnel manager instance (if enabled)
let tunnelManager = null;

// Load search index on startup
const indexPath = process.env.LUNR_INDEX_PATH || path.resolve(__dirname, '../../index/lunr.idx.json');
console.log(`🔍 Looking for search index at: ${indexPath}`);
const indexLoaded = await searchService.loadIndex(indexPath);
if (indexLoaded) {
  console.log(`✅ Search index loaded from ${indexPath}`);
} else {
  console.warn(`⚠️ Search index not found at ${indexPath}`);
}

// Health check endpoint
app.get('/health', async (req, reply) => {
  return { 
    ok: true, 
    timestamp: new Date().toISOString(),
    storage: storageAdapter.type,
    searchIndex: searchService.index ? 'loaded' : 'missing'
  };
});

// OpenAPI schema endpoint for ChatGPT Actions
app.get('/openapi.yml', async (req, reply) => {
  try {
    const fs = await import('fs/promises');
    const schemaPath = path.join(__dirname, '../openapi.yml');
    app.log.info(`Attempting to load OpenAPI schema from: ${schemaPath}`);
    const schema = await fs.readFile(schemaPath, 'utf8');
    reply.type('text/yaml');
    return schema;
  } catch (error) {
    app.log.error(error, `Failed to load OpenAPI schema from: ${path.join(__dirname, '../openapi.yml')}`);
    reply.status(500);
    return { error: 'OpenAPI schema not found' };
  }
});

// POST /save - Save chat log with YAML frontmatter + Markdown body
app.post('/save', {
  schema: {
    body: {
      type: 'object',
      required: ['frontmatter', 'body'],
      properties: {
        frontmatter: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            date: { type: 'string' },
            actors: { type: 'array', items: { type: 'string' } },
            topic: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            decision: { type: 'string', enum: ['採用', '保留', '却下'] },
            links: { type: 'array', items: { type: 'string' } }
          }
        },
        body: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  try {
    const { frontmatter, body } = req.body;
    
    // Generate ULID if not provided
    const enrichedFrontmatter = {
      id: ulid(),
      date: new Date().toISOString(),
      actors: [],
      topic: '',
      tags: [],
      decision: null,
      links: [],
      ...frontmatter
    };

    const result = await storageAdapter.save(enrichedFrontmatter, body);
    
    // Log the save operation for audit
    app.log.info('Chat log saved', { 
      id: enrichedFrontmatter.id, 
      topic: enrichedFrontmatter.topic,
      path: result.path
    });
    
    return result;
  } catch (error) {
    app.log.error('Save failed', error);
    reply.status(500);
    return { ok: false, error: error.message };
  }
});

// GET /search - Full-text search with Lunr
app.get('/search', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
      },
      required: ['q']
    }
  }
}, async (req, reply) => {
  try {
    const { q, limit = 10 } = req.query;
    const result = await searchService.search(q, limit);
    
    app.log.info('Search performed', { query: q, hits: result.hits.length });
    
    return result;
  } catch (error) {
    app.log.error('Search failed', error);
    reply.status(500);
    return { hits: [], error: error.message };
  }
});

// GET /recent - Get recent decisions
app.get('/recent', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        n: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
      }
    }
  }
}, async (req, reply) => {
  try {
    const { n = 20 } = req.query;
    const basePath = process.env.LOCAL_STORAGE_PATH || './chatlogs';
    const items = await searchService.getRecent(n, basePath);
    
    return { items };
  } catch (error) {
    app.log.error('Get recent failed', error);
    reply.status(500);
    return { items: [], error: error.message };
  }
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`YuiHub API server listening on http://${HOST}:${PORT}`);
    
    // Start tunnel if enabled
    if (TunnelManager && process.env.ENABLE_TUNNEL === 'true') {
      try {
        tunnelManager = new TunnelManager();
        const url = await tunnelManager.start();
        
        app.log.info(`🌐 Cloudflare Tunnel: ${url}`);
        app.log.info(`📋 OpenAPI Schema: ${url}/openapi.yml`);
        app.log.info(`🔍 Search API: ${url}/search?q=example`);
        
        // Store tunnel URL globally for potential API use
        app.decorate('tunnelUrl', url);
        
      } catch (tunnelError) {
        app.log.error('Failed to start tunnel:', tunnelError.message);
        app.log.info('💡 Server will continue without tunnel');
      }
    }
    
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown handling
process.on('SIGINT', async () => {
  app.log.info('🛑 Graceful shutdown initiated...');
  
  if (tunnelManager) {
    app.log.info('🔌 Stopping tunnel...');
    await tunnelManager.stop();
  }
  
  await app.close();
  app.log.info('✅ Server stopped');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  app.log.info('🛑 SIGTERM received, shutting down...');
  
  if (tunnelManager) {
    await tunnelManager.stop();
  }
  
  await app.close();
  process.exit(0);
});

start();
