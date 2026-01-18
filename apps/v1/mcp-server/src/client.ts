/**
 * YuiHub MCP Server - HTTP Client
 * Communicates with YuiHub Backend API
 */

import { YuiHubMCPError } from './errors.js';

export interface ClientConfig {
  baseUrl: string;
  token: string;
}

export interface SaveEntry {
  text: string;
  session_id: string;
  tags?: string[];
  mode?: 'private' | 'public';
}

export interface SearchFilter {
  tag?: string;
  session?: string;
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  mode: string;
  tags: string;
  session_id: string;
  source: string;
  date: string;
}

export interface Session {
  id: string;
  title: string;
  created_at: string;
}

export interface Checkpoint {
  id: string;
  session_id: string;
  snapshot: {
    working_memory: string;
    decision_rationale: string;
  };
  intent: string;
  entry_ids: string[];
  created_at: string;
}

export interface ContextPacket {
  intent: string;
  session_id?: string;
  working_memory: Record<string, unknown>;
  long_term_memory: Array<{
    text: string;
    relevance: number;
  }>;
  meta: {
    mode: string;
  };
}

export interface HealthStatus {
  status: string;
  version: string;
}

export class YuiHubClient {
  private baseUrl: string;
  private token: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text();
        
        if (response.status === 401) {
          throw new YuiHubMCPError(-32001, `Unauthorized: ${text}`);
        }
        if (response.status === 400) {
          throw new YuiHubMCPError(-32602, `Invalid params: ${text}`);
        }
        if (response.status === 429) {
          throw new YuiHubMCPError(-32003, `Rate limited: ${text}`);
        }
        if (response.status >= 500) {
          throw new YuiHubMCPError(-32603, `Internal error: ${text}`);
        }
        
        throw new YuiHubMCPError(-32603, `HTTP ${response.status}: ${text}`);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof YuiHubMCPError) {
        throw error;
      }
      
      // Connection error
      throw new YuiHubMCPError(-32002, `Backend not reachable at ${this.baseUrl}: ${(error as Error).message}`);
    }
  }

  // Health check
  async health(): Promise<HealthStatus> {
    const res = await this.request<{ status: string; version: string }>('GET', '/health');
    return res;
  }

  // Save entries
  async save(entries: SaveEntry[]): Promise<{ ok: boolean; count: number }> {
    return this.request('POST', '/save', {
      entries: entries.map(e => ({
        text: e.text,
        mode: e.mode || 'private',
        tags: e.tags || [],
        session_id: e.session_id,
      })),
    });
  }

  // Search memory
  async search(query: string, limit = 10, filter?: SearchFilter): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    if (filter?.tag) params.set('tag', filter.tag);
    if (filter?.session) params.set('session', filter.session);
    
    const res = await this.request<{ ok: boolean; results: SearchResult[] }>('GET', `/search?${params}`);
    return res.results;
  }

  // Create new session/thread
  async createThread(title?: string): Promise<Session> {
    const res = await this.request<{ ok: boolean; session: Session }>('POST', '/threads/new', { title });
    return res.session;
  }

  // Create checkpoint
  async createCheckpoint(params: {
    session_id: string;
    summary: string;
    intent: string;
    working_memory?: Record<string, unknown>;
    entry_ids?: string[];
  }): Promise<Checkpoint> {
    const res = await this.request<{ ok: boolean; checkpoint: Checkpoint }>('POST', '/checkpoints', params);
    return res.checkpoint;
  }

  // Export context
  async exportContext(intent?: string, session?: string): Promise<ContextPacket> {
    const params = new URLSearchParams();
    if (intent) params.set('q', intent);
    if (session) params.set('session', session);
    
    const query = params.toString();
    const res = await this.request<{ ok: boolean; packet: ContextPacket }>('GET', `/export/context${query ? '?' + query : ''}`);
    return res.packet;
  }
}

export function createClient(config: ClientConfig): YuiHubClient {
  return new YuiHubClient(config);
}
