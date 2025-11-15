#!/usr/bin/env node
/**
 * YuiHub API Integration Test (GPTs E2E lifecycle)
 * Flow: /health → /threads/new → /save → /search → /trigger → /export/context
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API_BASE = process.env.YUIHUB_API || 'http://localhost:3000';

async function makeRequest(url, options = {}) {
  const { headers: optHeaders, ...rest } = options || {};
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...(optHeaders || {})
  };
  const response = await fetch(url, {
    ...rest,
    headers: mergedHeaders
  });

  let data;
  const text = await response.text();
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: response.status, data };
}

function readApiToken() {
  if (process.env.API_TOKEN && process.env.API_TOKEN.length > 0) return process.env.API_TOKEN;
  // fallback: try several common locations
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'), // repo root from yuihub_api/tests
    path.resolve(process.cwd(), 'yuihub_api/../.env')
  ];
  for (const envPath of candidates) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^API_TOKEN=(.*)$/m);
        if (match) return match[1].trim();
      }
    } catch {}
  }
  return undefined;
}

async function runTests() {
  console.log('🧪 YuiHub API E2E (GPTs lifecycle)');
  console.log('===================================\n');

  const token = readApiToken();
  if (!token) {
    console.log('   ❌ No API_TOKEN found. Set env or .env API_TOKEN');
    process.exit(1);
  }
  const authHeaders = { 'x-yuihub-token': token };

  const results = { passed: 0, failed: 0 };
  let thread;
  let savedId;

  // 1) Health
  console.log('1) GET /health ...');
  try {
    const { status, data } = await makeRequest(`${API_BASE}/health`);
    if (status === 200 && data.ok === true) {
      console.log('   ✅ PASS');
      results.passed++;
    } else { throw new Error('health not ok'); }
  } catch (e) {
    console.log('   ❌ FAIL', e.message);
    results.failed++; return results;
  }

  // 2) Issue thread
  console.log('\n2) POST /threads/new ...');
  try {
    const { status, data } = await makeRequest(`${API_BASE}/threads/new`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({})
    });
    if (status === 200 && data.ok && /^th-[0-9A-Z]{26}$/.test(data.thread)) {
      thread = data.thread;
      console.log('   ✅ PASS', thread);
      results.passed++;
    } else {
      console.log('   ❌ DETAIL', status, JSON.stringify(data));
      throw new Error('thread issue failed');
    }
  } catch (e) {
    console.log('   ❌ FAIL', e.message);
    results.failed++;
  }

  // 3) Save
  console.log('\n3) POST /save ...');
  try {
    const inputMessage = {
      source: 'gpts',
      thread,
      author: 'ChatGPT',
      text: 'E2E test message from GPTs flow',
      tags: ['test', 'e2e']
    };
    const { status, data } = await makeRequest(`${API_BASE}/save`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(inputMessage)
    });
    if (status === 200 && data.ok && data.data?.id) {
      savedId = data.data.id;
      console.log('   ✅ PASS', savedId);
      results.passed++;
    } else {
      console.log('   ❌ DETAIL', status, JSON.stringify(data));
      throw new Error('save failed');
    }
  } catch (e) {
    console.log('   ❌ FAIL', e.message);
    results.failed++;
  }

  // 4) Recent
  console.log('\n4) GET /recent?n=3 ...');
  try {
    const { status, data } = await makeRequest(`${API_BASE}/recent?n=3`, {
      headers: authHeaders
    });
    if (status === 200 && data.ok === true && Array.isArray(data.notes)) {
      console.log(`   ✅ PASS (total=${data.total})`);
      results.passed++;
    } else { throw new Error('recent failed'); }
  } catch (e) {
    console.log('   ❌ FAIL', e.message);
    results.failed++;
  }

  // 5) Search
  console.log('\n5) GET /search?tag=test&limit=5 ...');
  try {
    const { status, data } = await makeRequest(`${API_BASE}/search?tag=test&limit=5`, {
      headers: authHeaders
    });
    if (status === 200 && data.ok === true) {
      console.log(`   ✅ PASS (${data.total} hits)`);
      results.passed++;
    } else { throw new Error('search failed'); }
  } catch (e) {
    console.log('   ❌ FAIL', e.message);
    results.failed++;
  }

  // 6) Trigger
  console.log('\n6) POST /trigger ...');
  try {
    const trigger = { type: 'test-echo', payload: { message: 'hello' }, reply_to: thread };
    const { status, data } = await makeRequest(`${API_BASE}/trigger`, {
      method: 'POST', headers: authHeaders, body: JSON.stringify(trigger)
    });
    if (status === 200 && data.ok && data.mode === 'shelter') {
      console.log('   ✅ PASS');
      results.passed++;
    } else {
      console.log('   ❌ DETAIL', status, JSON.stringify(data));
      throw new Error('trigger failed');
    }
  } catch (e) {
    console.log('   ❌ FAIL', e.message);
    results.failed++;
  }

  // 7) Export context
  console.log('\n7) GET /export/context/{thread} ...');
  try {
    const { status, data } = await makeRequest(`${API_BASE}/export/context/${thread}`, {
      headers: authHeaders
    });
    if (status === 200 && data.version === '1.0.0') {
      console.log('   ✅ PASS');
      results.passed++;
    } else { throw new Error('export failed'); }
  } catch (e) {
    console.log('   ❌ FAIL', e.message);
    results.failed++;
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed || 1)) * 100)}%`);
  return results;
}

// Jest test wrapper
describe('YuiHub API Integration Test', () => {
  test('complete GPTs E2E lifecycle', async () => {
    const results = await runTests();
    expect(results.failed).toBe(0);
  }, 30000); // 30秒タイムアウト
});