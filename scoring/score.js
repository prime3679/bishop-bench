#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class BishopScorer {
  constructor() {
    this.resultsDir = path.join(__dirname, '..', 'results');
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

  // Calculate scoring metrics for a single result
  scoreResult(result, task) {
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
      
      // TODO: Add more sophisticated scoring
      // - Content quality (would need LLM-as-judge)
      // - Hallucination detection
      // - Task-specific accuracy metrics
      quality_score: 0.5 // Placeholder - needs implementation
    };
    
    return scores;
  }

  // Generate comparison table across models and tasks
  generateComparison(results) {
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

    // Calculate per-task averages
    for (const [taskName, taskResults] of Object.entries(taskGroups)) {
      const taskScores = taskResults.map(r => this.scoreResult(r));
      comparison.by_task[taskName] = this.aggregateScores(taskScores);
    }

    // Calculate per-model averages  
    for (const [modelId, modelResults] of Object.entries(modelGroups)) {
      const modelScores = modelResults.map(r => this.scoreResult(r));
      comparison.by_model[modelId] = this.aggregateScores(modelScores);
    }

    // Overall summary
    const allScores = results
      .filter(r => r.completed || r.error)
      .map(r => this.scoreResult(r));
    comparison.summary = this.aggregateScores(allScores);

    return comparison;
  }

  // Aggregate scores across multiple results
  aggregateScores(scoresList) {
    if (scoresList.length === 0) return {};
    
    const aggregated = {};
    const keys = Object.keys(scoresList[0]);
    
    for (const key of keys) {
      const values = scoresList.map(s => s[key]).filter(v => typeof v === 'number' && !isNaN(v));
      if (values.length > 0) {
        aggregated[`${key}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
        aggregated[`${key}_min`] = values.reduce((min, v) => (v < min ? v : min), values[0]);
        aggregated[`${key}_max`] = values.reduce((max, v) => (v > max ? v : max), values[0]);
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
    const comparison = this.generateComparison(results);
    
    // Save detailed comparison
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const comparisonFile = path.join(this.resultsDir, `comparison-${timestamp}.json`);
    await fs.promises.writeFile(comparisonFile, JSON.stringify(comparison, null, 2));
    
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
  
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--results':
        options.resultsFile = value;
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
    }
  }
  
  const scorer = new BishopScorer();
  await scorer.scoreResults(options);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BishopScorer };
