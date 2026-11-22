#!/usr/bin/env python3
"""Collect Suricata network-traffic statistics from OpenObserve.

Queries the suricata_ips / suricata_ids streams and emits a single stats.json
consumed by render_report.py (HTML artifact) and by the Ollama analyst model.

Config (env vars, or pass flags):
    O2_HOST   default http://localhost:5080
    O2_ORG    default default
    O2_USER / O2_PASS   basic-auth credentials (required)

Usage:
    python3 collect_stats.py --hours 24 --out stats.json
"""

import argparse
import base64
import ipaddress
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

DEFAULT_STREAMS = ["suricata_ips", "suricata_ids"]

# Behaviour heuristics (tunable)
SCAN_UNIQUE_DESTS = 50          # distinct dest_ip seen by one src_ip
SCAN_UNIQUE_PORTS = 20          # distinct dest_port seen by one src_ip
MASS_SCAN_PORTS = 100           # port-sweep: many ports even to few dests
EXFIL_UP_BYTES = 100 * 1024**2  # >100 MiB uploaded by one src_ip
BEACON_FLOWS = 200              # flows to a single dest_ip
BEACON_AVG_BYTES = 4096         # low-and-even byte counts => C2-ish
TOP_IP_LIMIT = 50

# Alert signatures that are engine notices / informational, not detections.
# Excluded from alert stats so noise doesn't drive the verdict.
ALERT_NOISE_PREFIXES = ("SURICATA ", "ET INFO", "ET POLICY")

DEFAULT_CF_STATE = "/var/home/kim/workspace/suricata-cf/data/cf-block-state.json"
ARP_SUSPICIOUS = re.compile(r"flip flop|ether spoof|changed ethernet|conflict", re.I)
ARP_SUBJECT_RE = re.compile(r"Subject:\s*(.+?)\s*$")
ARP_IP_RE = re.compile(r"ip address:\s*(\S+)")
ARP_TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})")
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")


def o2_request(base, org, auth, path, payload=None):
    url = f"{base}/api/{org}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("Content-Type", "application/json")
    if auth:
        req.add_header("Authorization", "Basic " + base64.b64encode(auth.encode()).decode())
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def search(base, org, auth, stream, sql, start_us, end_us, size=1000):
    payload = {
        "query": {
            "sql": sql,
            "start_time": start_us,
            "end_time": end_us,
            "from": 0,
            "size": size,
        }
    }
    resp = o2_request(base, org, auth, "/_search?type=logs", payload)
    if resp.get("code") not in (200, 0, None) and "hits" not in resp:
        raise RuntimeError(f"search failed for {stream}: {resp}")
    return resp.get("hits", [])


