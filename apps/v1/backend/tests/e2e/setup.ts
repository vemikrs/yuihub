/**
 * E2E Test Environment Setup
 * Creates isolated DATA_DIR for each test run
 */
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export interface TestEnv {
  DATA_DIR: string;
  notesDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Create an isolated test environment with temporary DATA_DIR
 */
export async function createTestEnv(): Promise<TestEnv> {
  const tempDir = await mkdtemp(join(tmpdir(), 'yuihub-test-'));
  const notesDir = join(tempDir, 'notes');
  
  // Create necessary directories
  await mkdir(notesDir, { recursive: true });
  await mkdir(join(tempDir, 'data', 'lancedb'), { recursive: true });
  
  // Create VERSION file
  await writeFile(join(tempDir, 'VERSION'), '1.0.0-rc1');
  
  // Create minimal config
  const config = {
    server: { port: 0, host: '127.0.0.1' },
    sync: { enabled: false, interval: '*/5 * * * *', branch: 'main' },
    storage: { notes_dir: 'notes', db_path: 'data/lancedb' },
    ai: {
      defaults: { embedding: 'local', agent: 'local' },
      providers: [{ id: 'local', type: 'local' }]
    }
  };
  await writeFile(join(tempDir, 'yuihub.config.json'), JSON.stringify(config, null, 2));
  
  return {
    DATA_DIR: tempDir,
    notesDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    }
  };
}

/**
 * Create a test markdown file
 */
export async function createTestNote(
  notesDir: string,
  filename: string,
  content: string
): Promise<string> {
  const filePath = join(notesDir, filename);
  await writeFile(filePath, content);
  return filePath;
}

/**
 * Wait for a condition to be true (polling)
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('waitFor timeout');
}
