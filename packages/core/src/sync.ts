// Interface for Sync Layer
// Pluggable provider for syncing local memory/data to external storage (e.g. GitHub, S3, etc.)

export interface ISyncProvider {
  /**
   * Name of the provider (e.g. 'github')
   */
  name: string;

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
