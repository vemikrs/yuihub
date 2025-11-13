/**
 * Jest セットアップファイル
 * テスト実行前の共通設定
 */

// 環境変数の設定（テスト環境用）
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.API_TOKEN = 'test-token-for-testing-only';
process.env.STORAGE_ADAPTER = 'local';
process.env.MODE = 'shelter';
process.env.EXTERNAL_IO = 'blocked';

// タイムアウト警告を抑制
process.setMaxListeners(20);

// グローバルタイムアウトの設定
jest.setTimeout(10000);

// console.log/warn/errorのモック（必要に応じて）
// global.console = {
//   ...console,
//   log: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

console.log('✅ Jest test environment initialized');
