/**
 * Jest Configuration for YuiHub
 * ES Modules + Node.js 環境のテスト設定
 */

export default {
  // ES Modules対応
  testEnvironment: 'node',
  
  // ES Modules変換設定
  transform: {},
  
  // .js ファイルを ESM として扱う
  extensionsToTreatAsEsm: ['.js'],
  
  // モジュール解決設定
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  
  // テストファイルパターン
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
  ],
  
  // カバレッジ設定
  collectCoverageFrom: [
    'yuihub_api/src/**/*.js',
    'yuihub_mcp/src/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/__tests__/**',
  ],
  
  // カバレッジ閾値
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  
  // テストタイムアウト（デフォルト5秒）
  testTimeout: 10000,
  
  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // 詳細出力
  verbose: true,
  
  // モジュールパス設定
  modulePaths: ['<rootDir>'],
  
  // Node.js の実験的機能を有効化（ES Modules対応）
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};
