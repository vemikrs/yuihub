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

  async close() {
    if (this.watcher) await this.watcher.close();
    this.debouncedHandlers.forEach(h => h.cancel());
    this.debouncedHandlers.clear();
  }
}
