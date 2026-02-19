#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

// Supported models and their configurations
const MODELS = {
  'claude-3-5-haiku-latest': {
    name: 'Claude Haiku 3.5',
    provider: 'anthropic',
    cost_per_1m_tokens: { input: 0.80, output: 4.00 }
  },
  'claude-sonnet-4-20250514': {
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    cost_per_1m_tokens: { input: 3.00, output: 15.00 }
  },
  'claude-opus-4-20250514': {
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    cost_per_1m_tokens: { input: 15.00, output: 75.00 }
  },
  'gpt-5.2-codex': {
    name: 'GPT-5.2 Codex',
    provider: 'openai',
    cost_per_1m_tokens: { input: 1.75, output: 14.00 }
  }
};

const DEFAULT_TIMEOUT_MS = 120000;

class BishopEvaluator {
  constructor(options = {}) {
    this.tasksDir = options.tasksDir || path.join(__dirname, '..', 'tasks');
    this.resultsDir = options.resultsDir || path.join(__dirname, '..', 'results');
    this.ensureDirectories();
    this.anthropic = options.anthropic || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.openai = options.openai || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
      try {
        const content = fs.readFileSync(taskPath, 'utf8');
        const task = yaml.load(content);

        if (!task || typeof task !== 'object') {
          console.warn(`⚠️  Skipping invalid task file: ${file} (not a valid YAML object)`);
          continue;
        }

        if (!task.name) {
          console.warn(`⚠️  Skipping invalid task file: ${file} (missing 'name' field)`);
          continue;
        }

        if (!taskFilter || task.name === taskFilter) {
          tasks.push({ ...task, filename: file });
        }
      } catch (error) {
        console.warn(`⚠️  Error loading task file ${file}: ${error.message}`);
      }
    }
    
