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

// Promise cache for language loading (prevents race conditions)
let jsLangPromise: Promise<Language> | null = null;
let tsLangPromise: Promise<Language> | null = null;
let parserInitPromise: Promise<void> | null = null;

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
 * Uses promise caching to prevent race conditions
 */
async function ensureParserInitialized(): Promise<void> {
  if (!parserInitPromise) {
    parserInitPromise = Parser.init();
  }
  await parserInitPromise;
}

/**
 * Load a language WASM file with promise caching to prevent race conditions
 */
async function loadLanguage(lang: 'javascript' | 'typescript' | 'tsx'): Promise<Language> {
  await ensureParserInitialized();
  
  switch (lang) {
    case 'javascript':
      if (!jsLangPromise) {
        jsLangPromise = Language.load(getWasmPath('tree-sitter-javascript.wasm'));
      }
      return jsLangPromise;
    case 'typescript':
    case 'tsx':
      // tree-sitter-typescript.wasm handles both TypeScript and TSX
      if (!tsLangPromise) {
        tsLangPromise = Language.load(getWasmPath('tree-sitter-typescript.wasm'));
      }
      return tsLangPromise;
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

    try {
      // Query patterns differ slightly between JavaScript and TypeScript grammars
      // Use language-appropriate patterns to avoid TSQueryErrorStructure errors
      const queryPattern = lang === 'javascript' 
        ? `
          (function_declaration name: (identifier) @name) @def
          (class_declaration name: (identifier) @name) @def
          (method_definition name: (property_identifier) @name) @def
          (arrow_function) @def
        `
        : `
          (function_declaration name: (identifier) @name) @def
          (class_declaration name: (type_identifier) @name) @def
          (method_signature name: (property_identifier) @name) @def
          (arrow_function) @def
        `;
      
      const query = new Query(language, queryPattern);
      
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
      // Fallback: entire file as one chunk
      chunks.push({
        text: code,
        metadata: { type: 'file', startLine: 1, endLine: code.split('\n').length }
      });
    } finally {
      // Free WASM memory to prevent memory leaks
      tree.delete();
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
