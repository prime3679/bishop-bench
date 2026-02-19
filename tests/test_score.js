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

console.log('🎉 All tests passed!');
