const test = require('node:test');
const assert = require('node:assert');
const { BishopScorer, sprintf } = require('./score.js');

test('sprintf formatting', async (t) => {
  await t.test('basic string substitution', () => {
    assert.strictEqual(sprintf('%s', 'test'), 'test');
  });

  await t.test('basic number substitution', () => {
    assert.strictEqual(sprintf('%d', 123), '123');
  });

  await t.test('width padding (right aligned)', () => {
    assert.strictEqual(sprintf('%5s', 'foo'), '  foo');
    assert.strictEqual(sprintf('%5d', 12), '   12');
  });

  await t.test('width padding (left aligned)', () => {
    assert.strictEqual(sprintf('%-5s', 'foo'), 'foo  ');
  });

  await t.test('mixed formatting', () => {
    assert.strictEqual(sprintf('%-5s %5d', 'foo', 12), 'foo      12');
  });

  await t.test('percent escape', () => {
    assert.strictEqual(sprintf('%%'), '%');
    assert.strictEqual(sprintf('100%%'), '100%');
  });

  await t.test('multiple args', () => {
    assert.strictEqual(sprintf('%s %s', 'hello', 'world'), 'hello world');
  });
});

test('BishopScorer formatTable', async (t) => {
  const scorer = new BishopScorer();

  // Mock comparison data
  const comparison = {
    summary: {
      completion_rate_avg: 0.8,
      cost_usd_avg: 0.002,
      latency_ms_avg: 1500,
    },
    by_model: {
      'gpt-4': {
        completion_rate_avg: 0.95,
        cost_usd_avg: 0.03,
        latency_ms_avg: 2000,
        tokens_per_second_avg: 50.5
      },
      'claude-3': {
        completion_rate_avg: 0.90,
        cost_usd_avg: 0.01,
        latency_ms_avg: 1000,
        tokens_per_second_avg: 80.2
      }
    },
    by_task: {
      'coding': {
        completion_rate_avg: 0.85,
        cost_usd_avg: 0.02
      },
      'creative': {
        completion_rate_avg: 0.92,
        cost_usd_avg: 0.015
      }
    },
    detailed: []
  };

  const output = scorer.formatTable(comparison);

  await t.test('contains header', () => {
    assert.match(output, /BISHOP BENCHMARK RESULTS/);
    assert.match(output, /MODEL PERFORMANCE SUMMARY/);
  });

  await t.test('contains model data formatted correctly', () => {
    // Model name padded to 25 chars
    // Success% (0.95 * 100) -> 95.0%
    // Cost -> $ 0.0300
    // Latency -> 2000ms
    // TPS -> 50.5

    // Check for gpt-4 row
    // Note: use \s+ to match multiple spaces
    assert.match(output, /gpt-4\s+95.0%\s+\$\s+0.0300\s+2000ms\s+50.5/);

    // Check for claude-3 row
    assert.match(output, /claude-3\s+90.0%\s+\$\s+0.0100\s+1000ms\s+80.2/);
  });

  await t.test('contains task data formatted correctly', () => {
    assert.match(output, /TASK DIFFICULTY ANALYSIS/);

    // Check for coding task
    assert.match(output, /coding\s+85.0%\s+\$\s+0.0200/);

    // Check for creative task
    assert.match(output, /creative\s+92.0%\s+\$\s+0.0150/);
  });

  await t.test('handles missing metrics gracefully', () => {
    const incompleteComparison = {
      by_model: {
        'broken-model': {}
      },
      by_task: {}
    };

    const output2 = scorer.formatTable(incompleteComparison);
    // Should default to 0
    assert.match(output2, /broken-model\s+0.0%\s+\$ 0.0000\s+0ms\s+0.0/);
  });
});
