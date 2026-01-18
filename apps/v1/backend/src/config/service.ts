import fs from 'fs-extra';
import path from 'path';
import { AppConfig, AppConfigSchema, AppConfigUpdate } from './schema.js';

export class ConfigService {
  private config: AppConfig;
  private configPath: string;
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.configPath = path.join(dataDir, 'yuihub.config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    // 1. Defaults
    let config = AppConfigSchema.parse({
      server: {},
      sync: {},
      ai: {},
      storage: { dataDir: this.dataDir }
    });

    // 2. Load from JSON
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readJsonSync(this.configPath);
        // Merge file content with defaults. 
        const merged = {
          ...config,
          ...fileContent,
          server: { ...config.server, ...fileContent.server },
          sync: { ...config.sync, ...fileContent.sync },
          ai: { ...config.ai, ...fileContent.ai },
        };
        config = AppConfigSchema.parse(merged);
      } catch (e) {
        console.warn('[Config] Failed to load config file:', e);
      }
    }

    // 3. Env Vars Override (Priority)
    if (process.env.YUIHUB_PORT) config.server.port = parseInt(process.env.YUIHUB_PORT);
    if (process.env.YUIHUB_HOST) config.server.host = process.env.YUIHUB_HOST;
    if (process.env.GIT_REMOTE) config.sync.remoteUrl = process.env.GIT_REMOTE;
    if (process.env.ENABLE_SYNC) config.sync.enabled = process.env.ENABLE_SYNC === 'true';

    return config;
  }

  get(): AppConfig {
    return this.config;
  }

  async update(newConfig: AppConfigUpdate): Promise<AppConfig> {
    // Deep merge for update
    const current = this.config;
    
    const merged = {
      ...current,
      ...newConfig,
      server: { ...current.server, ...(newConfig.server || {}) },
      sync: { ...current.sync, ...(newConfig.sync || {}) },
      ai: { ...current.ai, ...(newConfig.ai || {}) },
      // Storage is system managed, usually not updated via API but if passed...
      storage: { ...current.storage, ...(newConfig.storage || {}) }
    };
    
    // Validate
    const validated = AppConfigSchema.parse(merged);
    this.config = validated;

    // Save to Disk (only persistence parts)
    const toSave = {
        server: validated.server,
        sync: validated.sync,
        ai: validated.ai
    };

    await fs.writeJson(this.configPath, toSave, { spaces: 2 });
    return this.config;
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
