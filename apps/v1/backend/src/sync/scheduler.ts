import { CronJob } from 'cron';
import { ISyncProvider } from '@yuihub/core';

export class SyncScheduler {
  private job: CronJob | null = null;
  private provider: ISyncProvider;
  private isRunning: boolean = false;
  private isSchedulerActive: boolean = false;
  private cronExpression: string;

  constructor(provider: ISyncProvider, cronExpression: string = '*/5 * * * *') { // Default 5 mins
    this.provider = provider;
    this.cronExpression = cronExpression;
    this.job = this.createJob(cronExpression);
  }

  private createJob(cronExpression: string): CronJob {
    return new CronJob(cronExpression, async () => {
      await this.runSync();
    });
  }

  start() {
    if (this.job) {
      this.job.start();
      this.isSchedulerActive = true;
      console.log(`[Sync] Scheduler started (${this.provider.name})`);
    }
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.isSchedulerActive = false;
    }
  }

  /**
   * Update the sync interval dynamically (hot reload)
   */
  updateInterval(newCronExpression: string) {
    if (newCronExpression === this.cronExpression) return;

    const wasRunning = this.isSchedulerActive;
    
    // Stop existing job
    this.stop();
    
    // Create new job with updated interval
    this.cronExpression = newCronExpression;
    this.job = this.createJob(newCronExpression);
    
    // Restart if it was running
    if (wasRunning) {
      this.start();
      console.log(`[Sync] Interval updated to: ${newCronExpression}`);
    }
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

