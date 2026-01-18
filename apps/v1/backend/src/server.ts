import Fastify, { FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import rateLimit from '@fastify/rate-limit';
import bearerAuth from '@fastify/bearer-auth';
import z from 'zod';
import { LanceVectorStore } from './engine/vector-store.js';
import { CompositeVectorStore } from './engine/composite-vector-store.js';
import { Indexer } from './engine/indexer.js';
import { SafeWatcher } from './engine/watcher.js';
import { withWriteLock, withReadLock, withRetry } from './engine/lock.js';
import { extractTerms } from './api/text-process.js';
import { GitHubSyncProvider } from './sync/github-provider.js';
import { SyncScheduler } from './sync/scheduler.js';
import { ConfigService } from './config/service.js';
import { AppConfigUpdateSchema } from './config/schema.js';
import { AIProviderRegistry } from './engine/ai/registry.js';
import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';
import os from 'os';
import { ulid } from 'ulid';
import { initAuth } from './auth.js';

const server = Fastify({
  logger: true
}).withTypeProvider<ZodTypeProvider>();

// Zod Type Provider Setup
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// --- Config & Engine Setup ---
const workspaceRoot = path.resolve(process.cwd(), '../../../'); 
const DEFAULT_DATA_DIR = path.join(os.homedir(), '.yuihub');
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
const STORAGE_VERSION = '1.0.0-rc1';

// 1. Initialize Config Service
const configService = new ConfigService(DATA_DIR);
let config = configService.get();

// 2. Initialize AI Registry & Services
const aiRegistry = new AIProviderRegistry(config.ai);

// Initialize Composite Vector Store (Dual Embedding)
const embeddingServices = await aiRegistry.getAllEmbeddingServices();
if (embeddingServices.length === 0) {
    throw new Error('No embedding services configured or initialized.');
}

const stores = embeddingServices.map(({ id, service }) => {
    // Store name = provider id (e.g. 'local', 'vertex')
    // Table name defaults to `entries_${id}` inside LanceVectorStore
    return new LanceVectorStore(DATA_DIR, service, id);
});

console.log(`[AI] Initialized ${stores.length} Vector Stores: ${stores.map(s => s.name).join(', ')}`);

const vectorStore = new CompositeVectorStore(stores);
await vectorStore.init(); // Init all underlying stores

const indexer = new Indexer(vectorStore);
const watcher = new SafeWatcher(indexer);

// 3. Sync Setup
const syncProvider = new GitHubSyncProvider(DATA_DIR);
const syncScheduler = new SyncScheduler(syncProvider, config.sync.interval);

// --- Security (File-based Handshake) ---
const authData = await initAuth(DATA_DIR);
const AUTH_TOKEN = process.env.YUIHUB_TOKEN || authData.token;
console.log(`[Auth] Token initialized (file-based handshake)`);

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
  
  // Storage Version Check
  const versionPath = path.join(DATA_DIR, 'VERSION');
  if (config.sync.enabled || await fs.pathExists(versionPath)) {
      // If sync enabled or version file exists, check it.
      if (await fs.pathExists(versionPath)) {
          const version = (await fs.readFile(versionPath, 'utf-8')).trim();
          if (version !== STORAGE_VERSION) {
              server.log.warn(`⚠️ Storage Version Mismatch! Expected ${STORAGE_VERSION}, found ${version}. Compatibility issues may occur.`);
          }
      } else {
          // If no version file but data exists... write it? or warn?
          // Write it for now to migrate.
          await fs.writeFile(versionPath, STORAGE_VERSION);
      }
  }

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

  // Bootstrap Indexing: If DB empty but files exist, scan!
  if (await vectorStore.isEmpty()) {
      const hasFiles = await fs.pathExists(notesDir) && (await fs.readdir(notesDir)).length > 0;
      if (hasFiles) {
          server.log.info('🚀 Empty Index detected with existing notes. Starting Initial Scan...');
          // Don't await scan fully to allow server start? Or await?
          // Await is safer to ensure index is ready.
          await watcher.scan(notesDir);
          server.log.info('✅ Initial Scan queued.');
      }
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
    const body = req.body as ConfigUpdateType; 
    const newConfig = await configService.update(body);
    config = newConfig; // Update local ref

    // Apply specific changes dynamically
    if (body.sync) {
      if (newConfig.sync.enabled && !syncScheduler['isSchedulerActive']) {
         // If enabled and not running, start
         // Re-init provider if remote url changed?
         if (body.sync.remoteUrl) await syncProvider.init(newConfig.sync.remoteUrl);
         syncScheduler.start();
      } else if (!newConfig.sync.enabled) {
         syncScheduler.stop();
      }
      // Update interval if changed
      if (body.sync.interval) {
         syncScheduler.updateInterval(newConfig.sync.interval);
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

  // Write Lock with Retry for LanceDB safety
  try {
    await withWriteLock(() => withRetry(async () => {
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
    }));
    
    // Lock released, Watcher picks up changes.
    return { ok: true, count: entries.length };

  } catch (err) {
    server.log.error(err);
    reply.code(500);
    return { ok: false, error: 'Save failed' };
  }
});

// 2. SEARCH Endpoint (Read Lock)
server.get('/search', {
  schema: {
    querystring: SearchQuerySchema
  }
}, async (req: FastifyRequest<{ Querystring: SearchQueryType }>, reply) => {
  const { q, limit, tag, session } = req.query;
  const results = await withReadLock(() => vectorStore.search(q, limit, { tag, session }));
  return { ok: true, results };
});

// 3. TRIGGER Endpoint (Mock / Private Mode)
server.post('/trigger', async (req, reply) => {
  // Logic: In Private Mode, we don't send to external agent actually.
  // We just return OK.
  return { ok: true, ref: 'mock-private-ref', status: 'ignored_in_private_mode' };
});

// --- MCP Support Endpoints ---

// 3.1 THREADS/NEW - Create new session
const ThreadsNewSchema = z.object({
  title: z.string().optional()
});
type ThreadsNewType = z.infer<typeof ThreadsNewSchema>;

server.post('/threads/new', {
  schema: { body: ThreadsNewSchema }
}, async (req: FastifyRequest<{ Body: ThreadsNewType }>, reply) => {
  const { title } = req.body;
  
  const session = {
    id: `th-${ulid()}`,
    title: title || `Session ${new Date().toLocaleDateString()}`,
    created_at: new Date().toISOString()
  };
  
  return { ok: true, session };
});

// 3.2 CHECKPOINTS - Create decision checkpoint
const CheckpointSchema = z.object({
  session_id: z.string(),
  summary: z.string(),
  intent: z.string(),
  working_memory: z.record(z.unknown()).optional(),
  entry_ids: z.array(z.string()).optional()
});
type CheckpointType = z.infer<typeof CheckpointSchema>;

server.post('/checkpoints', {
  schema: { body: CheckpointSchema }
}, async (req: FastifyRequest<{ Body: CheckpointType }>, reply) => {
  const { session_id, summary, intent, working_memory, entry_ids } = req.body;
  
  const checkpoint = {
    id: `cp-${ulid()}`,
    session_id,
    snapshot: {
      working_memory: JSON.stringify(working_memory || {}),
      decision_rationale: summary
    },
    intent,
    entry_ids: entry_ids || [],
    created_at: new Date().toISOString()
  };
  
  // Write Lock with Retry for file safety
  await withWriteLock(() => withRetry(async () => {
    const checkpointDir = path.join(DATA_DIR, 'checkpoints');
    await fs.ensureDir(checkpointDir);
    await fs.writeJson(path.join(checkpointDir, `${checkpoint.id}.json`), checkpoint, { spaces: 2 });
  }));
  
  return { ok: true, checkpoint };
});
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
       relevance: r.score, // Use normalized score from Composite Store
       source_store: r._source_store
    })),
    meta: {
      mode: 'private'
    }
  };

  return { ok: true, packet };
});


// 5. AGENT Endpoint
import { Agent } from './engine/agent/core.js';
import { LiveContextService } from './engine/agent/live-context.js';

const liveContextService = new LiveContextService();
watcher.onActivity((path, type) => liveContextService.addEvent(type, path));

const AgentPromptSchema = z.object({
  prompt: z.string(),
  context: z.string().optional()
});
type AgentPromptType = z.infer<typeof AgentPromptSchema>;

server.post('/agent', {
  schema: {
    body: AgentPromptSchema
  }
}, async (req: FastifyRequest<{ Body: AgentPromptType }>, reply) => {
  const { prompt, context } = req.body;
  
  try {
      const providerId = config.ai.defaults.agent;
      const genAIService = await aiRegistry.getGenAIService(providerId);
      
      const agent = new Agent({
          genAI: genAIService,
          rootDir: workspaceRoot,
          dataDir: DATA_DIR
      });
      
      const fullContext = (context || '') + '\n\n' + liveContextService.getSnapshot();
      
      const answer = await agent.run(prompt, fullContext);
      return { ok: true, answer };
  } catch (err: any) {
      server.log.error(err);
      reply.code(500);
      return { ok: false, error: err.message };
  }
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
