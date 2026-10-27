---
name: fluent-bit-generator
description: Generate maintainable Fluent Bit input, parser, filter, and output configurations for logs and metrics pipelines.
---

# Fluent Bit configuration generator

## Required context
Determine Fluent Bit version, deployment mode (systemd, Podman, Kubernetes), input sources, output destination, data format, expected volume, retention, and secrets policy. Ask for missing details if they change the config materially; otherwise state assumptions.

## Design process
1. Map sources to inputs and identify file paths, tags, systemd units, socket endpoints, or forward receivers.
2. Define parser and timestamp behavior explicitly. Preserve original timestamps where reliable and normalize time zones.
3. Design tag naming and routing before filters. Prefer explicit match patterns over catch-all routing.
4. Add filters only for a stated need: parsing, enrichment, field removal, redaction, multiline handling, or record modification. Avoid unnecessary duplicate parsing.
5. Configure each output with the correct endpoint, TLS verification, authentication source, retry behavior, and required labels/streams.
6. Set buffering and storage behavior intentionally: memory limits, filesystem buffering, storage path, chunk limits, and backpressure policy.
7. Keep credentials in environment variables or mounted secret files, not committed config. Avoid logging authorization headers or sensitive payloads.
8. Generate modular files when supported by the target version; document include order and dependencies.
9. Include comments for non-obvious choices and a data-flow summary.

## Deliverables
- Fluent Bit config compatible with the declared version.
- Required parser files and environment-variable example with placeholders only.
- Input → parser/filter → output routing table.
- Resource/buffer assumptions and deployment notes.
- Validation commands and representative sample records.

## Validation
- Confirm plugin names and options against official docs for the deployed version.
- Run the Fluent Bit native config validation/test command supported by that version, then inspect startup logs.
- Test each input, route, parser, TLS/auth path, and output independently in a non-production environment.
- Check for loops, duplicate ingestion, dropped records, timestamp errors, and unbounded buffers.
- Never invent a plugin option or claim the config is valid without a real validator result.

## References
- https://docs.fluentbit.io/manual/
