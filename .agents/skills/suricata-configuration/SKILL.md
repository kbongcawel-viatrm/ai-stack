---
name: suricata-configuration
description: Configure, validate, troubleshoot, and safely operate Suricata IDS/IPS, rules, capture interfaces, and EVE logs on Linux.
---

# Suricata configuration and operations

## Discover and establish scope
- Read the shared [upstream source registry](../../sources/github-repositories.md) and the official, version-matched Suricata User Guide.
- Inspect the installed version and package layout before suggesting paths or options:
  `suricata --build-info`, `suricata -V`, `rpm -q suricata`, `systemctl status suricata`.
- Confirm IDS/passive monitoring versus inline IPS, interface(s), HOME_NET, rule sources, log consumers, memory budget, and maintenance window.
- Do not switch to inline/drop mode or change firewall/NIC settings without explicit authorization and a rollback plan.

## Configuration workflow
1. Discover interfaces and addresses: `ip -br addr`, `ip route`, `sudo suricata --list-runmodes`.
2. Inspect actual config and rule paths; distro packages commonly use `/etc/suricata/suricata.yaml`, but verify the package.
3. Check that each AF_PACKET interface name exactly matches a real interface. Never assume `eth0`; use `ip -br link`.
4. Verify HOME_NET, capture mode, thread/queue settings, rule-files list, default-rule-path, EVE outputs, permissions, and log rotation.
5. Check rules exist and are readable. Prefer explicit rule file entries over an assumed wildcard unless the installed version and loader explicitly support it.
6. Validate before restart: `run0 suricata -T -c /etc/suricata/suricata.yaml` (use the host's supported privilege mechanism and actual path).
7. Review `journalctl -u suricata -b --no-pager`, `/var/log/suricata/fast.log`, and `/var/log/suricata/eve.json` as configured.
8. Restart only with approval, then verify service status, capture counters, alerts, and downstream log ingestion.

## Useful diagnostics
- `suricata --build-info`
- `suricata -T -c /etc/suricata/suricata.yaml -v`
- `ip -details link show`
- `sudo suricatasc -c uptime` (only if the Unix socket is configured and accessible)
- `jq 'select(.event_type == "alert")' /var/log/suricata/eve.json`
- `journalctl -u suricata --since "30 minutes ago"`

## Safety and tuning
- Suricata is a sensor by default only when configured that way; do not imply passive mode if NFQUEUE/inline settings are enabled.
- Keep a backup of config and rule state before edits. Avoid unreviewed third-party rules and scripts.
- For constrained hosts, inspect thread counts, flow memcap, stream/reassembly memcaps, and observed RSS before tuning; do not blindly copy high-throughput examples.
- Avoid logging secrets or exporting full packet payloads unless justified and authorized.
- Do not flush firewall rules or change NIC offloads as a generic troubleshooting step.
- Preserve logs and timestamps during incident response.

## Upstream references
- [Official User Guide](https://docs.suricata.io/en/latest/)
- [Quickstart](https://docs.suricata.io/en/latest/quickstart.html)
- [suricata.yaml configuration](https://docs.suricata.io/en/latest/configuration/suricata-yaml.html)
- [Official source](https://github.com/OISF/suricata)
- Version-specific docs and configuration schema take precedence over generic examples.
