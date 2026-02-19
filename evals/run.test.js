
const { BishopEvaluator } = require('./run');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

jest.mock('fs');
jest.mock('js-yaml');
jest.mock('@anthropic-ai/sdk');
jest.mock('openai');

describe('BishopEvaluator', () => {
  let evaluator;
  let mockAnthropicCreate;
  let mockOpenAICreate;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fs
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});
    fs.readdirSync.mockReturnValue([]);
    fs.readFileSync.mockReturnValue('');

    // Mock path (partial)
    // We don't mock path because we want the real path logic,
    // but the constructor uses path.join which is fine.

    // Mock Anthropic
    mockAnthropicCreate = jest.fn();
    Anthropic.mockImplementation(() => ({
      messages: {
        create: mockAnthropicCreate
      }
    }));

    // Mock OpenAI
    mockOpenAICreate = jest.fn();
    OpenAI.mockImplementation(() => ({
      responses: {
        create: mockOpenAICreate
      }
    }));

    evaluator = new BishopEvaluator();
  });

  describe('constructor', () => {
    it('should initialize with correct directories and clients', () => {
      expect(evaluator.tasksDir).toContain('tasks');
      expect(evaluator.resultsDir).toContain('results');
      expect(Anthropic).toHaveBeenCalled();
      expect(OpenAI).toHaveBeenCalled();
    });

    it('should create results directory if it does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      new BishopEvaluator();
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('results'), { recursive: true });
    });
  });

  describe('loadTasks', () => {
    it('should load tasks from yaml files', () => {
      fs.readdirSync.mockReturnValue(['task1.yaml', 'ignore.txt']);
      fs.readFileSync.mockReturnValue('name: task1\nprompt: hello');
      yaml.load.mockReturnValue({ name: 'task1', prompt: 'hello' });

      const tasks = evaluator.loadTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual({ name: 'task1', prompt: 'hello', filename: 'task1.yaml' });
      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('task1.yaml'), 'utf8');
    });

    it('should filter tasks by name', () => {
      fs.readdirSync.mockReturnValue(['task1.yaml', 'task2.yaml']);
      yaml.load
        .mockReturnValueOnce({ name: 'task1' })
        .mockReturnValueOnce({ name: 'task2' });

      const tasks = evaluator.loadTasks('task1');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('task1');
    });
  });

  describe('executeTask', () => {
    const task = { name: 'test-task', prompt: 'test prompt' };
    const modelConfig = { name: 'Test Model', provider: 'anthropic', cost_per_1m_tokens: { input: 1, output: 2 } };

    it('should handle dry run correctly', async () => {
      const result = await evaluator.executeTask(task, 'model-id', modelConfig, { dryRun: true });

      expect(result.output).toContain('DRY RUN');
      expect(result.completed).toBe(true);
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });

    it('should execute anthropic task successfully', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'response text' }],
        usage: { input_tokens: 10, output_tokens: 20 }
      });

      const result = await evaluator.executeTask(task, 'anthropic-model', modelConfig);

      expect(mockAnthropicCreate).toHaveBeenCalledWith({
        model: 'anthropic-model',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test prompt' }]
      });
      expect(result.output).toBe('response text');
      expect(result.completed).toBe(true);
      expect(result.input_tokens).toBe(10);
      expect(result.output_tokens).toBe(20);
    });

    it('should execute openai task successfully', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const openaiModelConfig = { ...modelConfig, provider: 'openai' };

      mockOpenAICreate.mockResolvedValue({
        output_text: 'openai response',
        usage: { input_tokens: 5, output_tokens: 5 }
      });

      const result = await evaluator.executeTask(task, 'openai-model', openaiModelConfig);

      expect(mockOpenAICreate).toHaveBeenCalledWith({
        model: 'openai-model',
        input: [{ role: 'user', content: 'test prompt' }]
      });
      expect(result.output).toBe('openai response');
    });

    it('should handle API errors', async () => {
        process.env.ANTHROPIC_API_KEY = 'test-key';
        mockAnthropicCreate.mockRejectedValue(new Error('API Error'));

        const result = await evaluator.executeTask(task, 'model-id', modelConfig);

        expect(result.completed).toBe(false);
        expect(result.error).toBe('API Error');
    });

    it('should handle missing API key', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        const result = await evaluator.executeTask(task, 'model-id', modelConfig);

        expect(result.completed).toBe(false);
        expect(result.error).toContain('Missing ANTHROPIC_API_KEY');
    });
  });

  describe('extractAnthropicText', () => {
      it('should extract text from anthropic response', () => {
          const message = {
              content: [
                  { type: 'text', text: 'Hello' },
                  { type: 'image' },
                  { type: 'text', text: ' World' }
              ]
          };
          expect(evaluator.extractAnthropicText(message)).toBe('Hello World');
      });

      it('should handle empty or invalid content', () => {
          expect(evaluator.extractAnthropicText(null)).toBe('');
          expect(evaluator.extractAnthropicText({})).toBe('');
          expect(evaluator.extractAnthropicText({ content: [] })).toBe('');
      });
  });

  describe('extractOpenAIText', () => {
      it('should extract text from openai response (string format)', () => {
          expect(evaluator.extractOpenAIText({ output_text: 'response' })).toBe('response');
      });

      it('should extract text from openai response (complex format)', () => {
          const response = {
              output: [
                  {
                      content: [
                          { type: 'output_text', text: 'Part 1' },
                          { type: 'other' }
                      ]
                  },
                  {
                      content: [
                          { type: 'output_text', text: ' Part 2' }
                      ]
                  }
              ]
          };
          expect(evaluator.extractOpenAIText(response)).toBe('Part 1 Part 2');
      });
  });

  describe('runEvaluation', () => {
    it('should run evaluation for all tasks and specified models', async () => {
      // Mock loadTasks to return one task
      evaluator.loadTasks = jest.fn().mockReturnValue([{ name: 'task1', prompt: 'prompt1' }]);

      // Mock executeTask to return a dummy result
      evaluator.executeTask = jest.fn().mockResolvedValue({
        task_name: 'task1',
        model_id: 'claude-3-5-haiku-latest',
        completed: true
      });

      fs.writeFileSync.mockImplementation(() => {});

      const results = await evaluator.runEvaluation({
        modelFilter: 'claude-3-5-haiku-latest',
        runs: 1
      });

      expect(evaluator.loadTasks).toHaveBeenCalled();
      expect(evaluator.executeTask).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'task1' }),
        'claude-3-5-haiku-latest',
        expect.anything(),
        expect.objectContaining({ runIndex: 1 })
      );
      expect(results).toHaveLength(1);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('results/eval-'),
        expect.any(String)
      );
    });

    it('should handle errors during evaluation', async () => {
      evaluator.loadTasks = jest.fn().mockReturnValue([{ name: 'task1' }]);
      evaluator.executeTask = jest.fn().mockRejectedValue(new Error('Execution failed'));

      const results = await evaluator.runEvaluation({
        modelFilter: 'claude-3-5-haiku-latest'
      });

      expect(results).toHaveLength(1);
      expect(results[0].completed).toBe(false);
      expect(results[0].error).toBe('Execution failed');
    });
  });
});
