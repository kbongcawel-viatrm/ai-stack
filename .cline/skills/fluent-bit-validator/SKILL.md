---
name: fluent-bit-validator
description: Validate Fluent Bit configurations, parsers, routing, delivery behavior, and resource safety before deployment.
---

# Fluent Bit configuration validator

## Inputs
Obtain the exact config files, Fluent Bit version/build, launch command, container/systemd context, and target outputs. Do not validate a different config path than the one deployed.

## Validation sequence
1. Check file existence, permissions, include paths, environment-variable expansion, and secret-file mounts.
2. Identify version-specific plugins and options using the official documentation for that version.
3. Run the binary's supported config-test/validation mode (check `fluent-bit --help` and version docs; do not assume flags are identical across releases).
4. Start a test instance in isolation and capture startup errors. Do not replace the production service or send test data to production outputs without approval.
5. Send representative valid, malformed, multiline, missing-field, and timestamp-edge-case records through the pipeline.
6. Verify tags, parser output, filter order, routing matches, output acknowledgements, retries, and end-to-end delivery.
7. Test failure modes: unavailable destination, expired/invalid credentials, TLS failure, disk full, and backpressure where safe.
8. Review memory limits, filesystem buffering, chunk limits, storage path capacity, and restart recovery.
9. Compare input and output counts to detect drops, duplicates, and routing gaps. Check service/container logs and Fluent Bit metrics.
10. Record pass/fail per check, evidence, environment, version, and unresolved risks.

## Security checks
- No tokens, passwords, or private keys in tracked files or logs.
- TLS certificate verification stays enabled unless an explicitly approved, time-bounded exception exists.
- Inputs are not unintentionally exposed on public interfaces.
- Filters redact credentials and sensitive fields before external output.

## Output format
Summarize configuration identity/version, checks executed, results, evidence, failures, data-loss risks, and deployment recommendation. Distinguish static inspection from runtime-tested validation.
