/**
 * Context Packet Builder - Generates Context Packets for GPTs⇄Copilot bridging
 */

import { ContextPacketSchema } from './schemas/yuiflow.js';

export class ContextBuilder {
  constructor(storage, searchService) {
    this.storage = storage;
    this.searchService = searchService;
  }

  /**
   * Build a Context Packet for a specific thread
   * @param {string} thread - Thread ID to build context for
   * @param {string} intent - Intent description for the context
   * @param {Object} options - Options for context building
   * @returns {Object} Context Packet conforming to YuiFlow schema
   */
  async buildPacket(thread, intent, options = {}) {
    const {
      maxFragments = 100,
      includeKnots = true
    } = options;

    try {
      // 1) インデックスのメタデータから該当threadのドキュメント群を抽出
      const allDocs = Array.from(this.searchService.documents.values());
      const byThread = allDocs.filter(doc => doc.thread === thread);

      // 2) originalId（1レコード=複数チャンク）でグルーピング
      const groups = new Map();
      for (const d of byThread) {
        const key = d.originalId || d.id;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(d);
      }

      // 3) 各レコードごとにフラグメントを生成（チャンク本文は結合、上限を適用）
      const yuiflowFragments = Array.from(groups.entries())
        .sort((a, b) => {
          const da = a[1][0]?.date ? new Date(a[1][0].date).getTime() : 0;
          const db = b[1][0]?.date ? new Date(b[1][0].date).getTime() : 0;
          return da - db; // 古い順→新しい順
        })
        .slice(0, maxFragments)
        .map(([origId, docs]) => {
          const sortedChunks = docs
            .slice()
            .sort((x, y) => (x.chunkIndex ?? 0) - (y.chunkIndex ?? 0));
          const combinedText = sortedChunks.map(c => c.body || '').join('\n\n');
          const first = sortedChunks[0] || {};
          const tags = Array.isArray(first.tags) ? first.tags : [];
          const source = ['gpts','copilot','claude','human'].includes(first.source) ? first.source : 'gpts';

          return {
            id: String(origId),
            when: first.date || new Date().toISOString(),
            mode: 'shelter',
            controls: {
              visibility: 'internal',
              detail: 'minimal',
              external_io: 'blocked'
            },
            thread,
            source,
            text: combinedText,
            terms: [],
            tags,
            links: [],
            kind: 'fragment'
          };
        });

      // Extract knots (key points) if requested
      let knots = [];
      if (includeKnots) {
        knots = this.extractKnots(yuiflowFragments);
      }

      // Build the Context Packet
      const packet = {
        version: '1.0.0',
        intent,
        fragments: yuiflowFragments,
        knots,
        thread
      };

      // Validate the packet
      return ContextPacketSchema.parse(packet);

    } catch (error) {
      console.error('Failed to build context packet:', error);
      throw error;
    }
  }

  /**
   * Extract knots (key points) from fragments
   * Simple implementation: groups every 5 fragments into a knot
   * @param {Array} fragments - Array of fragments
   * @returns {Array} Array of knots
   */
  extractKnots(fragments) {
    const knots = [];
    const chunkSize = 5;

    for (let i = 0; i < fragments.length; i += chunkSize) {
      const chunk = fragments.slice(i, i + chunkSize);
      if (chunk.length > 0) {
        const knot = {
          id: `knot-${Date.now()}-${Math.floor(i / chunkSize)}`,
          when: new Date().toISOString(),
          mode: 'shelter',
          controls: {
            visibility: 'internal',
            detail: 'minimal',
            external_io: 'blocked'
          },
          thread: chunk[0].thread,
          source: 'system',
          text: `Summary of ${chunk.length} fragments`,
          terms: [...new Set(chunk.flatMap(f => f.terms))],
          tags: [...new Set(chunk.flatMap(f => f.tags))],
          links: chunk.map(f => ({ type: 'fragment', ref: f.id })),
          kind: 'knot',
          decision: null,
          refs: chunk.map(f => f.id)
        };
        knots.push(knot);
      }
    }

    return knots;
  }

