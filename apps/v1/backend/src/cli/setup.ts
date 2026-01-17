import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { simpleGit } from 'simple-git';
import { ConfigService } from '../config/service.js';

import os from 'os';

// Setup Wizard
async function runSetup() {
  console.log('🤖 YuiHub V1 Setup Wizard 🤖');
  
  const questions = [
    {
      type: 'input',
      name: 'dataDir',
      message: 'Where should we store your data (DATA_DIR)?',
      default: process.env.DATA_DIR || path.join(os.homedir(), '.yuihub'),
    },
    {
      type: 'list',
      name: 'mode',
      message: 'What would you like to do?',
      choices: [
        { name: '🆕 Create New Vault', value: 'new' },
        { name: '🔗 Connect Existing Vault (Git Clone)', value: 'clone' },
      ],
    }
  ];

  const answers = await inquirer.prompt(questions);
  const dataDir = path.resolve(answers.dataDir);

  console.log(`\n📂 Setting up in: ${dataDir}`);
  await fs.ensureDir(dataDir);

  if (answers.mode === 'new') {
    await setupNewVault(dataDir);
  } else {
    await setupExistingVault(dataDir);
  }
  
  // Ensure VERSION file exists
  await fs.writeFile(path.join(dataDir, 'VERSION'), '1.0.0-rc1'); 

  // Final Config Check
  const configService = new ConfigService(dataDir);
  const currentConfig = configService.get();
  console.log('\n✅ Setup Complete! Config:', JSON.stringify(currentConfig, null, 2));
  console.log(`\nRun 'npm start' to launch YuiHub.`);
}

async function setupNewVault(dataDir: string) {
  // 1. Initialize Git
  const git = simpleGit(dataDir);
  if (!await fs.pathExists(path.join(dataDir, '.git'))) {
    console.log('📦 Initializing Git repository...');
    await git.init();
  }

  // 2. Create Config
  const configService = new ConfigService(dataDir);
  // Default config is already loaded/created by service if missing
  // But let's ask for remote if they want to push later?
  const { configureRemote } = await inquirer.prompt([{
    type: 'confirm',
    name: 'configureRemote',
    message: 'Do you want to configure a remote origin now?',
    default: false
  }]);

  if (configureRemote) {
    const { remoteUrl } = await inquirer.prompt([{
      type: 'input',
      name: 'remoteUrl',
      message: 'Enter Git Remote URL:'
    }]);
    
    await git.addRemote('origin', remoteUrl);
    await configService.update({ sync: { enabled: true, remoteUrl, interval: '*/5 * * * *', branch: 'main' } });
    console.log('🔗 Remote configured.');
  }
}

async function setupExistingVault(dataDir: string) {
  // Check if directory is empty
  const files = await fs.readdir(dataDir);
  if (files.length > 0) {
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Directory is not empty. Proceeding might fail if it is not a fresh clone. Continue?',
      default: false
    }]);
    if (!proceed) process.exit(0);
  }

  const { remoteUrl } = await inquirer.prompt([{
    type: 'input', // TODO: paste validation
    name: 'remoteUrl',
    message: 'Enter Git Remote URL to Clone:'
  }]);

  console.log('⬇️  Cloning from remote... (This may take a while)');
  const git = simpleGit();
  try {
      // Clone into dataDir
      await git.clone(remoteUrl, dataDir);
      console.log('✅ Clone successful.');
  } catch(e) {
      console.error('❌ Clone failed:', e);
      process.exit(1);
  }

  // Update Config to match
  const configService = new ConfigService(dataDir);
  await configService.update({ sync: { enabled: true, remoteUrl, interval: '*/5 * * * *', branch: 'main' } });
  
  // Note: Initial Indexing will happen on server startup automatically
  console.log('💡 Note: Search Index will be rebuilt when you start the server.');
}

runSetup().catch(console.error);
