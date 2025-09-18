#!/usr/bin/env node
/**
 * YuiHub MCP Server - Model Context Protocol interface for YuiHub API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

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

// Tool definitions following the plan
const TOOLS = [
  {
    name: "save_note",
    description: "Save a chat conversation or decision to YuiHub with structured frontmatter and markdown content",
    inputSchema: {
      type: "object",
      properties: {
        frontmatter: {
          type: "object",
          properties: {
            id: { type: "string", description: "ULID identifier (auto-generated if not provided)" },
            date: { type: "string", description: "ISO8601 timestamp (defaults to now)" },
            actors: { 
              type: "array", 
              items: { type: "string" },
              description: "AI actors involved (chatgpt, claude, copilot, etc.)"
            },
            topic: { type: "string", description: "Brief topic or title" },
            tags: { 
              type: "array", 
              items: { type: "string" },
              description: "Classification tags"
            },
            decision: { 
              type: "string", 
              enum: ["採用", "保留", "却下"], 
              description: "Decision status" 
            },
            links: { 
              type: "array", 
              items: { type: "string" },
              description: "Reference URLs"
            }
          },
          required: ["topic"]
        },
        body: { 
          type: "string", 
          description: "Markdown content with conversation details and rationale"
        }
      },
      required: ["frontmatter", "body"]
    }
  },
  {
    name: "search_notes",
    description: "Full-text search across all saved notes using Lunr indexing",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Maximum results" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_recent_decisions",
    description: "Get recently saved decisions and discussions",
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
        const result = await callYuiHubAPI("/save", {
          method: "POST",
          body: JSON.stringify({
            frontmatter: args.frontmatter,
            body: args.body
          })
        });

        return {
          content: [
            {
              type: "text",
              text: `✅ Note saved successfully!\n\nID: ${result.path}\nURL: ${result.url}\n\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to save note: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }

    case "search_notes": {
      try {
        const searchParams = new URLSearchParams({
          q: args.query
        });
        if (args.limit) {
          searchParams.set("limit", args.limit.toString());
        }

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
