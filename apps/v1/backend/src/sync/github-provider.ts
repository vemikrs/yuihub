import { simpleGit, SimpleGit } from 'simple-git';
import fs from 'fs-extra';
import { ISyncProvider } from '@yuihub/core';
import path from 'path';

export class GitHubSyncProvider implements ISyncProvider {
  name = 'github';
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

  async push(message: string = 'chore: sync from yuihub'): Promise<void> {
    try {
      const status = await this.git.status();
      if (status.isClean()) return;

      await this.git.add('.');
      await this.git.commit(message);
      // await this.git.push('origin', 'main'); // TODO: Configure branch
    } catch (e) {
      console.error('[Sync] Push failed:', e);
      throw e;
    }
  }

  async pull(): Promise<void> {
    try {
      // await this.git.pull('origin', 'main');
    } catch (e) {
      console.error('[Sync] Pull failed:', e);
      throw e;
    }
  }

  async status() {
    const s = await this.git.status();
    return {
      dirty: !s.isClean(),
      ahead: s.ahead,
      behind: s.behind
    };
  }
}
