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
import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';

const server = Fastify({
  logger: true
});

// Zod Type Provider Setup
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// --- Engine Setup ---
const workspaceRoot = path.resolve(process.cwd(), '../../../'); 
const DATA_DIR = process.env.DATA_DIR || './'; 

const vectorStore = new VectorStore(DATA_DIR);
const indexer = new Indexer(vectorStore);
const watcher = new SafeWatcher(indexer);

// --- Security & Plugins ---
const AUTH_TOKEN = process.env.YUIHUB_TOKEN || 'dev-token'; // In prod, rely on env

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

type SaveBodyType = z.infer<typeof SaveBodySchema>;
type SearchQueryType = z.infer<typeof SearchQuerySchema>;
type ExportQueryType = z.infer<typeof ExportQuerySchema>;

// --- Lifecycle ---
server.addHook('onReady', async () => {
  server.log.info('Initializing Engine...');
  await vectorStore.init();
  server.log.info('Engine initialized.');
  
  // Start Watcher
  // For V1, we store markdown files in DATA_DIR/notes ?
  // Or do we just rely on /save API to write files?
  const notesDir = path.join(DATA_DIR, 'notes');
  await fs.ensureDir(notesDir);
  watcher.start(notesDir);
});

server.addHook('onClose', async () => {
  await watcher.close();
});

// --- Endpoints ---

server.get('/health', async () => {
  return { status: 'ok', version: 'v1' };
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
    const savedCount = 0;
    
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
       // Filename strategy: SessionID or Timestamp
       // If source is provided, use it? Or append to file?
       // For V1, we simply write to a file named by session or timestamp in notes/
       const filename = finalEntry.session_id ? `${finalEntry.session_id}.md` : `entry-${finalEntry.id}.md`;
       const filePath = path.join(DATA_DIR, 'notes', filename);
       
       // Append or Write?
       // YuiHub logic usually appends to Session Thread.
       // Format: 
       // ---
       // id: ...
       // tags: ...
       // ---
       // content...
       
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
  
  // 1. Retrieve Recent Context (Session)
  // For V1 MVP, just search or read file?
  // Let's use search with session filter to get recent entries? Or explicit DB query?
  // Since we rely on VectorStore, we can search by session.
  // Ideally VectorStore supports 'get recent' without vector search.
  // For now, assume search matches.
  
  // 2. Retrieve Long Term Memory (Vector Search)
  const longTermResults = q ? await vectorStore.search(q, 5) : [];
  
  // Construct Context Packet
  const packet = {
    intent: q || 'No specific intent',
    session_id: session,
    working_memory: {
        // Todo: Load recent entries from session file
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
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
