import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import rateLimit from '@fastify/rate-limit';
import bearerAuth from '@fastify/bearer-auth';
import z from 'zod';
import { Entry } from '@yuihub/core';
import { VectorStore } from './engine/vector-store.js';
import { Indexer } from './engine/indexer.js';
import { SafeWatcher } from './engine/watcher.js';
import { globalMutex } from './engine/lock.js';
import { extractTerms } from './api/text-process.js';
import { GitHubSyncProvider } from './sync/github-provider.js';
import { SyncScheduler } from './sync/scheduler.js';
import { ConfigService } from './config/service.js';
import { AppConfigSchema, AppConfigUpdateSchema } from './config/schema.js';
import { LocalEmbeddingService } from './engine/embeddings/local-service.js';
import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';

const server = Fastify({
  logger: true
});

// Zod Type Provider Setup
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// --- Config & Engine Setup ---
const workspaceRoot = path.resolve(process.cwd(), '../../../'); 
const DATA_DIR = process.env.DATA_DIR || './'; // Base DB location

// 1. Initialize Config Service
const configService = new ConfigService(DATA_DIR);
let config = configService.get();

// 2. Dependency Injection
const embeddingService = new LocalEmbeddingService(config.ai.modelName);
const vectorStore = new VectorStore(DATA_DIR, embeddingService);
const indexer = new Indexer(vectorStore);
const watcher = new SafeWatcher(indexer);

// 3. Sync Setup
const syncProvider = new GitHubSyncProvider(DATA_DIR);
const syncScheduler = new SyncScheduler(syncProvider, config.sync.interval);

// --- Security ---
const AUTH_TOKEN = process.env.YUIHUB_TOKEN || 'dev-token';

server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

server.register(bearerAuth, {
  keys: new Set([AUTH_TOKEN]),
  errorResponse: (err) => {
    return { error: 'Unauthorized', message: err.message };
  }
});

// --- API Schema ---
const SaveBodySchema = z.object({
  entries: z.array(z.object({
    id: z.string().optional(),
    text: z.string(),
    mode: z.enum(['private', 'public']),
    tags: z.array(z.string()).optional(),
    session_id: z.string().optional(),
    source: z.string().optional()
  }))
});

const SearchQuerySchema = z.object({
  q: z.string(),
  limit: z.coerce.number().optional().default(10),
  tag: z.string().optional(),
  session: z.string().optional()
});

const ExportQuerySchema = z.object({
  q: z.string().optional(), // Intent
  session: z.string().optional()
});

const ConfigUpdateSchema = AppConfigUpdateSchema;

type SaveBodyType = z.infer<typeof SaveBodySchema>;
type SearchQueryType = z.infer<typeof SearchQuerySchema>;
type ExportQueryType = z.infer<typeof ExportQuerySchema>;
type ConfigUpdateType = z.infer<typeof ConfigUpdateSchema>;

// --- Lifecycle ---
server.addHook('onReady', async () => {
  server.log.info({ config: configService.get() }, 'Initializing Engine with Config...');
  
  await vectorStore.init();
  server.log.info('Engine initialized.');
  
  // Start Watcher
  const notesDir = path.join(DATA_DIR, 'notes');
  await fs.ensureDir(notesDir);
  watcher.start(notesDir);

  // Initialize & Start Sync if Enabled
  if (config.sync.enabled) {
     server.log.info('Initializing Sync...');
     await syncProvider.init(config.sync.remoteUrl);
     syncScheduler.start();
  }
});

server.addHook('onClose', async () => {
  server.log.info('Shutting down...');
  await watcher.close();
  syncScheduler.stop();
});

// --- Endpoints ---

server.get('/health', async () => {
  return { status: 'ok', version: 'v1' };
});

// System API: Get Config
server.get('/system/config', async () => {
  return { ok: true, config: configService.get() };
});

