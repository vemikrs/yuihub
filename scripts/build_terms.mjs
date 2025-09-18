#!/usr/bin/env node
/**
 * YuiHub Terms Builder - Creates reverse index of terms and topics
 */

import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = process.env.LOCAL_STORAGE_PATH || path.join(__dirname, '../chatlogs');
const OUTPUT_DIR = path.join(__dirname, '../index');

await fs.ensureDir(OUTPUT_DIR);

/**
 * Extract terms from text using simple word extraction
 */
function extractTerms(text, minLength = 2) {
  if (!text) return [];
  
  // Japanese and English word extraction
  const terms = new Set();
  
  // Extract Japanese terms (2+ characters)
  const japaneseMatches = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{2,}/g);
  if (japaneseMatches) {
    japaneseMatches.forEach(match => {
      if (match.length >= minLength) {
        terms.add(match);
      }
    });
  }
  
  // Extract English terms (3+ characters, alphanumeric)
  const englishMatches = text.match(/[a-zA-Z][a-zA-Z0-9]{2,}/g);
  if (englishMatches) {
    englishMatches.forEach(match => {
      if (match.length >= 3 && !match.match(/^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|may|new|now|old|see|two|way|who|boy|did|its|let|put|say|she|too|use)$/i)) {
        terms.add(match.toLowerCase());
      }
    });
  }
  
  return Array.from(terms);
}

/**
 * Calculate term frequency across documents
 */
function calculateTfIdf(termDocs, totalDocs) {
  const termFreq = new Map();
  
  for (const [term, docs] of termDocs) {
    const df = docs.length; // Document frequency
    const idf = Math.log(totalDocs / df); // Inverse document frequency
    
    let totalTf = 0;
    docs.forEach(doc => totalTf += doc.count);
    
    termFreq.set(term, {
      term,
      documentFrequency: df,
      totalFrequency: totalTf,
      idf,
      documents: docs.map(doc => ({
        id: doc.id,
        topic: doc.topic,
        count: doc.count,
        relevance: doc.count * idf
      })).sort((a, b) => b.relevance - a.relevance)
    });
  }
  
  return termFreq;
}

