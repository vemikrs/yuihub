#!/usr/bin/env node
/**
 * sync-version.js
 * Syncs version from /VERSION file to all package.json files
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Read VERSION file
const versionFile = join(ROOT, 'VERSION');
if (!existsSync(versionFile)) {
  console.error('ERROR: VERSION file not found');
  process.exit(1);
}
const version = readFileSync(versionFile, 'utf-8').trim();
console.log(`📦 Syncing version: ${version}`);

// Package.json files to sync
const packages = [
  'package.json',
  'packages/core/package.json',
  'apps/v1/backend/package.json',
  'apps/v1/mcp-server/package.json',
  'apps/vscode-client/package.json',
];

for (const pkgPath of packages) {
  const fullPath = join(ROOT, pkgPath);
  if (!existsSync(fullPath)) {
    console.log(`  ⚠️  Skipping (not found): ${pkgPath}`);
    continue;
  }
  
  const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));
  const oldVersion = pkg.version;
  
  if (oldVersion === version) {
    console.log(`  ✓ ${pkgPath} (already ${version})`);
  } else {
    pkg.version = version;
    writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ✅ ${pkgPath}: ${oldVersion} → ${version}`);
  }
}

console.log('Done.');
