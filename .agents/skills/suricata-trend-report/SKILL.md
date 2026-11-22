---
name: suricata-trend-report
description: Generate a text-based (Markdown) security assessment of Suricata network traffic — event/alert trends over time, per-IP occurrence counts and behaviour classification (scanner, exfil, beacon), top talkers, alert signatures, DNS anomalies, and correlation with the Cloudflare auto-block pipeline and arpwatch ARP monitoring. Produces a conclusive "act / monitor / no action" recommendation. Use whenever the user asks for a traffic trend report, daily security assessment, network traffic visualization, per-IP analysis, or a verdict on whether malicious activity needs action — including scheduled/daily runs against the OpenObserve suricata_ips and suricata_ids streams.
---

# Suricata Trend Report

Produces a Markdown/text artifact that analyzes Suricata IDS/IPS traffic trends and delivers a conclusive security assessment. Designed to run both interactively (via the agent) and unattended (daily via Ollama — see `ollama/`).

## Pipeline

```
OpenObserve (suricata_ips, suricata_ids streams)
        │  scripts/collect_stats.py
        ▼
   stats.json  ──►  scripts/assess.py  (deterministic criteria -> score -> verdict)
        │              ▲                        │
        │              └── findings.json        ▼
        │              (optional LLM            verdict.md  (Markdown fragment)
        │               observations only,           │
        │               corroborated vs stats)      ▼
        └──────────────►  scripts/render_text.py
                               │
                               ▼
                     suricata-assessment-*.md  (verdict + tables)
```

## Steps

### 1. Collect statistics

```bash
cd ~/.agents/skills/suricata-trend-report/scripts
O2_USER=... O2_PASS=... python3 collect_stats.py --hours 24 --arp-journal --out stats.json
```

Credentials come from `observability/.env` (`O2_USER`/`O2_PASS`) or env. Other env: `O2_HOST` (default `http://localhost:5080`), `O2_ORG` (default `default`), `CF_STATE_FILE` (default `/var/home/kim/workspace/suricata-cf/data/cf-block-state.json`).

`stats.json` contains: event totals, event-type mix, hourly timeseries (all events + alerts), app-protocol distribution, top source/destination IPs with per-IP features and deterministic `classification` (`scanner`, `exfil-suspect`, `beacon-suspect`, `heavy-client`, `normal`), top alert signatures/categories/source IPs, top DNS queries, and `enrichment` sections correlating with the **Cloudflare auto-block state** (`submitted`, `pending_action_ips`) and **arpwatch** suspicious-ARP counts.

### 2. Assessment (deterministic — the decision authority)

`scripts/assess.py` produces a **conclusion, not a score**. For each notable subject (non-normal top talker, arpwatch offender, corroborated LLM finding) it emits a conclusion class with a written justification citing the evidence, then resolves the overall verdict as the most severe subject conclusion:

- `HOSTILE` — high-confidence malicious activity (requires corroboration: agentic IOC/TD-rule hit + hostile flow behaviour, or exfil pattern + alerts/CF candidacy)
- `SUSPICIOUS` — evidence suggests possible compromise — investigate
- `ANOMALOUS` — unusual but plausibly explainable; statements are explicit, e.g. "likely false positives: only N% of flows received any response" or "low-confidence, most likely benign system traffic"
- `NOMINAL` — expected traffic
- `NO DATA` — zero events collected (collection failure, never a clean bill of health)

Outputs: `assessment.json` (full audit trail — per-subject conclusion, justification, evidence, `cf_candidate` flags, rejected LLM findings) and `verdict.md` (Markdown assessment statement).

**Subject coverage is detection-driven, not volume-driven:** subjects include every non-normal top talker, arpwatch offenders, *alert-generating IPs that never made the top-talkers list* (quiet/targeted activity), destination IPs matching the agentic IOC feed, and corroborated LLM findings.

