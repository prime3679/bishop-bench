const assert = require('assert');
const { BishopScorer } = require('../scoring/score');

console.log('🧪 Testing BishopScorer...');

const scorer = new BishopScorer();

// Test 1: aggregateScores with empty list
console.log('Test 1: aggregateScores with empty list');
const emptyResult = scorer.aggregateScores([]);
assert.deepStrictEqual(emptyResult, {}, 'Empty list should return empty object');
console.log('✅ Passed');

// Test 2: aggregateScores with populated list
console.log('Test 2: aggregateScores with populated list');
const scores = [
  { accuracy: 0.8, latency: 100 },
  { accuracy: 0.9, latency: 200 },
  { accuracy: 1.0, latency: 150 }
];

const result = scorer.aggregateScores(scores);

// Expected averages
// accuracy: (0.8 + 0.9 + 1.0) / 3 = 0.9
// latency: (100 + 200 + 150) / 3 = 150

// Use floating point close comparison for safety, though these specific numbers should be exact in JS
assert(Math.abs(result.accuracy_avg - 0.9) < 0.0001, 'Accuracy average incorrect');
assert.strictEqual(result.latency_avg, 150, 'Latency average incorrect');
assert.strictEqual(result.accuracy_min, 0.8, 'Accuracy min incorrect');
assert.strictEqual(result.accuracy_max, 1.0, 'Accuracy max incorrect');
assert.strictEqual(result.latency_min, 100, 'Latency min incorrect');
assert.strictEqual(result.latency_max, 200, 'Latency max incorrect');
console.log('✅ Passed');

// Test 3: aggregateScores with missing values
console.log('Test 3: aggregateScores with missing values');
const mixedScores = [
  { a: 10 },
  { a: 20, b: 5 },
  { b: 15 } // 'a' is missing here
];
// keys are taken from first element: ['a']
// so 'b' will be ignored because it's not in the first element.

const mixedResult = scorer.aggregateScores(mixedScores);
// 'a' values: 10, 20. (third object has undefined 'a')
// filter(v => typeof v === 'number' && !isNaN(v))
// so values for 'a' are [10, 20] -> avg 15
assert.strictEqual(mixedResult.a_avg, 15, 'Average for partial data incorrect');
assert.strictEqual(mixedResult.b_avg, undefined, 'Keys not in first element should be ignored');

console.log('✅ Passed');


// Test 4: formatTable with complete data (Happy Path)
console.log('Test 4: formatTable with complete data');
const completeComparison = {
  by_model: {
    'test-model-1': {
      completion_rate_avg: 0.95,
      cost_usd_avg: 0.015,
      latency_ms_avg: 500,
      tokens_per_second_avg: 20.5
    }
  },
  by_task: {
    'task-1': {
      completion_rate_avg: 0.9,
      cost_usd_avg: 0.01
    }
  }
};
const outputComplete = scorer.formatTable(completeComparison);
assert(outputComplete.includes('test-model-1'), 'Should contain model name');
assert(outputComplete.includes('95.0%'), 'Should format completion rate correctly');
assert(outputComplete.includes('0.0150'), 'Should format cost correctly');
assert(outputComplete.includes('500ms'), 'Should format latency correctly');
assert(outputComplete.includes('20.5'), 'Should format tokens per second correctly');
assert(outputComplete.includes('task-1'), 'Should contain task name');
assert(outputComplete.includes('90.0%'), 'Should format task completion rate correctly');
assert(outputComplete.includes('0.0100'), 'Should format task cost correctly');
console.log('✅ Passed');

// Test 5: formatTable with empty comparison object (Edge/Empty Case)
console.log('Test 5: formatTable with empty data');
const emptyComparison = {
  by_model: {},
  by_task: {}
};
const outputEmpty = scorer.formatTable(emptyComparison);
assert(outputEmpty.includes('MODEL PERFORMANCE SUMMARY'), 'Should contain model summary header');
assert(outputEmpty.includes('TASK DIFFICULTY ANALYSIS'), 'Should contain task difficulty header');
// Ensure it doesn't crash and returns the headers properly
console.log('✅ Passed');

// Test 6: formatTable with missing metrics (Missing/Partial Data)
console.log('Test 6: formatTable with missing metrics');
const missingComparison = {
  by_model: {
    'test-model-2': {} // No metrics provided
  },
  by_task: {
    'task-2': {} // No metrics provided
  }
};
const outputMissing = scorer.formatTable(missingComparison);
assert(outputMissing.includes('test-model-2'), 'Should contain model name');
assert(outputMissing.includes('0.0%'), 'Should default completion rate to 0.0%');
assert(outputMissing.includes('0.0000'), 'Should default cost to 0.0000');
assert(outputMissing.includes('0ms'), 'Should default latency to 0ms');
assert(outputMissing.includes('0.0'), 'Should default tokens per second to 0.0');
assert(outputMissing.includes('task-2'), 'Should contain task name');
console.log('✅ Passed');
console.log('🎉 All tests passed!');
