/**
 * YuiHub V1 Backend - Lock Utilities
 * ReadWriteLock for LanceDB concurrency control
 */

import { RWLock } from 'async-rwlock';

// ReadWriteLock: Multiple readers OR single writer
export const rwLock = new RWLock();

/**
 * Execute function with write lock (exclusive)
 * Use for: /save, /checkpoints, indexing
 */
export async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  await rwLock.writeLock();
  try {
    return await fn();
  } finally {
    rwLock.unlock();
  }
}

/**
 * Execute function with read lock (shared)
 * Use for: /search, /export/context
 */
export async function withReadLock<T>(fn: () => Promise<T>): Promise<T> {
  await rwLock.readLock();
  try {
    return await fn();
  } finally {
    rwLock.unlock();
  }
}

/**
 * Execute function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 100
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[Lock] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Legacy export for backward compatibility (deprecated)
import { Mutex } from 'async-mutex';
/** @deprecated Use withWriteLock instead */
export const globalMutex = new Mutex();
