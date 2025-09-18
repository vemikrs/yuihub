#!/usr/bin/env node
/**
 * YuiHub Indexer - Builds Lunr search index from markdown chat logs
 * Usage: node scripts/chunk_and_lunr.mjs [--source=./chatlogs] [--output=./index]
 */

import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import lunr from 'lunr';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defaultValue;
};

const SOURCE_DIR = getArg('source', process.env.LOCAL_STORAGE_PATH || path.join(__dirname, '../chatlogs'));
const OUTPUT_DIR = getArg('output', path.join(__dirname, '../index'));
const CHUNK_SIZE = parseInt(getArg('chunk-size', '1000'), 10);

console.log(`📚 YuiHub Indexer`);
console.log(`Source: ${SOURCE_DIR}`);
console.log(`Output: ${OUTPUT_DIR}`);
console.log(`Chunk size: ${CHUNK_SIZE} chars`);

await fs.ensureDir(OUTPUT_DIR);

/**
 * Split long text into chunks for better search precision
 */
function chunkText(text, maxSize = CHUNK_SIZE) {
  if (text.length <= maxSize) return [text];
  
  const chunks = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Extract searchable content from markdown
 */
function extractContent(markdown) {
  // Remove code blocks
  let content = markdown.replace(/```[\s\S]*?```/g, '');
  // Remove inline code
  content = content.replace(/`[^`]+`/g, '');
  // Remove markdown links but keep text
  content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove markdown formatting
  content = content.replace(/[*_#>]/g, '');
  // Normalize whitespace
  content = content.replace(/\s+/g, ' ').trim();
  
  return content;
}

async function buildIndex() {
  console.log('🔍 Scanning for markdown files...');
  
  const pattern = path.join(SOURCE_DIR, '**/*.md').replace(/\\/g, '/');
  const files = await glob(pattern);
  
  console.log(`Found ${files.length} files`);
  
  const documents = [];
  const docMetadata = [];
  let chunkId = 0;
  
  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = matter(raw);
      const { data: frontmatter, content } = parsed;
      
      if (!frontmatter?.id) {
        console.warn(`⚠️  Skipping ${filePath} - missing id in frontmatter`);
        continue;
      }
      
      const extractedContent = extractContent(content);
      const chunks = chunkText(extractedContent);
      
      const relativePath = path.relative(SOURCE_DIR, filePath);
      const baseUrl = process.env.BASE_URL || '';
      
      for (let i = 0; i < chunks.length; i++) {
        const docId = `${frontmatter.id}-${i}`;
        const chunk = chunks[i];
        
        if (chunk.length < 50) continue; // Skip very short chunks
        
        documents.push({
          id: docId,
          title: frontmatter.topic || path.basename(filePath, '.md'),
          body: chunk,
          tags: (frontmatter.tags || []).join(' '),
          actors: (frontmatter.actors || []).join(' ')
        });
        
        docMetadata.push({
          id: docId,
          originalId: frontmatter.id,
          chunkIndex: i,
          title: frontmatter.topic || path.basename(filePath, '.md'),
          path: relativePath,
          url: baseUrl ? `${baseUrl}/${relativePath}` : `file://./${relativePath}`,
          date: frontmatter.date,
          tags: frontmatter.tags || [],
          decision: frontmatter.decision,
          actors: frontmatter.actors || [],
          body: chunk.substring(0, 500) // Store first 500 chars for snippets
        });
        
        chunkId++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }
  
  console.log(`📄 Processed ${documents.length} document chunks`);
  
  if (documents.length === 0) {
    console.warn('⚠️  No documents found to index');
    return;
  }
  
  console.log('🔨 Building Lunr index...');
  
  // Configure Lunr with Japanese support if needed
  const index = lunr(function () {
    this.ref('id');
    this.field('title', { boost: 10 });
    this.field('body');
    this.field('tags', { boost: 5 });
    this.field('actors');
    
    documents.forEach(doc => this.add(doc));
  });
  
  console.log('💾 Saving index...');
  
  const indexData = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    documentsCount: documents.length,
    index: index.toJSON(),
    documents: docMetadata
  };
  
  const indexPath = path.join(OUTPUT_DIR, 'lunr.idx.json');
  await fs.writeJson(indexPath, indexData, { spaces: 2 });
  
  // Also save a simple docs list for fallback
  const docsPath = path.join(OUTPUT_DIR, 'documents.json');
  await fs.writeJson(docsPath, docMetadata, { spaces: 2 });
  
  console.log(`✅ Index built successfully!`);
  console.log(`   Index file: ${indexPath}`);
  console.log(`   Documents: ${documents.length} chunks from ${files.length} files`);
  console.log(`   Size: ${(await fs.stat(indexPath)).size} bytes`);
}

// Generate build statistics
async function generateStats() {
  try {
    const pattern = path.join(SOURCE_DIR, '**/*.md').replace(/\\/g, '/');
    const files = await glob(pattern);
    
    const stats = {
      totalFiles: files.length,
      byDecision: { '採用': 0, '保留': 0, '却下': 0, null: 0 },
      byActor: {},
      byTag: {},
      generatedAt: new Date().toISOString()
    };
    
    for (const filePath of files) {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = matter(raw);
        const { data } = parsed;
        
        // Count decisions
        const decision = data.decision || null;
        stats.byDecision[decision]++;
        
        // Count actors
        if (data.actors) {
          data.actors.forEach(actor => {
            stats.byActor[actor] = (stats.byActor[actor] || 0) + 1;
          });
        }
        
        // Count tags
        if (data.tags) {
          data.tags.forEach(tag => {
            stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
          });
        }
      } catch (error) {
        // Skip files with parsing errors
      }
    }
    
    const statsPath = path.join(OUTPUT_DIR, 'stats.json');
    await fs.writeJson(statsPath, stats, { spaces: 2 });
    
    console.log(`📊 Statistics saved to ${statsPath}`);
  } catch (error) {
    console.error('❌ Failed to generate stats:', error.message);
  }
}

// Main execution
async function main() {
  try {
    await buildIndex();
    await generateStats();
  } catch (error) {
    console.error('❌ Indexing failed:', error);
    process.exit(1);
  }
}

main();
