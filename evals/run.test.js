
const { BishopEvaluator } = require('./run');

// Mock external dependencies
jest.mock('@anthropic-ai/sdk', () => {
  return class Anthropic {
    constructor() {
      this.messages = { create: jest.fn() };
    }
  };
});

jest.mock('openai', () => {
  return class OpenAI {
    constructor() {
      this.responses = { create: jest.fn() };
    }
  };
});

describe('BishopEvaluator', () => {
  let evaluator;

  beforeEach(() => {
    // Set dummy API keys
    process.env.ANTHROPIC_API_KEY = 'dummy-key';
    process.env.OPENAI_API_KEY = 'dummy-key';

    evaluator = new BishopEvaluator();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  describe('withTimeout', () => {
    test('should resolve if promise completes before timeout', async () => {
      const result = 'success';
      const promise = Promise.resolve(result);
      const timeoutMs = 1000;

      const promiseWithTimeout = evaluator.withTimeout(promise, timeoutMs);

      // Advance timers less than timeout
      jest.advanceTimersByTime(500);

      await expect(promiseWithTimeout).resolves.toBe(result);
    });

    test('should reject if promise throws before timeout', async () => {
      const error = new Error('failure');
      const promise = Promise.reject(error);
      const timeoutMs = 1000;

      const promiseWithTimeout = evaluator.withTimeout(promise, timeoutMs);

      jest.advanceTimersByTime(500);

      await expect(promiseWithTimeout).rejects.toThrow(error);
    });

    test('should reject with ETIMEDOUT if promise times out', async () => {
      const promise = new Promise(() => {}); // Never resolves
      const timeoutMs = 1000;

      const promiseWithTimeout = evaluator.withTimeout(promise, timeoutMs);

      // Fast-forward past the timeout
      jest.advanceTimersByTime(1001);

      await expect(promiseWithTimeout).rejects.toThrow('Request timed out after 1000ms');
    });

    test('should have correct error code on timeout', async () => {
      const promise = new Promise(() => {}); // Never resolves
      const timeoutMs = 1000;

      const promiseWithTimeout = evaluator.withTimeout(promise, timeoutMs);

      jest.advanceTimersByTime(1001);

      try {
        await promiseWithTimeout;
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).toBe('ETIMEDOUT');
        expect(error.message).toBe('Request timed out after 1000ms');
      }
    });

    test('should handle zero timeout correctly', async () => {
      const promise = new Promise(() => {});
      const timeoutMs = 0;

      const promiseWithTimeout = evaluator.withTimeout(promise, timeoutMs);

      jest.advanceTimersByTime(1);

      await expect(promiseWithTimeout).rejects.toThrow('Request timed out after 0ms');
    });

    test('should cleanup timer on success', async () => {
      // We can check if clearTimeout was called
      const spy = jest.spyOn(global, 'clearTimeout');
      const promise = Promise.resolve('success');

      await evaluator.withTimeout(promise, 1000);

      expect(spy).toHaveBeenCalled();
    });
  });
});
