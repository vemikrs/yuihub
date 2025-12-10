import express from 'express';
import rateLimit from 'express-rate-limit';
import { spawn } from 'node:child_process';

const app = express();
app.use(express.json());

const HOST = '127.0.0.1';
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.LOCAL_OPS_TOKEN || '';

// simple bearer check
app.use((req, res, next) => {
  if (req.path.startsWith('/ops/')) {
    const auth = req.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!TOKEN || token !== TOKEN) {
      return res.status(401).json({ ok:false, error: 'unauthorized' });
    }
  }
  next();
});

app.post('/ops/reindex', reindexLimiter, (req, res) => {
  const body = req.body || {};
  const paths = Array.isArray(body.paths) ? body.paths : (body.paths ? [body.paths] : []);
  const filters = body.filters || {};
  const mode = Array.isArray(filters.mode) ? filters.mode.join(',') : (filters.mode || '');
  const visibility = Array.isArray(filters.visibility) ? filters.visibility.join(',') : (filters.visibility || '');
  const dryRun = !!body.dryRun;

  const args = ['scripts/build-index.cjs'];
  for (const p of paths) args.push('--paths', p);
  if (mode) args.push('--mode', mode);
  if (visibility) args.push('--visibility', visibility);
  if (dryRun) args.push('--dryRun');

  const child = spawn(process.execPath, args, { stdio: ['ignore','pipe','pipe'] });
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => out += d.toString());
  child.stderr.on('data', (d) => err += d.toString());
  child.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ ok:false, error: 'indexer_failed', stderr: err.trim() });
    }
    try {
      const parsed = JSON.parse(out.trim());
      return res.json(parsed);
    } catch (e) {
      return res.status(200).json({ ok:true, raw: out.trim() });
    }
  });
});

app.get('/health', (_req, res) => res.json({ ok:true }));

app.listen(PORT, HOST, () => {
  console.log(`[YuiHub API] /ops/reindex ready on http://${HOST}:${PORT}`);
});
