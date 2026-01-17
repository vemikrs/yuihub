/**
 * YuiHub VSCode Client - Auth Token Reader
 * Reads token from Backend's .token file for File-based Handshake
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AuthToken {
  token: string;
  created_at: string;
}

/**
 * Get default data directory
 */
export function getDefaultDataDir(): string {
  return process.env.DATA_DIR || path.join(os.homedir(), '.yuihub');
}

/**
 * Read token from .token file (synchronous)
 */
export function readTokenSync(dataDir?: string): string | undefined {
  const dir = dataDir || getDefaultDataDir();
  const tokenPath = path.join(dir, '.token');
  
  try {
    if (fs.existsSync(tokenPath)) {
      const content = fs.readFileSync(tokenPath, 'utf-8');
      const auth = JSON.parse(content) as AuthToken;
      return auth.token;
    }
  } catch {
    // Token file not found or invalid
  }
  
  return undefined;
}

/**
 * Read token from .token file (async)
 */
export async function readToken(dataDir?: string): Promise<string | undefined> {
  const dir = dataDir || getDefaultDataDir();
  const tokenPath = path.join(dir, '.token');
  
  try {
    const content = await fs.promises.readFile(tokenPath, 'utf-8');
    const auth = JSON.parse(content) as AuthToken;
    return auth.token;
  } catch {
    return undefined;
  }
}
