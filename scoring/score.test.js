const { BishopScorer } = require('./score');

describe('BishopScorer', () => {
  let scorer;

  beforeEach(() => {
    scorer = new BishopScorer();
  });

  describe('scoreResult', () => {
    const mockTask = {
      name: 'test-task',
      description: 'A test task'
    };

    test('should score a successful result correctly', () => {
      const result = {
        completed: true,
        error: false,
        timeout_exceeded: false,
        latency_ms: 1000,
        cost_usd: 0.002,
        output_tokens: 100
      };

      const score = scorer.scoreResult(result, mockTask);

      expect(score.completion_rate).toBe(1.0);
      expect(score.error_rate).toBe(0.0);
      expect(score.timeout_rate).toBe(0.0);
      expect(score.latency_ms).toBe(1000);
      expect(score.cost_usd).toBe(0.002);
      // 100 tokens / 1 second = 100 tokens/sec
      expect(score.tokens_per_second).toBe(100);
      // 0.002 usd / 100 tokens = 0.00002 usd/token
      expect(score.cost_per_token).toBe(0.00002);
    });

    test('should score a failed result (error) correctly', () => {
      const result = {
        completed: false,
        error: true,
        timeout_exceeded: false
      };

      const score = scorer.scoreResult(result, mockTask);

      expect(score.completion_rate).toBe(0.0);
      expect(score.error_rate).toBe(1.0);
    });

    test('should score a timeout result correctly', () => {
      const result = {
        completed: false,
        error: false,
        timeout_exceeded: true
      };

      const score = scorer.scoreResult(result, mockTask);

      expect(score.timeout_rate).toBe(1.0);
    });

    describe('tool usage effectiveness', () => {
      test('should calculate tool success rate correctly when tools are called', () => {
        const result = {
          tools_called: ['tool1', 'tool2'],
          tools_successful: 1
        };

        const score = scorer.scoreResult(result, mockTask);

        // 1 successful / 2 called = 0.5
        expect(score.tool_success_rate).toBe(0.5);
      });

      test('should handle no tools called (empty array)', () => {
        const result = {
          tools_called: []
        };

        const score = scorer.scoreResult(result, mockTask);

        expect(score.tool_success_rate).toBe(0.0);
      });

      test('should handle no tools called (undefined)', () => {
        const result = {};

        const score = scorer.scoreResult(result, mockTask);

        expect(score.tool_success_rate).toBe(0.0);
      });
    });

    describe('edge cases', () => {
      test('should handle zero latency (avoid division by zero)', () => {
        const result = {
          latency_ms: 0,
          output_tokens: 100
        };

        const score = scorer.scoreResult(result, mockTask);

        expect(score.latency_ms).toBe(0);
        expect(score.tokens_per_second).toBe(0);
      });

      test('should handle zero output tokens', () => {
        const result = {
          cost_usd: 0.001,
          output_tokens: 0
        };

        const score = scorer.scoreResult(result, mockTask);

        expect(score.cost_per_token).toBe(0);
      });

      test('should handle missing optional fields with defaults', () => {
        const result = {}; // minimal object

        const score = scorer.scoreResult(result, mockTask);

        expect(score.completion_rate).toBe(0.0);
        expect(score.error_rate).toBe(0.0);
        expect(score.timeout_rate).toBe(0.0);
        expect(score.latency_ms).toBe(0);
        expect(score.cost_usd).toBe(0);
      });
    });
  });
});
