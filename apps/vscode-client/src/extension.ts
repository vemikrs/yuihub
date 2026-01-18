import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { readToken, getDefaultDataDir } from './auth.js';

// --- Types ---
type Health = { ok: boolean; version?: string; status?: string };
type SearchHit = { 
  id: string; 
  text: string; 
  score?: number; 
  source?: string; 
  tags?: string[];
  session_id?: string;
};
type SearchResponse = { ok: boolean; results: SearchHit[] }; // V1 API: { results: [...] }
type SaveResponse = { ok: boolean; count: number }; // V1 API: { count: number }

// --- Configuration Helper ---
const SECRET_API_KEY = 'yuihub.apiKey';
let secretToken: string | undefined;
let fileToken: string | undefined;

function cfg<T = string>(key: string): T {
  return vscode.workspace.getConfiguration().get<T>(key)!;
}
function baseUrl() { return cfg<string>('yuihub.apiBaseUrl').replace(/\/$/, ''); }
function apiKey() { 
  // Priority: Secret Storage > File-based Token > Settings
  return secretToken || fileToken || cfg<string>('yuihub.apiKey'); 
}

// --- Logger ---
const out = vscode.window.createOutputChannel('YuiHub');

function log(msg: string) {
  out.appendLine(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

// --- HTTP Client ---
async function fetchApi<T>(method: 'GET' | 'POST', path: string, body?: any): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const token = apiKey();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  log(`${method} ${url}`);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
    }
    
    return await res.json() as T;
  } catch (e: any) {
    log(`ERROR: ${e.message}`);
    vscode.window.showErrorMessage(`YuiHub API Error: ${e.message}`);
    throw e;
  }
}

// --- Search Provider ---
class SearchResultsProvider implements vscode.TreeDataProvider<SearchHit> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SearchHit | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private results: SearchHit[] = [];

  constructor() {}

  refresh(hits: SearchHit[]) {
    this.results = hits;
    this._onDidChangeTreeData.fire();
  }

  clear() {
    this.results = [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SearchHit): vscode.TreeItem {
    const item = new vscode.TreeItem(element.text.slice(0, 60).replace(/\n/g, ' ') || element.id);
    item.description = `Score: ${element.score?.toFixed(2) ?? 'N/A'}`;
    item.tooltip = `${element.text}\nSource: ${element.source}`;
    item.command = {
      command: 'yuihub.openSearchResult',
      title: 'Open Result',
      arguments: [element]
    };
    return item;
  }

  getChildren(): SearchHit[] {
    return this.results;
  }
}

