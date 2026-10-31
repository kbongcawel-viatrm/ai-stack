# Reusable workflows and automation packages

This directory contains reusable automation projects that can be consumed or maintained independently of the repository's core infrastructure.

## PHP patch automation

The `php-patch-automation/` package provides multi-cloud PHP inventory, policy validation, and guarded patch orchestration.

- Project documentation: [PHP patch automation README](php-patch-automation/README.md)
- Python package and tests: `php-patch-automation/src/` and `php-patch-automation/tests/`
- Module workflow and dependency configuration: `php-patch-automation/.github/`

Run the project from the repository root:

```bash
cd reusable-workflows/php-patch-automation
make install
make validate
make discover-fixtures
```