    return tasks;
  }

  extractAnthropicText(message) {
    if (!message || !Array.isArray(message.content)) return '';
    return message.content
      .filter(part => part && part.type === 'text')
      .map(part => part.text)
      .join('');
  }

  extractOpenAIText(response) {
    if (response && typeof response.output_text === 'string') return response.output_text;
    if (!response || !Array.isArray(response.output)) return '';
    const chunks = [];
    for (const item of response.output) {
      if (!item || !Array.isArray(item.content)) continue;
      for (const part of item.content) {
        if (part && part.type === 'output_text' && typeof part.text === 'string') {
          chunks.push(part.text);
        }
      }
    }
    return chunks.join('');
  }

  async withTimeout(promise, timeoutMs) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error(`Request timed out after ${timeoutMs}ms`);
        error.code = 'ETIMEDOUT';
        reject(error);
      }, timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Execute a task against a specific model
  async executeTask(task, modelId, modelConfig, options = {}) {
    const { dryRun = false, runIndex = 1, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
    console.log(`Running task "${task.name}" on ${modelConfig.name} (run ${runIndex})...`);

    const startTime = process.hrtime.bigint();

    const baseResult = {
      task_name: task.name,
      model_id: modelId,
      model_name: modelConfig.name,
      run_index: runIndex,
      timestamp: new Date().toISOString(),
      prompt: task.prompt,
      expected_capabilities: task.expected_capabilities,

      output: '',

      latency_ms: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,

      cost_usd: 0,

      // Tool usage (to be populated by real execution)
      tools_called: [],
      tools_successful: 0,
      tools_failed: 0,

      error: null,
      completed: true,
      timeout_exceeded: false
    };

    if (dryRun) {
      const latencyMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      return {
        ...baseResult,
        output: '[DRY RUN] No API call executed.',
        latency_ms: Math.round(latencyMs),
        completed: true
      };
    }

    try {
      let response;

      if (modelConfig.provider === 'anthropic') {
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error('Missing ANTHROPIC_API_KEY env var');
        }
        response = await this.withTimeout(
          this.anthropic.messages.create({
            model: modelId,
            max_tokens: 1024,
            messages: [{ role: 'user', content: task.prompt }]
          }),
          timeoutMs
        );
        const outputText = this.extractAnthropicText(response);
        const inputTokens = response.usage?.input_tokens || 0;
        const outputTokens = response.usage?.output_tokens || 0;
        const latencyMs = Number(process.hrtime.bigint() - startTime) / 1e6;
        return {
          ...baseResult,
          output: outputText,
          latency_ms: Math.round(latencyMs),
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
          cost_usd: this.calculateCost(inputTokens, outputTokens, modelConfig.cost_per_1m_tokens)
        };
      }

      if (modelConfig.provider === 'openai') {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('Missing OPENAI_API_KEY env var');
        }
        response = await this.withTimeout(
          this.openai.responses.create({
            model: modelId,
            input: [{ role: 'user', content: task.prompt }]
          }),
          timeoutMs
        );
        const outputText = this.extractOpenAIText(response);
        const inputTokens = response.usage?.input_tokens || 0;
        const outputTokens = response.usage?.output_tokens || 0;
        const latencyMs = Number(process.hrtime.bigint() - startTime) / 1e6;
        return {
          ...baseResult,
          output: outputText,
          latency_ms: Math.round(latencyMs),
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
          cost_usd: this.calculateCost(inputTokens, outputTokens, modelConfig.cost_per_1m_tokens)
        };
      }

      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    } catch (error) {
      const latencyMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      const status = error?.status || error?.response?.status;
      const isTimeout = error?.code === 'ETIMEDOUT';
      const isRateLimit = status === 429 || error?.code === 'rate_limit';
      const errorMessage = isRateLimit
        ? `Rate limit: ${error.message}`
        : isTimeout
          ? error.message
          : error.message || 'Unknown error';

      return {
        ...baseResult,
        latency_ms: Math.round(latencyMs),
        error: errorMessage,
        completed: false,
        timeout_exceeded: isTimeout
      };
    }
  }

  calculateCost(inputTokens, outputTokens, pricing) {
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return Math.round((inputCost + outputCost) * 1000000) / 1000000; // Round to 6 decimal places
  }

  // Run evaluation across all specified tasks and models
  async runEvaluation(options = {}) {
    const { taskFilter = null, modelFilter = null, runs = 1, dryRun = false } = options;
    
    const tasks = this.loadTasks(taskFilter);
    const modelsToTest = modelFilter 
      ? modelFilter.split(',').map(m => m.trim())
      : Object.keys(MODELS);
    
    console.log(`Running ${tasks.length} task(s) across ${modelsToTest.length} model(s) with ${runs} run(s) each...`);
    
    const results = [];
    
    for (const task of tasks) {
      console.log(`\\n📋 Task: ${task.name}`);
      
      for (const modelId of modelsToTest) {
        if (!MODELS[modelId]) {
          console.warn(`⚠️  Unknown model: ${modelId}`);
          continue;
        }

        for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
          try {
            const result = await this.executeTask(task, modelId, MODELS[modelId], {
              dryRun,
              runIndex
            });
            results.push(result);
          } catch (error) {
            console.error(`❌ Error running ${task.name} on ${modelId}:`, error.message);
            results.push({
              task_name: task.name,
              model_id: modelId,
              run_index: runIndex,
              error: error.message,
              completed: false
            });
          }
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
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    
    switch (flag) {
      case '--task':
        options.taskFilter = args[i + 1];
        i += 1;
        break;
      case '--models':
        options.modelFilter = args[i + 1];
        i += 1;
        break;
      case '--runs':
        options.runs = Number(args[i + 1] || 1);
        i += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Bishop Benchmark Evaluator

Usage: node run.js [options]

Options:
  --task <name>      Run specific task only
  --models <list>    Comma-separated list of models to test
  --runs <n>         Run each task N times (default 1)
  --dry-run          Skip API calls and record empty results
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

module.exports = { BishopEvaluator };
