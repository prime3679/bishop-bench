const { BishopEvaluator } = require('./run');

// Mock external dependencies to avoid API key requirements and side effects
jest.mock('@anthropic-ai/sdk');
jest.mock('openai');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn()
}));

describe('BishopEvaluator', () => {
  let evaluator;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    evaluator = new BishopEvaluator();
  });

  describe('extractAnthropicText', () => {
    test('returns empty string for null input', () => {
      expect(evaluator.extractAnthropicText(null)).toBe('');
    });

    test('returns empty string for undefined input', () => {
      expect(evaluator.extractAnthropicText(undefined)).toBe('');
    });

    test('returns empty string for object without content array', () => {
      expect(evaluator.extractAnthropicText({})).toBe('');
      expect(evaluator.extractAnthropicText({ other: 'field' })).toBe('');
    });

    test('returns empty string for empty content array', () => {
      expect(evaluator.extractAnthropicText({ content: [] })).toBe('');
    });

    test('extracts text from a single text block', () => {
      const message = {
        content: [{ type: 'text', text: 'Hello world' }]
      };
      expect(evaluator.extractAnthropicText(message)).toBe('Hello world');
    });

    test('joins text from multiple text blocks', () => {
      const message = {
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' }
        ]
      };
      expect(evaluator.extractAnthropicText(message)).toBe('Hello world');
    });

    test('ignores non-text blocks (e.g., images)', () => {
      const message = {
        content: [
          { type: 'text', text: 'Here is an image: ' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } },
          { type: 'text', text: 'End of message' }
        ]
      };
      expect(evaluator.extractAnthropicText(message)).toBe('Here is an image: End of message');
    });

    test('handles null or undefined parts in content array', () => {
      const message = {
        content: [
          { type: 'text', text: 'Start' },
          null,
          undefined,
          { type: 'text', text: 'End' }
        ]
      };
      expect(evaluator.extractAnthropicText(message)).toBe('StartEnd');
    });

    test('handles blocks with missing type or text property', () => {
      const message = {
        content: [
          { type: 'text', text: 'Valid' },
          { text: 'Missing type' }, // Should be ignored
          { type: 'text' }, // Missing text
        ]
      };

      expect(evaluator.extractAnthropicText(message)).toBe('Valid');
    });
  });
});
