/**
 * EnhancedSearchService - 日本語検索強化版
 * 
 * 機能:
 * - 基本Lunr検索 + terms.json逆引き検索の二段検索
 * - 日本語正規化処理（全角→半角、ひらがな→カタカナ）
 * - 検索結果の統合・重複除去
 * - フォールバック機能付き検索精度向上
 */

import { SearchService } from './search.js';
import fs from 'fs/promises';
import { normalizeJa } from './text-ja.js';

export class EnhancedSearchService extends SearchService {
  constructor() {
    super();
    this.termsIndex = null;
    this.termsLoaded = false;
    this.termsPath = null;
    // Delta overlay (in-memory)
    this.deltaDocs = new Map(); // id -> { id, title, body, tags, thread, date, path, url }
    this.lastDeltaAdd = null;
    this.tombstones = new Set(); // originalId set
  }

  /**
   * 用語インデックスの読み込み
   * @param {string} termsPath terms.jsonファイルのパス
   * @returns {Promise<boolean>}
   */
  async loadTermsIndex(termsPath) {
    this.termsPath = termsPath;
    
    try {
      const content = await fs.readFile(termsPath, 'utf8');
      this.termsIndex = JSON.parse(content);
      this.termsLoaded = true;
      console.log(`✅ Terms index loaded: ${Object.keys(this.termsIndex).length} terms`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Terms index not loaded from ${termsPath}:`, error.message);
      this.termsLoaded = false;
      return false;
    }
  }

  /**
   * 日本語クエリの正規化処理
   * @param {string} query 検索クエリ
   * @returns {string} 正規化されたクエリ
   */
  _normalizeQuery(query) {
    if (!query) return '';
    
    return query
      // 全角英数字→半角
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => 
        String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
      )
      // ひらがな→カタカナ
      .replace(/[ぁ-ゖ]/g, (s) => 
        String.fromCharCode(s.charCodeAt(0) + 0x60)
      )
      // 連続する空白を単一に
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * 二段検索の実行
   * @param {string} query 検索クエリ
   * @param {number} limit 結果数制限
   * @returns {Promise<Array>} 検索結果
   */
  async search(query, limit = 10) {
    if (!query) return [];
    
    const normalizedQuery = this._normalizeQuery(query);
    const startTime = Date.now();
    
    try {
      // Phase 1: Lunr検索（ベース実装は { hits: [] } を返す）
      const baseResult = await super.search(normalizedQuery, limit);
      const lunrHits = Array.isArray(baseResult) ? baseResult : (baseResult?.hits || []);
      
      // Phase 2: Terms逆引き検索（Lunr結果が少ない場合のみ）
      let combinedHits = lunrHits || [];
      if (combinedHits.length < Math.ceil(limit / 2) && this.termsLoaded) {
        const termsHits = this._searchByTerms(normalizedQuery, limit);
        combinedHits = this._mergeHits(combinedHits, termsHits);
      }

      // Phase 3: Delta overlay（/save直後の差分レイヤ）
      const deltaHits = this._searchDelta(normalizedQuery, limit);
      combinedHits = this._mergeHits(combinedHits, deltaHits);

      // Phase 4: Bodyプレビューの部分一致フォールバック（索引に日本語トークンが無い場合の暫定措置）
      if ((combinedHits?.length || 0) === 0) {
        const bodyFallback = this._fallbackScanByBody(normalizedQuery, limit);
        combinedHits = bodyFallback;
      }
      
      const searchTime = Date.now() - startTime;
      // 墓石除外 + 上位limit適用
      const filtered = (Array.isArray(combinedHits) ? combinedHits : [])
        .filter(h => !this._isTombstoned(h))
        .slice(0, limit);
      
      // 検索ログ
      console.log(
        `🔍 Enhanced search "${query}" -> ${filtered.length}/${combinedHits.length} hits ` +
        `(Lunr: ${lunrHits ? lunrHits.length : 0}, Terms: ${this.termsLoaded ? 'enabled' : 'disabled'}) ` +
        `in ${searchTime}ms`
      );
      
      return filtered;
    } catch (error) {
      console.error('Enhanced search error:', error);
      return [];
    }
  }

  /**
   * /save 後に即時反映するための delta 追加
   * frontmatter と body テキストからチャンク化して登録
   */
  addDeltaFromSave(frontmatter, bodyText) {
    try {
      if (!frontmatter?.id) return false;
      const chunks = this._chunkText(this._extractContent(String(bodyText || '')));
      const title = frontmatter.topic || frontmatter.title || frontmatter.id;
      const baseMeta = {
        originalId: frontmatter.id,
        title,
        date: frontmatter.date,
        tags: frontmatter.tags || [],
        thread: frontmatter.thread || null,
        decision: frontmatter.decision,
        path: frontmatter.path || null,
        url: null
      };
      // 既存deltaの同一originalIdは置換
      for (const [id, d] of Array.from(this.deltaDocs.entries())) {
        if (d.originalId === frontmatter.id) this.deltaDocs.delete(id);
      }

      let index = 0;
      for (const chunk of chunks) {
        const id = `${frontmatter.id}-${index}`;
        this.deltaDocs.set(id, {
          id,
          ...baseMeta,
          body: chunk.substring(0, 1000) // deltaでは短めに保持
        });
        index++;
      }
      this.lastDeltaAdd = new Date().toISOString();
      return true;
    } catch (e) {
      console.warn('addDeltaFromSave failed:', e.message);
      return false;
    }
  }

  clearDelta() {
    this.deltaDocs.clear();
  }

  addTombstone(originalId) {
    if (originalId) this.tombstones.add(originalId);
  }

  clearTombstones() {
    this.tombstones.clear();
  }

  _isTombstoned(hit) {
    try {
      const orig = this._getOriginalIdFromHit(hit);
      if (!orig) return false;
      return this.tombstones.has(orig);
    } catch {
      return false;
    }
  }

  _getOriginalIdFromHit(hit) {
    if (!hit) return null;
    if (hit.originalId) return hit.originalId;
    const id = String(hit.id || '');
    // 末尾の -<number> を取り除いて originalId に推定（例: rec-XXXX-0 → rec-XXXX）
    const m = id.match(/^(.*)-\d+$/);
    return m ? m[1] : id || null;
  }

  _searchDelta(normalizedQuery, limit = 10) {
    try {
      const tokens = this._splitQuery(normalizedQuery);
      if (tokens.length === 0) return [];
      const hits = [];
      for (const doc of this.deltaDocs.values()) {
        if (this.tombstones.has(doc.originalId)) continue;
        const bodyNorm = this._normalizeQuery(doc.body || '');
        const titleNorm = this._normalizeQuery(doc.title || '');
        const tagsNorm = this._normalizeQuery((doc.tags || []).join(' '));
        const matched = tokens.some(t => bodyNorm.includes(t) || titleNorm.includes(t) || tagsNorm.includes(t));
        if (matched) {
          hits.push({
            id: doc.id,
            score: 6.0, // Termsより少し低め、Lunrよりは低めに
            title: doc.title,
            path: doc.path,
            snippet: (doc.body || '').substring(0, 200),
            url: doc.url,
            date: doc.date,
            tags: doc.tags || [],
            decision: doc.decision,
            thread: doc.thread || null,
            source: 'delta'
          });
          if (hits.length >= limit) break;
        }
      }
      return hits;
    } catch (e) {
      console.warn('delta search failed:', e.message);
      return [];
    }
  }

  /**
   * 索引に日本語トークンが無い場合の暫定フォールバック: bodyプレビューで部分一致スキャン
   * @param {string} normalizedQuery 正規化済みクエリ（カタカナ・小文字・空白統一）
   * @param {number} limit
   * @returns {Array}
   */
  _fallbackScanByBody(normalizedQuery, limit = 10) {
    try {
      const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
      if (tokens.length === 0) return [];

      const hits = [];
      for (const doc of this.documents.values()) {
        if (this.tombstones.has(doc.originalId)) continue;
        const bodyNorm = normalizeJa(doc.body || '');
        const matched = tokens.some(t => bodyNorm.includes(t));
        if (matched) {
          hits.push({
            id: doc.id,
            score: 0.02, // 低スコアで格納（Lunr/Termsが優先）
            title: doc.title || doc.topic,
            path: doc.path,
            snippet: doc.body?.substring(0, 200) || '',
            url: doc.url,
            date: doc.date,
            tags: doc.tags || [],
            decision: doc.decision,
            thread: doc.thread || null,
            source: 'body-scan'
          });
          if (hits.length >= limit) break;
        }
      }
      return hits;
    } catch (e) {
      console.warn('fallbackScanByBody failed:', e.message);
      return [];
    }
  }

  /**
   * クエリなしの場合のトップドキュメント（最近順）
   * @param {number} limit 
   * @returns {Array}
   */
  getTopDocuments(limit = 10) {
    try {
      const docs = Array.from(this.documents.values());
      const sorted = docs.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });
      return sorted.slice(0, limit).map(doc => ({
        id: doc.id,
        score: 0.1,
        title: doc.title || doc.topic,
        path: doc.path,
        snippet: '',
        url: doc.url,
        date: doc.date,
        tags: doc.tags || [],
        decision: doc.decision,
        thread: doc.thread || null
      }));
    } catch (e) {
      console.warn('getTopDocuments failed:', e.message);
      return [];
    }
  }

  /**
   * 用語インデックスによる検索
   * @private
   * @param {string} query 正規化済みクエリ
   * @param {number} limit 結果数制限
   * @returns {Array} 用語マッチ結果
   */
  _searchByTerms(query, limit) {
    if (!this.termsIndex || !query) return [];

    const hits = [];
    const queryTerms = this._splitQuery(query);
    
    // 用語インデックスからマッチング
    for (const [term, docIds] of Object.entries(this.termsIndex)) {
      const termScore = this._calculateTermMatchScore(term, queryTerms);
      
      if (termScore > 0) {
        // 該当ドキュメントIDごとにヒット作成
        for (const docId of docIds) {
          hits.push({
            id: docId,
            score: termScore,
            source: 'terms',
            matchedTerm: term
          });
        }
      }
    }

    // スコア降順でソート
    return hits
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * クエリを検索語に分割
   * @private
   * @param {string} query 
   * @returns {Array<string>}
   */
  _splitQuery(query) {
    return query
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => term.toLowerCase());
  }

  /**
   * 用語マッチスコアの計算
   * @private
   * @param {string} term インデックス内の用語
   * @param {Array<string>} queryTerms 検索語リスト
   * @returns {number} マッチスコア
   */
  _calculateTermMatchScore(term, queryTerms) {
    const normalizedTerm = term.toLowerCase();
    let maxScore = 0;
    
    for (const queryTerm of queryTerms) {
      let score = 0;
      
      // 完全一致
      if (normalizedTerm === queryTerm) {
        score = 15.0;
      }
      // 前方一致
      else if (normalizedTerm.startsWith(queryTerm)) {
        score = 12.0;
      }
      // 後方一致
      else if (normalizedTerm.endsWith(queryTerm)) {
        score = 10.0;
      }
      // 部分一致
      else if (normalizedTerm.includes(queryTerm)) {
        score = 8.0;
      }
      // 逆方向の部分一致（短い用語の場合）
      else if (queryTerm.includes(normalizedTerm) && normalizedTerm.length >= 2) {
        score = 6.0;
      }
      
      // 長さ補正（短すぎる用語は減点）
      if (normalizedTerm.length < 2) {
        score *= 0.5;
      } else if (normalizedTerm.length >= 4) {
        score *= 1.2; // ボーナス
      }
      
      maxScore = Math.max(maxScore, score);
    }
    
    return maxScore;
  }

  /**
   * Lunr検索結果と用語検索結果の統合
   * @private
   * @param {Array} lunrHits Lunr検索結果
   * @param {Array} termsHits 用語検索結果
   * @returns {Array} 統合済み検索結果
   */
  _mergeHits(lunrHits, termsHits) {
    const merged = [...lunrHits];
    const existingIds = new Set(lunrHits.map(h => h.id));
    
    // 重複しない用語検索結果を追加
    for (const hit of termsHits) {
      if (!existingIds.has(hit.id)) {
        // Lunrスコアと統合するため、用語スコアを調整
        hit.score = Math.min(hit.score, 5.0); // 最大5.0に制限
        merged.push(hit);
        existingIds.add(hit.id);
      }
    }

    return merged.sort((a, b) => b.score - a.score);
  }

  /**
   * 検索サービスの統計情報を取得
   * @returns {Object} 統計情報
   */
  getStats() {
    const baseStats = super.getStats();
    
    return {
      ...baseStats,
      termsIndexLoaded: this.termsLoaded,
      termsCount: this.termsIndex ? Object.keys(this.termsIndex).length : 0,
      enhancedFeatures: {
        japanesNormalization: true,
        twoPhaseSearch: this.termsLoaded,
        fallbackSearch: true,
        deltaOverlay: true
      },
      deltaDocs: this.deltaDocs.size,
      lastDeltaAdd: this.lastDeltaAdd || null
    };
  }

  /**
   * インデックス全体のリロード（Lunr + Terms）
   * @param {string} indexPath Lunrインデックスパス
   * @param {string} termsPath 用語インデックスパス（オプション）
   * @returns {Promise<boolean>}
   */
  async loadAllIndexes(indexPath, termsPath = null) {
    const lunrLoaded = await super.loadIndex(indexPath);
    
    let termsLoaded = true;
    if (termsPath) {
      termsLoaded = await this.loadTermsIndex(termsPath);
    } else if (this.termsPath) {
      termsLoaded = await this.loadTermsIndex(this.termsPath);
    }
    
    const success = lunrLoaded && (termsPath ? termsLoaded : true);
    
    if (success) {
      console.log('✅ All search indexes loaded successfully');
    } else {
      console.warn('⚠️ Some search indexes failed to load');
    }
    
    return success;
  }

  /**
   * 検索デバッグ情報の出力
   * @param {string} query 
   * @param {Array} results 
   */
  debugSearch(query, results) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Search Debug: "${query}"`);
      console.log('Normalized:', this._normalizeQuery(query));
      console.log('Results:', results.map(r => ({
        id: r.id,
        score: r.score.toFixed(2),
        source: r.source || 'lunr',
        title: r.title?.substring(0, 50) || 'N/A'
      })));
    }
  }

  // --- helpers for delta ingestion ---
  _extractContent(markdown) {
    // 簡易の抜粋（scripts側のextractContentに準拠）
    let content = markdown.replace(/```[\s\S]*?```/g, '');
    content = content.replace(/`[^`]+`/g, '');
    content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    content = content.replace(/[*_#>]/g, '');
    content = content.replace(/\s+/g, ' ').trim();
    return content;
  }

  _chunkText(text, maxSize = 1000) {
    if (!text) return [];
    if (text.length <= maxSize) return [text];
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/);
    let current = '';
    for (const p of paragraphs) {
      if (current.length > 0 && current.length + p.length > maxSize) {
        chunks.push(current.trim());
        current = p;
      } else {
        current += (current ? '\n\n' : '') + p;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }
}