  /**
   * Generate Copilot-friendly markdown from a thread
   * @param {string} thread - Thread ID
   * @param {Object} options - Export options
   * @returns {string} Markdown content
   */
  async generateCopilotMarkdown(thread, options = {}) {
    const {
      includeMetadata = true,
      includeKnots = true
    } = options;

    function escapeMarkdown(str) {
      // Minimal escape: replace <, >, &, and optionally backticks
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/`/g, '&#96;');
    }

    try {
      const packet = await this.buildPacket(thread, 'copilot-export', { includeKnots });
      
      const escapedThread = escapeMarkdown(thread);
      let markdown = `# Thread: ${escapedThread}\n\n`;
      
      if (includeMetadata) {
        markdown += `**Intent**: ${packet.intent}\n`;
        markdown += `**Generated**: ${new Date().toISOString()}\n`;
        markdown += `**Fragments**: ${packet.fragments.length}\n`;
        markdown += `**Knots**: ${packet.knots.length}\n\n`;
        markdown += `---\n\n`;
      }

      // Add knots first (summary)
      if (includeKnots && packet.knots.length > 0) {
        markdown += `## 📊 Key Points (Knots)\n\n`;
        packet.knots.forEach((knot, index) => {
          markdown += `### ${index + 1}. ${knot.text}\n`;
          markdown += `- **Fragments**: ${knot.refs.length}\n`;
          markdown += `- **Tags**: ${knot.tags.join(', ')}\n`;
          markdown += `- **Terms**: ${knot.terms.join(', ')}\n\n`;
        });
        markdown += `---\n\n`;
      }

      // Add fragments (detailed content)
      markdown += `## 💬 Messages (Fragments)\n\n`;
      packet.fragments.forEach((fragment, index) => {
        markdown += `### ${index + 1}. ${fragment.when} - ${fragment.source}\n`;
        markdown += `**ID**: ${fragment.id}\n`;
        markdown += `**Tags**: ${fragment.tags.join(', ') || 'none'}\n\n`;
        markdown += `${fragment.text}\n\n`;
        markdown += `---\n\n`;
      });

      return markdown;

    } catch (error) {
      console.error('Failed to generate Copilot markdown:', error);
      throw error;
    }
  }

  /**
   * Get thread summary for VS Code Extension
   * @param {string} thread - Thread ID
   * @returns {Object} Thread summary
   */
  async getThreadSummary(thread) {
    try {
      const packet = await this.buildPacket(thread, 'thread-summary', { includeKnots: true });
      
      return {
        thread,
        fragmentCount: packet.fragments.length,
        knotCount: packet.knots.length,
        lastActivity: packet.fragments.length > 0 
          ? packet.fragments[packet.fragments.length - 1].when
          : null,
        tags: [...new Set(packet.fragments.flatMap(f => f.tags))],
        summary: packet.knots.length > 0 
          ? packet.knots[packet.knots.length - 1].text
          : 'No summary available'
      };
    } catch (error) {
      console.error('Failed to get thread summary:', error);
      throw error;
    }
  }

  /**
   * Generate thread title automatically
   * @param {string} thread - Thread ID
   * @returns {string} Generated title
   */
  async generateThreadTitle(thread) {
    try {
      const packet = await this.buildPacket(thread, 'title-generation', { includeKnots: false });
      
      if (packet.fragments.length === 0) {
        return 'Empty Thread';
      }

      // Simple title generation: use first fragment's text (first 50 chars)
      const firstFragment = packet.fragments[0];
      const title = firstFragment.text.substring(0, 50).trim();
      
      return title + (firstFragment.text.length > 50 ? '...' : '');
    } catch (error) {
      console.error('Failed to generate thread title:', error);
      return `Thread ${thread}`;
    }
  }
}