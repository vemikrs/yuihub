/**
 * Unit tests for Agent core
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent, AgentConfig } from '../../src/engine/agent/core.js';
import { IGenAIService, GenAIResult } from '../../src/engine/ai/types.js';
import { ToolDef } from '../../src/engine/ai/tools.js';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock GenAI Service
function createMockGenAI(responses: GenAIResult[]): IGenAIService {
  let index = 0;
  return {
    init: vi.fn().mockResolvedValue(undefined),
    getModelName: vi.fn().mockReturnValue('mock-model'),
    generate: vi.fn().mockImplementation(async () => {
      if (index >= responses.length) {
        return { text: 'No more responses' };
      }
      return responses[index++];
    }),
    stream: vi.fn().mockImplementation(async function* () {
      yield 'mock stream';
    }),
  };
}

describe('Agent', () => {
  let testDir: string;
  let dataDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agent-test-${Date.now()}`);
    dataDir = join(testDir, 'data');
    await mkdir(dataDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an Agent instance', () => {
      const mockGenAI = createMockGenAI([{ text: 'Hello' }]);
      const agent = new Agent({
        genAI: mockGenAI,
        rootDir: testDir,
        dataDir: dataDir,
        sessionId: 'test-session',
      });
      expect(agent).toBeDefined();
    });
  });

  describe('run', () => {
    it('should return final answer when no tool calls', async () => {
      const mockGenAI = createMockGenAI([{ text: 'The answer is 42.' }]);
      const agent = new Agent({
        genAI: mockGenAI,
        rootDir: testDir,
        dataDir: dataDir,
        sessionId: 'test-run-1',
      });

      const result = await agent.run('What is the meaning of life?');
      
      expect(result).toBe('The answer is 42.');
      expect(mockGenAI.generate).toHaveBeenCalledTimes(1);
    });

    it('should return max turns message when limit reached', async () => {
      // Create responses that always request tool calls
      const toolCallResponse: GenAIResult = {
        text: 'Thinking...',
        toolCalls: [{ name: 'list_files', args: { path: '.' }, id: 'call_1' }],
      };
      const responses = Array(15).fill(toolCallResponse);
      const mockGenAI = createMockGenAI(responses);

      const agent = new Agent({
        genAI: mockGenAI,
        rootDir: testDir,
        dataDir: dataDir,
        sessionId: 'test-run-2',
      });

      const result = await agent.run('Loop forever');
      
      expect(result).toBe('Agent max turns reached.');
    });

    it('should execute tool calls and continue loop', async () => {
      const mockGenAI = createMockGenAI([
        {
          text: 'Let me list files.',
          toolCalls: [{ name: 'list_files', args: { path: '.' }, id: 'call_1' }],
        },
        { text: 'Here are the files.' },
      ]);

      const agent = new Agent({
        genAI: mockGenAI,
        rootDir: testDir,
        dataDir: dataDir,
        sessionId: 'test-run-3',
      });

      const result = await agent.run('List files');
      
      expect(result).toBe('Here are the files.');
      expect(mockGenAI.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe('executeTool', () => {
    it('should return error for unknown tool', async () => {
      const mockGenAI = createMockGenAI([
        {
          text: 'Trying unknown tool.',
          toolCalls: [{ name: 'unknown_tool', args: {}, id: 'call_1' }],
        },
        { text: 'Done.' },
      ]);

      const agent = new Agent({
        genAI: mockGenAI,
        rootDir: testDir,
        dataDir: dataDir,
        sessionId: 'test-exec-1',
      });

      const result = await agent.run('Use unknown tool');
      
      // Should still return final answer after tool error
      expect(result).toBe('Done.');
    });
  });
});
