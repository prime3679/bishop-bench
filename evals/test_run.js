const { test, describe } = require('node:test');
const assert = require('node:assert');

// Mock environment variables before importing the module
process.env.OPENAI_API_KEY = 'dummy';
process.env.ANTHROPIC_API_KEY = 'dummy';

const { BishopEvaluator } = require('./run.js');

describe('BishopEvaluator', () => {
  describe('calculateCost', () => {
    const evaluator = new BishopEvaluator();

    // Pricing for testing: $1.00 input, $2.00 output per 1M tokens
    const pricing = { input: 1.00, output: 2.00 };

    test('should calculate cost correctly for non-zero values', () => {
      const inputTokens = 1000000;
      const outputTokens = 1000000;
      const cost = evaluator.calculateCost(inputTokens, outputTokens, pricing);
      assert.strictEqual(cost, 3.00);
    });

    test('should handle zero input tokens', () => {
      const inputTokens = 0;
      const outputTokens = 1000000;
      const cost = evaluator.calculateCost(inputTokens, outputTokens, pricing);
      assert.strictEqual(cost, 2.00);
    });

    test('should handle zero output tokens', () => {
      const inputTokens = 1000000;
      const outputTokens = 0;
      const cost = evaluator.calculateCost(inputTokens, outputTokens, pricing);
      assert.strictEqual(cost, 1.00);
    });

    test('should handle zero input and output tokens', () => {
      const inputTokens = 0;
      const outputTokens = 0;
      const cost = evaluator.calculateCost(inputTokens, outputTokens, pricing);
      assert.strictEqual(cost, 0);
    });

    test('should round to 6 decimal places', () => {
      // Pricing: $0.33 input, $0.66 output
      const weirdPricing = { input: 0.33, output: 0.66 };
      // 1000 tokens
      const inputTokens = 1000;
      const outputTokens = 1000;

      // Input cost: 1000/1000000 * 0.33 = 0.001 * 0.33 = 0.00033
      // Output cost: 1000/1000000 * 0.66 = 0.001 * 0.66 = 0.00066
      // Total: 0.00099

      const cost = evaluator.calculateCost(inputTokens, outputTokens, weirdPricing);
      assert.strictEqual(cost, 0.00099);
    });
  });
});
