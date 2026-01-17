/**
 * YuiHub MCP Resources - Registration
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { YuiHubClient } from '../client.js';
import { toMCPError } from '../errors.js';
import { handleRecent, handleSession, handleSystemStatus } from './handlers.js';

export function registerResources(server: Server, client: YuiHubClient): void {
  // List resources handler
  server.setRequestHandler({ method: 'resources/list' } as any, async () => {
    return {
      resources: [
        {
          uri: 'yuihub://recent',
          name: 'Recent Memories',
          description: 'Most recent thoughts and entries',
          mimeType: 'text/plain',
        },
        {
          uri: 'yuihub://system/status',
          name: 'System Status',
          description: 'YuiHub backend health status',
          mimeType: 'text/plain',
        },
      ],
    };
  });

  // Resource templates for dynamic URIs
  server.setRequestHandler({ method: 'resources/templates/list' } as any, async () => {
    return {
      resourceTemplates: [
        {
          uriTemplate: 'yuihub://session/{id}',
          name: 'Session History',
          description: 'All entries for a specific session',
          mimeType: 'text/plain',
        },
      ],
    };
  });

  // Read resource handler
  server.setRequestHandler({ method: 'resources/read' } as any, async (request: any) => {
    const { uri } = request.params;

    try {
      let content: string;

      if (uri === 'yuihub://recent') {
        content = await handleRecent(client);
      } else if (uri === 'yuihub://system/status') {
        content = await handleSystemStatus(client);
      } else if (uri.startsWith('yuihub://session/')) {
        const sessionId = uri.replace('yuihub://session/', '');
        content = await handleSession(client, sessionId);
      } else {
        throw new Error(`Unknown resource: ${uri}`);
      }

      return {
        contents: [{
          uri,
          mimeType: 'text/plain',
          text: content,
        }],
      };
    } catch (error) {
      const mcpError = toMCPError(error);
      throw mcpError;
    }
  });
}
