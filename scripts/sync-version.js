#!/usr/bin/env node
/**
 * sync-version.js
 * Syncs version from /VERSION file to all package.json files
 * Also updates internal @yuihub/* dependency versions
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

// Internal @yuihub dependencies to sync
const internalDeps = ['@yuihub/core'];

for (const pkgPath of packages) {
  const fullPath = join(ROOT, pkgPath);
  if (!existsSync(fullPath)) {
    console.log(`  ⚠️  Skipping (not found): ${pkgPath}`);
    continue;
  }
  
  const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));
  const changes = [];
  
  // Sync package version
  if (pkg.version !== version) {
    changes.push(`version: ${pkg.version} → ${version}`);
    pkg.version = version;
  }
  
  // Sync internal dependencies (skip workspace:* references for local dev)
  for (const dep of internalDeps) {
    if (pkg.dependencies?.[dep] && !pkg.dependencies[dep].startsWith('workspace:')) {
      const oldDep = pkg.dependencies[dep];
      const newDep = `^${version}`;
      if (oldDep !== newDep) {
        changes.push(`${dep}: ${oldDep} → ${newDep}`);
        pkg.dependencies[dep] = newDep;
      }
    }
  }
  
  if (changes.length > 0) {
    writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ✅ ${pkgPath}: ${changes.join(', ')}`);
  } else {
    console.log(`  ✓ ${pkgPath} (already synced)`);
  }
}

console.log('Done.');
