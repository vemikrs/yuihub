import fs from 'fs-extra';
import lunr from 'lunr';
import path from 'path';
import { tokenizeQuery, normalizeJa } from './text-ja.js';

export class SearchService {
  constructor() {
    this.index = null;
    this.documents = new Map();
  }

  async loadIndex(indexPath) {
    try {
      if (await fs.pathExists(indexPath)) {
        const indexData = await fs.readJson(indexPath);
        this.index = lunr.Index.load(indexData.index);
        
        // Load document metadata
        indexData.documents.forEach(doc => {
          this.documents.set(doc.id, doc);
        });
        
        console.log(`Loaded search index with ${this.documents.size} documents`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to load search index:', error.message);
    }
    return false;
  }

  async search(query, limit = 10) {
    if (!this.index) {
      return { hits: [] };
    }

    try {
      // 日本語クエリ処理: URLデコード → 正規化 → トークン化
      const processedQuery = tokenizeQuery(query);
      console.log(`Search query: "${query}" -> "${processedQuery}"`);
      
      if (!processedQuery.trim()) {
        return { hits: [] };
      }

      const results = this.index.search(processedQuery);
      const hits = results
        .slice(0, limit)
        .map(result => {
          const doc = this.documents.get(result.ref);
          if (!doc) return null;
          
          return {
            id: doc.id,
            score: result.score,
            title: doc.title || doc.topic,
            path: doc.path,
            snippet: this._generateSnippet(doc.body, query), // 元のクエリでスニペット生成
            url: doc.url,
            date: doc.date,
            tags: doc.tags || [],
            decision: doc.decision,
            thread: doc.thread || null
          };
        })
        .filter(Boolean);

      return { hits };
    } catch (error) {
      console.error('Search error:', error);
      return { hits: [] };
    }
  }

  _generateSnippet(text, query, maxLength = 200) {
    if (!text || !query) return '';
    
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) return text.substring(0, maxLength);
    
    const lowerText = text.toLowerCase();
    let bestIndex = -1;
    
    // Find the first occurrence of any query term
    for (const term of queryTerms) {
      const index = lowerText.indexOf(term);
      if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
        bestIndex = index;
        break;
      }
    }
    
    if (bestIndex === -1) {
      return text.substring(0, maxLength);
    }
    
    // Extract snippet around the match
    const start = Math.max(0, bestIndex - 50);
    const end = Math.min(text.length, bestIndex + maxLength - 50);
    
    let snippet = text.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    return snippet;
  }

  async getRecent(limit = 20, basePath = './chatlogs') {
    try {
      // Get all markdown files sorted by modification time
      const glob = await import('glob');
      const pattern = path.join(basePath, '**/*.md').replace(/\\/g, '/');
      const files = await glob.glob(pattern);
      
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const stat = await fs.stat(file);
          return { file, mtime: stat.mtime };
        })
      );
      
      const recentFiles = fileStats
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, limit)
        .map(item => item.file);
      
      const matter = await import('gray-matter');
      const recentNotes = [];
      
      for (const file of recentFiles) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const parsed = matter.default(content);
          
          if (parsed.data && parsed.data.id) {
            recentNotes.push({
              id: parsed.data.id,
              title: parsed.data.topic || path.basename(file, '.md'),
              path: path.relative(basePath, file),
              date: parsed.data.date,
              tags: parsed.data.tags || [],
              decision: parsed.data.decision,
              actors: parsed.data.actors || []
            });
          }
        } catch (error) {
          console.warn(`Failed to parse ${file}:`, error.message);
        }
      }
      
      return recentNotes;
    } catch (error) {
      console.error('Failed to get recent notes:', error);
      return [];
    }
  }

  /**
   * タグ由来のフォールバック検索（ゼロ件時補助）
   * @param {string} query 
   * @param {number} limit 
   * @returns {{hits: Array}}
   */
  fallbackByTag(query, limit = 10) {
    const q = (query || '').toString().trim();
    if (!q) return { hits: [] };
    try {
      const docs = Array.from(this.documents.values());
      const matches = [];
      for (const doc of docs) {
        const tags = Array.isArray(doc.tags) ? doc.tags : [];
        if (tags.some(t => typeof t === 'string' && t.includes(q))) {
          matches.push({
            id: doc.id,
            score: 0.05,
            title: doc.title || doc.topic,
            path: doc.path,
            snippet: '',
            url: doc.url,
            date: doc.date,
            tags: doc.tags || [],
            decision: doc.decision,
            thread: doc.thread || null
          });
        }
        if (matches.length >= limit) break;
      }
      return { hits: matches.slice(0, limit) };
    } catch (e) {
      console.warn('fallbackByTag failed:', e.message);
      return { hits: [] };
    }
  }
}