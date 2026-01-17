/**
 * Auth Module Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    promises: {
      readFile: vi.fn(),
    },
  },
}));

// Need to import after mocking
import { readTokenSync, readToken, getDefaultDataDir } from '../../src/auth.js';

describe('getDefaultDataDir', () => {
  const originalEnv = process.env.DATA_DIR;

  afterEach(() => {
    if (originalEnv) {
      process.env.DATA_DIR = originalEnv;
    } else {
      delete process.env.DATA_DIR;
    }
  });

  it('should return DATA_DIR from env if set', () => {
    process.env.DATA_DIR = '/custom/path';
    expect(getDefaultDataDir()).toBe('/custom/path');
  });

  it('should return ~/.yuihub if DATA_DIR not set', () => {
    delete process.env.DATA_DIR;
    expect(getDefaultDataDir()).toBe(path.join(os.homedir(), '.yuihub'));
  });
});

describe('readTokenSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return token if file exists and is valid', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      token: 'yh-test-token',
      created_at: '2026-01-18T00:00:00Z'
    }));

    const token = readTokenSync('/test/dir');
    
    expect(token).toBe('yh-test-token');
  });

  it('should return undefined if file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const token = readTokenSync('/test/dir');
    
    expect(token).toBeUndefined();
  });

  it('should return undefined if file is invalid JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not json');

    const token = readTokenSync('/test/dir');
    
    expect(token).toBeUndefined();
  });
});

describe('readToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return token if file exists and is valid', async () => {
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
      token: 'yh-async-token',
      created_at: '2026-01-18T00:00:00Z'
    }));

    const token = await readToken('/test/dir');
    
    expect(token).toBe('yh-async-token');
  });

  it('should return undefined if read fails', async () => {
    vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('ENOENT'));

    const token = await readToken('/test/dir');
    
    expect(token).toBeUndefined();
  });
});
