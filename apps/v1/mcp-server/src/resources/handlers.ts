/**
 * YuiHub MCP Resources - Handlers
 * yuihub://recent, yuihub://session/{id}, yuihub://system/status
 */

import type { YuiHubClient } from '../client.js';

export async function handleRecent(client: YuiHubClient): Promise<string> {
  const results = await client.search('', 20);
  
  if (results.length === 0) {
    return 'No recent memories.';
  }
  
  return results.map((r, i) => 
    `[${i + 1}] ${r.date}\n${r.text.slice(0, 150)}${r.text.length > 150 ? '...' : ''}`
  ).join('\n\n');
}

export async function handleSession(client: YuiHubClient, sessionId: string): Promise<string> {
  const results = await client.search('', 50, { session: sessionId });
  
  if (results.length === 0) {
    return `No entries found for session: ${sessionId}`;
  }
  
  return `Session: ${sessionId}\nEntries: ${results.length}\n\n` +
    results.map((r, i) => 
      `[${i + 1}] ${r.date}\n${r.text.slice(0, 200)}${r.text.length > 200 ? '...' : ''}`
    ).join('\n\n');
}

export async function handleSystemStatus(client: YuiHubClient): Promise<string> {
  try {
    const health = await client.health();
    return `Status: ${health.status}\nVersion: ${health.version}`;
  } catch (error) {
    return `Status: offline\nError: ${(error as Error).message}`;
  }
}