async function buildTermsIndex() {
  console.log('🏗️  Building terms index...');
  
  const pattern = path.join(SOURCE_DIR, '**/*.md').replace(/\\/g, '/');
  const files = await glob(pattern);
  
  console.log(`Processing ${files.length} files...`);
  
  const termDocuments = new Map(); // term -> [{id, topic, count}]
  const topicIndex = new Map(); // topic -> [documents]
  const tagIndex = new Map(); // tag -> [documents]
  const actorIndex = new Map(); // actor -> [documents]
  const documents = [];
  
  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = matter(raw);
      const { data: frontmatter, content } = parsed;
      
      if (!frontmatter?.id) continue;
      
      const docInfo = {
        id: frontmatter.id,
        topic: frontmatter.topic || path.basename(filePath, '.md'),
        path: path.relative(SOURCE_DIR, filePath),
        date: frontmatter.date,
        tags: frontmatter.tags || [],
        actors: frontmatter.actors || [],
        decision: frontmatter.decision
      };
      
      documents.push(docInfo);
      
      // Index by topic
      const topic = frontmatter.topic;
      if (topic) {
        if (!topicIndex.has(topic)) {
          topicIndex.set(topic, []);
        }
        topicIndex.get(topic).push(docInfo);
      }
      
      // Index by tags
      if (frontmatter.tags) {
        frontmatter.tags.forEach(tag => {
          if (!tagIndex.has(tag)) {
            tagIndex.set(tag, []);
          }
          tagIndex.get(tag).push(docInfo);
        });
      }
      
      // Index by actors
      if (frontmatter.actors) {
        frontmatter.actors.forEach(actor => {
          if (!actorIndex.has(actor)) {
            actorIndex.set(actor, []);
          }
          actorIndex.get(actor).push(docInfo);
        });
      }
      
      // Extract and count terms
      const fullText = `${frontmatter.topic || ''} ${content}`;
      const terms = extractTerms(fullText);
      const termCounts = new Map();
      
      terms.forEach(term => {
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      });
      
      // Add to global term index
      for (const [term, count] of termCounts) {
        if (!termDocuments.has(term)) {
          termDocuments.set(term, []);
        }
        termDocuments.get(term).push({
          id: frontmatter.id,
          topic: frontmatter.topic,
          count
        });
      }
    } catch (error) {
      console.warn(`⚠️  Error processing ${filePath}:`, error.message);
    }
  }
  
  console.log('🧮 Calculating term frequencies...');
  
  // Calculate TF-IDF for terms
  const termsWithTfIdf = calculateTfIdf(termDocuments, documents.length);
  
  // Sort terms by relevance
  const sortedTerms = Array.from(termsWithTfIdf.values())
    .sort((a, b) => b.totalFrequency - a.totalFrequency);
  
  // Build final index
  const termsIndex = {
    generatedAt: new Date().toISOString(),
    documentsCount: documents.length,
    termsCount: sortedTerms.length,
    
    // Top terms by frequency
    topTerms: sortedTerms.slice(0, 100).map(term => ({
      term: term.term,
      frequency: term.totalFrequency,
      documentCount: term.documentFrequency
    })),
    
    // All terms with document references
    terms: Object.fromEntries(
      sortedTerms.map(term => [
        term.term,
        {
          frequency: term.totalFrequency,
          documentCount: term.documentFrequency,
          documents: term.documents.slice(0, 20) // Limit to top 20 most relevant docs
        }
      ])
    ),
    
    // Indexes by different dimensions
    topics: Object.fromEntries(
      Array.from(topicIndex.entries()).map(([topic, docs]) => [
        topic,
        docs.map(d => ({ id: d.id, path: d.path, date: d.date }))
      ])
    ),
    
    tags: Object.fromEntries(
      Array.from(tagIndex.entries())
        .sort(([,a], [,b]) => b.length - a.length) // Sort by document count
        .map(([tag, docs]) => [
          tag,
          docs.map(d => ({ id: d.id, topic: d.topic, path: d.path, date: d.date }))
        ])
    ),
    
    actors: Object.fromEntries(
      Array.from(actorIndex.entries())
        .sort(([,a], [,b]) => b.length - a.length)
        .map(([actor, docs]) => [
          actor,
          docs.map(d => ({ id: d.id, topic: d.topic, path: d.path, date: d.date }))
        ])
    )
  };
  
  // Save the comprehensive terms index
  const termsPath = path.join(OUTPUT_DIR, 'terms.json');
  await fs.writeJson(termsPath, termsIndex, { spaces: 2 });
  
  // Save lightweight version for quick lookups
  const quickPath = path.join(OUTPUT_DIR, 'terms-quick.json');
  await fs.writeJson(quickPath, {
    generatedAt: termsIndex.generatedAt,
    topTerms: termsIndex.topTerms,
    tags: Object.fromEntries(
      Object.entries(termsIndex.tags).map(([tag, docs]) => [tag, docs.length])
    ),
    actors: Object.fromEntries(
      Object.entries(termsIndex.actors).map(([actor, docs]) => [actor, docs.length])
    )
  }, { spaces: 2 });
  
  console.log(`✅ Terms index built successfully!`);
  console.log(`   Full index: ${termsPath}`);
  console.log(`   Quick index: ${quickPath}`);
  console.log(`   Terms: ${sortedTerms.length}`);
  console.log(`   Topics: ${topicIndex.size}`);
  console.log(`   Tags: ${tagIndex.size}`);
  console.log(`   Actors: ${actorIndex.size}`);
}

async function main() {
  try {
    await buildTermsIndex();
  } catch (error) {
    console.error('❌ Terms index building failed:', error);
    process.exit(1);
  }
}

main();