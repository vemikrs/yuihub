/**
 * IndexManager - 検索インデックスの状態管理とライフサイクル制御
 * 
 * 主な機能:
 * - 索引の状態管理（missing|building|ready）
 * - 索引の再構築・リロード
 * - バックグラウンドでの索引更新
 */

import { SearchService } from './search.js';
import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(execFile);

export class IndexManager {
  constructor(config) {
    this.searchService = config.searchService || new SearchService();
    this.indexPath = config.indexPath;
    this.termsPath = config.termsPath;
    this.statsPath = config.statsPath;
    this.dataRoot = config.dataRoot;
    this.status = 'missing';  // missing|building|ready
    this.lastBuildAt = null;
    this.buildPromise = null;
    this.logger = config.logger || console;
    // Debounce scheduling
    this._debounceTimer = null;
    this._debounceDelayMs = 60000; // default 60s
    this._debounceScheduledAt = null;
    this._lastFullRebuildAt = null;
    this._rebuilding = false;
    this._backoffAttempt = 0;
    this._lastRebuildResult = null; // { status: 'success'|'failed', reason?: string }
    this._searchServiceRef = this.searchService; // for delta clear
  }

  /**
   * 現在の索引状態を取得
   * @returns {Promise<{status: string, lastBuildAt: string|null, buildTime?: number}>}
   */
  async getStatus() {
    const exists = await this.indexExists();
    
    if (!exists) {
      this.status = 'missing';
      return { status: 'missing', lastBuildAt: null };
    }
    
    if (this.buildPromise) {
      return { 
        status: 'building', 
        lastBuildAt: this.lastBuildAt,
        startedAt: this._buildStartTime
      };
    }

    // インデックスファイルの更新日時を取得
    if (this.status === 'ready' && !this.lastBuildAt) {
      try {
        const stats = await fs.stat(this.indexPath);
        this.lastBuildAt = stats.mtime.toISOString();
      } catch (error) {
        this.logger.warn('Failed to get index file stats:', error.message);
      }
    }

    return { 
      status: 'ready', 
      lastBuildAt: this.lastBuildAt,
      lastFullRebuildAt: this._lastFullRebuildAt,
      debounce: this._debounceTimer ? {
        scheduledAt: this._debounceScheduledAt,
        etaSeconds: Math.max(0, Math.ceil((this._debounceScheduledAt + this._debounceDelayMs - Date.now())/1000))
      } : null,
      lastRebuildResult: this._lastRebuildResult
    };
  }

