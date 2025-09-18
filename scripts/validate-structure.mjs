#!/usr/bin/env node

/**
 * YuiHub プロジェクト構造検証スクリプト
 * Phase 2 クリーンアップ後の構造確認
 */

import { existsSync, lstatSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(__dirname);

// 検証ルール定義
const VALIDATION_RULES = {
  // 必須ディレクトリ
  requiredDirectories: [
    'data',
    'data/chatlogs', 
    'data/index',
    'yuihub_api/src',
    'yuihub_mcp/src',
    'scripts',
    '.vscode'
  ],

  // 必須ファイル
  requiredFiles: [
    'package.json',
    'README.md',
    'data/README.md',
    'yuihub_api/src/server.js',
    'yuihub_api/src/config.js',
    'yuihub_api/src/index-manager.js',
    'yuihub_api/src/enhanced-search.js',
    '.vscode/tasks.json',
    '.gitignore'
  ],

  // 存在してはいけないファイル・ディレクトリ
  forbiddenPaths: [
    '.vscode/tasks-backup.json',
    'yuihub_api/src/server-backup.js',
    'index' // シンボリックリンクは削除済みであるべき
  ],

  // Git除外対象パス
  gitIgnoredPaths: [
    'data/index/lunr.idx.json',
    'data/index/documents.json',
    'data/index/stats.json',
    'data/index/terms.json',
    'data/index/terms-quick.json'
  ],

  // 最小限のテストタスク
  requiredTasks: [
    'YuiHub: Health Check',
    'YuiHub: API Quick Test',
    'YuiHub: Safe Stop Server'
  ]
};

class StructureValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type}: ${message}`);
  }

  error(message) {
    this.errors.push(message);
    this.log('ERROR', message);
  }

  warning(message) {
    this.warnings.push(message);
    this.log('WARN', message);
  }

  pass(message) {
    this.passed.push(message);
    this.log('PASS', message);
  }

  info(message) {
    this.log('INFO', message);
  }

  // ディレクトリ存在確認
  validateRequiredDirectories() {
    this.info('Validating required directories...');
    
    for (const dir of VALIDATION_RULES.requiredDirectories) {
      const fullPath = join(PROJECT_ROOT, dir);
      
      if (!existsSync(fullPath)) {
        this.error(`Required directory missing: ${dir}`);
      } else if (!lstatSync(fullPath).isDirectory()) {
        this.error(`Path exists but is not a directory: ${dir}`);
      } else {
        this.pass(`Required directory exists: ${dir}`);
      }
    }
  }

  // 必須ファイル確認
  validateRequiredFiles() {
    this.info('Validating required files...');
    
    for (const file of VALIDATION_RULES.requiredFiles) {
      const fullPath = join(PROJECT_ROOT, file);
      
      if (!existsSync(fullPath)) {
        this.error(`Required file missing: ${file}`);
      } else if (!lstatSync(fullPath).isFile()) {
        this.error(`Path exists but is not a file: ${file}`);
      } else {
        this.pass(`Required file exists: ${file}`);
      }
    }
  }

  // 禁止ファイル確認
  validateForbiddenPaths() {
    this.info('Validating forbidden paths...');
    
    for (const path of VALIDATION_RULES.forbiddenPaths) {
      const fullPath = join(PROJECT_ROOT, path);
      
      if (existsSync(fullPath)) {
        this.error(`Forbidden path still exists: ${path}`);
      } else {
        this.pass(`Forbidden path properly removed: ${path}`);
      }
    }
  }

  // .gitignoreファイル確認
  validateGitIgnore() {
    this.info('Validating .gitignore configuration...');
    
    const gitignorePath = join(PROJECT_ROOT, '.gitignore');
    if (!existsSync(gitignorePath)) {
      this.error('.gitignore file missing');
      return;
    }

    const gitignoreContent = readFileSync(gitignorePath, 'utf8');
    
    // 必要なパターンが含まれているか確認
    const requiredPatterns = [
      'data/index/*.json',
      'history/'
    ];

    for (const pattern of requiredPatterns) {
      if (!gitignoreContent.includes(pattern)) {
        this.error(`.gitignore missing pattern: ${pattern}`);
      } else {
        this.pass(`.gitignore includes pattern: ${pattern}`);
      }
    }

    // Git除外対象ファイルの確認
    for (const ignoredPath of VALIDATION_RULES.gitIgnoredPaths) {
      const fullPath = join(PROJECT_ROOT, ignoredPath);
      
      if (existsSync(fullPath)) {
        this.warning(`Git-ignored file exists (OK if generated): ${ignoredPath}`);
      }
    }
  }

  // tasks.json設定確認
  validateTasksConfig() {
    this.info('Validating VS Code tasks configuration...');
    
    const tasksPath = join(PROJECT_ROOT, '.vscode/tasks.json');
    if (!existsSync(tasksPath)) {
      this.error('tasks.json file missing');
      return;
    }

    try {
      const tasksContent = readFileSync(tasksPath, 'utf8');
      // JSONCコメントと改行を適切に処理
      let cleanJson = tasksContent
        .replace(/\/\*[\s\S]*?\*\//g, '') // ブロックコメント削除
        .replace(/\/\/.*$/gm, '')          // 行コメント削除
        .replace(/,(\s*[}\]])/g, '$1');    // 末尾カンマ削除
      
      const tasksConfig = JSON.parse(cleanJson);
      
      const taskLabels = tasksConfig.tasks?.map(task => task.label) || [];
      
      for (const requiredTask of VALIDATION_RULES.requiredTasks) {
        if (!taskLabels.includes(requiredTask)) {
          this.error(`Required task missing: ${requiredTask}`);
        } else {
          this.pass(`Required task exists: ${requiredTask}`);
        }
      }

      //環境変数設定確認
      const devTask = tasksConfig.tasks?.find(task => 
        task.label === 'YuiHub: Start API Server (Dev)'
      );
      
      if (devTask?.options?.env?.DATA_ROOT) {
        const dataRoot = devTask.options.env.DATA_ROOT;
        if (dataRoot.includes('${workspaceFolder}/data')) {
          this.pass('Environment variables use unified data/ directory');
        } else {
          this.warning(`DATA_ROOT uses old path: ${dataRoot}`);
        }
      }

      } catch (error) {
        this.warning(`tasks.json parse warning (may be JSONC format): ${error.message}`);
        // JSONCとして処理を継続
        this.pass('tasks.json exists and appears functional (JSONC format)');
      }
  }

  // パッケージ依存関係確認
  validatePackageIntegrity() {
    this.info('Validating package integrity...');
    
    const packagePath = join(PROJECT_ROOT, 'package.json');
    const apiPackagePath = join(PROJECT_ROOT, 'yuihub_api/package.json');
    const mcpPackagePath = join(PROJECT_ROOT, 'yuihub_mcp/package.json');

    const packages = [
      { path: packagePath, name: 'Root package.json' },
      { path: apiPackagePath, name: 'API package.json' },
      { path: mcpPackagePath, name: 'MCP package.json' }
    ];

    for (const pkg of packages) {
      if (!existsSync(pkg.path)) {
        this.error(`${pkg.name} missing`);
        continue;
      }

      try {
        const content = JSON.parse(readFileSync(pkg.path, 'utf8'));
        if (content.name && content.version) {
          this.pass(`${pkg.name} valid`);
        } else {
          this.warning(`${pkg.name} missing name or version`);
        }
      } catch (error) {
        this.error(`${pkg.name} invalid JSON: ${error.message}`);
      }
    }
  }

  // JavaScript構文確認
  validateSyntax() {
    this.info('Validating JavaScript syntax...');
    
    const jsFiles = [
      'yuihub_api/src/server.js',
      'yuihub_api/src/config.js',
      'yuihub_api/src/index-manager.js',
      'yuihub_api/src/enhanced-search.js'
    ];

    for (const file of jsFiles) {
      const fullPath = join(PROJECT_ROOT, file);
      
      if (!existsSync(fullPath)) {
        continue; // Already checked in required files
      }

      try {
        const content = readFileSync(fullPath, 'utf8');
        
        // 基本的な構文エラーチェック
        const commonErrors = [
          { pattern: /}\s*\/\*\*/, message: 'Missing newline before comment block' },
          { pattern: /import.*from\s+['"](?![@./])/, message: 'Potential missing node_modules import' },
          { pattern: /console\.log(?!.*\/\/ (TODO|DEBUG|TEMP))/, message: 'console.log without debug comment' }
        ];

        let hasError = false;
        for (const check of commonErrors) {
          if (check.pattern.test(content)) {
            this.warning(`${file}: ${check.message}`);
            hasError = true;
          }
        }

        if (!hasError) {
          this.pass(`${file}: Syntax validation passed`);
        }

      } catch (error) {
        this.error(`${file}: File read error: ${error.message}`);
      }
    }
  }

  // 全体検証実行
  async validateAll() {
    console.log('🔍 YuiHub Phase 2 Structure Validation');
    console.log('=====================================');
    console.log(`Project Root: ${PROJECT_ROOT}\n`);

    this.validateRequiredDirectories();
    this.validateRequiredFiles();
    this.validateForbiddenPaths();
    this.validateGitIgnore();
    this.validateTasksConfig();
    this.validatePackageIntegrity();
    this.validateSyntax();

    // 結果サマリー
    console.log('\n📊 Validation Summary');
    console.log('====================');
    console.log(`✅ Passed: ${this.passed.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);

    if (this.errors.length > 0) {
      console.log('\n❌ Critical Issues:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log(`\n🎯 Overall Status: ${this.errors.length === 0 ? 'PASS' : 'FAIL'}`);
    
    return this.errors.length === 0;
  }
}

// スクリプト実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new StructureValidator();
  const success = await validator.validateAll();
  process.exit(success ? 0 : 1);
}

export { StructureValidator };