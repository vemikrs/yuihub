// Interface for Sync Layer
// Pluggable provider for syncing local memory/data to external storage (e.g. GitHub, S3, etc.)

/**
 * Define specific provider names for better type safety
 */
export type SyncProviderName = 'github' | 's3' | 'local';

export interface ISyncProvider {
  /**
   * Name of the provider (e.g. 'github')
   */
  name: SyncProviderName;

  /**
   * Push changes to remote
   * @param message Commit message or sync context
   */
  push(message: string): Promise<void>;

  /**
   * Pull changes from remote
   */
  pull(): Promise<void>;

  /**
   * Check status (is dirty?)
   */
  status(): Promise<{ dirty: boolean; ahead: number; behind: number }>;
}
