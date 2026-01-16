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

console.log('✅ Jest test environment initialized');
