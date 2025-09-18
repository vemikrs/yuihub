// YuiHub Quick Cloudflare Tunnel Manager
// Handles dynamic URL generation with accurate URL extraction

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class QuickTunnelManager extends EventEmitter {
  constructor() {
    super();
    this.url = null;
    this.process = null;
    this.starting = false;
  }

  async start(targetUrl = 'http://localhost:3000') {
    if (this.starting) {
      throw new Error('Tunnel is already starting');
    }
    
    if (this.process) {
      throw new Error('Tunnel is already running');
    }

    this.starting = true;
    
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting Quick Tunnel...');
      
      this.process = spawn('cloudflared', ['tunnel', '--url', targetUrl], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Accurate URL regex that preserves hyphens
      const urlRegex = /https:\/\/[a-z0-9\-]+\.trycloudflare\.com/;
      let urlFound = false;
      
      this.process.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('Cloudflared:', output.trim());
        
        if (!urlFound) {
          const match = output.match(urlRegex);
          
          if (match) {
            this.url = match[0];
            urlFound = true;
            this.starting = false;
            
            console.log(`✅ Tunnel URL: ${this.url}`);
            this.emit('url', this.url);
            resolve(this.url);
          }
        }
      });

      this.process.stdout.on('data', (data) => {
        console.log('Cloudflared stdout:', data.toString().trim());
      });

      this.process.on('error', (error) => {
        this.starting = false;
        console.error('Cloudflared process error:', error);
        reject(error);
      });
      
      this.process.on('exit', (code, signal) => {
        this.starting = false;
        this.process = null;
        console.log(`Cloudflared exited with code ${code}, signal ${signal}`);
        this.emit('exit', { code, signal });
      });
      
      // Timeout handling
      setTimeout(() => {
        if (!urlFound && this.starting) {
          this.starting = false;
          reject(new Error('Timeout: Could not get tunnel URL within 30 seconds'));
        }
      }, 30000);
    });
  }

  async stop() {
    if (this.process) {
      console.log('🛑 Stopping tunnel...');
      this.process.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      setTimeout(() => {
        if (this.process) {
          console.log('🔪 Force killing tunnel process');
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  isRunning() {
    return this.process !== null;
  }

  getUrl() {
    return this.url;
  }
}
