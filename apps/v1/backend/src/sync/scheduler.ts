import { CronJob } from 'cron';
import { ISyncProvider } from '@yuihub/core';

export class SyncScheduler {
  private job: CronJob;
  private provider: ISyncProvider;
  private isRunning: boolean = false;

  constructor(provider: ISyncProvider, cronExpression: string = '*/5 * * * *') { // Default 5 mins
    this.provider = provider;
    this.job = new CronJob(cronExpression, async () => {
      await this.runSync();
    });
  }

  start() {
    this.job.start();
    console.log(`[Sync] Scheduler started (${this.provider.name})`);
  }

  stop() {
    this.job.stop();
  }

  async runSync() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      console.log('[Sync] Starting sync...');
      await this.provider.push(`sync: auto backup ${new Date().toISOString()}`);
      // await this.provider.pull(); // Pull strategy?
      console.log('[Sync] Sync completed.');
    } catch (e) {
      console.error('[Sync] Error:', e);
    } finally {
      this.isRunning = false;
    }
  }
}
