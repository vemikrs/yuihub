/**
 * YuiHub MCP Server - Core Server Setup
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { YuiHubClient, createClient } from './client.js';
import { readTokenSync, getDefaultDataDir } from './auth.js';
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';

export interface ServerConfig {
  name?: string;
  version?: string;
  dataDir?: string;
  backendUrl?: string;
}

export function createServer(config: ServerConfig = {}): { server: Server; client: YuiHubClient } {
  const dataDir = config.dataDir || getDefaultDataDir();
  const backendUrl = config.backendUrl || process.env.YUIHUB_API_URL || 'http://localhost:4182';
  
  // Read token from .token file
  const token = process.env.YUIHUB_TOKEN || readTokenSync(dataDir);
  
  if (!token) {
    throw new Error(`No auth token found. Make sure YuiHub Backend is running and has created ${dataDir}/.token`);
  }

  // Create HTTP client
  const client = createClient({
    baseUrl: backendUrl,
    token,
  });

  // Create MCP server
  const server = new Server(
    {
      name: config.name || 'yuihub-mcp',
      version: config.version || '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register handlers
  registerTools(server, client);
  registerResources(server, client);

  return { server, client };
}
