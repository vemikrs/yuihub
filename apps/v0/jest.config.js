/**
 * Jest Configuration for YuiHub
 * ES Modules + Node.js 環境のテスト設定
 */

export default {
  // ES Modules対応
  testEnvironment: 'node',
  
  // ES Modules変換設定
  transform: {},
  
  // テストファイルパターン
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
    // Standalone E2E scripts (not Jest tests)
    '!**/yuihub_api/tests/api-integration.test.js',
  ],
  
  // カバレッジ設定
  collectCoverageFrom: [
    'yuihub_api/src/**/*.js',
    'yuihub_mcp/src/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/__tests__/**',
  ],
  
  // カバレッジ閾値（PoC段階では実際の数値に合わせて設定）
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10,
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
