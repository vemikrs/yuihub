// YuiHub Named Cloudflare Tunnel Manager
// Handles fixed subdomain tunnels for production use

import { spawn } from 'child_process';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';

export class NamedTunnelManager {
  constructor(tunnelName, domain) {
    this.tunnelName = tunnelName;
    this.domain = domain;
    this.process = null;
  }

  async setup() {
    // Generate configuration file for named tunnel
    const config = {
      tunnel: this.tunnelName,
      'credentials-file': `~/.cloudflared/${await this.getTunnelId()}.json`,
      ingress: [{
        hostname: this.domain,
        service: 'http://localhost:3000'
      }, {
        service: 'http_status:404'
      }]
    };
    
    const configPath = '.cloudflare/config/named.yml';
    await fs.writeFile(configPath, yaml.dump(config));
    
    console.log(`✅ Named tunnel config written to ${configPath}`);
  }

  async start() {
    await this.setup();
    
    console.log(`🚀 Starting named tunnel: ${this.tunnelName}`);
    
    this.process = spawn('cloudflared', [
      'tunnel',
      '--config', '.cloudflare/config/named.yml',
      'run'
    ], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    this.process.stdout.on('data', (data) => {
      console.log('Named tunnel stdout:', data.toString().trim());
    });
    
    this.process.stderr.on('data', (data) => {
      console.log('Named tunnel stderr:', data.toString().trim());
    });
    
    this.process.on('error', (error) => {
      console.error('Named tunnel error:', error);
    });
    
    this.process.unref(); // Allow process to run independently
    
    return `https://${this.domain}`;
  }

  async getTunnelId() {
    // This would normally query cloudflared tunnel list
    // For now, return a placeholder - in practice this would be implemented
    // based on actual tunnel configuration
    return 'tunnel-id-placeholder';
  }

  async stop() {
    if (this.process) {
      console.log('🛑 Stopping named tunnel...');
      this.process.kill('SIGTERM');
    }
  }

  isRunning() {
    return this.process !== null;
  }
}
