import { Mutex } from 'async-mutex';

// Global Write/Index Lock
// Shared between API (/save) and Indexer (Watcher)
export const globalMutex = new Mutex();
