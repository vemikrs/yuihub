import { Language, Parser, Query } from 'web-tree-sitter';
import { createRequire } from 'module';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);

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

// Lazy-loaded language instances
let jsLang: Language | null = null;
let tsLang: Language | null = null;
let parserInitialized = false;

/**
 * Get the path to WASM files from tree-sitter-wasms package
 */
function getWasmPath(filename: string): string {
  // Resolve from tree-sitter-wasms package
  const wasmPackagePath = require.resolve('tree-sitter-wasms/package.json');
  return join(dirname(wasmPackagePath), 'out', filename);
}

/**
 * Initialize web-tree-sitter (must be called before using)
 */
async function ensureParserInitialized(): Promise<void> {
  if (parserInitialized) return;
  await Parser.init();
  parserInitialized = true;
}

/**
 * Load a language WASM file
 */
async function loadLanguage(lang: 'javascript' | 'typescript' | 'tsx'): Promise<Language> {
  await ensureParserInitialized();
  
  switch (lang) {
    case 'javascript':
      if (!jsLang) {
        jsLang = await Language.load(getWasmPath('tree-sitter-javascript.wasm'));
      }
      return jsLang;
    case 'typescript':
    case 'tsx':
      // tree-sitter-typescript.wasm handles both TypeScript and TSX
      if (!tsLang) {
        tsLang = await Language.load(getWasmPath('tree-sitter-typescript.wasm'));
      }
      return tsLang;
    default:
      throw new Error(`Unsupported language: ${lang}`);
  }
}

export class SemanticChunker {
  private parser: Parser | null = null;

  /**
   * Ensure parser is initialized
   */
  private async ensureParser(): Promise<Parser> {
    if (!this.parser) {
      await ensureParserInitialized();
      this.parser = new Parser();
    }
    return this.parser;
  }

  /**
   * Parse code and extract semantic chunks (classes, functions, methods)
   */
  async chunk(code: string, lang: 'javascript' | 'typescript' | 'tsx'): Promise<Chunk[]> {
    const parser = await this.ensureParser();
    const language = await loadLanguage(lang);
    parser.setLanguage(language);

    const tree = parser.parse(code);
    const chunks: Chunk[] = [];

    // Handle parse failure
    if (!tree) {
      chunks.push({
        text: code,
        metadata: { type: 'file', startLine: 1, endLine: code.split('\n').length }
      });
      return chunks;
    }

    // Simple query to find definitions
    // Note: Query syntax depends on grammar.
    // Need to handle errors if query fails.
    try {
      const query = new Query(language, `
        (function_declaration name: (identifier) @name) @def
        (class_declaration name: (identifier) @name) @def
        (method_definition name: (property_identifier) @name) @def
        (arrow_function) @def
      `);
      
      const matches = query.matches(tree.rootNode);

      for (const match of matches) {
        const defCapture = match.captures.find((c: { name: string }) => c.name === 'def');
        const nameCapture = match.captures.find((c: { name: string }) => c.name === 'name');

        if (defCapture) {
          const defNode = defCapture.node;
          chunks.push({
            text: defNode.text,
            metadata: {
              type: defNode.type,
              name: nameCapture?.node.text || 'anonymous',
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
