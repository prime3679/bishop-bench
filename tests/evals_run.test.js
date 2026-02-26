const assert = require('assert');
const path = require('path');

// Mock environment variables before requiring the module
process.env.ANTHROPIC_API_KEY = 'dummy-key';
process.env.OPENAI_API_KEY = 'dummy-key';

const { BishopEvaluator } = require('../evals/run');

console.log('🧪 Testing BishopEvaluator.extractOpenAIText...');

const evaluator = new BishopEvaluator();

// Helper to test equality
function testExtract(name, input, expected) {
  console.log(`Test: ${name}`);
  const result = evaluator.extractOpenAIText(input);
  try {
    assert.strictEqual(result, expected);
    console.log('✅ Passed');
  } catch (e) {
    console.error(`❌ Failed: Expected "${expected}", got "${result}"`);
    throw e;
  }
}

// Test Cases

// 1. Happy Path: output_text string
testExtract(
  'Direct output_text string',
  { output_text: 'Hello World' },
  'Hello World'
);

// 2. Happy Path: output array with chunks
testExtract(
  'Output array with multiple chunks',
  {
    output: [
      {
        content: [
          { type: 'output_text', text: 'Hello' },
          { type: 'output_text', text: ' ' },
          { type: 'output_text', text: 'World' }
        ]
      }
    ]
  },
  'Hello World'
);

// 3. Null/Undefined response
testExtract('Null response', null, '');
testExtract('Undefined response', undefined, '');

// 4. Malformed response (no output_text or output)
testExtract('Empty object response', {}, '');

// 5. Malformed output items
testExtract(
  'Output array with empty item',
  { output: [{}] },
  ''
);

testExtract(
  'Output array with item missing content',
  { output: [{ content: null }] },
  ''
);

// 6. Mixed content types
testExtract(
  'Mixed content types (ignore non-text)',
  {
    output: [
      {
        content: [
          { type: 'other_type', text: 'ignore me' },
          { type: 'output_text', text: 'keep me' }
        ]
      }
    ]
  },
  'keep me'
);

// 7. Non-string text in output_text part
testExtract(
  'Non-string text property',
  {
    output: [
      {
        content: [
          { type: 'output_text', text: 123 }, // Should be ignored
          { type: 'output_text', text: 'valid' }
        ]
      }
    ]
  },
  'valid'
);

console.log('🎉 All BishopEvaluator tests passed!');
