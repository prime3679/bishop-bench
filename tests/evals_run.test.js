
const { BishopEvaluator, MODELS } = require('../evals/run');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const fs = require('fs');

jest.mock('@anthropic-ai/sdk');
jest.mock('openai');
jest.mock('fs');

describe('BishopEvaluator', () => {
  let evaluator;
  const mockTask = {
    name: 'test-task',
    prompt: 'Hello world',
    expected_capabilities: ['test']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'mock-anthropic-key';
    process.env.OPENAI_API_KEY = 'mock-openai-key';

    // Mock fs
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});
    fs.readdirSync.mockReturnValue([]);
    fs.readFileSync.mockReturnValue('');

    // Setup mocks for Anthropic instance
    const mockAnthropicInstance = {
      messages: {
        create: jest.fn()
      }
    };
    Anthropic.mockImplementation(() => mockAnthropicInstance);

    // Setup mocks for OpenAI instance
    const mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    OpenAI.mockImplementation(() => mockOpenAIInstance);

    evaluator = new BishopEvaluator();
  });

  afterEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
  });

  describe('Initialization', () => {
      test('should initialize correctly', () => {
          expect(evaluator).toBeDefined();
          expect(evaluator.anthropic).toBeDefined();
          expect(evaluator.openai).toBeDefined();
      });
  });

  describe('executeTask', () => {
    test('dryRun should return result without API call', async () => {
      const modelId = 'claude-3-5-haiku-latest';
      const result = await evaluator.executeTask(mockTask, modelId, MODELS[modelId], { dryRun: true });

      expect(result.completed).toBe(true);
      expect(result.output).toContain('[DRY RUN]');
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
      expect(evaluator.anthropic.messages.create).not.toHaveBeenCalled();
      expect(evaluator.openai.chat.completions.create).not.toHaveBeenCalled();
    });

    describe('Anthropic Provider', () => {
      const modelId = 'claude-3-5-haiku-latest';
      const modelConfig = MODELS[modelId];

      test('should execute successfully and return result', async () => {
        const mockResponse = {
          content: [{ type: 'text', text: 'Anthropic response' }],
          usage: { input_tokens: 10, output_tokens: 20 }
        };
        evaluator.anthropic.messages.create.mockResolvedValue(mockResponse);

        const result = await evaluator.executeTask(mockTask, modelId, modelConfig);

        expect(result.completed).toBe(true);
        expect(result.output).toBe('Anthropic response');
        expect(result.input_tokens).toBe(10);
        expect(result.output_tokens).toBe(20);
        expect(result.total_tokens).toBe(30);
        expect(result.model_id).toBe(modelId);
        expect(result.cost_usd).toBeGreaterThan(0);

        expect(evaluator.anthropic.messages.create).toHaveBeenCalledWith({
          model: modelId,
          max_tokens: 1024,
          messages: [{ role: 'user', content: mockTask.prompt }]
        });
      });

      test('should handle missing API key', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        // Re-instantiate to clear env var from constructor usage if applicable,
        // though executeTask checks process.env.ANTHROPIC_API_KEY directly.

        // However, if the key is checked inside executeTask, deleting it from process.env is enough.

        const result = await evaluator.executeTask(mockTask, modelId, modelConfig);

        expect(result.completed).toBe(false);
        expect(result.error).toContain('Missing ANTHROPIC_API_KEY');
        expect(evaluator.anthropic.messages.create).not.toHaveBeenCalled();
      });

      test('should handle API errors', async () => {
        const error = new Error('API Error');
        evaluator.anthropic.messages.create.mockRejectedValue(error);

        const result = await evaluator.executeTask(mockTask, modelId, modelConfig);

        expect(result.completed).toBe(false);
        expect(result.error).toBe('API Error');
        expect(result.latency_ms).toBeGreaterThanOrEqual(0);
      });

      test('should handle rate limit errors', async () => {
        const error = new Error('Rate limit exceeded');
        error.status = 429;
        evaluator.anthropic.messages.create.mockRejectedValue(error);

        const result = await evaluator.executeTask(mockTask, modelId, modelConfig);

        expect(result.completed).toBe(false);
        expect(result.error).toContain('Rate limit');
      });

      test('should handle timeout', async () => {
        // Mock timeout by delaying the promise
        evaluator.anthropic.messages.create.mockImplementation(() =>
          new Promise(resolve => setTimeout(resolve, 200))
        );

        // Run with a very short timeout
        const result = await evaluator.executeTask(mockTask, modelId, modelConfig, { timeoutMs: 50 });

        expect(result.completed).toBe(false);
        expect(result.timeout_exceeded).toBe(true);
        expect(result.error).toContain('Request timed out');
      });
    });

    describe('OpenAI Provider', () => {
      const modelId = 'gpt-5.2-codex';
      const modelConfig = MODELS[modelId];

      test('should execute successfully and return result', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'OpenAI response' } }],
          usage: { input_tokens: 15, output_tokens: 25 }
        };
        evaluator.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const result = await evaluator.executeTask(mockTask, modelId, modelConfig);

        expect(result.completed).toBe(true);
        expect(result.output).toBe('OpenAI response');
        expect(result.input_tokens).toBe(15);
        expect(result.output_tokens).toBe(25);
        expect(result.total_tokens).toBe(40);
        expect(result.cost_usd).toBeGreaterThan(0);

        expect(evaluator.openai.chat.completions.create).toHaveBeenCalledWith({
          model: modelId,
          messages: [{ role: 'user', content: mockTask.prompt }]
        });
      });

      test('should handle missing API key', async () => {
        delete process.env.OPENAI_API_KEY;

        const result = await evaluator.executeTask(mockTask, modelId, modelConfig);

        expect(result.completed).toBe(false);
        expect(result.error).toContain('Missing OPENAI_API_KEY');
        expect(evaluator.openai.chat.completions.create).not.toHaveBeenCalled();
      });

       test('should handle API errors', async () => {
        const error = new Error('OpenAI Error');
        evaluator.openai.chat.completions.create.mockRejectedValue(error);

        const result = await evaluator.executeTask(mockTask, modelId, modelConfig);

        expect(result.completed).toBe(false);
        expect(result.error).toBe('OpenAI Error');
      });
    });

    test('should handle unsupported provider', async () => {
        const invalidModelConfig = {
            name: 'Invalid',
            provider: 'unknown',
            cost_per_1m_tokens: { input: 0, output: 0 }
        };

        const result = await evaluator.executeTask(mockTask, 'invalid-model', invalidModelConfig);

        expect(result.completed).toBe(false);
        expect(result.error).toContain('Unsupported provider');
    });
  });
});
