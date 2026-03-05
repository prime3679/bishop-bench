const assert = require('assert');
const { BishopEvaluator } = require('../evals/run');

console.log('🧪 Testing BishopEvaluator...');

// We need to set dummy API keys so the constructor doesn't fail
// if the environment variables are missing during test execution.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test';

const evaluator = new BishopEvaluator();

console.log('Test 1: extractAnthropicText with empty/invalid inputs');
assert.strictEqual(evaluator.extractAnthropicText(null), '', 'Should return empty string for null message');
assert.strictEqual(evaluator.extractAnthropicText(undefined), '', 'Should return empty string for undefined message');
assert.strictEqual(evaluator.extractAnthropicText({}), '', 'Should return empty string for object without content');
assert.strictEqual(evaluator.extractAnthropicText({ content: null }), '', 'Should return empty string for null content');
assert.strictEqual(evaluator.extractAnthropicText({ content: 'string' }), '', 'Should return empty string for string content (not array)');
assert.strictEqual(evaluator.extractAnthropicText({ content: [] }), '', 'Should return empty string for empty content array');
console.log('✅ Passed');

console.log('Test 2: extractAnthropicText with valid text content');
const validMessage = {
  content: [
    { type: 'text', text: 'Hello, ' },
    { type: 'text', text: 'world!' }
  ]
};
assert.strictEqual(evaluator.extractAnthropicText(validMessage), 'Hello, world!', 'Should concatenate text parts');
console.log('✅ Passed');

console.log('Test 3: extractAnthropicText with mixed content types');
const mixedMessage = {
  content: [
    { type: 'text', text: 'The answer is ' },
    { type: 'image', source: '...' },
    { type: 'tool_use', name: 'calculator' },
    { type: 'text', text: '42.' }
  ]
};
assert.strictEqual(evaluator.extractAnthropicText(mixedMessage), 'The answer is 42.', 'Should only extract and concatenate text parts');
console.log('✅ Passed');

console.log('Test 4: extractAnthropicText with malformed content array elements');
const malformedMessage = {
  content: [
    null,
    undefined,
    {},
    { type: 'text' }, // missing text property
    { type: 'text', text: 'Valid' }
  ]
};
// The function filters `part && part.type === 'text'`, and maps `part.text`.
// For `{ type: 'text' }`, `part.text` is undefined, so `join('')` might cast it or ignore it depending on how join works.
// Actually, mapping to `undefined` and calling `join('')` might result in empty strings. Let's see what `[undefined, 'Valid'].join('')` does.
// In JS: `[undefined, 'Valid'].join('')` produces `"Valid"`.
assert.strictEqual(evaluator.extractAnthropicText(malformedMessage), 'Valid', 'Should handle malformed content parts gracefully');
console.log('✅ Passed');

console.log('🎉 All BishopEvaluator tests passed!');
