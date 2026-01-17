/**
 * YuiHub V1 Authentication Module
 * File-based Handshake: Token is written to DATA_DIR/.token
 */

import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';

export interface AuthToken {
  token: string;
  created_at: string;
}

const TOKEN_PREFIX = 'yh-';

/**
 * Generate a new auth token
 */
export function generateToken(): string {
  return `${TOKEN_PREFIX}${randomUUID()}`;
}

/**
 * Get the token file path
 */
export function getTokenPath(dataDir: string): string {
  return path.join(dataDir, '.token');
}

/**
 * Initialize authentication - generate token if not exists
 * This is called on backend startup
 */
export async function initAuth(dataDir: string): Promise<AuthToken> {
  const tokenPath = getTokenPath(dataDir);
  
  // Check if token file exists
  if (await fs.pathExists(tokenPath)) {
    try {
      const auth = await fs.readJson(tokenPath) as AuthToken;
      if (auth.token && auth.token.startsWith(TOKEN_PREFIX)) {
        return auth;
      }
    } catch {
      // Invalid token file, regenerate
    }
  }
  
  // Generate new token
  const auth: AuthToken = {
    token: generateToken(),
    created_at: new Date().toISOString(),
  };
  
  await fs.ensureDir(dataDir);
  await fs.writeJson(tokenPath, auth, { spaces: 2 });
  
  return auth;
}

/**
 * Read token from file (for MCP Server / VSCode Client)
 */
export async function readToken(dataDir: string): Promise<string | undefined> {
  const tokenPath = getTokenPath(dataDir);
  
  if (await fs.pathExists(tokenPath)) {
    try {
      const auth = await fs.readJson(tokenPath) as AuthToken;
      return auth.token;
    } catch {
      return undefined;
    }
  }
  
  return undefined;
}

/**
 * Validate a token against the stored token
 */
export async function validateToken(dataDir: string, token: string): Promise<boolean> {
  const storedToken = await readToken(dataDir);
  return storedToken === token;
}
