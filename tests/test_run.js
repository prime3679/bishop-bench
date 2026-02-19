// Set dummy API keys before requiring the module
process.env.ANTHROPIC_API_KEY = 'dummy';
process.env.OPENAI_API_KEY = 'dummy';

const { BishopEvaluator } = require('../evals/run.js');

async function test() {
  console.log('Starting regression test...');
  try {
    const evaluator = new BishopEvaluator();

    // We expect this to be async after the fix, but currently sync.
    // await works for both.
    const tasks = await evaluator.loadTasks();

    console.log(`Loaded ${tasks.length} tasks.`);

    if (tasks.length === 0) {
      console.error('❌ No tasks loaded.');
      process.exit(1);
    }

    const morningBriefing = tasks.find(t => t.name === 'morning-briefing');
    if (morningBriefing) {
      console.log('✅ Found morning-briefing task.');
    } else {
      console.error('❌ Could not find morning-briefing task.');
      process.exit(1);
    }

    console.log('✅ Task loading verification successful.');
  } catch (err) {
    console.error('❌ Error during test:', err);
    process.exit(1);
  }
}

test();
