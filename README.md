# bishop-bench

A lightweight benchmark harness for comparing LLMs on the same assistant task.

Instead of choosing models on vibes, `bishop-bench` runs the same prompt across multiple models and captures output, latency, token usage, and estimated cost so routing decisions can be grounded in evidence.

## Current status

This repo is working, but still intentionally small.

What exists now:
- task definitions in YAML
- multi-model eval runner
- JSON result capture in `results/`
- comparison/scoring script for summarizing runs
- real benchmark outputs already checked into the repo

What it is not yet:
- a polished dashboard
- a general-purpose eval platform
- a full LLM judge/evals framework

## Supported models

The current runner is wired for:
- Claude Haiku 3.5
- Claude Sonnet 4
- Claude Opus 4.6
- GPT-5.2 Codex

Model config lives in `evals/run.js`.

## Repo structure

```text
bishop-bench/
├── evals/run.js          # run tasks across one or more models
├── scoring/score.js      # summarize and compare run results
├── tasks/                # YAML task definitions
├── results/              # raw eval outputs + comparison files
└── README.md
```

## Installation

```bash
git clone https://github.com/prime3679/bishop-bench.git
cd bishop-bench
npm install
```

## Environment

Set the model keys you want to use:

```bash
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
```

The runner will error cleanly if a required key is missing for a selected model.

## Usage

Run all tasks against all configured models:

```bash
npm run eval
```

Run a specific task:

```bash
node evals/run.js --task morning-briefing
```

Run only selected models:

```bash
node evals/run.js --models claude-sonnet-4-20250514,gpt-5.2-codex
```

Dry run without calling APIs:

```bash
node evals/run.js --dry-run
```

Score the latest results:

```bash
npm run score
```

Or score a specific results file:

```bash
node scoring/score.js --results results/eval-2026-02-16T21-43-15-693Z.json
```

## Task format

Tasks live in `tasks/*.yaml`.

Example:

```yaml
name: "morning-briefing"
description: "Evaluate morning briefing quality"
prompt: "Generate a concise morning briefing..."
expected_capabilities:
  - summarization
  - prioritization
scoring_criteria:
  - completeness
  - actionability
timeout: 120
```

## Output

Each eval run writes a timestamped JSON file to `results/` with:
- model name and provider
- raw output
- latency
- input/output/total tokens
- estimated cost
- timeout/error state

The scoring script also writes a comparison JSON artifact and prints a terminal summary table.

## Why this exists

This repo came out of a practical problem inside Bishop: different assistant tasks want different models. Some need speed. Some need stronger writing. Some need coding depth. Some need lower cost. `bishop-bench` makes those tradeoffs visible.

## Roadmap

Likely next improvements:
- better task coverage
- more diagnostic scoring
- richer content-quality evaluation
- improved result visualization
- repeatable benchmark suites by task family

## License

MIT
