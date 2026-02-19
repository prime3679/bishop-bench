const { BishopEvaluator } = require('./run');

// Mock external dependencies to avoid side effects and errors during instantiation
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  readFileSync: jest.fn(() => ''),
  writeFileSync: jest.fn(),
}));

jest.mock('@anthropic-ai/sdk', () => {
  return class Anthropic {
    constructor() {}
  };
});

jest.mock('openai', () => {
  return class OpenAI {
    constructor() {}
  };
});

describe('BishopEvaluator', () => {
  let evaluator;
  const originalEnv = process.env;

  beforeAll(() => {
    jest.resetModules();
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'dummy-key', OPENAI_API_KEY: 'dummy-key' };
    evaluator = new BishopEvaluator();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('calculateCost', () => {
    const pricing = {
      input: 3.00,  // $3 per 1M tokens
      output: 15.00 // $15 per 1M tokens
    };

    test('should correctly calculate cost for basic inputs', () => {
      // 1M input tokens ($3) + 1M output tokens ($15) = $18
      expect(evaluator.calculateCost(1_000_000, 1_000_000, pricing)).toBe(18.00);

      // 500k input ($1.5) + 200k output ($3) = $4.5
      expect(evaluator.calculateCost(500_000, 200_000, pricing)).toBe(4.5);
    });

    test('should handle zero inputs', () => {
      expect(evaluator.calculateCost(0, 0, pricing)).toBe(0);
      expect(evaluator.calculateCost(1_000_000, 0, pricing)).toBe(3.00);
      expect(evaluator.calculateCost(0, 1_000_000, pricing)).toBe(15.00);
    });

    test('should round to 6 decimal places', () => {
      // 1 input token: 3/1000000 = 0.000003
      // 1 output token: 15/1000000 = 0.000015
      // Total: 0.000018
      expect(evaluator.calculateCost(1, 1, pricing)).toBe(0.000018);

      // Test a case that might have floating point issues
      // 123 input: 0.000369
      // 456 output: 0.00684
      // Total: 0.007209
      expect(evaluator.calculateCost(123, 456, pricing)).toBe(0.007209);
    });

    test('should handle fractional pricing', () => {
        const cheapPricing = { input: 0.5, output: 1.5 };
        // 1M input ($0.5) + 1M output ($1.5) = $2.0
        expect(evaluator.calculateCost(1_000_000, 1_000_000, cheapPricing)).toBe(2.0);
    });

    test('should handle large numbers', () => {
        // 1B tokens
        // 1000 * 3 + 1000 * 15 = 18000
        expect(evaluator.calculateCost(1_000_000_000, 1_000_000_000, pricing)).toBe(18000);
    });
  });
});
