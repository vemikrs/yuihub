#!/usr/bin/env node
/**
 * sync-version.js
 * Syncs version from /VERSION file to all package.json files
 * 
 * Note: Internal @yuihub/* dependencies use workspace:* for local dev.
 * pnpm publish automatically converts workspace:* to actual versions.
 * 
 * VSCode Extension Special Handling:
 * VS Marketplace only supports major.minor.patch format.
 * Prerelease versions like 1.0.0-beta.5 are converted to 1.1.5
 * (odd minor = prerelease, patch = prerelease number)
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

/**
 * Convert semver prerelease to VS Code compatible version
 * Examples:
 *   1.0.0-beta.5  → 1.1.5 (odd minor = prerelease)
 *   1.0.0-alpha.3 → 1.1.3
 *   1.0.0-rc.1    → 1.1.1
 *   1.0.0         → 1.0.0 (unchanged)
 *   2.1.3         → 2.1.3 (unchanged, already even minor = release)
 */
function toVSCodeVersion(semver) {
  // Match prerelease pattern: major.minor.patch-label.number
  const prereleaseMatch = semver.match(/^(\d+)\.(\d+)\.(\d+)-(alpha|beta|rc)\.(\d+)$/);
  if (prereleaseMatch) {
    const [, major, minor, , , prereleaseNum] = prereleaseMatch;
    // Use minor+1 if minor is even (to make it odd = prerelease)
    const minorNum = parseInt(minor, 10);
    const vscodeMinor = minorNum % 2 === 0 ? minorNum + 1 : minorNum;
    return `${major}.${vscodeMinor}.${prereleaseNum}`;
  }
  // Regular version: return as-is
  return semver;
}

// Check if this is a prerelease version
const isPrerelease = /-(alpha|beta|rc)\./.test(version);
const vscodeVersion = toVSCodeVersion(version);

console.log(`  ℹ️  Prerelease: ${isPrerelease}`);
if (isPrerelease) {
  console.log(`  ℹ️  VSCode version: ${vscodeVersion} (converted for Marketplace)`);
}

// Package.json files to sync (excluding VSCode which needs special handling)
const packages = [
  'package.json',
  'packages/core/package.json',
  'apps/v1/backend/package.json',  // @yuihub/server
  'apps/v1/mcp-server/package.json',
];

console.log('');
console.log('📦 Syncing npm packages...');

for (const pkgPath of packages) {
  const fullPath = join(ROOT, pkgPath);
  if (!existsSync(fullPath)) {
    console.log(`  ⚠️  Skipping (not found): ${pkgPath}`);
    continue;
  }
  
  const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));
  
  // Sync package version
  if (pkg.version !== version) {
    const oldVersion = pkg.version;
    pkg.version = version;
    writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ✅ ${pkgPath}: ${oldVersion} → ${version}`);
  } else {
    console.log(`  ✓ ${pkgPath} (already ${version})`);
  }
}

// Handle VSCode extension separately with converted version
console.log('');
console.log('📦 Syncing VSCode extension...');
const vscodePkgPath = 'apps/vscode-client/package.json';
const vscodeFullPath = join(ROOT, vscodePkgPath);
if (existsSync(vscodeFullPath)) {
  const pkg = JSON.parse(readFileSync(vscodeFullPath, 'utf-8'));
  if (pkg.version !== vscodeVersion) {
    const oldVersion = pkg.version;
    pkg.version = vscodeVersion;
    writeFileSync(vscodeFullPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ✅ ${vscodePkgPath}: ${oldVersion} → ${vscodeVersion}`);
  } else {
    console.log(`  ✓ ${vscodePkgPath} (already ${vscodeVersion})`);
  }
} else {
  console.log(`  ⚠️  Skipping (not found): ${vscodePkgPath}`);
}

console.log('');
console.log('Done.');
console.log('');
console.log('To publish packages, use: pnpm publish (automatically converts workspace:* to versions)');

// Output for CI consumption
console.log('');
console.log('--- CI OUTPUT ---');
console.log(`VSCODE_VERSION=${vscodeVersion}`);
console.log(`IS_PRERELEASE=${isPrerelease}`);
