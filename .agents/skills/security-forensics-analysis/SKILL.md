---
name: security-forensics-analysis
description: Conduct evidence-preserving host, container, network, and log triage with defensible findings and safe containment.
---

# Security forensics and analysis

## Rules of engagement
Confirm authorization, scope, incident owner, time zone, and permitted collection actions. Preserve evidence before remediation when safe. Do not access systems or data outside approved scope.

## Triage
1. Establish a timeline and record host identity, OS/kernel, collection time, time source, analyst, and tool versions.
2. Prefer read-only collection. Capture relevant systemd/journal logs, audit logs, authentication events, process/socket listings, persistence mechanisms, package changes, container state, network telemetry, and relevant hashes.
3. Preserve original evidence, metadata, and timestamps. Hash collected files (e.g. SHA-256), record collection commands and errors, and store copies in access-controlled, integrity-protected locations.
4. Correlate journal/audit/auth logs, firewall and IDS events, DNS/network flows, container logs, and external indicators. Account for clock skew, log rotation, missing data, and normal maintenance.
5. Separate observed facts, inferences, hypotheses, and unknowns. Record confidence and alternative explanations; do not label a host compromised based on a single weak indicator.
6. Establish scope and impact: affected accounts, processes, hosts, containers, data paths, outbound connections, and persistence evidence.
7. Recommend proportionate containment only within authorization. Avoid rebooting, deleting files, killing processes, flushing logs, or modifying firewall rules before assessing evidence and business impact unless urgent containment is approved.
8. Preserve chain of custody: who collected, when, from where, tool/command, hashes, transfers, and every handling step.
9. Produce a concise report with executive summary, timeline, evidence, findings, confidence, impact, containment, recovery, and follow-up controls.

## Safe analysis
- Do not execute suspicious binaries or open unknown files on production hosts.
- Use isolated analysis environments and trusted tooling.
- Treat IOC matches as leads, not proof.
- Redact credentials, tokens, personal data, and unrelated user information in reports.
- Keep evidence read-only where possible and do not upload sensitive artifacts to public services without authorization.

## Fedora / container context
For systemd hosts, use read-only journal and audit inspection first. For Podman, distinguish rootless and rootful contexts and preserve container inspect data, image digests, logs, mounts, and events. Do not disable SELinux or security controls as a triage shortcut.
