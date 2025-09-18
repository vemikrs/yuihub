# YuiHub Workspace Configuration

# Copilot should understand these key concepts:

## Architecture Patterns
- **Adapter Pattern**: StorageAdapter for multiple backends (Local, GitHub, Notion)
- **Strategy Pattern**: SearchService with pluggable search engines
- **Facade Pattern**: MCP Server wrapping HTTP API
- **Observer Pattern**: GitHub Actions for automated index updates

## Data Flow
```
User Input → MCP/HTTP → Business Logic → Storage Adapter → File System/GitHub
                     ↓
                Search Index ← Lunr Processor ← Markdown Parser
```

## Error Handling Strategy
- Use structured error responses: `{ ok: false, error: "message", code: "ERROR_CODE" }`
- Log errors with context but never log sensitive data
- Graceful degradation for non-critical features
- Validate all external inputs

## Performance Considerations  
- Index operations are async and may take time
- Search queries should timeout after reasonable duration
- Memory usage is important for large chat log collections
- Use streaming for large file operations

## Security Model
- No authentication by design (local/private use)
- Input sanitization for all user data
- Environment variable isolation for secrets
- Git ignore for all sensitive files

## Testing Philosophy
- Integration tests over unit tests for this architecture
- Use curl for API endpoint testing
- VS Code Tasks for automated testing workflows
- Manual testing with real AI clients (ChatGPT, Claude)

## Development Workflow
1. Use VS Code Tasks for all server operations
2. Debug with integrated debugger (never terminal node commands)
3. Test locally before Cloudflare Tunnel deployment
4. Verify search index after any schema changes

## Code Review Checklist
- [ ] Error handling implemented
- [ ] Input validation added
- [ ] Logging appropriate (no sensitive data)
- [ ] VS Code integration working
- [ ] Security considerations addressed
- [ ] Performance impact evaluated