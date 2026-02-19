const fs = require('fs');
const path = require('path');
const { BishopEvaluator } = require('../run');

// Mock dependencies
jest.mock('fs');
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => {
    return {
      messages: {
        create: jest.fn()
      }
    };
  });
});
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      responses: {
        create: jest.fn()
      }
    };
  });
});

describe('BishopEvaluator', () => {
  let evaluator;
  const mockTasksDir = '/mock/tasks';

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock fs.existsSync and mkdirSync for constructor
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});

    // Instantiate the evaluator
    evaluator = new BishopEvaluator();
    // Override tasksDir for testing purposes to a known mock path
    evaluator.tasksDir = mockTasksDir;
  });

  describe('loadTasks', () => {
    it('should load all valid YAML tasks', () => {
      const mockFiles = ['task1.yaml', 'task2.yml', 'readme.txt'];
      const mockTask1Content = 'name: task1\nprompt: prompt1';
      const mockTask2Content = 'name: task2\nprompt: prompt2';

      fs.readdirSync.mockReturnValue(mockFiles);
      fs.readFileSync.mockImplementation((filepath) => {
        if (filepath.endsWith('task1.yaml')) return mockTask1Content;
        if (filepath.endsWith('task2.yml')) return mockTask2Content;
        return '';
      });

      const tasks = evaluator.loadTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toEqual({ name: 'task1', prompt: 'prompt1', filename: 'task1.yaml' });
      expect(tasks[1]).toEqual({ name: 'task2', prompt: 'prompt2', filename: 'task2.yml' });

      expect(fs.readdirSync).toHaveBeenCalledWith(mockTasksDir);
    });

    it('should filter tasks by name', () => {
      const mockFiles = ['task1.yaml', 'task2.yaml'];
      const mockTask1Content = 'name: task1\nprompt: prompt1';
      const mockTask2Content = 'name: task2\nprompt: prompt2';

      fs.readdirSync.mockReturnValue(mockFiles);
      fs.readFileSync.mockImplementation((filepath) => {
        if (filepath.endsWith('task1.yaml')) return mockTask1Content;
        if (filepath.endsWith('task2.yaml')) return mockTask2Content;
        return '';
      });

      const tasks = evaluator.loadTasks('task2');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual({ name: 'task2', prompt: 'prompt2', filename: 'task2.yaml' });
    });

    it('should return empty array if no matching tasks found', () => {
        const mockFiles = ['task1.yaml'];
        const mockTask1Content = 'name: task1\nprompt: prompt1';

        fs.readdirSync.mockReturnValue(mockFiles);
        fs.readFileSync.mockReturnValue(mockTask1Content);

        const tasks = evaluator.loadTasks('non-existent-task');

        expect(tasks).toHaveLength(0);
    });

    it('should ignore non-yaml files', () => {
        const mockFiles = ['script.js', 'readme.md'];
        fs.readdirSync.mockReturnValue(mockFiles);

        const tasks = evaluator.loadTasks();

        expect(tasks).toHaveLength(0);
        expect(fs.readFileSync).not.toHaveBeenCalled();
    });
  });
});
