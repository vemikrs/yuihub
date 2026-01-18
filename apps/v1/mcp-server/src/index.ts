#!/usr/bin/env node
/**
 * YuiHub MCP Server - Stdio Entry Point
 * For Claude Desktop, VS Code Copilot, etc.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main() {
  const { server } = createServer();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
