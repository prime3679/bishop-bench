#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const OpenAI = require('openai');

class BishopScorer {
  constructor() {
    this.resultsDir = path.join(__dirname, '..', 'results');
    this.tasksDir = path.join(__dirname, '..', 'tasks');
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
  }

  // Load evaluation results from JSON file
  loadResults(resultFile) {
    if (!fs.existsSync(resultFile)) {
      throw new Error(`Results file not found: ${resultFile}`);
    }
    
    const content = fs.readFileSync(resultFile, 'utf8');
    return JSON.parse(content);
  }

  // Find the most recent results file if no specific file provided
  getLatestResults() {
    const files = fs.readdirSync(this.resultsDir)
      .filter(file => file.startsWith('eval-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      throw new Error('No evaluation results found. Run an evaluation first.');
    }
    
    return path.join(this.resultsDir, files[0]);
  }

  // Load task definitions from YAML files
  loadTasks() {
    const taskFiles = fs.readdirSync(this.tasksDir)
      .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

    const tasksMap = {};
    for (const file of taskFiles) {
      const taskPath = path.join(this.tasksDir, file);
      const content = fs.readFileSync(taskPath, 'utf8');
      const task = yaml.load(content);
      tasksMap[task.name] = task;
    }

    return tasksMap;
  }

  async evaluateContentQuality(task, result) {
    if (!this.openai || !task) return null;

    const prompt = `You are an expert judge evaluating the quality of an AI response.
Task: ${task.description}
Prompt: ${task.prompt}
Criteria: ${task.scoring_criteria ? task.scoring_criteria.join(', ') : 'completeness, accuracy, formatting'}

Response:
${result.output}

Rate the quality on a scale of 0.0 to 1.0 based on the criteria.
Return ONLY a valid JSON object with:
{
  "score": <float 0.0-1.0>,
  "reasoning": "<short explanation>"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0
      });
      const parsed = JSON.parse(completion.choices[0].message.content);
      return parsed.score;
    } catch (e) {
      console.warn(`Quality evaluation failed: ${e.message}`);
      return null;
    }
  }

  async detectHallucinations(task, result) {
    if (!this.openai || !task) return null;

    const prompt = `You are an expert fact-checker. Detect any hallucinations in the AI response.
Task: ${task.description}
Prompt: ${task.prompt}

Response:
${result.output}

Does the response contain any hallucinated information, made-up facts, or content not supported by the prompt/context (if applicable)?
Return ONLY a valid JSON object with:
{
  "hallucination_score": <float 0.0 (no hallucinations) to 1.0 (severe hallucinations)>,
  "reasoning": "<short explanation>"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0
      });
      const parsed = JSON.parse(completion.choices[0].message.content);
      return parsed.hallucination_score;
    } catch (e) {
      console.warn(`Hallucination detection failed: ${e.message}`);
      return null;
    }
  }

  async evaluateTaskAccuracy(task, result) {
    if (!this.openai || !task) return null;

    const prompt = `You are an expert judge. Check if the AI response strictly follows the instructions.
Task: ${task.description}
Prompt: ${task.prompt}
Expected Capabilities: ${task.expected_capabilities ? task.expected_capabilities.join(', ') : 'N/A'}

Response:
${result.output}

Does the response strictly follow all instructions and requirements?
Return ONLY a valid JSON object with:
{
  "accuracy_score": <float 0.0 (failed) to 1.0 (perfect)>,
  "reasoning": "<short explanation>"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0
      });
      const parsed = JSON.parse(completion.choices[0].message.content);
      return parsed.accuracy_score;
    } catch (e) {
      console.warn(`Accuracy evaluation failed: ${e.message}`);
      return null;
    }
  }

  // Calculate scoring metrics for a single result
  async scoreResult(result, task) {
    const scores = {
      completion_rate: result.completed ? 1.0 : 0.0,
      error_rate: result.error ? 1.0 : 0.0,
      timeout_rate: result.timeout_exceeded ? 1.0 : 0.0,
      
      // Tool usage effectiveness
      tool_success_rate: result.tools_called?.length > 0 
        ? result.tools_successful / result.tools_called.length 
        : 0.0,
      
      // Performance metrics
      latency_ms: result.latency_ms || 0,
      cost_usd: result.cost_usd || 0,
      tokens_per_second: result.latency_ms > 0 
        ? (result.output_tokens || 0) / (result.latency_ms / 1000) 
        : 0,
      
      // Efficiency metrics
      cost_per_token: result.output_tokens > 0 
        ? result.cost_usd / result.output_tokens 
        : 0,
      
      // Sophisticated scoring
      quality_score: 0.5, // Placeholder/Default
      hallucination_score: 0.0, // Default (optimistic)
      accuracy_score: 0.0 // Default
    };

    if (this.openai && task && result.output) {
      const [quality, hallucination, accuracy] = await Promise.all([
        this.evaluateContentQuality(task, result),
        this.detectHallucinations(task, result),
        this.evaluateTaskAccuracy(task, result)
      ]);

      if (quality !== null) scores.quality_score = quality;
      if (hallucination !== null) scores.hallucination_score = hallucination;
      if (accuracy !== null) scores.accuracy_score = accuracy;
    }
    
    return scores;
  }

  // Generate comparison table across models and tasks
  async generateComparison(results, tasksMap = {}) {
    const comparison = {
      summary: {},
      by_task: {},
      by_model: {},
      detailed: results
    };

    // Group results by task and model
    const taskGroups = {};
    const modelGroups = {};
    
    for (const result of results) {
      if (!result.completed && !result.error) continue;
      
      const taskName = result.task_name;
      const modelId = result.model_id;
      
      if (!taskGroups[taskName]) taskGroups[taskName] = [];
      if (!modelGroups[modelId]) modelGroups[modelId] = [];
      
      taskGroups[taskName].push(result);
      modelGroups[modelId].push(result);
    }

    // Pre-calculate scores for all results with batching
    const scoresMap = new Map();
    const batchSize = 5;

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      await Promise.all(batch.map(async (r) => {
        if (!r.completed && !r.error) return;
        const task = tasksMap[r.task_name];
        const score = await this.scoreResult(r, task);
        scoresMap.set(r, score);
      }));
    }

    // Calculate per-task averages
    for (const [taskName, taskResults] of Object.entries(taskGroups)) {
      const taskScores = taskResults.map(r => scoresMap.get(r)).filter(Boolean);
      comparison.by_task[taskName] = this.aggregateScores(taskScores);
    }

    // Calculate per-model averages  
    for (const [modelId, modelResults] of Object.entries(modelGroups)) {
      const modelScores = modelResults.map(r => scoresMap.get(r)).filter(Boolean);
      comparison.by_model[modelId] = this.aggregateScores(modelScores);
    }

    // Overall summary
    const allScores = results
      .filter(r => (r.completed || r.error) && scoresMap.has(r))
      .map(r => scoresMap.get(r));
    comparison.summary = this.aggregateScores(allScores);

    return comparison;
  }

  // Aggregate scores across multiple results
  aggregateScores(scoresList) {
    if (scoresList.length === 0) return {};
    
    const aggregated = {};
    const keys = Object.keys(scoresList[0]);
    
    for (const key of keys) {
      // Single pass calculation for sum, min, max
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      let count = 0;

      for (const s of scoresList) {
        const v = s[key];
        if (typeof v === 'number' && !isNaN(v)) {
          sum += v;
          if (v < min) min = v;
          if (v > max) max = v;
          count++;
        }
      }

      if (count > 0) {
        aggregated[`${key}_avg`] = sum / count;
        aggregated[`${key}_min`] = min;
        aggregated[`${key}_max`] = max;
      }
    }
    
    return aggregated;
  }

  // Format results as a readable table
  formatTable(comparison) {
    let output = "\\n📊 BISHOP BENCHMARK RESULTS\\n";
    output += "=" + "=".repeat(50) + "\\n\\n";

    // Model comparison table
    output += "🤖 MODEL PERFORMANCE SUMMARY\\n";
    output += "-".repeat(80) + "\\n";
    output += sprintf("%-25s %8s %8s %10s %8s\\n", 
      "Model", "Success%", "AvgCost", "AvgLatency", "Tokens/s");
    output += "-".repeat(80) + "\\n";

    for (const [modelId, scores] of Object.entries(comparison.by_model)) {
      const successRate = ((scores.completion_rate_avg || 0) * 100).toFixed(1);
      const avgCost = (scores.cost_usd_avg || 0).toFixed(4);
      const avgLatency = (scores.latency_ms_avg || 0).toFixed(0);
      const tokensPerSec = (scores.tokens_per_second_avg || 0).toFixed(1);
      
      output += sprintf("%-25s %7s%% $%7s %8sms %7s\\n",
        modelId.substring(0, 25), successRate, avgCost, avgLatency, tokensPerSec);
    }

    output += "\\n";

    // Task difficulty analysis
    output += "📋 TASK DIFFICULTY ANALYSIS\\n";
    output += "-".repeat(60) + "\\n";
    output += sprintf("%-20s %12s %12s\\n", "Task", "Avg Success%", "Avg Cost");
    output += "-".repeat(60) + "\\n";

    for (const [taskName, scores] of Object.entries(comparison.by_task)) {
      const successRate = ((scores.completion_rate_avg || 0) * 100).toFixed(1);
      const avgCost = (scores.cost_usd_avg || 0).toFixed(4);
      
      output += sprintf("%-20s %11s%% $%10s\\n",
        taskName.substring(0, 20), successRate, avgCost);
    }

    return output;
  }

  // Main scoring function
  async scoreResults(options = {}) {
    const { resultsFile = null } = options;
    
    const resultPath = resultsFile || this.getLatestResults();
    console.log(`📊 Analyzing results from: ${path.basename(resultPath)}`);
    
    const results = this.loadResults(resultPath);
    const tasksMap = this.loadTasks();
    const comparison = await this.generateComparison(results, tasksMap);
    
    // Save detailed comparison
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const comparisonFile = path.join(this.resultsDir, `comparison-${timestamp}.json`);
    fs.writeFileSync(comparisonFile, JSON.stringify(comparison, null, 2));
    
    // Display summary table
    console.log(this.formatTable(comparison));
    console.log(`\\n📁 Detailed comparison saved to: ${path.basename(comparisonFile)}`);
    
    return comparison;
  }
}

// Simple sprintf implementation for table formatting
function sprintf(format, ...args) {
  let i = 0;
  return format.replace(/%[sd%]/g, (match) => {
    if (match === '%%') return '%';
    if (i >= args.length) return match;
    const arg = args[i++];
    return match === '%s' ? String(arg) : match === '%d' ? Number(arg) : arg;
  });
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--results':
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          options.resultsFile = args[i + 1];
          i++; // Consume the value
        } else {
          console.error('Error: --results requires a file path argument');
          process.exit(1);
        }
        break;
      case '--help':
        console.log(`
Bishop Benchmark Scorer

Usage: node score.js [options]

Options:
  --results <file>   Score specific results file
  --help             Show this help message

Examples:
  node score.js                           # Score latest results
  node score.js --results eval-2025-02-16.json
        `);
        return;
      default:
        console.warn(`Warning: Unknown argument "${arg}" ignored`);
    }
  }
  
  const scorer = new BishopScorer();
  await scorer.scoreResults(options);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BishopScorer };