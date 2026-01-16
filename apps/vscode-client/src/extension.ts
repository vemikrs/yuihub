import * as vscode from 'vscode';

type Health = { ok: boolean; environment?: string; version?: string } & Record<string, any>;
type SearchHit = { id: string; title?: string; snippet?: string; thread?: string; path?: string; url?: string; score?: number; date?: string; tags?: string[]; source?: string };
type SearchResponse = { ok: boolean; total: number; hits: SearchHit[] };
type SaveResponse = { ok: boolean; data?: { id: string; thread: string; when: string } };

// Output channel for diagnostics
const out = vscode.window.createOutputChannel('YuiHub');

// Search Results Tree View Classes
class SearchResultItem extends vscode.TreeItem {
  constructor(
    public readonly hit: SearchHit,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private readonly extensionUri: vscode.Uri
  ) {
    super(hit.title || hit.snippet?.slice(0, 60) || hit.id, collapsibleState);
    this.tooltip = this.createTooltip();
    this.description = `score: ${hit.score?.toFixed(2) ?? 'N/A'}`;
    this.contextValue = 'searchHit';
    
    // Use custom search icon
    const iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'search-icon.svg');
    this.iconPath = {
      light: iconPath,
      dark: iconPath
    };
    
    // Click command
    this.command = {
      command: 'yuihub.openSearchResult',
      title: 'Open Search Result',
      arguments: [this.hit]
    };
  }

  private createTooltip(): string {
    const parts: string[] = [];
    parts.push(`ID: ${this.hit.id}`);
    if (this.hit.thread) parts.push(`Thread: ${this.hit.thread}`);
    if (this.hit.path) parts.push(`Path: ${this.hit.path}`);
    if (this.hit.date) parts.push(`Date: ${this.hit.date}`);
    if (this.hit.score !== undefined) parts.push(`Score: ${this.hit.score.toFixed(3)}`);
    if (this.hit.snippet) parts.push(`\n${this.hit.snippet}`);
    return parts.join('\n');
  }
}

class SearchResultsProvider implements vscode.TreeDataProvider<SearchResultItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SearchResultItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private searchResults: SearchHit[] = [];
  private totalResults = 0;

  constructor(private readonly extensionUri: vscode.Uri) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setResults(hits: SearchHit[], total: number): void {
    this.searchResults = hits;
    this.totalResults = total;
    this.refresh();
  }

  clearResults(): void {
    this.searchResults = [];
    this.totalResults = 0;
    this.refresh();
  }

  getTreeItem(element: SearchResultItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SearchResultItem): Thenable<SearchResultItem[]> {
    if (element) {
      return Promise.resolve([]);
    } else {
      if (this.searchResults.length === 0) {
        return Promise.resolve([]);
      }
      
      const items = this.searchResults.map(hit => 
        new SearchResultItem(hit, vscode.TreeItemCollapsibleState.None, this.extensionUri)
      );
      return Promise.resolve(items);
    }
  }

  getResultsCount(): number {
    return this.totalResults;
  }
}

// Secret storage key
const SECRET_API_KEY = 'yuihub.apiKey';
let secretToken: string | undefined;

