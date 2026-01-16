#!/usr/bin/env node
/**
 * YuiHub Weekly Summarizer - Generates weekly summaries of decisions and discussions
 */

import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = process.env.LOCAL_STORAGE_PATH || path.join(__dirname, '../chatlogs');
const OUTPUT_DIR = path.join(__dirname, '../summaries');

await fs.ensureDir(OUTPUT_DIR);

/**
 * Get the start and end dates for a week containing the given date
 */
function getWeekRange(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // End of week (Saturday)
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Format week identifier (YYYY-WW)
 */
function getWeekId(date) {
  const year = date.getFullYear();
  const week = Math.ceil(((date - new Date(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-${String(week).padStart(2, '0')}`;
}

async function generateWeeklySummaries() {
  console.log('📅 Generating weekly summaries...');
  
  const pattern = path.join(SOURCE_DIR, '**/*.md').replace(/\\/g, '/');
  const files = await glob(pattern);
  
  // Group files by week
  const weeklyData = new Map();
  
  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = matter(raw);
      const { data: frontmatter, content } = parsed;
      
      if (!frontmatter?.date) continue;
      
      const date = new Date(frontmatter.date);
      const weekId = getWeekId(date);
      
      if (!weeklyData.has(weekId)) {
        const { start, end } = getWeekRange(date);
        weeklyData.set(weekId, {
          weekId,
          start: start.toISOString(),
          end: end.toISOString(),
          decisions: { '採用': [], '保留': [], '却下': [] },
          discussions: [],
          actors: new Set(),
          tags: new Set(),
          totalNotes: 0
        });
      }
      
      const weekData = weeklyData.get(weekId);
      weekData.totalNotes++;
      
      // Add to actors and tags
      if (frontmatter.actors) {
        frontmatter.actors.forEach(actor => weekData.actors.add(actor));
      }
      if (frontmatter.tags) {
        frontmatter.tags.forEach(tag => weekData.tags.add(tag));
      }
      
      const noteData = {
        id: frontmatter.id,
        date: frontmatter.date,
        topic: frontmatter.topic,
        tags: frontmatter.tags || [],
        actors: frontmatter.actors || [],
        path: path.relative(SOURCE_DIR, filePath)
      };
      
      // Categorize by decision
      if (frontmatter.decision && weekData.decisions[frontmatter.decision]) {
        weekData.decisions[frontmatter.decision].push(noteData);
      } else {
        weekData.discussions.push(noteData);
      }
    } catch (error) {
      console.warn(`⚠️  Error processing ${filePath}:`, error.message);
    }
  }
  
  // Generate summaries
  const summaries = [];
  
  for (const [weekId, data] of weeklyData) {
    const summary = {
      ...data,
      actors: Array.from(data.actors),
      tags: Array.from(data.tags),
      summary: {
        totalDecisions: data.decisions['採用'].length + data.decisions['保留'].length + data.decisions['却下'].length,
        adopted: data.decisions['採用'].length,
        pending: data.decisions['保留'].length,
        rejected: data.decisions['却下'].length,
        discussions: data.discussions.length
      }
    };
    
    summaries.push(summary);
    
    // Save individual weekly summary
    const weekPath = path.join(OUTPUT_DIR, `${weekId}.json`);
    await fs.writeJson(weekPath, summary, { spaces: 2 });
  }
  
  // Sort by week and save master summary
  summaries.sort((a, b) => b.weekId.localeCompare(a.weekId));
  
  const masterPath = path.join(OUTPUT_DIR, 'weekly-summaries.json');
  await fs.writeJson(masterPath, {
    generatedAt: new Date().toISOString(),
    weeks: summaries.map(s => ({
      weekId: s.weekId,
      start: s.start,
      end: s.end,
      totalNotes: s.totalNotes,
      summary: s.summary
    }))
  }, { spaces: 2 });
  
  console.log(`✅ Generated ${summaries.length} weekly summaries`);
  console.log(`   Master summary: ${masterPath}`);
  
  // Generate recent activity report (last 4 weeks)
  const recentWeeks = summaries.slice(0, 4);
  const recentPath = path.join(OUTPUT_DIR, 'recent-activity.json');
  await fs.writeJson(recentPath, {
    generatedAt: new Date().toISOString(),
    period: '4 weeks',
    weeks: recentWeeks
  }, { spaces: 2 });
  
  console.log(`📋 Recent activity report: ${recentPath}`);
}

async function main() {
  try {
    await generateWeeklySummaries();
  } catch (error) {
    console.error('❌ Summary generation failed:', error);
    process.exit(1);
  }
}

main();