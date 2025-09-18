// YuiHub Unified Tunnel Manager
// Handles both Quick and Named tunnels with automatic mode selection

import { QuickTunnelManager } from './tunnel-quick.js';
import { NamedTunnelManager } from './tunnel-named.js';
import fs from 'fs/promises';
import path from 'path';

export class TunnelManager {
  constructor() {
    this.mode = process.env.TUNNEL_MODE || 'quick';
    this.manager = null;
    this.url = null;
  }

  async start() {
    if (this.manager) {
      throw new Error('Tunnel is already running');
    }

    console.log(`🔧 Starting tunnel in ${this.mode} mode...`);

    if (this.mode === 'quick') {
      this.manager = new QuickTunnelManager();
      
      // Set up event listeners
      this.manager.on('url', (url) => {
        this.url = url;
        this.saveUrl(url);
      });
      
      this.manager.on('exit', () => {
        this.manager = null;
        this.url = null;
      });
      
      const url = await this.manager.start();
      this.url = url;
      await this.saveUrl(url);
      return url;
      
    } else if (this.mode === 'named') {
      const baseUrl = process.env.TUNNEL_BASE_URL;
      const name = process.env.TUNNEL_NAME || 'yuihub-prod';
      
      if (!baseUrl) {
        throw new Error('TUNNEL_BASE_URL environment variable is required for named tunnels');
      }
      
      // Extract domain from TUNNEL_BASE_URL (e.g., https://poc-yuihub.vemi.jp -> poc-yuihub.vemi.jp)
      const domain = new URL(baseUrl).hostname;
      
      this.manager = new NamedTunnelManager(name, domain);
      const url = await this.manager.start();
      this.url = url;
      await this.saveUrl(url);
      return url;
      
    } else {
      throw new Error(`Unknown tunnel mode: ${this.mode}`);
    }
  }

  async saveUrl(url) {
    try {
      // Use absolute path from project root
      const projectRoot = process.cwd().includes('/yuihub_api') 
        ? path.join(process.cwd(), '..')  // If running from yuihub_api subdirectory
        : process.cwd();                  // If running from project root
      
      const urlFile = path.join(projectRoot, '.cloudflare/.tunnel-url');
      const pidFile = path.join(projectRoot, '.cloudflare/.tunnel-pid');
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(urlFile), { recursive: true });
      
      await fs.writeFile(urlFile, url, 'utf8');
      await fs.writeFile(pidFile, String(process.pid), 'utf8');
      
      console.log(`📝 Tunnel URL saved: ${url}`);
    } catch (error) {
      console.error('Failed to save tunnel URL:', error);
    }
  }

  async stop() {
    if (this.manager) {
      await this.manager.stop();
      this.manager = null;
      this.url = null;
    }
  }

  isRunning() {
    return this.manager ? this.manager.isRunning() : false;
  }

  getUrl() {
    return this.url;
  }

  getMode() {
    return this.mode;
  }
}
