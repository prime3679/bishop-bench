const fs = require('fs');
const path = require('path');
const { BishopScorer } = require('./score');

jest.mock('fs');

describe('BishopScorer', () => {
  let scorer;
  // We need to match the path construction in the class
  const mockResultsDir = path.join(__dirname, '..', 'results');

  beforeEach(() => {
    jest.clearAllMocks();
    scorer = new BishopScorer();
  });

  describe('loadResults', () => {
    it('should load and parse results file', () => {
      const mockData = [{ id: 1 }];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      const results = scorer.loadResults('test.json');
      expect(results).toEqual(mockData);
      expect(fs.readFileSync).toHaveBeenCalledWith('test.json', 'utf8');
    });

    it('should throw error if file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      expect(() => scorer.loadResults('test.json')).toThrow('Results file not found');
    });
  });

  describe('getLatestResults', () => {
    it('should return the latest results file', () => {
      const files = ['eval-2023-01-01.json', 'eval-2023-01-02.json'];
      // Mock readdirSync to return files
      fs.readdirSync.mockReturnValue(files);

      const latest = scorer.getLatestResults();
      // The class joins resultsDir with the filename
      expect(latest).toBe(path.join(mockResultsDir, 'eval-2023-01-02.json'));
    });

    it('should throw error if no results files found', () => {
      fs.readdirSync.mockReturnValue([]);
      expect(() => scorer.getLatestResults()).toThrow('No evaluation results found');
    });

    it('should filter out non-eval files', () => {
      const files = ['other.txt', 'eval-2023.json', 'garbage.json'];
      fs.readdirSync.mockReturnValue(files);

      const latest = scorer.getLatestResults();
      expect(latest).toBe(path.join(mockResultsDir, 'eval-2023.json'));
    });
  });

  describe('scoreResult', () => {
    it('should score a completed task correctly', () => {
      const result = {
        completed: true,
        error: false,
        timeout_exceeded: false,
        tools_called: ['tool1'],
        tools_successful: 1,
        latency_ms: 1000,
        cost_usd: 0.01,
        output_tokens: 100
      };

      const score = scorer.scoreResult(result);
      expect(score.completion_rate).toBe(1.0);
      expect(score.error_rate).toBe(0.0);
      expect(score.tool_success_rate).toBe(1.0);
      expect(score.tokens_per_second).toBe(100);
      expect(score.cost_per_token).toBe(0.0001);
    });

     it('should handle zero latency for tokens per second', () => {
      const result = {
        completed: true,
        latency_ms: 0,
        output_tokens: 100
      };
      const score = scorer.scoreResult(result);
      expect(score.tokens_per_second).toBe(0);
    });

    it('should handle failed task', () => {
        const result = {
            completed: false,
            error: true
        };
        const score = scorer.scoreResult(result);
        expect(score.completion_rate).toBe(0.0);
        expect(score.error_rate).toBe(1.0);
    });
  });

  describe('aggregateScores', () => {
    it('should aggregate scores correctly', () => {
      const scoresList = [
        { metric: 10 },
        { metric: 20 },
        { metric: 30 }
      ];

      const aggregated = scorer.aggregateScores(scoresList);
      expect(aggregated.metric_avg).toBe(20);
      expect(aggregated.metric_min).toBe(10);
      expect(aggregated.metric_max).toBe(30);
    });

    it('should return empty object for empty list', () => {
      expect(scorer.aggregateScores([])).toEqual({});
    });

    it('should handle non-number values gracefully', () => {
         const scoresList = [
        { metric: 10 },
        { metric: 'invalid' },
        { metric: 30 }
      ];
      const aggregated = scorer.aggregateScores(scoresList);
      expect(aggregated.metric_avg).toBe(20);
    });
  });

  describe('generateComparison', () => {
    it('should group and aggregate results', () => {
      const results = [
        {
          task_name: 'task1',
          model_id: 'model1',
          completed: true,
          latency_ms: 100
        },
        {
          task_name: 'task1',
          model_id: 'model1',
          completed: true,
          latency_ms: 200
        }
      ];

      const comparison = scorer.generateComparison(results);

      expect(comparison.by_task.task1.latency_ms_avg).toBe(150);
      expect(comparison.by_model.model1.latency_ms_avg).toBe(150);
      expect(comparison.summary.latency_ms_avg).toBe(150);
    });

    it('should ignore incomplete non-error results', () => {
         const results = [
        {
          task_name: 'task1',
          model_id: 'model1',
          completed: false,
          error: false // e.g. skipped or pending
        }
      ];
      const comparison = scorer.generateComparison(results);
      expect(comparison.by_task.task1).toBeUndefined();
    });
  });
});
