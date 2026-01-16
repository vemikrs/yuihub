#!/usr/bin/env node
// ESM front-matter aware Lunr indexer (Shelter-first)
// Usage:
//   node scripts/build-index.mjs --paths notes --paths docs/logdocs --mode=Shelter,Signal --visibility=private,internal --dryRun
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import lunr from 'lunr';
import yaml from 'js-yaml';
import minimist from 'minimist';
import { glob } from 'glob';

const argv = minimist(process.argv.slice(2), {
  string: ['paths','mode','visibility'],
  boolean: ['dryRun'],
  default: {
    paths: [],
    mode: '',
    visibility: ''
  }
});
const roots = (Array.isArray(argv.paths) ? argv.paths : [argv.paths]).filter(Boolean);
if (roots.length === 0) {
  roots.push('notes', 'chatlogs');
}
const modeFilter = new Set((argv.mode || '').split(',').filter(Boolean));
const visibilityFilter = new Set((argv.visibility || '').split(',').filter(Boolean));
const dryRun = !!argv.dryRun;

function splitFrontMatter(content) {
  if (!content.startsWith('---')) return { fm: {}, body: content };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { fm: {}, body: content };
  const raw = content.slice(3, end + 1); // between --- ... --- + trailing newline
  let fm = {};
  try { fm = yaml.load(raw) || {}; } catch (e) { fm = {}; }
  const body = content.slice(end + 4);
  return { fm, body };
}

function matchFilters(fm) {
  if (modeFilter.size > 0) {
    const mode = (fm.mode || '').toString().toLowerCase();
    const filterSet = new Set([...modeFilter].map(v => v.toLowerCase()));
    if (!filterSet.has(mode)) return false;
  }
  if (visibilityFilter.size > 0) {
    // support controls.visibility or top-level visibility
    const vis = (fm?.controls?.visibility || fm.visibility || '').toString().toLowerCase();
    const filterSetV = new Set([...visibilityFilter].map(v => v.toLowerCase()));
    if (!filterSetV.has(vis)) return false;
  }
  return true;
}

const t0 = performance.now();
const collected = [];
const skipped = [];
for (const rootDir of roots) {
  if (!fs.existsSync(rootDir)) continue;
  const pattern = path.join(rootDir, '**/*.md').replace(/\\/g, '/');
  const files = await glob(pattern);
  for (const p of files) {
    try {
      const content = fs.readFileSync(p, 'utf8');
      const { fm, body } = splitFrontMatter(content);
      if (!matchFilters(fm)) {
        skipped.push({ id: p, reason: 'filter-mismatch', fm });
        continue;
      }
      collected.push({ id: p, text: body, fm });
    } catch (e) {
      skipped.push({ id: p, reason: 'read-failed', error: e.message });
    }
  }
}

let summary = {
  ok: true,
  indexed: 0,
  skipped: skipped.length,
  duration_ms: 0,
  artifact: 'index/lunr.idx.json',
  warnings: [],
  candidates: collected.map(d => d.id)
};

if (dryRun) {
  summary.indexed = collected.length;
  summary.duration_ms = Math.round(performance.now() - t0);
  console.log(JSON.stringify(summary));
  process.exit(0);
}

// build index
const idx = lunr(function () {
  this.ref('id');
  this.field('text');
  collected.forEach(d => this.add(d));
});
fs.mkdirSync('index', { recursive: true });
fs.writeFileSync('index/lunr.idx.json', JSON.stringify(idx), 'utf8');
summary.indexed = collected.length;
summary.duration_ms = Math.round(performance.now() - t0);
console.log(JSON.stringify(summary));
