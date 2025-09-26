#!/usr/bin/env node
/**
 * YuiHub API Integration Test
 * Tests all YuiFlow-compliant endpoints
 */

const API_BASE = 'http://localhost:3000';

async function makeRequest(url, options = {}) {
  const fetch = (await import('node-fetch')).default;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log('🧪 YuiHub API Integration Tests');
  console.log('==============================\n');

  let testThread = 'th-01K5WHS123EXAMPLE456789ABC';
  let results = { passed: 0, failed: 0 };

  // Test 1: Health check
  console.log('1. Testing /health endpoint...');
  try {
    const { status, data } = await makeRequest(`${API_BASE}/health`);
    if (status === 200 && data.ok) {
      console.log('   ✅ PASS: Health check successful');
      results.passed++;
    } else {
      console.log('   ❌ FAIL: Health check failed');
      results.failed++;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Server not reachable');
    results.failed++;
    return results;
  }

  // Test 2: Save message with YuiFlow format
  console.log('\n2. Testing /save endpoint with YuiFlow InputMessage...');
  try {
    const inputMessage = {
      source: 'gpts',
      thread: testThread,
      author: 'test-user',
      text: 'Integration test message using YuiFlow schema',
      tags: ['test', 'integration', 'yuiflow']
    };

    const { status, data } = await makeRequest(`${API_BASE}/save`, {
      method: 'POST',
      body: JSON.stringify(inputMessage)
    });

    if (status === 200 && data.ok && data.data.id) {
      console.log('   ✅ PASS: Message saved successfully');
      console.log(`   📄 ID: ${data.data.id}`);
      results.passed++;
    } else {
      console.log('   ❌ FAIL: Save failed', data);
      results.failed++;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Save request failed', error.message);
    results.failed++;
  }

  // Test 3: Search with filters
  console.log('\n3. Testing /search endpoint with filters...');
  try {
    const { status, data } = await makeRequest(`${API_BASE}/search?tag=test&limit=5`);

    if (status === 200 && data.ok && data.filters) {
      console.log('   ✅ PASS: Search with filters successful');
      console.log(`   🔍 Results: ${data.total} hits`);
      results.passed++;
    } else {
      console.log('   ❌ FAIL: Search failed', data);
      results.failed++;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Search request failed', error.message);
    results.failed++;
  }

  // Test 4: Agent trigger
  console.log('\n4. Testing /trigger endpoint...');
  try {
    const trigger = {
      type: 'test-echo',
      payload: { message: 'Integration test trigger' },
      reply_to: testThread
    };

    const { status, data } = await makeRequest(`${API_BASE}/trigger`, {
      method: 'POST',
      body: JSON.stringify(trigger)
    });

    if (status === 200 && data.ok && data.mode === 'shelter') {
      console.log('   ✅ PASS: Agent trigger recorded (shelter mode)');
      console.log(`   ⚡ Ref: ${data.ref}`);
      results.passed++;
    } else {
      console.log('   ❌ FAIL: Trigger failed', data);
      results.failed++;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Trigger request failed', error.message);
    results.failed++;
  }

  // Test 5: VS Code endpoints
  console.log('\n5. Testing VS Code Extension endpoints...');
  try {
    const { status, data } = await makeRequest(`${API_BASE}/vscode/threads`);

    if (status === 200 && data.ok && Array.isArray(data.threads)) {
      console.log('   ✅ PASS: VS Code threads endpoint successful');
      results.passed++;
    } else {
      console.log('   ❌ FAIL: VS Code threads failed', data);
      results.failed++;
    }
  } catch (error) {
    console.log('   ❌ FAIL: VS Code request failed', error.message);
    results.failed++;
  }

  // Test 6: Context export endpoint
  console.log('\n6. Testing context export endpoint...');
  try {
    const { status, data } = await makeRequest(`${API_BASE}/export/context/${testThread}`);

    if (status === 200 && data.version === '1.0.0') {
      console.log('   ✅ PASS: Context packet export successful');
      console.log(`   📦 Fragments: ${data.fragments.length}`);
      results.passed++;
    } else {
      console.log('   ❌ FAIL: Context export failed', data);
      results.failed++;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Context export request failed', error.message);
    results.failed++;
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  return results;
}

// Run tests
runTests().then(results => {
  if (results.failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n💥 Test suite failed:', error);
  process.exit(1);
});