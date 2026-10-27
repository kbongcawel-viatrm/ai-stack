---
name: container-tuning
description: Measure and tune container CPU, memory, PIDs, storage, networking, and logging for reliable resource use.
---

# Container performance tuning

## Baseline first
Record workload, traffic, latency/error targets, host capacity, competing workloads, image/version, runtime/cgroup settings, and current limits. Collect time-series or repeated measurements; a single snapshot is not a reliable baseline.

## Tuning process
1. Measure CPU, memory, PIDs, I/O, network, restarts, throttling, OOM events, queue depth, and application latency.
2. Distinguish workload demand from leaks, excessive concurrency, inefficient queries, oversized buffers, and telemetry overhead.
3. Change one variable at a time and retain the previous settings for rollback.
4. Set memory limits above observed working set plus justified headroom, but below the host budget; account for page cache, sidecars, and kernel memory where relevant.
5. Set CPU quota/weight based on latency and throughput goals. Watch throttling and avoid assuming more CPU quota always improves performance.
6. Limit PIDs and file descriptors when appropriate; ensure limits do not break legitimate worker/thread counts.
7. Size application queues and logging buffers against expected bursts, destination outage duration, and available disk. Define backpressure and data-loss behavior.
8. Check persistent storage latency, filesystem capacity, inode pressure, and log growth. Never prune volumes or container storage blindly.
9. Validate under representative load and failure scenarios; compare baseline versus candidate using the same metrics.
10. Document chosen limits, rationale, tested workload, results, and rollback command.

## Podman-specific checks
Use `podman stats --all --no-stream`, `podman inspect`, and host cgroup metrics. Verify actual cgroup enforcement and rootless behavior. Ensure the total of configured limits leaves headroom for the host and other services. Do not tune solely from theoretical limits or a single short run.

## Acceptance criteria
State target metrics and thresholds before tuning. A change is accepted only when tests show improvement without unacceptable errors, data loss, restarts, or host pressure.