function cfg<T = string>(key: string): T {
  return vscode.workspace.getConfiguration().get<T>(key)!;
}
function baseUrl() { return cfg<string>('yuihub.apiBaseUrl').replace(/\/$/, ''); }
function apiKey() { return secretToken || cfg<string>('yuihub.apiKey'); }
type AuthHeader = 'auto' | 'authorization' | 'x-yuihub-token';
type AuthScheme = 'bearer' | 'none';
function authHeaderPref(): AuthHeader { return (cfg<string>('yuihub.authHeader') as AuthHeader) || 'auto'; }
function authScheme(): AuthScheme { return (cfg<string>('yuihub.authScheme') as AuthScheme) || 'bearer'; }
function defaultThread(context: vscode.ExtensionContext): string | undefined {
  const s = cfg<string>('yuihub.defaultThreadId');
  if (s) return s;
  return context.workspaceState.get<string>('yuihub.thread');
}
function setThread(context: vscode.ExtensionContext, th: string) {
  context.workspaceState.update('yuihub.thread', th);
}
function headers(useHeader: Exclude<AuthHeader, 'auto'> | null = null): Record<string,string> {
  const h: Record<string,string> = { 'Content-Type': 'application/json' };
  const key = apiKey();
  if (!key) return h;
  const headerMode: Exclude<AuthHeader, 'auto'> = useHeader ?? (authHeaderPref() === 'x-yuihub-token' ? 'x-yuihub-token' : 'authorization');
  if (headerMode === 'x-yuihub-token') {
    h['x-yuihub-token'] = key;
  } else {
    const scheme = authScheme();
    if (scheme === 'bearer') {
      const val = /^Bearer\s+/i.test(key) ? key : `Bearer ${key}`;
      h['Authorization'] = val;
    } else {
      h['Authorization'] = key;
    }
  }
  return h;
}
function redact(v: any) { return typeof v === 'string' ? v.replace(/(Bearer\s+)[^\s]+/i, '$1***') : v; }
function logRequest(method: string, url: URL | string, init?: RequestInit) {
  const u = typeof url === 'string' ? url : url.toString();
  const hdr = init?.headers as Record<string,string> | undefined;
  out.appendLine(`[HTTP] ${method} ${u}`);
  if (hdr) {
    const masked = Object.fromEntries(Object.entries(hdr).map(([k,v]) => {
      const lower = k.toLowerCase();
      if (lower === 'authorization' || lower === 'x-yuihub-token') return [k, '***'];
      return [k, v];
    }));
    out.appendLine(`[HTTP] headers=${JSON.stringify(masked, null, 0)}`);
  }
}
function requestTimeoutMs(): number { return Number(cfg<number>('yuihub.requestTimeoutMs') ?? 15000); }
async function timedFetch(resource: URL | string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), requestTimeoutMs());
  try {
    const res = await fetch(resource, { ...(init || {}), signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}
async function readBodySafe(res: Response) {
  try { return await res.text(); } catch { return ''; }
}
async function throwHttpError(ctx: { method: string; url: string }, res: Response): Promise<never> {
  const includeBodies = !!cfg<boolean>('yuihub.logResponseBodies');
  const body = includeBodies ? await readBodySafe(res) : '';
  const snippet = includeBodies ? (body?.slice(0, 400) ?? '') : '';
  const msg = `HTTP ${res.status} ${res.statusText}` + (snippet ? ` — ${snippet}` : '');
  out.appendLine(`[HTTP] ERROR ${ctx.method} ${ctx.url} -> ${res.status} ${res.statusText}`);
  if (snippet) out.appendLine(`[HTTP] body: ${snippet}`);
  const err = new Error(msg);
  // @ts-ignore add extra
  err.status = res.status;
  throw err;
}
async function get<T>(path: string, params?: Record<string,any>): Promise<T> {
  const url = new URL(baseUrl() + path);
  if (params) Object.entries(params).forEach(([k,v]) => v === undefined ? null : url.searchParams.set(k, String(v)));
  const initialHeader: Exclude<AuthHeader,'auto'> | null = authHeaderPref() === 'x-yuihub-token' ? 'x-yuihub-token' : 'authorization';
  let init = { method: 'GET', headers: headers(initialHeader) } as RequestInit;
  logRequest('GET', url, init);
  const res = await timedFetch(url, init);
  if (!res.ok && (res.status === 401 || res.status === 403) && authHeaderPref() === 'auto') {
    // failover to the other header
    const fallbackHeader: Exclude<AuthHeader,'auto'> = initialHeader === 'authorization' ? 'x-yuihub-token' : 'authorization';
    init = { method: 'GET', headers: headers(fallbackHeader) } as RequestInit;
    out.appendLine(`[HTTP] retry with header=${fallbackHeader}`);
    logRequest('GET', url, init);
    const res2 = await timedFetch(url, init);
    if (!res2.ok) return throwHttpError({ method: 'GET', url: url.toString() }, res2);
    const json2 = await res2.json() as T;
    out.appendLine(`[HTTP] OK GET ${url.toString()} (${res2.status})`);
    return json2;
  }
  if (!res.ok) return throwHttpError({ method: 'GET', url: url.toString() }, res);
  const json = await res.json() as T;
  out.appendLine(`[HTTP] OK GET ${url.toString()} (${res.status})`);
  return json;
}
async function post<T>(path: string, body: any): Promise<T> {
  const url = baseUrl() + path;
  const initialHeader: Exclude<AuthHeader,'auto'> | null = authHeaderPref() === 'x-yuihub-token' ? 'x-yuihub-token' : 'authorization';
  let init = { method: 'POST', headers: headers(initialHeader), body: JSON.stringify(body) } as RequestInit;
  logRequest('POST', url, init);
  const res = await timedFetch(url, init);
  if (!res.ok && (res.status === 401 || res.status === 403) && authHeaderPref() === 'auto') {
    const fallbackHeader: Exclude<AuthHeader,'auto'> = initialHeader === 'authorization' ? 'x-yuihub-token' : 'authorization';
    init = { method: 'POST', headers: headers(fallbackHeader), body: JSON.stringify(body) } as RequestInit;
    out.appendLine(`[HTTP] retry with header=${fallbackHeader}`);
    logRequest('POST', url, init);
    const res2 = await timedFetch(url, init);
    if (!res2.ok) return throwHttpError({ method: 'POST', url }, res2);
    const json2 = await res2.json() as T;
    out.appendLine(`[HTTP] OK POST ${url} (${res2.status})`);
    return json2;
  }
  if (!res.ok) return throwHttpError({ method: 'POST', url }, res);
  const json = await res.json() as T;
  out.appendLine(`[HTTP] OK POST ${url} (${res.status})`);
  return json;
}

export function activate(context: vscode.ExtensionContext) {
  // Prime secret from SecretStorage
  context.secrets.get(SECRET_API_KEY).then(v => {
    secretToken = v || undefined;
    out.appendLine(`[Secrets] token=${secretToken ? '***' : '(none)'}`);
  });
  const secretDisp = context.secrets.onDidChange(async (e) => {
    if (e.key === SECRET_API_KEY) {
      secretToken = (await context.secrets.get(SECRET_API_KEY)) || undefined;
      out.appendLine(`[Secrets] token changed -> ${secretToken ? '***' : '(none)'}`);
    }
  });
  context.subscriptions.push(secretDisp);
  // Trust state diagnostics
  out.appendLine(`[Trust] workspace.isTrusted=${vscode.workspace.isTrusted}`);

  // Initialize Search Results Tree View
  const searchResultsProvider = new SearchResultsProvider(context.extensionUri);
  const treeView = vscode.window.createTreeView('yuihub.results', {
    treeDataProvider: searchResultsProvider,
    showCollapseAll: false
  });
  context.subscriptions.push(treeView);
  treeView.message = '検索結果はありません。"YuiHub: Search..." で検索を開始してください。';

  function requireTrusted(feature: string): boolean {
    if (vscode.workspace.isTrusted) return true;
    vscode.window.showWarningMessage(
      `${feature} は未信頼ワークスペースでは無効です。ワークスペースを信頼すると使用できます。`,
      'ワークスペースの信頼を管理',
      'ログを開く'
    ).then(sel => {
      if (sel === 'ワークスペースの信頼を管理') {
        vscode.commands.executeCommand('workbench.trust.manage');
      } else if (sel === 'ログを開く') {
        out.show(true);
      }
    });
    return false;
  }

  // When workspace becomes trusted later
  const trustDisp = vscode.workspace.onDidGrantWorkspaceTrust(() => {
    out.appendLine('[Trust] Workspace has been granted trust. Full functionality enabled.');
    vscode.window.showInformationMessage('YuiHub: ワークスペースが信頼されました。すべての機能が有効になりました。');
  });
  context.subscriptions.push(trustDisp);
  async function handleHttpError(e: any, contextLabel: string) {
    const status = e?.status;
    if (status === 401) {
      const sel = await vscode.window.showErrorMessage(`${contextLabel} failed: Unauthorized (401). Set yuihub.apiKey in Settings.`, 'Open YuiHub Settings', 'Show Logs');
      if (sel === 'Open YuiHub Settings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'yuihub');
      } else if (sel === 'Show Logs') {
        out.show(true);
      }
    } else {
      vscode.window.showErrorMessage(`${contextLabel} failed: ${e?.message ?? e}`);
    }
  }
  // Initial diagnostics
  const k = apiKey();
  out.appendLine('YuiHub extension activated');
  out.appendLine(`baseUrl=${baseUrl()}`);
  out.appendLine(`apiKey=${k ? '***' : '(none)'}`);
  out.appendLine(`defaultThreadId=${cfg<string>('yuihub.defaultThreadId') || '(none)'}`);
  out.appendLine(`searchLimit=${cfg<number>('yuihub.searchLimit')}`);
  // Warn for non-local HTTP
  try {
    const bu = baseUrl();
    const isHttp = /^http:\/\//i.test(bu);
    const isLocal = /^(http:\/\/)?(localhost|127\.0\.0\.1|::1)(:\d+)?([\/]|$)/i.test(bu);
    if (isHttp && !isLocal) {
      vscode.window.showWarningMessage('YuiHub: baseUrl が HTTP です。HTTPS の利用を推奨します。');
    }
  } catch {}

  // Open logs command
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.openLogs', async () => {
    out.show(true);
  }));
  // Set API token (SecretStorage)
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.setApiToken', async () => {
    const token = await vscode.window.showInputBox({
      prompt: 'Enter API token (empty to clear)',
      password: true,
      ignoreFocusOut: true,
      placeHolder: 'Paste token here'
    });
    if (token === undefined) return; // cancelled
    if (token === '') {
      await context.secrets.delete(SECRET_API_KEY);
      secretToken = undefined;
      vscode.window.showInformationMessage('YuiHub: APIトークンを削除しました（SecretStorage）。');
      return;
    }
    await context.secrets.store(SECRET_API_KEY, token);
    secretToken = token;
    vscode.window.showInformationMessage('YuiHub: APIトークンを保存しました（SecretStorage）。');
  }));
  // Smoke Test
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.smokeTest', async () => {
    try {
      const health = await get<Health>('/health');
      const msg = health.ok ? `OK  version=${health.version ?? 'n/a'} env=${health.environment ?? 'n/a'}` : 'Not OK';
      vscode.window.showInformationMessage(`YuiHub /health: ${msg}`);
      out.appendLine(`/health -> ${msg}`);
    } catch (e: any) {
      vscode.window.showErrorMessage(`Smoke Test failed: ${e.message}`);
      out.appendLine(`[SmokeTest] ERROR ${e?.message ?? e}`);
    }
  }));

  // Search
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.search', async () => {
    const q = await vscode.window.showInputBox({ prompt: 'Search YuiHub (q)', placeHolder: '設計 決定 …' });
    if (!q) return;
    try {
      const limit = cfg<number>('yuihub.searchLimit');
      const res = await get<SearchResponse>('/search', { q, limit });
      
      // Update tree view with results
      if (!res.ok || !res.hits?.length) {
        searchResultsProvider.clearResults();
        treeView.message = `"${q}" の検索結果が見つかりませんでした。`;
        vscode.window.showInformationMessage('検索結果がありません。');
        return;
      }

      searchResultsProvider.setResults(res.hits, res.total);
      treeView.message = `"${q}" の検索結果: ${res.total}件`;
      
      // Show quick pick as well
      const pick = await vscode.window.showQuickPick(res.hits.map(h => ({
        label: h.title || h.snippet?.slice(0,60) || h.id,
        description: `${h.thread || ''}  score:${h.score?.toFixed?.(2) ?? ''}`.trim(),
        detail: h.snippet || '',
        h
      })), { matchOnDetail: true, matchOnDescription: true, placeHolder: `${res.total} hits` });
      if (!pick) return;
      const h = pick.h as SearchHit;
      const text = `// YuiHub Search Hit\n// id: ${h.id}\n// thread: ${h.thread ?? ''}\n// path: ${h.path ?? ''}\n${h.snippet ?? ''}`;
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await editor.edit(ed => ed.insert(editor.selection.active, text));
      } else {
        const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: text });
        await vscode.window.showTextDocument(doc);
      }
    } catch (e: any) {
      searchResultsProvider.clearResults();
      treeView.message = '検索中にエラーが発生しました。';
      out.appendLine(`[Search] ERROR ${e?.message ?? e}`);
      await handleHttpError(e, 'Search');
    }
  }));

  // Open Search Result (from tree view click)
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.openSearchResult', async (hit: SearchHit) => {
    const text = `// YuiHub Search Hit\n// id: ${hit.id}\n// thread: ${hit.thread ?? ''}\n// path: ${hit.path ?? ''}\n// date: ${hit.date ?? ''}\n// score: ${hit.score?.toFixed(3) ?? ''}\n// tags: ${hit.tags?.join(', ') ?? ''}\n// source: ${hit.source ?? ''}\n\n${hit.snippet ?? ''}`;
    
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      await editor.edit(ed => ed.insert(editor.selection.active, text));
    } else {
      const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: text });
      await vscode.window.showTextDocument(doc);
    }
  }));

  // Clear Search Results
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.clearSearchResults', () => {
    searchResultsProvider.clearResults();
    treeView.message = '検索結果をクリアしました。';
    out.appendLine('[SearchResults] Cleared');
  }));

  // Issue new thread
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.issueThread', async () => {
    try {
      const res = await post<{ ok: boolean; data?: { thread: string } }>('/threads/new', {});
      if (!res.ok || !res.data?.thread) throw new Error('No thread returned');
      setThread(context, res.data.thread);
      vscode.window.showInformationMessage(`New thread issued: ${res.data.thread}`);
      out.appendLine(`[IssueThread] OK ${res.data.thread}`);
    } catch (e: any) {
      out.appendLine(`[IssueThread] ERROR ${e?.message ?? e}`);
      await handleHttpError(e, 'Issue thread');
    }
  }));

  // Save Selection
  context.subscriptions.push(vscode.commands.registerCommand('yuihub.saveSelection', async () => {
    if (!requireTrusted('YuiHub: Save Selection')) return;
    let th = defaultThread(context);
    if (!th) {
      const input = await vscode.window.showInputBox({ prompt: 'Enter Thread ID (th-...) or leave empty to create new' });
      if (input) {
        th = input;
        setThread(context, th);
      } else {
        // auto issue
        try {
          const res = await post<{ ok: boolean; data?: { thread: string } }>('/threads/new', {});
          if (res.ok && res.data?.thread) { th = res.data.thread; setThread(context, th); }
        } catch {}
      }
    }
    if (!th) { vscode.window.showWarningMessage('No thread set.'); return; }

    const editor = vscode.window.activeTextEditor;
    if (!editor) { vscode.window.showWarningMessage('No active editor.'); return; }
    const selText = editor.document.getText(editor.selection);
    let text = selText;
    const confirmFull = !!cfg<boolean>('yuihub.saveConfirmOnFullDocument');
    if (!selText) {
      const full = editor.document.getText();
      if (!full.trim()) { vscode.window.showWarningMessage('No text to save.'); return; }
      if (confirmFull) {
  const bytes = new TextEncoder().encode(full).byteLength;
        const threshold = Number(cfg<number>('yuihub.saveConfirmFullDocThresholdBytes') ?? 8192);
        const sizeInfo = `${bytes} bytes, ${editor.document.lineCount} lines`;
        const severity = bytes >= threshold ? '大きな' : '全文';
        const sel = await vscode.window.showWarningMessage(`選択がありません。${severity}ドキュメントを送信しますか？ (${sizeInfo})`, '送信する', 'キャンセル');
        if (sel !== '送信する') return;
      }
      text = full;
    }
    if (!text.trim()) { vscode.window.showWarningMessage('No text to save.'); return; }

    const author = cfg<string>('yuihub.defaultAuthor');
    const source = cfg<string>('yuihub.defaultSource');

    try {
      const body = { source, thread: th, author, text };
      const res = await post<SaveResponse>('/save', body);
      if (!res.ok || !res.data) throw new Error('Save failed');
      vscode.window.showInformationMessage(`Saved to ${res.data.thread} (id=${res.data.id})`);
      out.appendLine(`[Save] OK thread=${res.data.thread} id=${res.data.id}`);
    } catch (e: any) {
      out.appendLine(`[Save] ERROR ${e?.message ?? e}`);
      await handleHttpError(e, 'Save');
    }
  }));
}

export function deactivate() {}