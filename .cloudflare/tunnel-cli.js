#!/usr/bin/env node
// YuiHub Tunnel CLI Interface
// Command-line interface for tunnel management

import { TunnelManager } from './tunnel-manager.js';
import fs from 'fs/promises';
import path from 'path';

const command = process.argv[2] || 'quick';

async function main() {
  const manager = new TunnelManager();
  
  switch (command) {
    case 'quick':
      process.env.TUNNEL_MODE = 'quick';
      try {
        const url = await manager.start();
        console.log('\n🎉 Tunnel Ready!');
        console.log('================================');
        console.log(`🌐 URL: ${url}`);
        console.log(`💚 Health: ${url}/health`);
        console.log(`📋 OpenAPI: ${url}/openapi.yml`);
        console.log('\n💡 Press Ctrl+C to stop');
        
        // Keep process alive
        process.on('SIGINT', async () => {
          console.log('\n🛑 Stopping tunnel...');
          await manager.stop();
          process.exit(0);
        });
        
        // Keep alive
        setInterval(() => {}, 1000);
        
      } catch (error) {
        console.error('❌ Failed to start tunnel:', error.message);
        process.exit(1);
      }
      break;
      
    case 'named':
      process.env.TUNNEL_MODE = 'named';
      try {
        const url = await manager.start();
        console.log(`✅ Named tunnel started: ${url}`);
      } catch (error) {
        console.error('❌ Failed to start named tunnel:', error.message);
        process.exit(1);
      }
      break;
      
    case 'status':
      try {
        const urlFile = path.join(process.cwd(), '.cloudflare/.tunnel-url');
        const pidFile = path.join(process.cwd(), '.cloudflare/.tunnel-pid');
        
        const url = await fs.readFile(urlFile, 'utf8').catch(() => null);
        const pid = await fs.readFile(pidFile, 'utf8').catch(() => null);
        
        if (url) {
          console.log(`🌐 Tunnel URL: ${url}`);
          if (pid) {
            console.log(`🔧 Process ID: ${pid}`);
          }
          
          // Test connectivity
          const response = await fetch(`${url}/health`);
          if (response.ok) {
            console.log('✅ Tunnel is accessible');
          } else {
            console.log('⚠️  Tunnel URL exists but not accessible');
          }
        } else {
          console.log('❌ No active tunnel found');
        }
      } catch (error) {
        console.error('❌ Failed to check status:', error.message);
      }
      break;
      
    case 'stop':
      try {
        await manager.stop();
        console.log('✅ Tunnel stopped');
      } catch (error) {
        console.error('❌ Failed to stop tunnel:', error.message);
      }
      break;
      
    default:
      console.log('Usage: node tunnel-cli.js [quick|named|status|stop]');
      break;
  }
}

main().catch(console.error);
