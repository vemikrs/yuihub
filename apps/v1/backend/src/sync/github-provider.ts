import { simpleGit, SimpleGit } from 'simple-git';
import fs from 'fs-extra';
import { ISyncProvider } from '@yuihub/core';
import path from 'path';

export class GitHubSyncProvider implements ISyncProvider {
  readonly name = 'github' as const;
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async init(remoteUrl?: string) {
    if (!await fs.pathExists(path.join(this.repoPath, '.git'))) {
      await this.git.init();
      if (remoteUrl) {
        await this.git.addRemote('origin', remoteUrl);
      }
    }
  }

  /**
   * Exponential Backoff Retry Wrapper for Git Operations
   */
  private async withRetry<T>(operation: () => Promise<T>, retries = 5, baseDelay = 1000): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (e: any) {
        const isLockError = e.message?.includes('index.lock') || e.message?.includes('Unable to create');
        if (isLockError && i < retries - 1) {
          const delay = baseDelay * Math.pow(2, i); // 1s, 2s, 4s, 8s, 16s
          console.warn(`[Sync] Git lock detected. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
          await new Promise(r => setTimeout(r, delay));
          
          // Attempt to clean stale lock?
          // CAUTION: Removing lock blindly is dangerous, but common in automated environments strictly controlled by one process.
          // Here we are potentially competing with user. Better to just wait.
          continue;
        }
        throw e;
      }
    }
    throw new Error('Unreachable');
  }

  async push(message: string = 'chore: sync from yuihub'): Promise<void> {
    await this.withRetry(async () => {
      // Check status first
      const status = await this.git.status();
      if (status.isClean()) return;

      await this.git.add('.');
      await this.git.commit(message);
      
      // Check if remote exists before pushing
      const remotes = await this.git.getRemotes();
      if (remotes.some(r => r.name === 'origin')) {
          // Pull with rebase first to avoid non-fast-forward?
          // await this.git.pull('origin', 'main', { '--rebase': 'true' });
          await this.git.push('origin', 'main'); 
      }
    });
  }

  async pull(): Promise<void> {
    await this.withRetry(async () => {
      const remotes = await this.git.getRemotes();
      if (remotes.some(r => r.name === 'origin')) {
        await this.git.pull('origin', 'main');
      }
    });
  }

  async status() {
    return this.withRetry(async () => {
      const s = await this.git.status();
      return {
        dirty: !s.isClean(),
        ahead: s.ahead,
        behind: s.behind
      };
    });
  }
}