**Cross-window memory:** `--state assessment-state-<window>h.json` persists per-subject `first_seen`/`last_seen`/`streak`/`total`/`worst`. An `ANOMALOUS` subject seen in ≥6 consecutive windows is promoted to `SUSPICIOUS` ("persistence indicates a real pattern"); streaks decay after >2 missed windows. Hourly and daily runs keep separate state files.

**Evidence the assessor uses:** per-IP flow stats including `answered_flows` (response ratio drives "no follow-on activity" false-positive calls), Suricata alert membership, Cloudflare state, arpwatch, the **agentic attack-detection pipeline** (`enrichment.agentic` — IOC feed hits from `feeds/ipv4.txt`/`domains.txt` and `TD `-prefixed rule alerts via `alerts.agentic_by_src_ip`), and corroborated LLM findings.

**The LLM never decides.** With `--llm`, Ollama emits structured *findings* only — `{ip, class A–D, behavior, evidence}`. A finding counts only if its IP appears in `stats.json`; class A can raise a subject to `SUSPICIOUS`, never `HOSTILE` alone.

**Cloudflare gate:** subjects with `cf_candidate=true` (HOSTILE + agentic corroboration, not already blocked/submittable-filtered) are listed in the report and O2 record. `scripts/cf_submit.py` pushes them to the Cloudflare list reusing `suricata-cf-block.py`'s API helpers and ignore-ranges; `daily_assess.sh --cf-submit` runs it automatically (sources `suricata-cf/cf.env`). Without the flag it only reports candidates.

`scripts/gen_verdict.py` is the legacy verdict writer kept for reference; `assess.py` supersedes it.

### 3. Render the report

```bash
python3 assess.py --stats stats.json [--findings findings.json] \
  --assessment assessment.json --verdict verdict.md
python3 render_text.py --stats stats.json --verdict verdict.md \
  --out /var/home/kim/workspace/v2.home-security.uk/v2.home-security.uk/suricata-analyzer/output/suricata-assessment-$(date +%F-%H%M).md
```

`render_text.py` strips the verdict fragment's HTML to plain text and emits a self-contained Markdown report (verdict, traffic summary, event types, flagged IPs, alert signatures, Cloudflare/arpwatch correlation, DNS, warnings). `render_report.py` remains for the legacy self-contained HTML dashboard version if a visual artifact is ever needed again.

### 4. OpenObserve dashboard (one-time / refresh)

```bash
O2_USER=... O2_PASS=... python3 setup_o2.py
```

Idempotent — creates "Suricata Security Overview" (per-sensor tabs of metrics, timeseries, top-IP bars, alert tables) and "Suricata Chronological Trends" (hourly/daily buckets) if missing. The Markdown report complements these dashboards.

## Unattended daily run (Ollama)

```bash
# one-time: create the model
ollama create suricata-analyst -f ollama/Modelfile

# daily (cron/systemd timer) — artifacts land in suricata-analyzer/output/:
OLLAMA_HOST=... ollama/daily_assess.sh --arp-journal --o2-report
```

The script collects stats, optionally asks the model for corroborated findings (`--llm`), runs the deterministic assessor, renders `suricata-assessment-YYYY-MM-DD-HHMM.md`, and optionally POSTs a summary record — including `verdict`, `score`, `confidence`, and `criteria_fired` — to the OpenObserve `suricata_reports` stream (`--o2-report`). The systemd user timer `suricata-assess.timer` runs it hourly with `--hours 1`.

## Notes & caveats

- `collect_stats.py` queries aggregated SQL only — it never downloads raw events, so it stays fast even with millions of records.
- `--arp-journal` needs read access to the system journal (`journalctl`); inside a container run it on the host or grant access. arpwatch must be running and logging with identifier `arpwatch`.
- The Cloudflare correlation reads the `suricata-cf-block` state file; if the automation is renamed/moved, pass `--cf-state`.
- Per-IP `classification` is heuristic — treat `beacon-suspect`/`exfil-suspect` as leads for the analyst, not proof.
- For deep dives on specific IPs/signatures, hand off to the `hunt-*` / `inspect` skills or query the streams directly.
