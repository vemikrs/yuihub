import * as vscode from 'vscode';
import { randomUUID } from 'crypto';

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

function cfg<T = string>(key: string): T {
  return vscode.workspace.getConfiguration().get<T>(key)!;
}
function baseUrl() { return cfg<string>('yuihub.apiBaseUrl').replace(/\/$/, ''); }
function apiKey() { return secretToken || cfg<string>('yuihub.apiKey'); }

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

  // 6. Create Checkpoint (Decision Anchor) - Placeholder for Phase 2b
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.createCheckpoint', async () => {
     vscode.window.showInformationMessage('Checkpoint feature coming soon!');
  }));
}

export function deactivate() {}