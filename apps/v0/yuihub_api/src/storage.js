import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';
import { Octokit } from '@octokit/rest';
import { ulid } from 'ulid';

export class StorageAdapter {
  constructor(type, config) {
    this.type = type;
    this.config = config;
    
    if (type === 'github') {
      this.octokit = new Octokit({
        auth: config.token,
      });
    }
  }

  async save(frontmatter, body) {
    const { id, date } = frontmatter;
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const safeTopic = typeof frontmatter.topic === 'string' && frontmatter.topic.trim().length > 0
      ? frontmatter.topic.replace(/[^a-zA-Z0-9-]/g, '-')
      : undefined;
    const filename = `${year}-${month}-${day}${safeTopic ? '-' + safeTopic : ''}-${id}.md`;
    const relativePath = `${year}/${month}/${filename}`;
    
    const content = this._buildMarkdown(frontmatter, body);
    
    switch (this.type) {
      case 'local':
        return await this._saveLocal(relativePath, content);
      case 'github':
        return await this._saveGithub(relativePath, content);
      default:
        throw new Error(`Unsupported storage adapter: ${this.type}`);
    }
  }

  async _saveLocal(relativePath, content) {
    const fullPath = path.join(this.config.basePath, relativePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf8');
    
    return {
      ok: true,
      path: relativePath,
      url: `file://./${relativePath}`
    };
  }

  async _saveGithub(relativePath, content) {
    const fullPath = path.join(this.config.basePath || 'chatlogs', relativePath).replace(/\\/g, '/');
    
    try {
      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path: fullPath,
        message: `chore: save chat log ${path.basename(relativePath)}`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch: this.config.branch || 'main',
      });

      return {
        ok: true,
        path: fullPath,
        url: data.content.html_url
      };
    } catch (error) {
      throw new Error(`GitHub save failed: ${error.message}`);
    }
  }

  _buildMarkdown(frontmatter, body) {
    const yamlLines = [];
    yamlLines.push('---');
    
    Object.entries(frontmatter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        yamlLines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
      } else {
        yamlLines.push(`${key}: ${JSON.stringify(value)}`);
      }
    });
    
    yamlLines.push('---');
    
    return yamlLines.join('\n') + '\n\n' + body;
  }

  /**
   * 最近のノートを取得（local adapterのみ）
   * @param {number} limit 最大件数（既定20）
   * @returns {Promise<Array<{id:string,title?:string,path:string,date?:string,tags?:string[],decision?:string,actors?:string[]}>>}
   */
  async getRecent(limit = 20) {
    if (this.type !== 'local') {
      // PoC: github/other adaptersは未対応
      return [];
    }

    const base = this.config.basePath;
    const pattern = path.join(base, '**/*.md').replaceAll('\\','/');
    const files = await glob(pattern, { nodir: true });

    // mtime降順でソート
    const withStat = await Promise.all(files.map(async (f) => ({
      file: f,
      stat: await fs.stat(f).catch(() => null)
    })));
    const sorted = withStat
      .filter(x => x.stat)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      .slice(0, limit);

    const items = [];
    for (const { file } of sorted) {
      try {
        const raw = await fs.readFile(file, 'utf8');
        const parsed = matter(raw);
        const fm = parsed.data || {};
        const rel = path.relative(base, file).replaceAll('\\','/');
        // タイトル: 先頭の見出しか1行目
        let title;
        const lines = (parsed.content || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const h1 = lines.find(l => l.startsWith('# '));
        if (h1) title = h1.replace(/^#\s+/, ''); else title = lines[0] || rel;

        items.push({
          id: String(fm.id || ''),
          title,
          path: rel,
          date: fm.date ? String(fm.date) : undefined,
          tags: Array.isArray(fm.tags) ? fm.tags : undefined,
          decision: fm.decision,
          actors: Array.isArray(fm.actors) ? fm.actors : undefined
        });
      } catch {
        // 読み込み失敗はスキップ
      }
    }
    return items;
  }
}

export function createStorageAdapter(overrides = {}) {
  const type = overrides.type || process.env.STORAGE_ADAPTER || 'local';
  const envConfig = {
    local: {
      basePath: process.env.LOCAL_STORAGE_PATH || './chatlogs'
    },
    github: {
      token: process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      branch: process.env.GITHUB_BRANCH || 'main',
      basePath: process.env.GITHUB_PATH || 'chatlogs'
    }
  };

  const conf = { ...envConfig[type], ...(overrides[type] || {}) };
  return new StorageAdapter(type, conf);
}