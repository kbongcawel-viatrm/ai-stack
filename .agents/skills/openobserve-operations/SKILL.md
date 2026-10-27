---
name: openobserve-operations
description: Configure, integrate, operate, and troubleshoot OpenObserve for logs, metrics, traces, dashboards, and alerting.
---

# OpenObserve operations

## Discovery
Identify OpenObserve version/deployment, storage backend, authentication mode, organization, stream names/types, retention, ingest protocols, and whether this is development or production. Never assume endpoint paths or feature availability without checking the deployed version.

## Setup and integration
1. Define the telemetry contract: source, event schema, timestamp, severity, resource/service identity, labels, and sensitive fields.
2. Choose ingestion method (for example, OTLP, Fluent Bit, or supported HTTP ingestion) based on source compatibility and documented capabilities.
3. Configure agents with explicit endpoint, TLS verification, authentication via secrets, retry/backoff, and buffering.
4. Separate streams by signal and operational purpose; avoid high-cardinality labels that increase storage and query cost.
5. Establish retention, partitioning/index strategy, access controls, dashboards, and alert thresholds before high-volume rollout.
6. Verify timestamps/time zones and field types. Use consistent service/host identifiers across sources.
7. Build dashboards around actionable SLOs and operational questions, not merely volume of charts.
8. Test ingestion, query, alert evaluation, notification delivery, and recovery from a temporary destination outage.

## Troubleshooting
Inspect agent logs first, then network/DNS/TLS/auth, endpoint and organization, stream naming, payload schema, timestamp parsing, retries/buffers, and OpenObserve ingest/query errors. Distinguish ingest success from data being visible in the expected stream and query window.

## Security and operations
Use TLS and scoped credentials, rotate tokens, apply least privilege, and redact sensitive data before ingestion. Never expose admin endpoints publicly without explicit controls. Test backup/restore and retention deletion in a non-production environment.

## Deliverables
Provide version-specific configuration, data-flow map, example event, validation commands, expected query, dashboards/alerts, capacity assumptions, and rollback steps.

## References
- https://openobserve.ai/docs/
- https://opentelemetry.io/docs/collector/
