# Bishop Benchmark Tool

## What is this?

Bishop Benchmark is a tool that runs identical tasks across multiple LLM models and compares their quality, cost, and latency. Instead of choosing models based on vibes, make data-driven routing decisions.

## Why does this matter?

Model routing decisions should be grounded in real performance data, not intuition. Different models excel at different tasks:
- Some are better at tool calling
- Some are faster for simple queries  
- Some provide better accuracy for complex reasoning
- Cost varies dramatically between models

This benchmark helps you understand which model to use for which types of assistant tasks.

## How it works

1. **Define tasks** in YAML format in the `tasks/` directory
2. **Run evaluations** across multiple models using the eval runner
3. **Compare results** with standardized metrics and scoring
4. **Get a comparison table** showing performance across all dimensions

### Supported Models
- `anthropic/claude-haiku` - Fast and economical
- `anthropic/claude-sonnet` - Balanced performance
- `anthropic/claude-opus` - Maximum capability  
- `openai/gpt-5.3-codex` - Code-focused tasks

## Planned Metrics

- **Tool-call accuracy** - How often the model calls the right tools with correct parameters
- **Hallucination rate** - Frequency of factual errors or made-up information
- **Cost per correct outcome** - Economic efficiency for successful task completion
- **Latency** - Time to first token and total completion time
- **Task completion rate** - Percentage of tasks completed successfully

## Installation

```bash
git clone https://github.com/prime3679/bishop-bench.git
cd bishop-bench
npm install
```

## Usage

```bash
# Run all tasks against all models
node evals/run.js

# Run specific task
node evals/run.js --task morning-briefing

# Run against specific models
node evals/run.js --models claude-sonnet,claude-opus

# Compare results
node scoring/score.js --results results/latest/
```

## Task Format

Tasks are defined in YAML with this structure:

```yaml
name: "task-name"
description: "What this task tests"
prompt: "The actual prompt to send to models"
expected_capabilities: 
  - web_search
  - calendar_read  
  - email_read
scoring_criteria:
  - completeness
  - accuracy
  - formatting
  - actionability
timeout: 120  # seconds
```

## Status

🚧 **Early Development** 🚧

This tool is actively being built. Current features:
- [ ] Basic eval runner framework
- [ ] Task definition format
- [ ] Model integrations
- [ ] Scoring algorithms
- [ ] Result comparison
- [ ] Web dashboard

## Contributing

This is an experimental tool for model routing research. Contributions welcome!

## License

MIT