const { BishopEvaluator } = require('./run');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const fs = require('fs');

jest.mock('@anthropic-ai/sdk');
jest.mock('openai');
jest.mock('fs');

describe('BishopEvaluator.executeTask', () => {
  let evaluator;
  let mockAnthropicCreate;
  let mockOpenAICreate;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    // Setup Anthropic mock
    mockAnthropicCreate = jest.fn();
    Anthropic.mockImplementation(() => ({
      messages: {
        create: mockAnthropicCreate
      }
    }));

    // Setup OpenAI mock
    mockOpenAICreate = jest.fn();
    OpenAI.mockImplementation(() => ({
      responses: {
        create: mockOpenAICreate
      }
    }));

    // Mock fs methods
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});

    evaluator = new BishopEvaluator();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const sampleTask = {
    name: 'test-task',
    prompt: 'Hello world',
    expected_capabilities: ['reasoning']
  };

  test('Dry run returns early without API call', async () => {
    const modelConfig = { name: 'Test Model', provider: 'anthropic' };
    const result = await evaluator.executeTask(sampleTask, 'model-id', modelConfig, { dryRun: true });

    expect(result.completed).toBe(true);
    expect(result.output).toContain('[DRY RUN]');
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  test('Anthropic provider success', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const modelConfig = {
        name: 'Claude Test',
        provider: 'anthropic',
        cost_per_1m_tokens: { input: 1.0, output: 2.0 }
    };

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Anthropic response' }],
      usage: { input_tokens: 1000000, output_tokens: 1000000 }
    });

    const result = await evaluator.executeTask(sampleTask, 'claude-test', modelConfig);

    expect(mockAnthropicCreate).toHaveBeenCalledWith({
      model: 'claude-test',
      max_tokens: 1024,
      messages: [{ role: 'user', content: sampleTask.prompt }]
    });

    expect(result.output).toBe('Anthropic response');
    expect(result.input_tokens).toBe(1000000);
    expect(result.output_tokens).toBe(1000000);
    // Cost: (1M/1M * 1) + (1M/1M * 2) = 1 + 2 = 3
    expect(result.cost_usd).toBe(3.0);
  });

  test('OpenAI provider success', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const modelConfig = {
        name: 'GPT Test',
        provider: 'openai',
        cost_per_1m_tokens: { input: 1.0, output: 2.0 }
    };

    mockOpenAICreate.mockResolvedValue({
      output_text: 'OpenAI response',
      usage: { input_tokens: 1000000, output_tokens: 1000000 }
    });

    const result = await evaluator.executeTask(sampleTask, 'gpt-test', modelConfig);

    expect(mockOpenAICreate).toHaveBeenCalledWith({
      model: 'gpt-test',
      input: [{ role: 'user', content: sampleTask.prompt }]
    });

    expect(result.output).toBe('OpenAI response');
    expect(result.input_tokens).toBe(1000000);
    expect(result.output_tokens).toBe(1000000);
    expect(result.cost_usd).toBe(3.0);
  });

  test('Missing Anthropic API Key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const modelConfig = { name: 'Claude Test', provider: 'anthropic' };

    const result = await evaluator.executeTask(sampleTask, 'claude-test', modelConfig);

    expect(result.completed).toBe(false);
    expect(result.error).toContain('Missing ANTHROPIC_API_KEY');
  });

  test('Missing OpenAI API Key', async () => {
    delete process.env.OPENAI_API_KEY;
    const modelConfig = { name: 'GPT Test', provider: 'openai' };

    const result = await evaluator.executeTask(sampleTask, 'gpt-test', modelConfig);

    expect(result.completed).toBe(false);
    expect(result.error).toContain('Missing OPENAI_API_KEY');
  });

  test('Unsupported provider', async () => {
    const modelConfig = { name: 'Unknown', provider: 'unknown' };

    const result = await evaluator.executeTask(sampleTask, 'unknown-model', modelConfig);

    expect(result.completed).toBe(false);
    expect(result.error).toContain('Unsupported provider');
  });

  test('API Error Handling', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const modelConfig = { name: 'Claude Test', provider: 'anthropic' };

    const error = new Error('API Error');
    mockAnthropicCreate.mockRejectedValue(error);

    const result = await evaluator.executeTask(sampleTask, 'claude-test', modelConfig);

    expect(result.completed).toBe(false);
    expect(result.error).toBe('API Error');
  });

  test('Timeout Handling', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const modelConfig = { name: 'Claude Test', provider: 'anthropic' };

    // Mock the API call to never resolve
    mockAnthropicCreate.mockImplementation(() => new Promise(() => {}));

    // Use a very short timeout
    const result = await evaluator.executeTask(sampleTask, 'claude-test', modelConfig, { timeoutMs: 10 });

    expect(result.completed).toBe(false);
    expect(result.timeout_exceeded).toBe(true);
    expect(result.error).toContain('Request timed out');
  });
});
