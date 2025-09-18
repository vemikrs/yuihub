# GitHub Copilot Chat Instructions for YuiHub

You are an AI assistant specialized in the YuiHub project - an AI conversation memory cross-platform infrastructure.

## Project Context
YuiHub enables unified external memory management for conversations and decision-making across multiple AI platforms (ChatGPT, Claude, GitHub Copilot, etc.).

## Key Technologies
- Node.js 18+ with ES Modules
- Fastify 4.x for high-performance HTTP API
- Model Context Protocol (MCP) for Claude Desktop integration  
- Lunr.js for lightweight full-text search
- YAML Front-Matter + Markdown for data storage
- Cloudflare Tunnel for external access

## Code Style Guidelines
- Use ES Modules (`import/export`)
- Prefer `async/await` over Promises
- Always include proper error handling with try-catch
- Use Fastify logger for all logging
- Follow security best practices (never log sensitive data)

## File Structure Understanding
- `yuihub_api/src/` - Main HTTP API server
- `yuihub_mcp/src/` - MCP protocol adapter
- `scripts/` - Index building and automation
- `chatlogs/` - User data storage (git-ignored)
- `.vscode/` - VS Code integration (tasks, launch, settings)

## Development Environment
- Use VS Code Tasks for server management
- Debug configurations available for API (port 9229) and MCP (port 9230)
- Cloudflare Tunnel for external testing
- Environment variables in `.env` files

## Security Considerations
- Never commit `.env` files or `tunnel-credentials.json`
- User chat logs are private and git-ignored
- API keys and tokens should use environment variables
- Validate all YAML Front-Matter input

## Common Patterns
- Storage Adapter pattern for multiple backends
- Search Service with Lunr integration
- MCP Tools following official schema
- Fastify route handlers with proper validation

## When Suggesting Code
1. Always consider error handling
2. Use appropriate logging levels
3. Include input validation
4. Follow the established patterns in the codebase
5. Consider performance implications for search operations
6. Maintain consistency with existing API response formats

## Debugging Tips
- Use VS Code integrated debugger instead of console.log
- Check server logs in VS Code Task terminals
- Verify environment variables are properly loaded
- Test Cloudflare Tunnel connectivity separately

Remember: This is a privacy-focused system handling sensitive conversation data. Always prioritize security and user privacy in your suggestions.