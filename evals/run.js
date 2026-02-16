#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Supported models and their configurations
const MODELS = {
  'anthropic/claude-haiku': {
    name: 'Claude Haiku',
    provider: 'anthropic',
    cost_per_1k_tokens: { input: 0.00025, output: 0.00125 }
  },
  'anthropic/claude-sonnet': {
    name: 'Claude Sonnet', 
    provider: 'anthropic',
    cost_per_1k_tokens: { input: 0.003, output: 0.015 }
  },
  'anthropic/claude-opus': {
    name: 'Claude Opus',
    provider: 'anthropic', 
    cost_per_1k_tokens: { input: 0.015, output: 0.075 }
  },
  'openai/gpt-5.3-codex': {
    name: 'GPT-5.3 Codex',
    provider: 'openai',
    cost_per_1k_tokens: { input: 0.01, output: 0.03 }
  }
};

class BishopEvaluator {
  constructor() {
    this.tasksDir = path.join(__dirname, '..', 'tasks');
    this.resultsDir = path.join(__dirname, '..', 'results');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  // Load task definitions from YAML files
  loadTasks(taskFilter = null) {
    const taskFiles = fs.readdirSync(this.tasksDir)
      .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

    const tasks = [];
    for (const file of taskFiles) {
      const taskPath = path.join(this.tasksDir, file);
      const content = fs.readFileSync(taskPath, 'utf8');
      const task = yaml.load(content);
      
      if (!taskFilter || task.name === taskFilter) {
        tasks.push({ ...task, filename: file });
      }
    }
    
    return tasks;
  }

  // Execute a task against a specific model
  async executeTask(task, modelId, modelConfig) {
    console.log(`Running task "${task.name}" on ${modelConfig.name}...`);
    
    const startTime = Date.now();
    
    // TODO: Implement actual model API calls
    // This is a skeleton - would need to integrate with:
    // - Anthropic API for Claude models
    // - OpenAI API for GPT models
    // - Include tool calling capabilities
    
    const mockResult = {
      task_name: task.name,
      model_id: modelId,
      model_name: modelConfig.name,
      timestamp: new Date().toISOString(),
      prompt: task.prompt,
      expected_capabilities: task.expected_capabilities,
      
      // Mock response data (to be replaced with real API calls)
      output: `Mock output for ${task.name} from ${modelConfig.name}`,
      
      // Performance metrics
      latency_ms: Date.now() - startTime,
      input_tokens: 150,  // Mock token count
      output_tokens: 300, // Mock token count  
      total_tokens: 450,
      
      // Cost calculation
      cost_usd: this.calculateCost(150, 300, modelConfig.cost_per_1k_tokens),
      
      // Tool usage (to be populated by real execution)
      tools_called: [],
      tools_successful: 0,
      tools_failed: 0,
      
      // Error handling
      error: null,
      completed: true,
      timeout_exceeded: false
    };
    
    return mockResult;
  }

  calculateCost(inputTokens, outputTokens, pricing) {
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    return Math.round((inputCost + outputCost) * 1000000) / 1000000; // Round to 6 decimal places
  }

  // Run evaluation across all specified tasks and models
  async runEvaluation(options = {}) {
    const { taskFilter = null, modelFilter = null } = options;
    
    const tasks = this.loadTasks(taskFilter);
    const modelsToTest = modelFilter 
      ? modelFilter.split(',').map(m => m.trim())
      : Object.keys(MODELS);
    
    console.log(`Running ${tasks.length} task(s) across ${modelsToTest.length} model(s)...`);
    
    const results = [];
    
    for (const task of tasks) {
      console.log(`\\n📋 Task: ${task.name}`);
      
      for (const modelId of modelsToTest) {
        if (!MODELS[modelId]) {
          console.warn(`⚠️  Unknown model: ${modelId}`);
          continue;
        }
        
        try {
          const result = await this.executeTask(task, modelId, MODELS[modelId]);
          results.push(result);
        } catch (error) {
          console.error(`❌ Error running ${task.name} on ${modelId}:`, error.message);
          results.push({
            task_name: task.name,
            model_id: modelId,
            error: error.message,
            completed: false
          });
        }
      }
    }
    
    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(this.resultsDir, `eval-${timestamp}.json`);
    
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\\n📊 Results saved to: ${resultsFile}`);
    
    return results;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--task':
        options.taskFilter = value;
        break;
      case '--models':
        options.modelFilter = value;
        break;
      case '--help':
        console.log(`
Bishop Benchmark Evaluator

Usage: node run.js [options]

Options:
  --task <name>      Run specific task only
  --models <list>    Comma-separated list of models to test
  --help             Show this help message

Available models:
  ${Object.keys(MODELS).join('\\n  ')}

Examples:
  node run.js                                    # Run all tasks on all models
  node run.js --task morning-briefing            # Run one task
  node run.js --models anthropic/claude-sonnet,anthropic/claude-opus
        `);
        return;
    }
  }
  
  const evaluator = new BishopEvaluator();
  await evaluator.runEvaluation(options);
}

if (require.main === module) {
  main().catch(console.error);
}