const assert = require('assert');
const { sprintf } = require('../scoring/score');

console.log('🧪 Testing sprintf utility...');

// Test 1: Basic string substitution
console.log('Test 1: Basic string substitution (%s)');
assert.strictEqual(sprintf('Hello %s', 'World'), 'Hello World');
assert.strictEqual(sprintf('%s %s', 'Foo', 'Bar'), 'Foo Bar');
console.log('✅ Passed');

// Test 2: Basic number substitution
console.log('Test 2: Basic number substitution (%d)');
assert.strictEqual(sprintf('Count: %d', 42), 'Count: 42');
assert.strictEqual(sprintf('%d + %d = %d', 1, 2, 3), '1 + 2 = 3');
console.log('✅ Passed');

// Test 3: Width padding (right aligned)
console.log('Test 3: Width padding (%10s)');
// "     World" (length 10)
assert.strictEqual(sprintf("'%10s'", 'World'), "'     World'");
assert.strictEqual(sprintf("'%5d'", 123), "'  123'");
console.log('✅ Passed');

// Test 4: Left alignment
console.log('Test 4: Left alignment (%-10s)');
// "World     " (length 10)
assert.strictEqual(sprintf("'%-10s'", 'World'), "'World     '");
assert.strictEqual(sprintf("'%-5d'", 123), "'123  '");
console.log('✅ Passed');

// Test 5: Escaped percent
console.log('Test 5: Escaped percent (%%)');
assert.strictEqual(sprintf('100%%'), '100%');
assert.strictEqual(sprintf('%%s'), '%s'); // Should be literal %s if not consumed? Wait. %% becomes %. s remains s.
// "%%s" -> matches "%%", returns "%". Then "s" is left.
// Wait, my regex is /%([-+])?(\d+)?(\.\d+)?[sd%]/g
// "%%" matches because [sd%] includes %.
// So "%%" -> "%". The "s" is outside the match.
assert.strictEqual(sprintf('%%s', 'ignored'), '%s');
console.log('✅ Passed');

// Test 6: Missing arguments
console.log('Test 6: Missing arguments');
// If arguments are missing, it should probably leave the placeholder or insert undefined?
// Implementation: if (i >= args.length) return match;
assert.strictEqual(sprintf('Hello %s'), 'Hello %s');
assert.strictEqual(sprintf('%s %s', 'One'), 'One %s');
console.log('✅ Passed');

// Test 7: Extra arguments
console.log('Test 7: Extra arguments');
assert.strictEqual(sprintf('Hello %s', 'World', 'Extra'), 'Hello World');
console.log('✅ Passed');

// Test 8: Type conversion
console.log('Test 8: Type conversion');
assert.strictEqual(sprintf('Num: %s', 123), 'Num: 123'); // Number to string
assert.strictEqual(sprintf('Str: %d', '456'), 'Str: 456'); // String to number
console.log('✅ Passed');

// Test 9: Complex format string (from code)
console.log('Test 9: Complex format string');
const header = sprintf("%-25s %8s %8s %10s %8s",
  "Model", "Success%", "AvgCost", "AvgLatency", "Tokens/s");
// "Model" (5) + 20 spaces = 25
// "Success%" (8) + 0 spaces (if width 8) -> "Success%"
// "AvgCost" (7) -> " AvgCost" (width 8)
// "AvgLatency" (10) -> "AvgLatency"
// "Tokens/s" (8) -> "Tokens/s"

// Let's verify lengths
const parts = header.split(' ');
// Note: split by space will be messy due to multiple spaces.
// Just check total length or specific substrings.
// "Model                    Success%  AvgCost AvgLatency Tokens/s"
//  12345678901234567890123456789012345678901234567890123456789012345
//  12345                    12345678 12345678 1234567890 12345678
//  Model                    Success%  AvgCost AvgLatency Tokens/s
// Lengths: 25, 8, 8, 10, 8
// Total length: 25 + 1 + 8 + 1 + 8 + 1 + 10 + 1 + 8 = 63 (approx, depends on how I join them in my head vs code)
// The format string puts spaces BETWEEN the placeholders: "%-25s %8s ..."
// So "Model                    " (25 chars) + " " + "Success%" (8 chars) ...

assert(header.startsWith('Model                    '), 'Model column not aligned');
assert(header.includes('Success%'), 'Success% missing');
console.log('✅ Passed');

console.log('🎉 All sprintf tests passed!');
