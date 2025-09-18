// YuiHub Named Cloudflare Tunnel Manager
// Handles fixed subdomain tunnels for production use

import { spawn } from 'child_process';

export class NamedTunnelManager {
  constructor(tunnelName, domain) {
    this.tunnelName = tunnelName;
    this.domain = domain;
    this.process = null;
    this.token = process.env.TUNNEL_TOKEN;
    
    if (!this.token) {
      throw new Error('TUNNEL_TOKEN environment variable is required for named tunnels');
    }
  }

  async start() {
    console.log(`🚀 Starting named tunnel with token: ${this.domain}`);
    
    // Use token-based approach instead of config file
    this.process = spawn('cloudflared', [
      'tunnel',
      'run',
      '--token', this.token,
      '--url', 'http://localhost:3000'
    ], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.process.stdout.on('data', (data) => {
      console.log('Named tunnel stdout:', data.toString().trim());
    });

    this.process.stderr.on('data', (data) => {
      console.log('Named tunnel stderr:', data.toString().trim());
    });
    
    this.process.on('close', (code) => {
      console.log(`Named tunnel process exited with code ${code}`);
      this.process = null;
    });

    this.process.on('error', (error) => {
      console.error('Named tunnel error:', error);
      this.process = null;
    });

    // Wait for process to start
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });

    const url = `https://${this.domain}`;
    console.log(`✅ Named tunnel started: ${url}`);
    return url;
  }

  async stop() {
    if (this.process) {
      console.log('🛑 Stopping named tunnel...');
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  isRunning() {
    return this.process !== null;
  }
}
