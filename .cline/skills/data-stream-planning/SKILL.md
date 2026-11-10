---
name: data-stream-planning
description: Design end-to-end log, metric, and trace pipelines with clear schemas, routing, buffering, reliability, security, and cost controls.
---

# Data stream planning

## Requirements
Identify producers, signal types, throughput (average and peak), event size, burst profile, latency target, retention, delivery guarantees, consumer needs, regulatory constraints, and failure recovery objectives.

## Plan
1. Draw the source → collector/agent → processor → transport/buffer → destination → query/alert path.
2. Define a versioned event contract: timestamp/time zone, severity, host/service identity, trace/correlation IDs, field types, schema evolution, and redaction requirements.
3. Establish routing rules and ownership. Define which streams receive which event classes, and how malformed or unknown events are handled.
4. Estimate volume: events/second × average bytes/event × seconds/day, then apply measured compression, indexing overhead, replication, and retention. Mark estimates and assumptions explicitly.
5. Choose buffer placement, persistence, queue capacity, retry/backoff, dead-letter handling, and backpressure policy. State what happens during destination outage and disk exhaustion.
6. Design idempotency/deduplication where needed. Clarify whether delivery is best-effort, at-least-once, or another supported guarantee; never promise exactly-once without end-to-end proof.
7. Set TLS, authentication, authorization, secret rotation, network boundaries, and sensitive-field redaction at the earliest safe point.
8. Define cardinality controls, sampling, retention tiers, and query/index strategy to manage cost.
9. Plan observability for the pipeline itself: input/output counts, dropped/retried records, queue depth, processing latency, destination errors, and collector resource usage.
10. Create a staged rollout, replay/backfill plan, canary checks, rollback steps, ownership, and operational runbook.

## Required deliverables
- Architecture/data-flow diagram or text flow.
- Stream inventory with source, schema, routing, destination, volume, retention, owner, and sensitivity.
- Capacity assumptions and buffer/outage calculations.
- Failure-mode matrix and alerting plan.
- Security review and validation checklist.
- Rollout and rollback plan.

## Integration notes
When using Fluent Bit, validate the exact plugin/config options for the deployed version. When using OpenObserve or OTLP, verify endpoint, auth, stream/resource semantics, and timestamp behavior against the deployed versions. Avoid high-cardinality labels and never include secrets in event attributes.
