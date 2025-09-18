import fs from 'fs-extra';
import path from 'path';
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
    
    const filename = `${year}-${month}-${day}-${frontmatter.topic?.replace(/[^a-zA-Z0-9-]/g, '-')}-${id}.md`;
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
      url: `file://${fullPath}`
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
}

export function createStorageAdapter() {
  const type = process.env.STORAGE_ADAPTER || 'local';
  
  const config = {
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

  return new StorageAdapter(type, config[type]);
}