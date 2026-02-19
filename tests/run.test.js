const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

describe('BishopEvaluator', () => {
  let originalEnv;
  let BishopEvaluator;

  before(() => {
    originalEnv = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'dummy_anthropic_key';
    process.env.OPENAI_API_KEY = 'dummy_openai_key';

    // Require the module
    BishopEvaluator = require('../evals/run.js').BishopEvaluator;
  });

  after(() => {
    process.env = originalEnv;
  });

  it('extractAnthropicText should handle empty content array', () => {
    const evaluator = new BishopEvaluator();
    const message = {
      content: []
    };
    const result = evaluator.extractAnthropicText(message);
    assert.strictEqual(result, '', 'Should return empty string for empty content array');
  });

  it('extractAnthropicText should handle null/undefined message', () => {
    const evaluator = new BishopEvaluator();
    assert.strictEqual(evaluator.extractAnthropicText(null), '');
    assert.strictEqual(evaluator.extractAnthropicText(undefined), '');
  });

  it('extractAnthropicText should handle invalid content (not array)', () => {
    const evaluator = new BishopEvaluator();
    assert.strictEqual(evaluator.extractAnthropicText({ content: 'not array' }), '');
    assert.strictEqual(evaluator.extractAnthropicText({ content: null }), '');
  });

  it('extractAnthropicText should extract text from valid content', () => {
    const evaluator = new BishopEvaluator();
    const message = {
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' World' }
      ]
    };
    assert.strictEqual(evaluator.extractAnthropicText(message), 'Hello World');
  });

  it('extractAnthropicText should ignore non-text parts', () => {
    const evaluator = new BishopEvaluator();
    const message = {
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'image', source: '...' },
        { type: 'text', text: ' World' }
      ]
    };
    assert.strictEqual(evaluator.extractAnthropicText(message), 'Hello World');
  });

  it('extractAnthropicText should handle parts missing type or text', () => {
      const evaluator = new BishopEvaluator();
      const message = {
        content: [
            { type: 'text', text: 'Hello' },
            null,
            { type: 'other' },
            { type: 'text' } // missing text property, so part.text is undefined
        ]
      };

      // [undefined].join('') is ''
      assert.strictEqual(evaluator.extractAnthropicText(message), 'Hello');
  });

});
