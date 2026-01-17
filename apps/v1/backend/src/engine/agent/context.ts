/**
 * AgentContext - Manages working memory and session state for the Agent loop
 */
import { Checkpoint } from '@yuihub/core';
import fs from 'fs-extra';
import path from 'path';
import { ulid } from 'ulid';

export interface ContextPacket {
  session_id: string;
  intent: string;
  working_memory: Record<string, unknown>;
  checkpoints: Checkpoint[];
  created_at: string;
  updated_at: string;
}

export interface IAgentContext {
  getPacket(): ContextPacket;
  getIntent(): string;
  setIntent(intent: string): void;
  getWorkingMemory(): Record<string, unknown>;
  setWorkingMemory(key: string, value: unknown): void;
  createCheckpoint(summary: string, intent: string): Promise<Checkpoint>;
  save(): Promise<void>;
}

export class AgentContext implements IAgentContext {
  private packet: ContextPacket;
  private dataDir: string;

  constructor(sessionId: string, dataDir: string) {
    this.dataDir = dataDir;
    this.packet = {
      session_id: sessionId,
      intent: '',
      working_memory: {},
      checkpoints: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  getPacket(): ContextPacket {
    return { ...this.packet };
  }

  getIntent(): string {
    return this.packet.intent;
  }

  setIntent(intent: string): void {
    this.packet.intent = intent;
    this.packet.updated_at = new Date().toISOString();
  }

  getWorkingMemory(): Record<string, unknown> {
    return { ...this.packet.working_memory };
  }

  setWorkingMemory(key: string, value: unknown): void {
    this.packet.working_memory[key] = value;
    this.packet.updated_at = new Date().toISOString();
  }

  async createCheckpoint(summary: string, intent: string): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: ulid(),
      entry_id: '', // No linked entry for agent-created checkpoints
      snapshot: {
        working_memory: JSON.stringify(this.packet.working_memory),
        decision_rationale: summary,
      },
      created_at: new Date().toISOString(),
    };

    this.packet.checkpoints.push(checkpoint);
    this.packet.intent = intent;
    this.packet.updated_at = new Date().toISOString();

    // Persist checkpoint to file
    const checkpointDir = path.join(this.dataDir, 'checkpoints');
    await fs.ensureDir(checkpointDir);
    const checkpointFile = path.join(checkpointDir, `${checkpoint.id}.json`);
    await fs.writeJson(checkpointFile, checkpoint, { spaces: 2 });

    return checkpoint;
  }

  // Static factory to load existing context from session
  static async loadOrCreate(sessionId: string, dataDir: string): Promise<AgentContext> {
    const contextFile = path.join(dataDir, 'contexts', `${sessionId}.json`);
    const context = new AgentContext(sessionId, dataDir);

    if (await fs.pathExists(contextFile)) {
      const savedPacket = await fs.readJson(contextFile);
      context.packet = { ...context.packet, ...savedPacket };
    }

    return context;
  }

  async save(): Promise<void> {
    const contextDir = path.join(this.dataDir, 'contexts');
    await fs.ensureDir(contextDir);
    const contextFile = path.join(contextDir, `${this.packet.session_id}.json`);
    await fs.writeJson(contextFile, this.packet, { spaces: 2 });
  }
}
