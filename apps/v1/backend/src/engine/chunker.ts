import Parser from 'tree-sitter';
import Javascript from 'tree-sitter-javascript';
// TypeScript definitions need checking, often generic 'tree-sitter-typescript' package 
// exports both typescript and tsx.
// For now, assuming standard CommonJS interoperability via default import or requires usually works in Node.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Typescript = require('tree-sitter-typescript').typescript;
const TSX = require('tree-sitter-typescript').tsx;

export interface Chunk {
  text: string;
  metadata: {
    type: string;
    name?: string;
    startLine: number;
    endLine: number;
    scope?: string;
  };
}

export class SemanticChunker {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Parse code and extract semantic chunks (classes, functions, methods)
   */
  async chunk(code: string, lang: 'javascript' | 'typescript' | 'tsx'): Promise<Chunk[]> {
    switch (lang) {
      // Type assertion needed due to tree-sitter and tree-sitter-* type definition mismatch
      case 'javascript': this.parser.setLanguage(Javascript as any); break;
      case 'typescript': this.parser.setLanguage(Typescript as any); break;
      case 'tsx': this.parser.setLanguage(TSX as any); break;
      default: throw new Error(`Unsupported language: ${lang}`);
    }

    const tree = this.parser.parse(code);
    const chunks: Chunk[] = [];

    // Simple query to find definitions
    // Note: Query syntax depends on grammar.
    // Need to handle errors if query fails.
    try {
      const query = new Parser.Query(this.parser.getLanguage(), `
        (function_declaration name: (identifier) @name) @def
        (class_declaration name: (identifier) @name) @def
        (method_definition name: (property_identifier) @name) @def
        (arrow_function) @def
      `);
      
      const matches = query.matches(tree.rootNode);

      for (const match of matches) {
        const defNode = match.captures.find(c => c.name === 'def')?.node;
        const nameNode = match.captures.find(c => c.name === 'name')?.node;

        if (defNode) {
          chunks.push({
            text: defNode.text,
            metadata: {
              type: defNode.type,
              name: nameNode?.text || 'anonymous',
              startLine: defNode.startPosition.row + 1,
              endLine: defNode.endPosition.row + 1
            }
          });
        }
      }
    } catch (e) {
      console.warn('Query failed or grammar mismatch:', e);
      // Fallback: entire file? or split by lines?
      // For now, return whole as one chunk if parsing fails semantically.
      chunks.push({
        text: code,
        metadata: { type: 'file', startLine: 1, endLine: code.split('\n').length }
      });
    }
    
    // Safety: If no chunks found (e.g. simple script without functions), add whole content
    if (chunks.length === 0 && code.trim().length > 0) {
       chunks.push({
        text: code,
        metadata: { type: 'script', startLine: 1, endLine: code.split('\n').length }
      });
    }

    return chunks;
  }
}
