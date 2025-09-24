#!/usr/bin/env node
/**
 * Quick schema validation test
 */

import { 
  InputMessageSchema, 
  FragmentSchema, 
  AgentTriggerSchema,
  inputMessageToFragment,
  Validators
} from '../src/schemas/yuiflow.js';

console.log('🧪 Testing YuiFlow Schemas...');

// Test InputMessage
const testInputMessage = {
  source: 'gpts',
  thread: 'th-01K5WHHB0D3ZE7A79NE9BY5387',
  author: 'test-user',
  text: 'This is a test message',
  tags: ['test', 'schema']
};

console.log('\n📝 Testing InputMessage validation...');
try {
  const validated = InputMessageSchema.parse(testInputMessage);
  console.log('✅ InputMessage validation passed');
  console.log('   Tags:', validated.tags);
} catch (error) {
  console.error('❌ InputMessage validation failed:', error.errors);
}

// Test conversion to Fragment
console.log('\n🔄 Testing InputMessage to Fragment conversion...');
try {
  const fragment = inputMessageToFragment(testInputMessage);
  console.log('✅ Fragment conversion passed');
  console.log('   ID:', fragment.id);
  console.log('   Mode:', fragment.mode);
  console.log('   Kind:', fragment.kind);
} catch (error) {
  console.error('❌ Fragment conversion failed:', error.message);
}

// Test AgentTrigger
const testTrigger = {
  type: 'echo',
  payload: { text: 'hello world' },
  reply_to: 'th-01K5WHHB0D3ZE7A79NE9BY5387'
};

console.log('\n⚡ Testing AgentTrigger validation...');
try {
  const validated = AgentTriggerSchema.parse(testTrigger);
  console.log('✅ AgentTrigger validation passed');
  console.log('   Type:', validated.type);
} catch (error) {
  console.error('❌ AgentTrigger validation failed:', error.errors || error.message);
}

// Test invalid data
console.log('\n🚫 Testing validation with invalid data...');
const invalidInput = {
  source: 'invalid-source',
  thread: 'invalid-thread-id',
  author: '',
  text: 'test'
};

const result = Validators.inputMessage(invalidInput);
if (!result.success) {
  console.log('✅ Correctly rejected invalid input');
  if (result.error && result.error.errors) {
    console.log('   Errors:', result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
  }
} else {
  console.error('❌ Should have rejected invalid input');
}

console.log('\n🎉 Schema test completed');