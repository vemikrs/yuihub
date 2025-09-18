// Minimal MCP server that proxies to YuiHub HTTP API.
import { StdioServerTransport, Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

const API_BASE = process.env.YUIHUB_API || "http://localhost:8787";

const server = new Server(
  { name: "yuihub-mcp", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {} } }
);

const tools = [
  {
    name: "save_note",
    description: "Save note to YuiHub (frontmatter + body)",
    inputSchema: {
      type: "object",
      properties: {
        frontmatter: { type: "object", additionalProperties: true },
        body: { type: "string" }
      },
      required: ["frontmatter","body"]
    }
  },
  {
    name: "search",
    description: "Search notes via YuiHub",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" },
        limit: { type: "number" }
      },
      required: ["q"]
    }
  },
  {
    name: "recent",
    description: "List recent decisions",
    inputSchema: {
      type: "object",
      properties: { n: { type: "number" } }
    }
  }
];

server.setRequestHandler("tools/list", async () => ({ tools }));

server.setRequestHandler("tools/call", async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "save_note") {
    const r = await fetch(`${API_BASE}/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ frontmatter: args.frontmatter, body: args.body })
    });
    return { content: [{ type: "text", text: await r.text() }] };
  }
  if (name === "search") {
    const u = new URL(`${API_BASE}/search`);
    u.searchParams.set("q", args.q);
    if (args.limit) u.searchParams.set("limit", String(args.limit));
    const r = await fetch(u);
    return { content: [{ type: "text", text: await r.text() }] };
  }
  if (name === "recent") {
    const u = new URL(`${API_BASE}/recent`);
    if (args?.n) u.searchParams.set("n", String(args.n));
    const r = await fetch(u);
    return { content: [{ type: "text", text: await r.text() }] };
  }
  throw new Error("unknown tool");
});

const transport = new StdioServerTransport();
await server.connect(transport);
