#!/usr/bin/env node
/**
 * YuiHub MCP Server - SSE Entry Point
 * For browser clients
 */

import http from 'http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from './server.js';

const DEFAULT_PORT = 4106;
const port = parseInt(process.env.YUIHUB_MCP_PORT || String(DEFAULT_PORT), 10);

const httpServer = http.createServer();

// Store active transports
const transports = new Map<string, SSEServerTransport>();
let connectionId = 0;

httpServer.on('request', async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${port}`);

  // SSE endpoint
  if (url.pathname === '/sse' && req.method === 'GET') {
    const id = `conn-${++connectionId}`;
    console.log(`[SSE] New connection: ${id}`);

    const { server } = createServer();
    const transport = new SSEServerTransport('/message', res);
    transports.set(id, transport);

    res.on('close', () => {
      console.log(`[SSE] Connection closed: ${id}`);
      transports.delete(id);
    });

    await server.connect(transport);
    return;
  }

  // Message endpoint for SSE clients
  if (url.pathname === '/message' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      // Find the transport for this session (simplified - uses last transport)
      const transport = Array.from(transports.values()).pop();
      if (transport) {
        // Handle incoming message
        try {
          await transport.handlePostMessage(req, res, body);
        } catch (error) {
          console.error('[SSE] Message error:', error);
          res.writeHead(500);
          res.end('Internal error');
        }
      } else {
        res.writeHead(404);
        res.end('No active connection');
      }
    });
    return;
  }

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', connections: transports.size }));
    return;
  }

  // Not found
  res.writeHead(404);
  res.end('Not Found');
});

httpServer.listen(port, () => {
  console.log(`[YuiHub MCP] SSE Server running on http://localhost:${port}`);
  console.log(`[YuiHub MCP] SSE endpoint: http://localhost:${port}/sse`);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('[YuiHub MCP] Shutting down...');
  httpServer.close();
  process.exit(0);
});
