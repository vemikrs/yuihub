import Fastify, { FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import z from 'zod';
import { Entry } from '@yuihub/core';
import { VectorStore } from './engine/vector-store.js';
import { Indexer } from './engine/indexer.js';
import { SafeWatcher } from './engine/watcher.js';
import { globalMutex } from './engine/lock.js';
import path from 'path';

const server = Fastify({
  logger: true
});

// Zod Type Provider Setup
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// --- Engine Setup ---
const workspaceRoot = path.resolve(process.cwd(), '../../../'); // Adjust based on monorepo structure
// Assuming running from root or apps/v1/backend. Let's rely on process.cwd() if started from root?
// Or explicit env var. For now relative from this file? 
// Actually process.cwd() in npm script 'start' from backend dir is backend dir.
// From root 'npm start -w ...' is root? Typically it is package dir.
// Let's use env var or default to './' relative to CWD.
const DATA_DIR = process.env.DATA_DIR || './'; 

const vectorStore = new VectorStore(DATA_DIR);
const indexer = new Indexer(vectorStore);
const watcher = new SafeWatcher(indexer);

// --- API Schema ---
const SaveBodySchema = z.object({
  entries: z.array(z.object({
    id: z.string(),
    text: z.string(),
    mode: z.enum(['private', 'public']),
    tags: z.array(z.string()).optional(),
    session_id: z.string().optional(),
    source: z.string().optional()
  }))
});

type SaveBodyType = z.infer<typeof SaveBodySchema>;

// --- Lifecycle ---
server.addHook('onReady', async () => {
  server.log.info('Initializing Engine...');
  await vectorStore.init();
  server.log.info('Engine initialized.');
  
  // Start Watcher
  // Watch target directory? 
  // For V1, we store markdown files in DATA_DIR/notes ?
  // Or do we just rely on /save API to write files?
  // User requirement: "All local file write triggers re-index".
  // So we watch the directory where files are saved.
  // Assuming storage adapter saves to 'notes/'.
  watcher.start(path.join(DATA_DIR, 'notes'));
});

server.addHook('onClose', async () => {
  await watcher.close();
});

// --- Endpoints ---

server.get('/health', async () => {
  return { status: 'ok', version: 'v1' };
});

server.post('/save', {
  schema: {
    body: SaveBodySchema
  }
}, async (req: FastifyRequest<{ Body: SaveBodyType }>, reply) => {
  const { entries } = req.body;

  // Mutex Lock for Write
  const release = await globalMutex.acquire();
  try {
    // 1. Save to Disk (Markdown) - TODO: Use Storage Adapter (from Core or Utils)
    // For now, mocking file write.
    // In real impl, we should write .md files here.
    
    // 2. Add to Vector Store immediately? Or wait for watcher?
    // Requirement: "Indexer execution... save... re-index queue"
    // If we write file here, watcher will trigger.
    // So we just write file.
    // BUT we hold the lock so Indexer cannot run yet.
    
    // Simulating Write
    server.log.info(`Saving ${entries.length} entries...`);
    
    // If we rely on Watcher to index, we don't call vectorStore.add here manually.
    // But we need to ensure the file is written before releasing lock?
    // Actually, if we release lock, Watcher picks up. 
    // If Watcher picks up, it will enqueue. Indexer worker will try to acquire lock.
    // So logic matches.
    
    return { ok: true, count: entries.length };

  } catch (err) {
    server.log.error(err);
    reply.code(500);
    return { ok: false, error: 'Save failed' };
  } finally {
    release();
  }
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

