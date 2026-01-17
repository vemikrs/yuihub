import { IVectorStore } from '../vector-store-types.js';
import { Checkpoint } from '@yuihub/core';

/**
 * AgentContext provides Memory Tools with access to:
 * - Current session state
 * - Vector store for persistence
 * - Working memory for short-term state
 */
export interface AgentContext {
    sessionId: string;
    vectorStore: IVectorStore;
    workingMemory: Map<string, any>;
    dataDir: string; // For checkpoint file creation
}

export interface CheckpointMetadata {
    id: string;
    session_id: string;
    summary: string;
    intent: string;
    timestamp: string;
}
