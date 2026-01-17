/**
 * Unit tests for schema.ts
 */
import { describe, it, expect } from 'vitest';
import { toLanceEntryBase } from '../../src/engine/schema.js';
import { Entry } from '@yuihub/core';

describe('schema.ts', () => {
  describe('toLanceEntryBase', () => {
    it('should convert Entry to LanceEntry base format', () => {
      const entry: Entry = {
        id: 'test-123',
        date: '2026-01-18T00:00:00Z',
        text: 'Test content',
        mode: 'private',
        tags: ['tag1', 'tag2'],
        session_id: 'session-abc',
        source: '/path/to/file.md',
      };

      const result = toLanceEntryBase(entry);

      expect(result.id).toBe('test-123');
      expect(result.text).toBe('Test content');
      expect(result.mode).toBe('private');
      expect(result.tags).toBe('["tag1","tag2"]');
      expect(result.session_id).toBe('session-abc');
      expect(result.source).toBe('/path/to/file.md');
      expect(result.date).toBe('2026-01-18T00:00:00Z');
      expect(result.metadata).toBe('{}');
    });

    it('should handle empty tags array', () => {
      const entry: Entry = {
        id: 'test-456',
        date: '2026-01-18T00:00:00Z',
        text: 'Content',
        mode: 'public',
        tags: [],
        session_id: '',
        source: '',
      };

      const result = toLanceEntryBase(entry);

      expect(result.tags).toBe('[]');
      expect(result.session_id).toBe('');
      expect(result.source).toBe('');
    });

    it('should handle undefined optional fields', () => {
      const entry: Entry = {
        id: 'test-789',
        date: '2026-01-18T00:00:00Z',
        text: 'Content',
        mode: 'private',
        tags: undefined as any,
        session_id: undefined as any,
        source: undefined as any,
      };

      const result = toLanceEntryBase(entry);

      expect(result.tags).toBe('[]');
      expect(result.session_id).toBe('');
      expect(result.source).toBe('');
    });

    it('should serialize metadata to JSON string', () => {
      const entry: Entry = {
        id: 'test-meta',
        date: '2026-01-18T00:00:00Z',
        text: 'Content',
        mode: 'private',
        tags: [],
        session_id: '',
        source: '',
        metadata: { key: 'value', nested: { a: 1 } },
      };

      const result = toLanceEntryBase(entry);

      expect(JSON.parse(result.metadata)).toEqual({ key: 'value', nested: { a: 1 } });
    });
  });
});
