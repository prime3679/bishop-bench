const assert = require('assert');
const { sprintf } = require('../scoring/score');

console.log('🧪 Testing sprintf utility...');

// Test 1: Basic substitution
console.log('Test 1: Basic substitution');
assert.strictEqual(sprintf('Hello %s', 'World'), 'Hello World', 'String substitution failed');
assert.strictEqual(sprintf('Number %d', 123), 'Number 123', 'Number substitution failed');
assert.strictEqual(sprintf('%s %s', 'A', 'B'), 'A B', 'Multiple substitution failed');
console.log('✅ Passed');

// Test 2: Escaping
console.log('Test 2: Escaping');
assert.strictEqual(sprintf('100%%'), '100%', 'Percent escape failed');
console.log('✅ Passed');

// Test 3: Width and Alignment
console.log('Test 3: Width and Alignment');
// Right alignment (default)
assert.strictEqual(sprintf('%5s', 'foo'), '  foo', 'Right alignment string failed');
assert.strictEqual(sprintf('%5d', 123), '  123', 'Right alignment number failed');

// Left alignment
assert.strictEqual(sprintf('%-5s', 'foo'), 'foo  ', 'Left alignment string failed');
assert.strictEqual(sprintf('%-5d', 123), '123  ', 'Left alignment number failed');

// Truncation (optional, but good to check if it happens or not. Standard printf doesn't truncate for min width)
assert.strictEqual(sprintf('%2s', 'long'), 'long', 'Width should be minimum width');

console.log('✅ Passed');

// Test 4: Mixed types
console.log('Test 4: Mixed types');
assert.strictEqual(sprintf('Item: %-10s Cost: $%d', 'Apple', 5), 'Item: Apple      Cost: $5', 'Mixed types and alignment failed');
console.log('✅ Passed');

console.log('🎉 All sprintf tests passed!');
