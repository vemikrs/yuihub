// Minimal prebuilder: scans chatlogs and emits a simple index JSON for the API/UI.
// Replace with true Lunr indexing in UI or here if desired.
import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import glob from 'glob';

const ROOT = path.resolve(process.env.ROOT || '.');
const CHAT = path.join(ROOT, 'chatlogs');
const OUTDIR = path.join(ROOT, 'index');
await fs.ensureDir(OUTDIR);

const files = glob.sync(path.join(CHAT, '**/*.md'));
const docs = [];
for (const f of files) {
  const raw = await fs.readFile(f, 'utf8');
  const fm = matter(raw);
  docs.push({
    id: fm.data?.id || path.basename(f),
    title: fm.data?.topic || 'note',
    path: f,
    url: '',
    text: fm.content.replace(/\s+/g,' ').slice(0, 4000)
  });
}
await fs.writeJson(path.join(OUTDIR, 'lunr.idx.json'), { docs }, { spaces: 2 });
console.log(`indexed ${docs.length} docs -> index/lunr.idx.json`);
