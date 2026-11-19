---
name: google-harness2
description: Understand, operate, and safely modify the Google Harness² repository: its recursive agent-harnessing workflow, benchmark adapters, OpenCode/Codex substrates, CLI, evaluation, and documentation.
---

# Google Harness² repository skill

Use this skill when exploring or changing this repository, explaining Harness²,
running its benchmark workflow, or investigating a regression in refinement,
execution, evaluation, or reporting.

## Project identity

This repository is Harness², a Python framework for recursively improving an
agent's execution harness while keeping model weights fixed. It is not itself a
general-purpose coding agent or a Google-supported product. A harness is the
system around a model—such as prompts, guardrails, memory, tool guidance,
subagents, skills, scripts, and plugins.

The system has two recursion levels:

1. **Task-level recursion:** Propose–Probe–Compose. Propose candidate harness
   edits, probe them by executing the same task, then compose a refined harness
   using behavioral contrasts and execution evidence rather than benchmark
   ground truth.
2. **Harnessing-level recursion:** after adoption, reflect on the refined harness
   and its evidence; retain evidence-supported lessons in a domain library for
   later tasks.

The released benchmark adapters are JobBench (`jb`), LAB (`lab`), and
WorkBuddy-Bench (`wb`). OpenCode is the default substrate; Codex is selected with
`--substrate cx`. Recursion supports `parallel` and `sequential` modes.

## Repository map

- `harness2/core/`: research and workflow logic—recursion, proposals, context,
  evidence ledger/library, scheduling, selection, judging, and reporting.
- `harness2/benchmarks/`: benchmark-specific task discovery, execution, and
  grading integration. Preserve boundaries between shared core logic and
  benchmark-specific behavior.
- `harness2/substrate/`: OpenCode and Codex executor integrations.
- `harness2/cli/`: command-line entry points and common argument/config helpers.
- `harness2/config.py`, `harness2/preflight.py`, `harness2/install.py`: runtime
  configuration, preflight checks, and setup behavior.
- `third_party/`: derived benchmark runners, overlays, compatibility patches,
  provenance, and license notices. Treat changes here as provenance/license-
  sensitive; consult `third_party/README.md` and `dependencies/README.md`.
- `tests/`: unit and workflow regressions, including fixtures for upstream
  benchmark integrations.
- `docs/`: setup, benchmark, and experiment guides. Keep operational guidance
  consistent with the CLI and implementation.

## Working on this repository

1. Read the relevant implementation, nearby tests, and applicable documentation
   before editing. Locate CLI flags and defaults in `harness2/cli/` and shared
   behavior in `harness2/core/` before changing an adapter.
2. Preserve established design constraints:
   - Do not give improvers benchmark answers, rubrics, or verifier output as
     evidence; inspect the adapter and experiment guidance before changing what
     each stage can see.
   - Keep failed or incomplete evaluations unscored; do not silently convert
     them to zero.
   - Preserve run identity, resume safety, task-input identity, and isolation
     between benchmark rollouts.
   - Treat model-backed runs as potentially costly. Prefer dry runs, narrow task
     selections, and preflight checks before launching them.
   - Consider executor network access and benchmark answer leakage. The release
     does not restrict executor egress; follow `docs/EXPERIMENTS.md` for
     evaluation safeguards.
   - Avoid checking credentials or generated benchmark data into version
     control. Respect third-party licenses and provenance.
3. Add or update focused tests for behavior changes. Follow the existing
   `unittest`-style tests and fixture patterns.
4. Run relevant tests, then the full test suite when practical:

   ```bash
   python -m unittest discover -s tests
   ```

   For packaging/style checks, use project-available tooling and the settings
   in `pyproject.toml` (Ruff targets Python 3.12, 100 columns). Do not assume
   optional benchmark environments or credentials are installed.
5. For documentation changes, check commands and flags against the current CLI
   and guides. Use absolute paths when reporting files to the user.

## Benchmark operation reference

The normal model-backed lifecycle is:

```bash
harness2-setup <lab|jb|wb>
harness2-check --bench <lab|jb|wb>
harness2 --bench <lab|jb|wb> --k 1 --mode parallel
harness2-judge --bench <lab|jb|wb> --k 1 --mode parallel
harness2-report --bench <lab|jb|wb> --k 1 --mode parallel
```

For WorkBuddy, select a subset when desired, for example
`--subset office`. Use `--substrate cx` consistently if running on Codex.
Keep benchmark, subset, substrate, `k`, mode, and relevant seed consistent
between refinement, judging, and reporting. Use a separate
`HARNESS2_RUNS_DIR` when changing models or task selection. `--max-tasks` is per
domain, not a whole-run cap; check `--help` and `docs/EXPERIMENTS.md` before
constructing commands.

Do not start a full benchmark run merely to validate a code change. Prefer unit
tests, dry-run/task-selection options, and the demo path when appropriate. A
real run can incur model costs and may require external benchmark installs,
credentials, Docker, or network configuration.

## Source of truth

Repository code and checked-in docs are authoritative for this checkout. When
details conflict, verify against the relevant CLI and adapter implementation,
then correct the documentation or call out the discrepancy; do not rely on
remembered Harness² behavior. External benchmark source and data retain their
own versioning and license terms.