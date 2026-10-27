---
name: python-development
description: Write, refactor, test, and package maintainable Python automation and services.
---

# Python development skill

## Workflow
1. Inspect the project's Python version, packaging tool, dependency lockfile, style, and test conventions before changing anything.
2. Define API contracts, input/output types, error handling, side effects, and compatibility requirements.
3. Prefer standard-library solutions unless an external dependency provides clear value. Pin or constrain dependencies using the project's established workflow.
4. Use functions with explicit responsibilities, type hints for public interfaces, meaningful names, and clear docstrings where useful.
5. Validate external input; avoid shelling out when a library is safer. When invoking subprocesses, pass argument arrays, set timeouts, check return codes, and avoid `shell=True` for untrusted input.
6. Keep secrets in environment/secret stores, not source code, fixtures, exceptions, or logs. Avoid logging sensitive payloads.
7. Add unit tests for normal, boundary, malformed, and failure cases. Mock external APIs and destructive operations.
8. Use context managers for resources, deterministic cleanup, and explicit timeouts/retries for I/O.
9. Handle exceptions narrowly; do not silently swallow failures or use broad catch-all logic without a clear recovery policy.
10. Document installation, configuration, usage, test commands, and operational assumptions.

## Validation
Run the project's formatter, linter, type checker, and test suite where configured. Otherwise use `python -m compileall`, targeted `unittest`/pytest tests, and a CLI smoke test as applicable. Check dependency vulnerabilities where tooling exists. Report exact commands and results.

## Security
Avoid unsafe deserialization such as untrusted pickle, dynamic code execution, insecure temporary files, path traversal, and SSRF. Treat subprocess output, files, network responses, and model output as untrusted input.


## Upstream sources
- https://github.com/python/cpython
- https://github.com/astral-sh/uv
- https://github.com/pytest-dev/pytest
- See the shared registry for worker-framework-specific sources; confirm which “Python worker” project is intended.
- Shared index: [GitHub repository sources](../../sources/github-repositories.md). Verify the upstream version against the target deployment before relying on examples.
