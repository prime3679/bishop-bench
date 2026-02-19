const fs = require('fs');
const path = require('path');
const { BishopEvaluator } = require('../evals/run');
const assert = require('assert');

// Mock process.env
process.env.ANTHROPIC_API_KEY = 'dummy';
process.env.OPENAI_API_KEY = 'dummy';

const tasksDir = path.join(__dirname, '..', 'tasks');
const invalidFile = path.join(tasksDir, 'test-invalid.yaml');
const emptyFile = path.join(tasksDir, 'test-empty.yaml');

try {
  // Create invalid task files
  fs.writeFileSync(invalidFile, 'not a valid task object');
  fs.writeFileSync(emptyFile, '');

  const evaluator = new BishopEvaluator();

  // This should not throw and should filter out the invalid tasks
  const tasks = evaluator.loadTasks();

  // Verify that the invalid tasks are NOT in the list
  const invalidTask = tasks.find(t => t.filename === 'test-invalid.yaml');
  const emptyTask = tasks.find(t => t.filename === 'test-empty.yaml');

  assert.strictEqual(invalidTask, undefined, 'Invalid task should be filtered out');
  assert.strictEqual(emptyTask, undefined, 'Empty task should be filtered out');

  console.log('Test passed: Invalid tasks were safely ignored.');
} catch (error) {
  console.error('Test failed:', error);
  process.exit(1);
} finally {
  // Cleanup
  if (fs.existsSync(invalidFile)) {
    fs.unlinkSync(invalidFile);
  }
  if (fs.existsSync(emptyFile)) {
    fs.unlinkSync(emptyFile);
  }
}
