/**
 * YuiHub MCP Server - Error Definitions
 */

/**
 * MCP Error Codes:
 * -32001: Unauthorized (401)
 * -32002: Backend not reachable
 * -32003: Rate limited (429)
 * -32602: Invalid params (400)
 * -32603: Internal error (500)
 */
export class YuiHubMCPError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'YuiHubMCPError';
    this.code = code;
    this.data = data;
  }
}

/**
 * Convert any error to MCP-compatible error
 */
export function toMCPError(error: unknown): YuiHubMCPError {
  if (error instanceof YuiHubMCPError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new YuiHubMCPError(-32603, error.message);
  }
  
  return new YuiHubMCPError(-32603, String(error));
}
