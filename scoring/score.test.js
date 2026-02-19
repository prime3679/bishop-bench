const { BishopScorer } = require('./score');

describe('BishopScorer', () => {
  let scorer;

  beforeEach(() => {
    scorer = new BishopScorer();
  });

  test('should be defined', () => {
    expect(scorer).toBeDefined();
  });

  describe('generateComparison', () => {
    test('should return empty comparison for empty results', () => {
      const results = [];
      const comparison = scorer.generateComparison(results);

      expect(comparison).toEqual({
        summary: {},
        by_task: {},
        by_model: {},
        detailed: results
      });
    });

    test('should group results by task and model', () => {
      const results = [
        {
          task_name: 'task1',
          model_id: 'modelA',
          completed: true,
          error: false,
          timeout_exceeded: false,
          latency_ms: 100,
          cost_usd: 0.01,
          output_tokens: 10,
          tools_called: [],
          tools_successful: 0
        },
        {
          task_name: 'task1',
          model_id: 'modelB',
          completed: true,
          error: false,
          timeout_exceeded: false,
          latency_ms: 150,
          cost_usd: 0.02,
          output_tokens: 15,
          tools_called: [],
          tools_successful: 0
        },
        {
          task_name: 'task2',
          model_id: 'modelA',
          completed: true,
          error: false,
          timeout_exceeded: false,
          latency_ms: 200,
          cost_usd: 0.03,
          output_tokens: 20,
          tools_called: [],
          tools_successful: 0
        }
      ];

      const comparison = scorer.generateComparison(results);

      expect(Object.keys(comparison.by_task)).toHaveLength(2);
      expect(comparison.by_task['task1']).toBeDefined();
      expect(comparison.by_task['task2']).toBeDefined();

      expect(Object.keys(comparison.by_model)).toHaveLength(2);
      expect(comparison.by_model['modelA']).toBeDefined();
      expect(comparison.by_model['modelB']).toBeDefined();
    });

    test('should correctly aggregate scores for a model', () => {
        const results = [
          {
            task_name: 'task1',
            model_id: 'modelA',
            completed: true,
            error: false,
            timeout_exceeded: false,
            latency_ms: 100,
            cost_usd: 0.01,
            output_tokens: 10
          },
          {
            task_name: 'task1',
            model_id: 'modelA',
            completed: true,
            error: false,
            timeout_exceeded: false,
            latency_ms: 200,
            cost_usd: 0.03,
            output_tokens: 20
          }
        ];

        const comparison = scorer.generateComparison(results);
        const modelStats = comparison.by_model['modelA'];

        // Latency: (100 + 200) / 2 = 150
        expect(modelStats.latency_ms_avg).toBe(150);
        expect(modelStats.latency_ms_min).toBe(100);
        expect(modelStats.latency_ms_max).toBe(200);

        // Cost: (0.01 + 0.03) / 2 = 0.02
        expect(modelStats.cost_usd_avg).toBeCloseTo(0.02);
    });

    test('should correctly aggregate scores for a task', () => {
        const results = [
          {
            task_name: 'task1',
            model_id: 'modelA',
            completed: true,
            latency_ms: 100,
          },
          {
            task_name: 'task1',
            model_id: 'modelB',
            completed: true,
            latency_ms: 300,
          }
        ];

        const comparison = scorer.generateComparison(results);
        const taskStats = comparison.by_task['task1'];

        // Latency: (100 + 300) / 2 = 200
        expect(taskStats.latency_ms_avg).toBe(200);
    });

    test('should ignore incomplete results without error', () => {
        const results = [
            {
                task_name: 'task1',
                model_id: 'modelA',
                completed: false, // Not completed
                error: false // No error
                // Should be ignored
            },
            {
                task_name: 'task1',
                model_id: 'modelA',
                completed: true,
                error: false,
                latency_ms: 100
            }
        ];

        const comparison = scorer.generateComparison(results);
        const modelStats = comparison.by_model['modelA'];

        // Only one result should be counted
        expect(modelStats.latency_ms_avg).toBe(100);
    });

    test('should include results with error', () => {
        const results = [
            {
                task_name: 'task1',
                model_id: 'modelA',
                completed: false,
                error: true,
                latency_ms: 50
            }
        ];

        const comparison = scorer.generateComparison(results);
        const modelStats = comparison.by_model['modelA'];

        expect(modelStats.error_rate_avg).toBe(1.0);
        expect(modelStats.latency_ms_avg).toBe(50);
    });

    test('should generate overall summary correctly', () => {
        const results = [
            {
                task_name: 'task1',
                model_id: 'modelA',
                completed: true,
                latency_ms: 100
            },
            {
                task_name: 'task2',
                model_id: 'modelB',
                completed: true,
                latency_ms: 200
            },
             {
                task_name: 'task3',
                model_id: 'modelC', // filtered out
                completed: false,
                error: false
            }
        ];

        const comparison = scorer.generateComparison(results);
        const summary = comparison.summary;

        // Latency: (100 + 200) / 2 = 150
        expect(summary.latency_ms_avg).toBe(150);
        expect(summary.latency_ms_min).toBe(100);
        expect(summary.latency_ms_max).toBe(200);
    });
  });
});