  /**
   * 索引ファイルの存在確認
   * @returns {Promise<boolean>}
   */
  async indexExists() {
    try {
      await fs.access(this.indexPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 索引の再構築（既に実行中の場合は既存のPromiseを返却）
   * @returns {Promise<boolean>} 再構築成功の可否
   */
  async rebuild() {
    if (this.buildPromise || this._rebuilding) {
      this.logger.info('Index rebuild already in progress, returning existing promise');
      return this.buildPromise;
    }

    this.logger.info('🔄 Starting index rebuild...');
    this.status = 'building';
    this._buildStartTime = new Date().toISOString();
  this._rebuilding = true;
  this.buildPromise = this._performRebuild();
    
    try {
      const result = await this.buildPromise;
      this.status = 'ready';
      this.lastBuildAt = new Date().toISOString();
      this._lastFullRebuildAt = this.lastBuildAt;
      // フル再索引成功→deltaクリア（原子的に差替え後）
      try {
        if (typeof this._searchServiceRef.clearDelta === 'function') {
          this._searchServiceRef.clearDelta();
        }
      } catch (e) {
        this.logger.warn('Delta clear failed:', e.message);
      }
      this._backoffAttempt = 0;
      this._lastRebuildResult = { status: 'success' };
      this.logger.info('✅ Index rebuild completed successfully');
      return result;
    } catch (error) {
      this.status = 'missing';
      this._lastRebuildResult = { status: 'failed', reason: error.message };
      this.logger.error('❌ Index rebuild failed:', error.message);
      throw error;
    } finally {
      this.buildPromise = null;
      this._buildStartTime = null;
      this._rebuilding = false;
    }
  }

  /**
   * 実際の索引再構築処理
   * @private
   * @returns {Promise<boolean>}
   */
  async _performRebuild() {
    // scripts/chunk_and_lunr.mjsを呼び出し（プロジェクトルートからの相対パス）
    const scriptPath = path.resolve(process.cwd(), '../scripts/chunk_and_lunr.mjs');
    const sourceDir = path.join(this.dataRoot, 'chatlogs');
    const outputDir = path.join(this.dataRoot, 'index');
    
    try {
      this.logger.info(`Executing index build script: ${scriptPath}`);
      this.logger.info(`Source: ${sourceDir}, Output: ${outputDir}`);
      
      const { stdout, stderr } = await execAsync('node', [
        scriptPath,
        `--source=${sourceDir}`,
        `--output=${outputDir}`
      ], {
        cwd: path.resolve(process.cwd(), '..'),  // プロジェクトルートに移動
        timeout: 120000  // 2分でタイムアウト
      });

      if (stdout) {
        this.logger.info('Build script output:', stdout);
      }
      if (stderr) {
        this.logger.warn('Build script warnings:', stderr);
      }

      // 索引をSearchServiceにリロード
      const reloadResult = await this.searchService.loadIndex(this.indexPath);
      
      // 統計情報を更新
      await this._updateStats('rebuild');
      
      return reloadResult;
    } catch (error) {
      this.logger.error('Index rebuild script failed:', error);
      throw new Error(`Index rebuild failed: ${error.message}`);
    }
  }

  /**
   * 索引のリロード（ファイルシステムから再読み込み）
   * @returns {Promise<boolean>}
   */
  async reload() {
    this.logger.info('🔄 Reloading index from filesystem...');
    
    try {
      const loaded = await this.searchService.loadIndex(this.indexPath);
      
      if (loaded) {
        this.status = 'ready';
        this.lastBuildAt = new Date().toISOString();
        this.logger.info('✅ Index reloaded successfully');
        await this._updateStats('reload');
      } else {
        this.status = 'missing';
        this.logger.warn('⚠️ Index reload failed - file not found or invalid');
      }
      
      return loaded;
    } catch (error) {
      this.status = 'missing';
      this.logger.error('❌ Index reload error:', error.message);
      throw error;
    }
  }

  /**
   * バックグラウンドでの索引再構築（非同期、エラーは警告ログのみ）
   */
  scheduleRebuild() {
    // Debounce: leading=false, trailing=true, maxBurst=1
    if (this._debounceTimer) return;
    this._debounceScheduledAt = Date.now();
    const delay = this._computeBackoffDelay();
    this._debounceTimer = setTimeout(async () => {
      this._debounceTimer = null;
      try {
        await this.rebuild();
        this.logger.info('📚 Debounced index rebuild completed');
      } catch (error) {
        this._backoffAttempt = Math.min(this._backoffAttempt + 1, 5);
        this.logger.warn('⚠️ Debounced index rebuild failed:', error.message);
        // 次回を自動スケジュール（バックオフ）
        this.scheduleRebuild();
      }
    }, delay);
  }

  setDebounceDelay(ms) {
    this._debounceDelayMs = Math.max(0, parseInt(ms) || 0);
  }

  _computeBackoffDelay() {
    // 失敗回数に応じた指数バックオフ（1x,2x,4x,8x,15x上限）
    const base = this._debounceDelayMs || 60000;
    const factor = Math.min(2 ** this._backoffAttempt, 15);
    return base * factor;
  }

  /**
   * 統計情報の更新
   * @private
   * @param {string} operation 操作種別
   */
  async _updateStats(operation) {
    if (!this.statsPath) return;
    
    try {
      let stats = {};
      try {
        const content = await fs.readFile(this.statsPath, 'utf8');
        stats = JSON.parse(content);
      } catch {
        // ファイルが存在しない場合は新規作成
        stats = {
          totalDocuments: 0,
          totalChunks: 0,
          lastBuild: null,
          operations: {}
        };
      }
      
      // 統計更新
      stats.operations = stats.operations || {};
      stats.operations[operation] = (stats.operations[operation] || 0) + 1;
      stats.lastBuild = new Date().toISOString();
      stats[`last${operation.charAt(0).toUpperCase() + operation.slice(1)}`] = new Date().toISOString();
      
      await fs.writeFile(this.statsPath, JSON.stringify(stats, null, 2));
    } catch (error) {
      this.logger.warn(`Failed to update stats for ${operation}:`, error.message);
    }
  }

  /**
   * 索引の初期化処理（起動時実行）
   * @returns {Promise<boolean>}
   */
  async initialize() {
    const exists = await this.indexExists();
    
    if (!exists) {
      this.logger.warn(`⚠️ Search index not found at ${this.indexPath}`);
      this.status = 'missing';
      return false;
    }
    
    try {
      const loaded = await this.searchService.loadIndex(this.indexPath);
      if (loaded) {
        this.status = 'ready';
        this.logger.info(`✅ Search index loaded from ${this.indexPath}`);
        return true;
      } else {
        this.status = 'missing';
        this.logger.warn(`⚠️ Failed to load search index from ${this.indexPath}`);
        return false;
      }
    } catch (error) {
      this.status = 'missing';
      this.logger.error(`❌ Error loading search index: ${error.message}`);
      return false;
    }
  }
}