def classify_ip(stats):
    """Deterministic behaviour label from aggregated flow stats."""
    labels = []
    # Scanner needs destination diversity AND port diversity — busy clients
    # hit hundreds of dests but almost all on 443/80.
    if ((stats["unique_dests"] >= SCAN_UNIQUE_DESTS
         and stats["unique_ports"] >= SCAN_UNIQUE_PORTS)
            or stats["unique_ports"] >= MASS_SCAN_PORTS):
        labels.append("scanner")
    if stats["bytes_up"] >= EXFIL_UP_BYTES:
        labels.append("exfil-suspect")
    if stats["top_dest_flows"] >= BEACON_FLOWS and stats["avg_flow_bytes"] <= BEACON_AVG_BYTES:
        labels.append("beacon-suspect")
    if stats["unique_dests"] <= 3 and stats["flows"] > 500:
        labels.append("heavy-client")
    return ",".join(labels) if labels else "normal"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=24, help="lookback window in hours")
    ap.add_argument("--streams", default=",".join(DEFAULT_STREAMS))
    ap.add_argument("--out", default="stats.json")
    ap.add_argument("--top", type=int, default=TOP_IP_LIMIT)
    ap.add_argument("--cf-state", default=os.environ.get("CF_STATE_FILE", DEFAULT_CF_STATE),
                    help="path to suricata-cf-block state JSON (submitted IPs); '' disables")
    ap.add_argument("--arp-journal", action="store_true",
                    help="also parse arpwatch syslog lines from the journal (best effort)")
    ap.add_argument("--arp-log", default=os.environ.get("ARP_LOG_FILE", ""),
                    help="path to arpwatch syslog export (e.g. /var/log/arpwatch-export/arpwatch.log)")
    args = ap.parse_args()

    base = os.environ.get("O2_HOST", "http://localhost:5080").rstrip("/")
    org = os.environ.get("O2_ORG", "default")
    user = os.environ.get("O2_USER")
    pw = os.environ.get("O2_PASS")
    if not user or not pw:
        sys.exit("O2_USER and O2_PASS env vars are required")
    auth = f"{user}:{pw}"

    streams = [s.strip() for s in args.streams.split(",") if s.strip()]
    end_us = int(time.time() * 1_000_000)
    start_us = end_us - int(args.hours * 3600 * 1_000_000)

    stats = {
        "meta": {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "window_hours": args.hours,
            "window_start": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(start_us / 1e6)),
            "window_end": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(end_us / 1e6)),
            "streams": streams,
        },
        "totals": {},
        "event_types": {},
        "timeseries": {},          # stream -> [{bucket, event_type?, c}]
        "protocols": {},           # stream -> [{app_proto, flows}]
        "top_src_ips": [],
        "top_dst_ips": [],
        "alerts": {"by_signature": [], "by_src_ip": [], "by_category": [],
                   "agentic_by_src_ip": []},
        "dns_top": [],
        "enrichment": {"cloudflare": {}, "arpwatch": {}},
        "errors": [],
    }

    for stream in streams:
        sensor = stream.replace("suricata_", "")
        try:
            # event_type totals
            for h in search(base, org, auth, stream,
                            "SELECT event_type, COUNT(*) AS c FROM \"%s\" "
                            "GROUP BY event_type ORDER BY c DESC" % stream,
                            start_us, end_us):
                stats["event_types"].setdefault(sensor, []).append(
                    {"event_type": h["event_type"], "count": h["c"]})
                stats["totals"][sensor] = stats["totals"].get(sensor, 0) + h["c"]

            # hourly timeseries overall
            try:
                ts = search(base, org, auth, stream,
                            "SELECT histogram(_timestamp, '1 hour') AS bucket, COUNT(*) AS c "
                            "FROM \"%s\" GROUP BY bucket ORDER BY bucket" % stream,
                            start_us, end_us, size=500)
                stats["timeseries"][sensor] = ts
            except Exception as e:
                stats["errors"].append(f"{stream} timeseries: {e}")

            # hourly timeseries for alerts only (for the alert trend chart)
            try:
                ts = search(base, org, auth, stream,
                            "SELECT histogram(_timestamp, '1 hour') AS bucket, COUNT(*) AS c "
                            "FROM \"%s\" WHERE event_type='alert' GROUP BY bucket ORDER BY bucket" % stream,
                            start_us, end_us, size=500)
                stats["timeseries"][f"{sensor}_alerts"] = ts
            except Exception as e:
                stats["errors"].append(f"{stream} alert ts: {e}")

            # app protocol distribution (flow events)
            try:
                proto = search(base, org, auth, stream,
                               "SELECT app_proto, COUNT(*) AS flows FROM \"%s\" "
                               "WHERE event_type='flow' GROUP BY app_proto ORDER BY flows DESC" % stream,
                               start_us, end_us, size=100)
                stats["protocols"][sensor] = proto
            except Exception as e:
                stats["errors"].append(f"{stream} protocols: {e}")

            # top source IPs with behaviour features
            src_rows = search(base, org, auth, stream,
                              "SELECT src_ip, COUNT(*) AS flows, "
                              "SUM(flow_bytes_toserver) AS bytes_up, "
                              "SUM(flow_bytes_toclient) AS bytes_down, "
                              "COUNT(DISTINCT dest_ip) AS unique_dests, "
                              "COUNT(DISTINCT dest_port) AS unique_ports, "
                              "SUM(CASE WHEN flow_bytes_toclient > 0 THEN 1 ELSE 0 END) "
                              "AS answered_flows "
                              "FROM \"%s\" WHERE event_type='flow' "
                              "GROUP BY src_ip ORDER BY flows DESC" % stream,
                              start_us, end_us, size=args.top)
            # per-src top destination flow count (for beacon heuristic)
            dst_rows = search(base, org, auth, stream,
                              "SELECT src_ip, dest_ip, COUNT(*) AS flows "
                              "FROM \"%s\" WHERE event_type='flow' "
                              "GROUP BY src_ip, dest_ip ORDER BY flows DESC" % stream,
                              start_us, end_us, size=500)
            top_dest = {}
            for r in dst_rows:
                top_dest[r["src_ip"]] = max(top_dest.get(r["src_ip"], 0), r["flows"])

            src_stats = []
            for r in src_rows:
                up = r.get("bytes_up") or 0
                down = r.get("bytes_down") or 0
                total_bytes = up + down
                feat = {
                    "ip": r["src_ip"],
                    "sensor": sensor,
                    "flows": r["flows"],
                    "bytes_up": up,
                    "bytes_down": down,
                    "unique_dests": r.get("unique_dests") or 0,
                    "unique_ports": r.get("unique_ports") or 0,
                    "top_dest_flows": top_dest.get(r["src_ip"], 0),
                    "avg_flow_bytes": int(total_bytes / r["flows"]) if r["flows"] else 0,
                    "answered_flows": r.get("answered_flows") or 0,
                }
                feat["classification"] = classify_ip(feat)
                src_stats.append(feat)
            stats["top_src_ips"].extend(src_stats)

            # top destination IPs
            dst_agg = search(base, org, auth, stream,
                             "SELECT dest_ip, COUNT(*) AS flows, "
                             "COUNT(DISTINCT src_ip) AS unique_srcs, "
                             "SUM(flow_bytes_toserver) AS bytes_in "
                             "FROM \"%s\" WHERE event_type='flow' "
                             "GROUP BY dest_ip ORDER BY flows DESC" % stream,
                             start_us, end_us, size=args.top)
            for r in dst_agg:
                stats["top_dst_ips"].append({
                    "ip": r["dest_ip"], "sensor": sensor, "flows": r["flows"],
                    "unique_srcs": r.get("unique_srcs") or 0,
                    "bytes_in": r.get("bytes_in") or 0,
                })

            # alerts (excluding engine notices / informational signatures)
            noise_where = " AND ".join(
                f"alert_signature NOT LIKE '{p}%'" for p in ALERT_NOISE_PREFIXES)
            try:
                sig = search(base, org, auth, stream,
                             "SELECT alert_signature AS signature, COUNT(*) AS c "
                             "FROM \"%s\" WHERE event_type='alert' AND %s "
                             "GROUP BY alert_signature ORDER BY c DESC" % (stream, noise_where),
                             start_us, end_us, size=25)
                cat = search(base, org, auth, stream,
                             "SELECT alert_category AS category, COUNT(*) AS c "
                             "FROM \"%s\" WHERE event_type='alert' AND %s "
                             "GROUP BY alert_category ORDER BY c DESC" % (stream, noise_where),
                             start_us, end_us, size=25)
                asrc = search(base, org, auth, stream,
                              "SELECT src_ip, COUNT(*) AS c "
                              "FROM \"%s\" WHERE event_type='alert' AND %s "
                              "GROUP BY src_ip ORDER BY c DESC" % (stream, noise_where),
                              start_us, end_us, size=25)
                total = search(base, org, auth, stream,
                               "SELECT COUNT(*) AS c "
                               "FROM \"%s\" WHERE event_type='alert' AND %s" % (stream, noise_where),
                               start_us, end_us, size=1)
                stats["alerts"]["by_signature"].extend(
                    [{"sensor": sensor, **h} for h in sig])
                stats["alerts"]["by_category"].extend(
                    [{"sensor": sensor, **h} for h in cat])
                stats["alerts"]["by_src_ip"].extend(
                    [{"sensor": sensor, **h} for h in asrc])
                stats["alerts"]["total_ex_noise"] = (
                    stats["alerts"].get("total_ex_noise", 0)
                    + sum(h.get("c", 0) for h in total))
                # agentic-framework detections: rules all use msg:"TD ..."
                try:
                    ag = search(base, org, auth, stream,
                                "SELECT src_ip, COUNT(*) AS c "
                                "FROM \"%s\" WHERE event_type='alert' "
                                "AND alert_signature LIKE 'TD %%' "
                                "GROUP BY src_ip ORDER BY c DESC" % stream,
                                start_us, end_us, size=25)
                    stats["alerts"]["agentic_by_src_ip"].extend(
                        [{"sensor": sensor, **h} for h in ag])
                except Exception as e:
                    stats["errors"].append(f"{stream} agentic-alerts: {e}")
            except Exception as e:
                stats["errors"].append(f"{stream} alerts: {e}")

            # top DNS queries
            try:
                dns = search(base, org, auth, stream,
                             "SELECT dns_queries AS q, COUNT(*) AS c "
                             "FROM \"%s\" WHERE event_type='dns' "
                             "GROUP BY dns_queries ORDER BY c DESC" % stream,
                             start_us, end_us, size=25)
                for h in dns:
                    q = h.get("q") or ""
                    # dns_queries looks like [{"rrname":"example.com","rrtype":"A"}]
                    name = q[:80]
                    try:
                        arr = json.loads(q)
                        if isinstance(arr, list) and arr:
                            name = arr[0].get("rrname") or str(arr[0])[:80]
                    except Exception:
                        m = re.search(r'"rrname"\s*:\s*"([^"]+)"', q)
                        if m:
                            name = m.group(1)
                    stats["dns_top"].append({"sensor": sensor, "q": name, "c": h["c"]})
            except Exception as e:
                stats["errors"].append(f"{stream} dns: {e}")

        except Exception as e:
            stats["errors"].append(f"{stream}: {e}")

    # ---- enrichment: Cloudflare auto-block state ----
    if args.cf_state:
        try:
            with open(args.cf_state) as f:
                raw = json.load(f).get("submitted", [])
            submitted = [
                (x.get("ip") if isinstance(x, dict) else str(x)) for x in raw
            ]
            alert_ips = {r["src_ip"] for r in stats["alerts"]["by_src_ip"] if r.get("src_ip")}
            flagged = {r["ip"] for r in stats["top_src_ips"]
                       if r["classification"] not in ("", "normal")}
            def is_public(ip):
                try:
                    return ipaddress.ip_address(ip).is_global
                except ValueError:
                    return False
            # Cloudflare only blocks globally-routable IPs — private/ULA flagged
            # IPs are noise for the pending-action list. Require an actual alert
            # from the IP too: flow-only heuristic hits (e.g. CDN resolver IPs
            # like 172.64.x) must not become block candidates.
            pending = sorted(
                ip for ip in flagged & alert_ips - set(submitted)
                if is_public(ip))
            stats["enrichment"]["cloudflare"] = {
                "state_file": args.cf_state,
                "submitted_count": len(submitted),
                "submitted_ips": submitted[:200],
                "malicious_flagged_ips": sorted(flagged)[:200],
                "pending_action_ips": pending[:200],
                "alert_src_ips": sorted(alert_ips)[:200],
            }
        except Exception as e:
            stats["errors"].append(f"cf-state: {e}")

    # ---- enrichment: arpwatch ----
    def _arp_result(source, counts, by_subject):
        return {
            "source": source,
            "suspicious_lines": sum(counts.values()),
            "by_subject": by_subject,
            "top_ips": sorted(
                ({"ip": ip, "events": c} for ip, c in counts.items()),
                key=lambda x: x["events"], reverse=True)[:50],
        }

    arp_done = False
    if args.arp_log:
        try:
            counts, by_subject = {}, {}
            counts24, by_subject24 = {}, {}
            current_subject = None
            window_start = start_us / 1e6
            cutoff24 = time.time() - 86400
            with open(args.arp_log, errors="replace") as f:
                for line in f:
                    m = ARP_SUBJECT_RE.search(line)
                    if m:
                        current_subject = m.group(1)
                        continue
                    m = ARP_IP_RE.search(line)
                    if not (m and current_subject):
                        continue
                    # optional time filter on the syslog timestamp prefix
                    ts = ARP_TS_RE.match(line)
                    t = None
                    if ts:
                        try:
                            t = time.mktime(time.strptime(ts.group(1), "%Y-%m-%dT%H:%M:%S"))
                            if t < window_start:
                                in_window = False
                            else:
                                in_window = True
                        except Exception:
                            in_window = True
                    else:
                        in_window = True
                    subj = current_subject.split(" (")[0]
                    if not ARP_SUSPICIOUS.search(subj):
                        continue
                    ip = m.group(1)
                    if in_window:
                        counts[ip] = counts.get(ip, 0) + 1
                        by_subject[subj] = by_subject.get(subj, 0) + 1
                    if t is None or t >= cutoff24:
                        counts24[ip] = counts24.get(ip, 0) + 1
                        by_subject24[subj] = by_subject24.get(subj, 0) + 1
            result = _arp_result(f"file:{args.arp_log}", counts, by_subject)
            result["last_24h"] = _arp_result("", counts24, by_subject24)
            result["last_24h"].pop("source", None)
            stats["enrichment"]["arpwatch"] = result
            arp_done = True
        except Exception as e:
            stats["errors"].append(f"arp-log: {e}")

    if not arp_done and args.arp_journal:
        try:
            since = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(start_us / 1e6))
            out = subprocess.run(
                ["journalctl", "--since", since, "-o", "cat",
                 "SYSLOG_IDENTIFIER=arpwatch"],
                capture_output=True, text=True, timeout=60)
            counts = {}
            for line in out.stdout.splitlines():
                if not ARP_SUSPICIOUS.search(line):
                    continue
                for ip in IP_RE.findall(line):
                    counts[ip] = counts.get(ip, 0) + 1
            stats["enrichment"]["arpwatch"] = _arp_result(
                "journalctl SYSLOG_IDENTIFIER=arpwatch", counts, {})
        except Exception as e:
            stats["errors"].append(f"arpwatch: {e}")

    # ---- enrichment: agentic attack-detection IOCs (ThreatDefence feeds) ----
    agentic_dir = os.environ.get(
        "AGENTIC_IOC_DIR",
        "/var/home/kim/workspace/suricata-containerized-rootful/"
        "agentic-attack-detections")
    try:
        def _feed(name):
            p = os.path.join(agentic_dir, "feeds", name)
            if not os.path.exists(p):
                return set()
            return {l.strip().lower() for l in open(p, errors="replace")
                    if l.strip() and not l.startswith("#")}
        ioc_v4, ioc_v6, ioc_dom = (_feed("ipv4.txt"), _feed("ipv6.txt"),
                                   _feed("domains.txt"))

        observed = {r["ip"] for r in stats["top_src_ips"] + stats["top_dst_ips"]}
        observed |= {r.get("src_ip") for r in stats["alerts"]["by_src_ip"]}
        observed.discard(None)
        ioc_ip_hits = sorted(
            ip for ip in observed
            if ip.lower() in ioc_v4 or ip.lower() in ioc_v6)
        dom_hits = []
        for d in stats["dns_top"]:
            q = (d.get("q") or "").lower().rstrip(".")
            if any(q == dom or q.endswith("." + dom) for dom in ioc_dom):
                dom_hits.append(d)
        agentic_sigs = [s for s in stats["alerts"]["by_signature"]
                        if (s.get("signature") or "").startswith("TD ")]
        for r in stats["top_src_ips"] + stats["top_dst_ips"]:
            r["ioc_match"] = (r["ip"].lower() in ioc_v4
                              or r["ip"].lower() in ioc_v6)
        stats["enrichment"]["agentic"] = {
            "ioc_dir": agentic_dir,
            "ipv4_feed_size": len(ioc_v4),
            "ipv6_feed_size": len(ioc_v6),
            "domain_feed_size": len(ioc_dom),
            "ioc_ip_hits": ioc_ip_hits[:100],
            "ioc_domain_hits": dom_hits[:50],
            "agentic_alert_count": sum(s.get("c", 0) for s in agentic_sigs),
            "agentic_signatures": agentic_sigs[:25],
        }
    except Exception as e:
        stats["errors"].append(f"agentic-ioc: {e}")

    # sort merged IP lists
    stats["top_src_ips"].sort(key=lambda x: x["flows"], reverse=True)
    stats["top_src_ips"] = stats["top_src_ips"][: args.top]
    stats["top_dst_ips"].sort(key=lambda x: x["flows"], reverse=True)
    stats["top_dst_ips"] = stats["top_dst_ips"][: args.top]

    with open(args.out, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"wrote {args.out} "
          f"({sum(stats['totals'].values())} events across {len(streams)} streams)")
    if stats["errors"]:
        print("warnings:", *stats["errors"], sep="\n  ", file=sys.stderr)


if __name__ == "__main__":
    main()
