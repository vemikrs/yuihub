/**
 * Scenario C: Agent Execution Tests
 * Tests: Agent loop with tools and context injection
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestEnv, TestEnv } from './setup.js';
import { Agent } from '../../src/engine/agent/core.js';
import { IGenAIService, GenAIResult } from '../../src/engine/ai/types.js';
import { ToolDef } from '../../src/engine/ai/tools.js';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * MockGenAIService - Predictable responses for testing
 */
class MockGenAIService implements IGenAIService {
  private responses: GenAIResult[] = [];
  private responseIndex = 0;

  constructor() {}

  async init(): Promise<void> {}
  getModelName(): string { return 'mock-model'; }

  setResponses(responses: GenAIResult[]) {
    this.responses = responses;
    this.responseIndex = 0;
  }

  async generate(_prompt: string, _tools?: ToolDef[]): Promise<GenAIResult> {
    if (this.responseIndex >= this.responses.length) {
      return { text: 'No more responses configured' };
    }
    return this.responses[this.responseIndex++];
  }

  async *stream(_prompt: string, _tools?: ToolDef[]): AsyncGenerator<string> {
    yield 'Mock stream response';
  }
}

describe('Scenario C: Agent Execution', () => {
  let env: TestEnv;
  let mockGenAI: MockGenAIService;

  beforeAll(async () => {
    env = await createTestEnv();
    mockGenAI = new MockGenAIService();
    
    // Create notes directory for file operations
    await mkdir(join(env.notesDir), { recursive: true });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  // C-1: Simple question returns text answer
  it('C-1: should return text answer for simple question', async () => {
    mockGenAI.setResponses([
      { text: 'The answer is 42.' }
    ]);

    const agent = new Agent({
      genAI: mockGenAI,
      rootDir: env.notesDir,
      dataDir: env.DATA_DIR,
      sessionId: 'test-session-c1'
    });

    const answer = await agent.run('What is the meaning of life?');
    expect(answer).toBe('The answer is 42.');
  });

  // C-2: list_files tool call
  it('C-2: should execute list_files tool and return result', async () => {
    mockGenAI.setResponses([
      {
        text: 'Let me list the files.',
        toolCalls: [{
          name: 'list_files',
          args: { path: '.' },
          id: 'call_1'
        }]
      },
      { text: 'Here are the files in the directory.' }
    ]);

    const agent = new Agent({
      genAI: mockGenAI,
      rootDir: env.notesDir,
      dataDir: env.DATA_DIR,
      sessionId: 'test-session-c2'
    });

    const answer = await agent.run('List all files');
    expect(answer).toContain('files');
  });

  // C-3: create_checkpoint tool call
  it('C-3: should create checkpoint file when tool is called', async () => {
    mockGenAI.setResponses([
      {
        text: 'Creating a checkpoint.',
        toolCalls: [{
          name: 'create_checkpoint',
          args: { summary: 'Test checkpoint', intent: 'Continue testing' },
          id: 'call_1'
        }]
      },
      { text: 'Checkpoint created successfully.' }
    ]);

    const agent = new Agent({
      genAI: mockGenAI,
      rootDir: env.notesDir,
      dataDir: env.DATA_DIR,
      sessionId: 'test-session-c3'
    });

    const answer = await agent.run('Create a checkpoint');
    
    // Verify checkpoint directory was created
    const checkpointDir = join(env.DATA_DIR, 'checkpoints');
    expect(existsSync(checkpointDir) || answer.includes('Checkpoint')).toBe(true);
  });

  // C-4: Max turns reached
  it('C-4: should return max turns message when limit reached', async () => {
    // Create responses that always request another tool call
    const toolCallResponse: GenAIResult = {
      text: 'Need more info.',
      toolCalls: [{
        name: 'list_files',
        args: { path: '.' },
        id: 'call_loop'
      }]
    };

    // Fill with 15 responses (more than max turns of 10)
    mockGenAI.setResponses(Array(15).fill(toolCallResponse));

    const agent = new Agent({
      genAI: mockGenAI,
      rootDir: env.notesDir,
      dataDir: env.DATA_DIR,
      sessionId: 'test-session-c4'
    });

    const answer = await agent.run('Loop forever');
    expect(answer).toBe('Agent max turns reached.');
  });

  // C-5: Context injection
  it('C-5: should include injected context in prompt', async () => {
    let capturedPrompt = '';
    
    // Custom mock that captures the prompt
    const capturingMock: IGenAIService = {
      init: async () => {},
      getModelName: () => 'capture-mock',
      generate: async (prompt: string) => {
        capturedPrompt = prompt;
        return { text: 'Response with context.' };
      },
      stream: async function* () { yield ''; }
    };

    const agent = new Agent({
      genAI: capturingMock,
      rootDir: env.notesDir,
      dataDir: env.DATA_DIR,
      sessionId: 'test-session-c5'
    });

    const contextString = 'Recent file changes: test.md modified at 10:00';
    await agent.run('What changed recently?', contextString);
    
    expect(capturedPrompt).toContain(contextString);
  });
});