// --- Main Activation ---
export function activate(context: vscode.ExtensionContext) {
  log('Activating YuiHub Client V1...');

  // File-based Token Init (read from ~/.yuihub/.token)
  readToken().then(token => {
    if (token) {
      fileToken = token;
      log('Loaded token from file-based handshake');
    }
  });

  // Secret Storage Init
  context.secrets.get(SECRET_API_KEY).then(v => secretToken = v);
  context.subscriptions.push(context.secrets.onDidChange(async e => {
    if (e.key === SECRET_API_KEY) secretToken = await context.secrets.get(SECRET_API_KEY);
  }));

  // Tree View
  const searchProvider = new SearchResultsProvider();
  vscode.window.createTreeView('yuihub.results', { treeDataProvider: searchProvider });

  // 1. Smoke Test
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.smokeTest', async () => {
    try {
      const res = await fetchApi<Health>('GET', '/health');
      vscode.window.showInformationMessage(`YuiHub Connected: ${res.status} (v${res.version})`);
    } catch {
      vscode.window.showErrorMessage('YuiHub Connection Failed');
    }
  }));

  // 2. Set API Token
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.setApiToken', async () => {
    const token = await vscode.window.showInputBox({ 
      prompt: 'Enter YuiHub Bearer Token', 
      password: true 
    });
    if (token !== undefined) {
      await context.secrets.store(SECRET_API_KEY, token);
      vscode.window.showInformationMessage('Token Saved');
    }
  }));

  // 3. Search
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.search', async () => {
    const q = await vscode.window.showInputBox({ prompt: 'Search Memory...' });
    if (!q) return;

    try {
      // V1 Search Schema: q, limit
      const limit = cfg<number>('yuihub.searchLimit') || 10;
      // Construct Query String manually or use URLSearchParams (if available in env)
      const params = new URLSearchParams({ q, limit: limit.toString() });
      const res = await fetchApi<SearchResponse>('GET', `/search?${params.toString()}`);
      
      if (res.ok && res.results) {
        searchProvider.refresh(res.results);
        vscode.window.showInformationMessage(`Found ${res.results.length} results`);
      }
    } catch (e) {
      searchProvider.clear();
    }
  }));

  // 4. Save Selection (Local First Session ID)
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.saveSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const text = editor.document.getText(editor.selection) || editor.document.getText();
    if (!text.trim()) return;

    // Get Session ID (Thread)
    // Priority: User Input -> Workspace State -> Generate New
    let sessionId = context.workspaceState.get<string>('yuihub.sessionId');
    if (!sessionId) {
      const choice = await vscode.window.showQuickPick(['New Session', 'Enter Session ID'], { placeHolder: 'Select Session Strategy' });
      if (!choice) return;
      
      if (choice === 'Enter Session ID') {
        sessionId = await vscode.window.showInputBox({ prompt: 'Session/Thread ID' });
      } else {
        sessionId = randomUUID(); // Generate Local UUID
      }
      
      if (sessionId) {
        await context.workspaceState.update('yuihub.sessionId', sessionId);
      }
    }

    if (!sessionId) return; // Cancelled

    // Source Info
    const source = vscode.workspace.asRelativePath(editor.document.uri);
    
    try {
      // V1 /save Payload
      await fetchApi<SaveResponse>('POST', '/save', {
        entries: [{
          id: randomUUID(),
          text,
          mode: 'private',
          source,
          session_id: sessionId
        }]
      });
      vscode.window.showInformationMessage(`Saved to Session: ${sessionId}`);
    } catch {
      // Error handled in fetchApi
    }
  }));

  // 5. Open Search Result
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.openSearchResult', async (hit: SearchHit) => {
    // Open in virtual doc or preview
    const doc = await vscode.workspace.openTextDocument({ 
      content: `// Source: ${hit.source}\n// Score: ${hit.score}\n\n${hit.text}`, 
      language: 'markdown' 
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  }));

  // 6. Create Checkpoint (Decision Anchor)
  type CheckpointResponse = { ok: boolean; checkpoint: { id: string; session_id: string; created_at: string } };
  
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.createCheckpoint', async () => {
    // Get current session
    const sessionId = context.workspaceState.get<string>('yuihub.sessionId');
    if (!sessionId) {
      vscode.window.showWarningMessage('No active session. Save something first to create a session.');
      return;
    }

    // Get checkpoint details from user
    const summary = await vscode.window.showInputBox({ 
      prompt: 'Checkpoint Summary (decision/conclusion)',
      placeHolder: 'e.g., Decided to use React for the frontend'
    });
    if (!summary) return;

    const intent = await vscode.window.showInputBox({ 
      prompt: 'Current Intent/Goal',
      placeHolder: 'e.g., Building the user dashboard'
    });
    if (!intent) return;

    try {
      const res = await fetchApi<CheckpointResponse>('POST', '/checkpoints', {
        session_id: sessionId,
        summary,
        intent
      });
      vscode.window.showInformationMessage(`Checkpoint created: ${res.checkpoint.id}`);
    } catch {
      // Error handled in fetchApi
    }
  }));

  // 7. Install MCP Server (Antigravity/Cursor)
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.installMcpServer', async () => {
    const os = await import('os');
    const fs = await import('fs');
    const path = await import('path');
    
    const home = os.homedir();
    
    // MCP Server configuration
    const mcpConfig = {
      yuihub: {
        command: 'node',
        args: [path.join(context.extensionPath, '..', 'v1', 'mcp-server', 'dist', 'index.js')]
      }
    };
    
    // Config file paths
    const configPaths = [
      { name: 'Antigravity', path: path.join(home, '.gemini', 'antigravity', 'mcp_config.json') },
      { name: 'Cursor (Global)', path: path.join(home, '.cursor', 'mcp.json') },
    ];
    
    const results: string[] = [];
    
    for (const config of configPaths) {
      try {
        // Ensure directory exists
        const dir = path.dirname(config.path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Read existing config or create new
        let existing: any = { mcpServers: {} };
        if (fs.existsSync(config.path)) {
          try {
            existing = JSON.parse(fs.readFileSync(config.path, 'utf-8'));
            if (!existing.mcpServers) existing.mcpServers = {};
          } catch {
            existing = { mcpServers: {} };
          }
        }
        
        // Add YuiHub MCP Server
        existing.mcpServers.yuihub = mcpConfig.yuihub;
        
        // Write back
        fs.writeFileSync(config.path, JSON.stringify(existing, null, 2) + '\n');
        results.push(`✅ ${config.name}`);
      } catch (e: any) {
        results.push(`❌ ${config.name}: ${e.message}`);
      }
    }
    
    const message = `MCP Server Installed:\n${results.join('\n')}\n\nRestart Antigravity/Cursor to activate.`;
    vscode.window.showInformationMessage(message, 'OK');
    log(message);
  }));

  // --- Language Model Tools Registration ---
  // These tools are exposed to Copilot/Antigravity for AI-assisted workflows
  
  // Tool: yuihub_save_thought
  context.subscriptions.push(vscode.lm.registerTool('yuihub_save_thought', {
    async invoke(options, token) {
      const { text, session_id, tags, mode } = options.input as any;
      try {
        const res = await fetchApi<SaveResponse>('POST', '/save', {
          entries: [{
            text,
            session_id,
            tags: tags || [],
            mode: mode || 'private'
          }]
        });
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Saved ${res.count} entry to session ${session_id}`)
        ]);
      } catch (e: any) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Error: ${e.message}`)
        ]);
      }
    }
  }));

  // Tool: yuihub_search_memory
  context.subscriptions.push(vscode.lm.registerTool('yuihub_search_memory', {
    async invoke(options, token) {
      const { query, limit, session, tag } = options.input as any;
      try {
        const params = new URLSearchParams({ q: query, limit: String(limit || 10) });
        if (session) params.append('session', session);
        if (tag) params.append('tag', tag);
        
        const res = await fetchApi<SearchResponse>('GET', `/search?${params}`);
        const formatted = res.results.map((r, i) => 
          `[${i + 1}] (score: ${r.score?.toFixed(3) ?? 'N/A'})\n${r.text.slice(0, 200)}${r.text.length > 200 ? '...' : ''}`
        ).join('\n\n');
        
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(formatted || 'No results found.')
        ]);
      } catch (e: any) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Error: ${e.message}`)
        ]);
      }
    }
  }));

  // Tool: yuihub_start_session
  type ThreadResponse = { ok: boolean; session: { id: string; title: string; created_at: string } };
  context.subscriptions.push(vscode.lm.registerTool('yuihub_start_session', {
    async invoke(options, token) {
      const { title } = options.input as any;
      try {
        const res = await fetchApi<ThreadResponse>('POST', '/threads/new', { title });
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Created new session:\nID: ${res.session.id}\nTitle: ${res.session.title}\nCreated: ${res.session.created_at}`)
        ]);
      } catch (e: any) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Error: ${e.message}`)
        ]);
      }
    }
  }));

  // Tool: yuihub_fetch_context
  type ContextResponse = { ok: boolean; packet: { intent: string; session_id?: string; long_term_memory: Array<{ text: string; relevance: number }>; meta: { mode: string } } };
  context.subscriptions.push(vscode.lm.registerTool('yuihub_fetch_context', {
    async invoke(options, token) {
      const { intent, session } = options.input as any;
      try {
        const params = new URLSearchParams();
        if (intent) params.append('q', intent);
        if (session) params.append('session', session);
        
        const res = await fetchApi<ContextResponse>('GET', `/export/context?${params}`);
        const memories = res.packet.long_term_memory.map((m, i) => 
          `[${i + 1}] (relevance: ${m.relevance.toFixed(3)})\n${m.text.slice(0, 200)}${m.text.length > 200 ? '...' : ''}`
        ).join('\n\n');
        
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Intent: ${res.packet.intent}\nSession: ${res.packet.session_id || 'N/A'}\nMode: ${res.packet.meta.mode}\n\nLong-term Memory:\n${memories || 'No relevant memories found.'}`)
        ]);
      } catch (e: any) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Error: ${e.message}`)
        ]);
      }
    }
  }));

  // Tool: yuihub_create_checkpoint
  context.subscriptions.push(vscode.lm.registerTool('yuihub_create_checkpoint', {
    async invoke(options, token) {
      const { session_id, summary, intent, working_memory, entry_ids } = options.input as any;
      try {
        const res = await fetchApi<CheckpointResponse>('POST', '/checkpoints', {
          session_id,
          summary,
          intent,
          working_memory,
          entry_ids
        });
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Created checkpoint:\nID: ${res.checkpoint.id}\nSession: ${res.checkpoint.session_id}\nCreated: ${res.checkpoint.created_at}`)
        ]);
      } catch (e: any) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Error: ${e.message}`)
        ]);
      }
    }
  }));

  log('Language Model Tools registered (5 tools)');
}

export function deactivate() {}