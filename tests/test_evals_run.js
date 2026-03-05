const assert = require('assert');
const { BishopEvaluator } = require('../evals/run');

console.log('🧪 Testing BishopEvaluator.extractOpenAIText...');

// Set dummy API keys to avoid initialization errors
process.env.ANTHROPIC_API_KEY = 'test';
process.env.OPENAI_API_KEY = 'test';

const evaluator = new BishopEvaluator();

// Test 1: extractOpenAIText with direct output_text
console.log('Test 1: extractOpenAIText with direct output_text');
const res1 = evaluator.extractOpenAIText({ output_text: 'Hello from output_text' });
assert.strictEqual(res1, 'Hello from output_text', 'Should return output_text when present');
console.log('✅ Passed');

// Test 2: extractOpenAIText with output chunks
console.log('Test 2: extractOpenAIText with output chunks');
const responseWithChunks = {
  output: [
    {
      content: [
        { type: 'output_text', text: 'Hello ' },
        { type: 'image_url', url: '...' }, // should be ignored
        { type: 'output_text', text: 'world!' }
      ]
    },
    {
      content: [
        { type: 'output_text', text: ' How are you?' }
      ]
    }
  ]
};
const res2 = evaluator.extractOpenAIText(responseWithChunks);
assert.strictEqual(res2, 'Hello world! How are you?', 'Should concatenate output chunks correctly');
console.log('✅ Passed');

// Test 3: extractOpenAIText with null or undefined
console.log('Test 3: extractOpenAIText with null or undefined');
assert.strictEqual(evaluator.extractOpenAIText(null), '', 'Should return empty string for null response');
assert.strictEqual(evaluator.extractOpenAIText(undefined), '', 'Should return empty string for undefined response');
console.log('✅ Passed');

// Test 4: extractOpenAIText with invalid output
console.log('Test 4: extractOpenAIText with invalid output array');
assert.strictEqual(evaluator.extractOpenAIText({}), '', 'Should return empty string when output is missing');
assert.strictEqual(evaluator.extractOpenAIText({ output: 'not an array' }), '', 'Should return empty string when output is not an array');
console.log('✅ Passed');

// Test 5: extractOpenAIText with malformed items inside output
console.log('Test 5: extractOpenAIText with malformed items in output array');
const malformedItemsResponse = {
  output: [
    null,
    undefined,
    {},
    { content: 'not an array' },
    {
      content: [
        null,
        undefined,
        {},
        { type: 'output_text' }, // missing text
        { type: 'output_text', text: 123 }, // text is not a string
        { type: 'other_type', text: 'should be ignored' }, // wrong type
        { type: 'output_text', text: 'Valid part.' }
      ]
    }
  ]
};
const res5 = evaluator.extractOpenAIText(malformedItemsResponse);
assert.strictEqual(res5, 'Valid part.', 'Should gracefully skip malformed items and parts');
console.log('✅ Passed');

console.log('🎉 All extractOpenAIText tests passed!');
