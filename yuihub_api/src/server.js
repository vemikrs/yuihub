import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { ulid } from 'ulid';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8787;
const DATA_ROOT = process.env.DATA_ROOT || path.join(__dirname, '../../chatlogs');
const INDEX_DIR = process.env.INDEX_DIR || path.join(__dirname, '../../index');
const LUNR_JSON = path.join(INDEX_DIR, 'lunr.idx.json');

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

function sanitizeSlug(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

app.get('/health', async () => ({ ok: true }));

// POST /save
app.post('/save', async (req, reply) => {
  const { frontmatter, body } = req.body || {};
  const id = (frontmatter?.id) || ulid();
  const date = new Date(frontmatter?.date || Date.now());
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  const topic = sanitizeSlug(frontmatter?.topic || 'note');
  const dir = path.join(DATA_ROOT, `${y}`, `${m}`);
  await fs.ensureDir(dir);
  const filename = `${y}-${m}-${d}-${topic}-${id}.md`;
  const full = path.join(dir, filename);

  const fm = { id, date: date.toISOString(), actors: [], topic: '', tags: [], decision: null, links: [], ...frontmatter };
  const md = matter.stringify(body || '', fm);
  await fs.writeFile(full, md, 'utf8');

  return { ok: true, path: full, url: `file://${full}` };
});

// GET /recent?n=20
app.get('/recent', async (req, reply) => {
  const n = Number(req.query.n || 20);
  const files = (await fs.glob(`${DATA_ROOT}/**/*.md`)).sort((a,b)=>fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const items = [];
  for (const f of files.slice(0, n*3)) {
    const raw = await fs.readFile(f, 'utf8');
    const p = matter(raw);
    if (p.data?.decision) {
      items.push({ id: p.data.id, date: p.data.date, topic: p.data.topic, decision: p.data.decision, path: f });
      if (items.length >= n) break;
    }
  }
  return { items };
});

// GET /search?q=... (Lunr prebuilt JSON)
app.get('/search', async (req, reply) => {
  const q = String(req.query.q || '').trim();
  if (!q) return { hits: [] };
  try {
    const idx = await fs.readJson(LUNR_JSON);
    // naive client-side style search: substring match on title/body as a placeholder (Lunr query is done in UI normally)
    const hits = [];
    for (const doc of idx.docs || []) {
      const hay = `${doc.title} ${doc.text}`.toLowerCase();
      const pos = hay.indexOf(q.toLowerCase());
      if (pos >= 0) {
        hits.push({
          id: doc.id,
          score: doc.text.length, // placeholder score
          title: doc.title,
          path: doc.path,
          snippet: doc.text.slice(Math.max(0, pos-40), pos+80) + '...',
          url: doc.url || ''
        });
        if (hits.length >= Number(req.query.limit || 10)) break;
      }
    }
    return { hits };
  } catch (e) {
    return { hits: [], error: 'index_missing_or_invalid' };
  }
});

app.listen({ port: Number(PORT), host: '0.0.0.0' }).catch((err)=>{
  app.log.error(err);
  process.exit(1);
});