// System API: Update Config (Hot Reload-ish)
server.patch('/system/config', {
  schema: {
    body: ConfigUpdateSchema
  }
}, async (req: FastifyRequest<{ Body: ConfigUpdateType }>, reply) => {
  try {
    const newConfig = await configService.update(req.body);
    config = newConfig; // Update local ref

    // Apply specific changes dynamically
    if (req.body.sync) {
      if (newConfig.sync.enabled && !syncScheduler['isRunning']) {
         // If enabled and not running, start
         // Re-init provider if remote url changed?
         if (req.body.sync.remoteUrl) await syncProvider.init(newConfig.sync.remoteUrl);
         syncScheduler.start(); // TODO: Update interval if changed
      } else if (!newConfig.sync.enabled) {
         syncScheduler.stop();
      }
    }
    
    // Note: Deep reconfiguration (e.g. port change, model change) might require restart.
    // For now we just return the new config.
    return { ok: true, config: newConfig, message: 'Config updated. Some changes may require restart.' };
  } catch (err: any) {
    server.log.error(err);
    reply.code(500);
    return { ok: false, error: err.message };
  }
});


// 1. SAVE Endpoint
server.post('/save', {
  schema: {
    body: SaveBodySchema
  }
}, async (req: FastifyRequest<{ Body: SaveBodyType }>, reply) => {
  const { entries } = req.body;

  // Mutex Lock for Write
  const release = await globalMutex.acquire();
  try {
    // Process each entry
    for (const entry of entries) {
       // Enhanced Logic: Japanese Terms Extraction
       const extractedTerms = extractTerms(entry.text);
       const tags = new Set([...(entry.tags || []), ...extractedTerms]);
       
       const finalEntry = {
        ...entry,
        id: entry.id || randomUUID(), // Generate ID if atomic entry
        tags: Array.from(tags),
        date: new Date().toISOString()
       };

       // Physical Save (Markdown)
       const filename = finalEntry.session_id ? `${finalEntry.session_id}.md` : `entry-${finalEntry.id}.md`;
       const filePath = path.join(DATA_DIR, 'notes', filename);
       
       const fileContent = `\n\n---\nid: ${finalEntry.id}\ndate: ${finalEntry.date}\ntags: [${finalEntry.tags.join(', ')}]\n---\n\n${finalEntry.text}`;
       
       await fs.appendFile(filePath, fileContent);
    }
    
    // Lock released, Watcher picks up changes.
    return { ok: true, count: entries.length };

  } catch (err) {
    server.log.error(err);
    reply.code(500);
    return { ok: false, error: 'Save failed' };
  } finally {
    release();
  }
});

// 2. SEARCH Endpoint
server.get('/search', {
  schema: {
    querystring: SearchQuerySchema
  }
}, async (req: FastifyRequest<{ Querystring: SearchQueryType }>, reply) => {
  const { q, limit, tag, session } = req.query;
  const results = await vectorStore.search(q, limit, { tag, session });
  return { ok: true, results };
});

// 3. TRIGGER Endpoint (Mock / Private Mode)
server.post('/trigger', async (req, reply) => {
  // Logic: In Private Mode, we don't send to external agent actually.
  // We just return OK.
  return { ok: true, ref: 'mock-private-ref', status: 'ignored_in_private_mode' };
});

// 4. EXPORT CONTEXT Endpoint
server.get('/export/context', {
  schema: {
    querystring: ExportQuerySchema
  }
}, async (req: FastifyRequest<{ Querystring: ExportQueryType }>, reply) => {
  const { q, session } = req.query;
  
  // 1. Retrieve Recent Context
  const longTermResults = q ? await vectorStore.search(q, 5) : [];
  
  // Construct Context Packet
  const packet = {
    intent: q || 'No specific intent',
    session_id: session,
    working_memory: {
        recent_summary: '...'
    },
    long_term_memory: longTermResults.map(r => ({
       text: r.text,
       relevance: r._distance // LanceDB returns distance
    })),
    meta: {
      mode: 'private'
    }
  };

  return { ok: true, packet };
});


const start = async () => {
  try {
    const port = config.server.port;
    const host = config.server.host;
    await server.listen({ port, host });
    console.log(`Server listening on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
