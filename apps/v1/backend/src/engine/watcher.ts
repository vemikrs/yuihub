import { watch, FSWatcher } from 'chokidar';
import lodash from 'lodash';
import { Indexer } from './indexer.js';

export class SafeWatcher {
  private watcher: FSWatcher | null = null;
  private indexer: Indexer;
  private debouncedHandlers: Map<string, lodash.DebouncedFunc<(path: string) => void>>;

  constructor(indexer: Indexer) {
    this.indexer = indexer;
    this.debouncedHandlers = new Map();
  }

  start(paths: string | string[]) {
    this.watcher = watch(paths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true // Don't queue initial scan to avoid storm? Or maybe allow it?
      // For V1, maybe allow initial scan to build index. But let's keep it safe.
    });

    this.watcher
      .on('add', this.handleFileChange.bind(this))
      .on('change', this.handleFileChange.bind(this));
      // .on('unlink', ...) TODO
    
    console.log(`[Watcher] Started watching: ${paths}`);
  }

  private handleFileChange(filePath: string) {
    if (!this.debouncedHandlers.has(filePath)) {
      // Create debounced handler per file
      const handler = lodash.debounce((path: string) => {
        console.log(`[Watcher] Change detected (stable): ${path}`);
        this.indexer.enqueue(path);
      }, 2000); // 2000ms debounce
      this.debouncedHandlers.set(filePath, handler);
    }

    const handler = this.debouncedHandlers.get(filePath);
    if (handler) handler(filePath);
  }

  async scan(dir: string) {
    console.log(`[Watcher] Scanning directory: ${dir}`);
    try {
       // Node 20+ supports recursive readdir. Assume Node 18+ or use manual walk?
       // Let's use fs-extra readdir or custom walk if needed. 
       // fs.readdir(dir, { recursive: true }) is Node 20.
       // Safe fallback: use chokidar instance if ready? No.
       // Simple recursive walk:
       const files = await this.getFiles(dir);
       console.log(`[Watcher] Found ${files.length} files. Enqueuing...`);
       
       for (const file of files) {
          if (file.endsWith('.md')) {
             this.indexer.enqueue(file);
          }
       }
    } catch (e) {
       console.error('[Watcher] Scan failed:', e);
    }
  }

  private async getFiles(dir: string): Promise<string[]> {
    const dirents = await import('fs').then(r => r.promises.readdir(dir, { withFileTypes: true }));
    const files = await Promise.all(dirents.map((dirent) => {
      const res = import('path').then(p => p.join(dir, dirent.name));
      return dirent.isDirectory() ? res.then(p => this.getFiles(p)) : res;
    }));
    return Array.prototype.concat(...files);
  }

  async close() {
    if (this.watcher) await this.watcher.close();
    this.debouncedHandlers.forEach(h => h.cancel());
    this.debouncedHandlers.clear();
  }
}
