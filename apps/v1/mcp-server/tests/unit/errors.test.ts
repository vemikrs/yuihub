/**
 * MCP Server Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YuiHubMCPError, toMCPError } from '../../src/errors.js';

describe('YuiHubMCPError', () => {
  it('should create error with code and message', () => {
    const error = new YuiHubMCPError(-32001, 'Unauthorized');
    
    expect(error.code).toBe(-32001);
    expect(error.message).toBe('Unauthorized');
    expect(error.name).toBe('YuiHubMCPError');
  });

  it('should include optional data', () => {
    const error = new YuiHubMCPError(-32602, 'Invalid params', { field: 'session_id' });
    
    expect(error.data).toEqual({ field: 'session_id' });
  });
});

describe('toMCPError', () => {
  it('should return YuiHubMCPError as-is', () => {
    const original = new YuiHubMCPError(-32001, 'Test');
    const result = toMCPError(original);
    
    expect(result).toBe(original);
  });

  it('should convert Error to YuiHubMCPError with -32603', () => {
    const error = new Error('Something went wrong');
    const result = toMCPError(error);
    
    expect(result).toBeInstanceOf(YuiHubMCPError);
    expect(result.code).toBe(-32603);
    expect(result.message).toBe('Something went wrong');
  });

  it('should convert string to YuiHubMCPError', () => {
    const result = toMCPError('Unknown error');
    
    expect(result).toBeInstanceOf(YuiHubMCPError);
    expect(result.code).toBe(-32603);
    expect(result.message).toBe('Unknown error');
  });
});
