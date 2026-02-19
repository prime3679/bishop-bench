const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs');
jest.mock('@anthropic-ai/sdk');
jest.mock('openai');

const { BishopEvaluator } = require('./run');

describe('BishopEvaluator', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks for fs
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
  });

  describe('ensureDirectories', () => {
    it('should create results directory on initialization if it does not exist', () => {
      // Setup fs mock
      fs.existsSync.mockReturnValue(false);

      new BishopEvaluator();

      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('results'));
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('results'), { recursive: true });
    });

    it('should not create results directory on initialization if it already exists', () => {
      // Setup fs mock
      fs.existsSync.mockReturnValue(true);

      new BishopEvaluator();

      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('results'));
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should create results directory when called explicitly', () => {
      // Setup fs mock
      fs.existsSync.mockReturnValue(false);

      const evaluator = new BishopEvaluator();

      // Reset mocks to verify the explicit call
      fs.existsSync.mockClear();
      fs.mkdirSync.mockClear();

      evaluator.ensureDirectories();

      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('results'));
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('results'), { recursive: true });
    });
  });
});
