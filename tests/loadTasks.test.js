const fs = require('fs');
const path = require('path');
const os = require('os');
const { BishopEvaluator } = require('../evals/run');

describe('BishopEvaluator.loadTasks', () => {
  let tempDir;
  let tasksDir;
  let resultsDir;

  // Mock API clients to avoid API key requirements
  const mockAnthropic = {};
  const mockOpenAI = {};

  beforeEach(() => {
    // Create temp directory structure
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bishop-tests-'));
    tasksDir = path.join(tempDir, 'tasks');
    resultsDir = path.join(tempDir, 'results');
    fs.mkdirSync(tasksDir);
    // resultsDir is created by ensureDirectories
  });

  afterEach(() => {
    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Cleanup failed:', e);
    }
  });

  test('should load valid tasks', () => {
    const taskContent = `
name: valid-task
prompt: "Hello"
`;
    fs.writeFileSync(path.join(tasksDir, 'valid.yaml'), taskContent);

    const evaluator = new BishopEvaluator({
      tasksDir,
      resultsDir,
      anthropic: mockAnthropic,
      openai: mockOpenAI
    });
    const tasks = evaluator.loadTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('valid-task');
    expect(tasks[0].prompt).toBe('Hello');
  });

  test('should filter tasks by name', () => {
    fs.writeFileSync(path.join(tasksDir, 't1.yaml'), 'name: t1\n');
    fs.writeFileSync(path.join(tasksDir, 't2.yaml'), 'name: t2\n');

    const evaluator = new BishopEvaluator({ tasksDir, resultsDir, anthropic: mockAnthropic, openai: mockOpenAI });
    const tasks = evaluator.loadTasks('t1');

    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('t1');
  });

  test('should skip files with invalid YAML syntax', () => {
    // This file has invalid syntax
    fs.writeFileSync(path.join(tasksDir, 'invalid.yaml'), 'invalid: [');
    // valid one to ensure process continues
    fs.writeFileSync(path.join(tasksDir, 'valid.yaml'), 'name: valid\n');

    const evaluator = new BishopEvaluator({ tasksDir, resultsDir, anthropic: mockAnthropic, openai: mockOpenAI });

    // Should not throw, should return valid task only
    const tasks = evaluator.loadTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('valid');
  });

  test('should skip empty files', () => {
    fs.writeFileSync(path.join(tasksDir, 'empty.yaml'), '');
    fs.writeFileSync(path.join(tasksDir, 'valid.yaml'), 'name: valid\n');

    const evaluator = new BishopEvaluator({ tasksDir, resultsDir, anthropic: mockAnthropic, openai: mockOpenAI });
    const tasks = evaluator.loadTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('valid');
  });

  test('should throw error if tasks directory does not exist', () => {
    const missingDir = path.join(tempDir, 'missing');

    const evaluator = new BishopEvaluator({ tasksDir: missingDir, resultsDir, anthropic: mockAnthropic, openai: mockOpenAI });

    // Expect fs.readdirSync to throw ENOENT
    expect(() => evaluator.loadTasks()).toThrow();
  });
});
