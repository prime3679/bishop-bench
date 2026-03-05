const assert = require('assert');
const { BishopEvaluator } = require('../evals/run');

console.log('🧪 Testing BishopEvaluator lazy initialization...');

// Clear out API keys
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;

// Constructor should NOT throw an error without API keys
let evaluator;
try {
  evaluator = new BishopEvaluator();
  console.log('✅ Constructor passed without API keys.');
} catch (error) {
  console.error('❌ Constructor failed:', error.message);
  process.exit(1);
}

assert.strictEqual(evaluator.anthropic, null, 'Anthropic client should be null');
assert.strictEqual(evaluator.openai, null, 'OpenAI client should be null');

// Now provide dummy keys and simulate an executeTask call, verifying the clients get instantiated
process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
process.env.OPENAI_API_KEY = 'sk-test';

// Override withTimeout to mock network response, but since withTimeout wraps the real API call, the real API call would still fire!
// To truly test we just mock the `create` functions on the clients AFTER they are instantiated, OR mock `withTimeout` to NOT evaluate the promise it receives.
// But JS evaluates promises eagerly. So the promise is already created by calling `.create()`.
// Instead, let's intercept `executeTask` failure by ensuring it catches errors gracefully and we check the instance properties.

async function testAnthropic() {
    // executeTask handles errors internally and returns a result with `error: '...'`
    await evaluator.executeTask(
        { name: 'test', prompt: 'hello' },
        'anthropic/claude',
        { provider: 'anthropic', cost_per_1m_tokens: { input: 1, output: 1 } },
        { dryRun: false }
    );
    assert.notStrictEqual(evaluator.anthropic, null, 'Anthropic client should be instantiated');
}

async function testOpenAI() {
    await evaluator.executeTask(
        { name: 'test', prompt: 'hello' },
        'openai/gpt-4',
        { provider: 'openai', cost_per_1m_tokens: { input: 1, output: 1 } },
        { dryRun: false }
    );
    assert.notStrictEqual(evaluator.openai, null, 'OpenAI client should be instantiated');
}

testAnthropic().then(() => testOpenAI()).then(() => console.log('✅ All lazy init tests passed.'));
