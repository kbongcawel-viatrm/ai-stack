---
name: ollama-llm-training
description: Prepare, adapt, evaluate, and package local LLMs for Ollama while distinguishing model training from Modelfile configuration.
---

# Ollama LLM adaptation and evaluation

## Scope clarification
Ollama primarily manages and runs models. A Modelfile configures a model package; it does not train new weights. For weight fine-tuning, use an appropriate training framework and hardware, then import the resulting supported artifact into Ollama.

## Workflow
1. Define the task, target users, measurable quality criteria, latency, context size, hardware/RAM/VRAM budget, and privacy constraints.
2. Select a base model whose license, capabilities, language support, and quantization meet requirements. Record exact model/version and license.
3. Prepare a lawful, permissioned, task-relevant dataset. Remove secrets and personal data; deduplicate; inspect quality; split train/validation/test before training.
4. Establish a baseline on a held-out evaluation set before adapting the model.
5. Decide whether prompting, a Modelfile/system prompt, retrieval-augmented generation, or fine-tuning best fits the problem. Prefer the least costly method that meets acceptance criteria.
6. For fine-tuning, use a compatible framework and method (for example, LoRA/QLoRA where supported), record hyperparameters and seed, monitor overfitting, and preserve the original base model.
7. Evaluate against the same held-out set and adversarial/edge cases. Measure task accuracy, hallucination rate, refusal/safety behavior, latency, memory use, and regressions.
8. Package a supported artifact with an Ollama Modelfile; set model template/system prompt and context parameters deliberately.
9. Run `ollama create`, `ollama run`, and API smoke tests using the installed Ollama version's documented commands. Keep model artifacts and datasets out of Git unless intentionally licensed and sized for source control.
10. Document reproducibility, license, dataset lineage, limitations, benchmark results, rollback path, and intended deployment.

## Safety and data governance
Never train on confidential or unlicensed data without authorization. Do not put sensitive examples into model logs or benchmark reports. Treat model outputs as untrusted and evaluate prompt-injection resistance for tool-using models.

## References
- https://docs.ollama.com/
- https://github.com/ollama/ollama/blob/main/docs/modelfile.md


## Upstream sources
- https://github.com/ollama/ollama
- https://docs.ollama.com/
- Shared index: [GitHub repository sources](../../sources/github-repositories.md). Verify the upstream version against the target deployment before relying on examples.
