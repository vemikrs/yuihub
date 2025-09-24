#!/usr/bin/env node
/**
 * YuiHub MCP Server - Model Context Protocol interface for YuiHub API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ulid } from "ulid";
import { MCPValidators } from "./schemas.js";

// Configuration
const API_BASE = process.env.YUIHUB_API || "http://localhost:3000";
const SERVER_INFO = {
  name: "yuihub-mcp",
  version: "0.1.0"
};

// Create MCP server instance
const server = new Server(
  SERVER_INFO,
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Tool definitions following YuiFlow specification
const TOOLS = [
  {
    name: "save_note",
    description: "Save a message fragment to YuiHub using YuiFlow InputMessage format",
    inputSchema: {
      type: "object",
      properties: {
        id: { 
          type: "string", 
          pattern: "^msg-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$",
          description: "Message ID (auto-generated if not provided)"
        },
        when: { 
          type: "string", 
          format: "date-time",
          description: "ISO8601 timestamp (defaults to now)"
        },
        source: { 
          type: "string", 
          enum: ["gpts", "copilot", "claude", "human"],
          description: "Source of the message"
        },
        thread: { 
          type: "string", 
          pattern: "^th-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$",
          description: "Thread ID that this message belongs to"
        },
        author: { 
          type: "string", 
          description: "Author of the message"
        },
        text: { 
          type: "string", 
          description: "Message content"
        },
        tags: { 
          type: "array", 
          items: { type: "string" },
          description: "Classification tags"
        },
        meta: {
          type: "object",
          properties: {
            intent: { type: "string", description: "Intent description" },
            ref: { type: "string", description: "Reference to other messages" }
          },
          description: "Additional metadata"
        }
      },
      required: ["source", "thread", "author", "text"]
    }
  },
  {
    name: "search_notes",
    description: "Search notes with optional filters for tag and thread",
    inputSchema: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "Text search query (optional if using filters)"
        },
        tag: { 
          type: "string", 
          description: "Filter by specific tag"
        },
        thread: { 
          type: "string", 
          pattern: "^th-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$",
          description: "Filter by specific thread"
        },
        limit: { 
          type: "integer", 
          minimum: 1, 
          maximum: 100, 
          default: 10, 
          description: "Maximum results"
        }
      }
    }
  },
  {
    name: "trigger_agent",
    description: "Trigger an AI agent action with specified payload",
    inputSchema: {
      type: "object",
      properties: {
        id: { 
          type: "string", 
          pattern: "^trg-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$",
          description: "Trigger ID (auto-generated if not provided)"
        },
        when: { 
          type: "string", 
          format: "date-time",
          description: "ISO8601 timestamp (defaults to now)"
        },
        type: { 
          type: "string", 
          description: "Type of agent action (e.g., 'echo', 'summarize', 'analyze')"
        },
        payload: { 
          type: "object", 
          description: "Data to pass to the agent"
        },
        reply_to: { 
          type: "string", 
          pattern: "^th-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$",
          description: "Thread to reply to"
        }
      },
      required: ["type", "payload", "reply_to"]
    }
  },
  {
    name: "get_recent_decisions",
    description: "Get recently saved decisions and discussions (legacy compatibility)",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20, description: "Number of recent items" }
      }
    }
  }
];

// Resource definitions
const RESOURCES = [
  {
    uri: "yui://notes/recent",
    name: "Recent Notes",
    description: "Recently saved notes and decisions",
    mimeType: "application/json"
  },
  {
    uri: "yui://search",
    name: "Search Interface",
    description: "Search across all notes",
    mimeType: "application/json"
  }
];

// Helper function to make API requests with error handling
async function callYuiHubAPI(path, options = {}) {
  try {
    const url = `${API_BASE}${path}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `${SERVER_INFO.name}/${SERVER_INFO.version}`,
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`YuiHub API call failed: ${error.message}`);
    throw new Error(`YuiHub API unavailable: ${error.message}`);
  }
}

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "save_note": {
      try {
        // Validate InputMessage format
        const validation = MCPValidators.inputMessage(args);
        
        if (!validation.success) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Invalid InputMessage format:\n${validation.error.errors.map(e => `- ${e.path.join('.')}: ${e.message}`).join('\n')}`
              }
            ],
            isError: true
          };
        }

        // Call YuiHub API with YuiFlow InputMessage format
        const result = await callYuiHubAPI("/save", {
          method: "POST",
          body: JSON.stringify(validation.data)
        });

        return {
          content: [
            {
              type: "text",
              text: `✅ Message saved successfully!\n\nID: ${result.data.id}\nThread: ${result.data.thread}\nTimestamp: ${result.data.when}\n\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to save message: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }

    case "search_notes": {
      try {
        // Validate search query
        const validation = MCPValidators.searchQuery(args);
        
        if (!validation.success) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Invalid search parameters:\n${validation.error.errors.map(e => `- ${e.path.join('.')}: ${e.message}`).join('\n')}`
              }
            ],
            isError: true
          };
        }

        const validArgs = validation.data;
        const searchParams = new URLSearchParams();
        
        if (validArgs.query) searchParams.set("q", validArgs.query);
        if (validArgs.tag) searchParams.set("tag", validArgs.tag);
        if (validArgs.thread) searchParams.set("thread", validArgs.thread);
        if (validArgs.limit) searchParams.set("limit", validArgs.limit.toString());

        const result = await callYuiHubAPI(`/search?${searchParams}`);
        
        if (result.hits.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `🔍 No results found for "${args.query}"`
              }
            ]
          };
        }

        const formattedResults = result.hits.map((hit, index) => 
          `${index + 1}. **${hit.title}** (Score: ${hit.score.toFixed(2)})\n` +
          `   📁 ${hit.path}\n` +
          `   📅 ${hit.date}\n` +
          `   🏷️  ${hit.tags.join(", ")}\n` +
          `   💭 ${hit.snippet}\n`
        ).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `🔍 Found ${result.hits.length} results for "${args.query}":\n\n${formattedResults}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Search failed: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }

    case "get_recent_decisions": {
      try {
        const searchParams = new URLSearchParams();
        if (args?.limit) {
          searchParams.set("n", args.limit.toString());
        }

        const result = await callYuiHubAPI(`/recent?${searchParams}`);
        
        if (result.items.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "📋 No recent decisions found"
              }
            ]
          };
        }

        const formattedItems = result.items.map((item, index) =>
          `${index + 1}. **${item.topic}** (${item.decision})\n` +
          `   📅 ${item.date}\n` +
          `   📁 ${item.path}\n` +
          `   🏷️  ${item.tags.join(", ")}\n`
        ).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `📋 Recent decisions (${result.items.length} items):\n\n${formattedItems}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to get recent decisions: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }

    case "trigger_agent": {
      try {
        // Validate AgentTrigger format
        const validation = MCPValidators.agentTrigger(args);
        
        if (!validation.success) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Invalid AgentTrigger format:\n${validation.error.errors.map(e => `- ${e.path.join('.')}: ${e.message}`).join('\n')}`
              }
            ],
            isError: true
          };
        }

        // Call YuiHub API with AgentTrigger format
        const result = await callYuiHubAPI("/trigger", {
          method: "POST",
          body: JSON.stringify(validation.data)
        });

        return {
          content: [
            {
              type: "text",
              text: `⚡ Agent trigger ${result.mode === 'shelter' ? 'recorded' : 'executed'} successfully!\n\nRef: ${result.ref}\nMode: ${result.mode}\nMessage: ${result.message}\n\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to trigger agent: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Register resource list handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: RESOURCES };
});

// Register resource read handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "yui://notes/recent": {
      try {
        const result = await callYuiHubAPI("/recent");
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to read recent notes: ${error.message}`);
      }
    }

    case "yui://search": {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({
              message: "Use the search_notes tool to perform searches",
              example: {
                tool: "search_notes",
                arguments: {
                  query: "your search term",
                  limit: 10
                }
              }
            }, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Initialize and start the server
async function main() {
  console.error(`🚀 Starting ${SERVER_INFO.name} v${SERVER_INFO.version}`);
  console.error(`📡 YuiHub API: ${API_BASE}`);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("✅ MCP Server ready");
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
