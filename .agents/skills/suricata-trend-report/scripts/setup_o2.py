#!/usr/bin/env python3
"""Idempotently create the 'Suricata Security Overview' dashboard in OpenObserve.

Usage:
    O2_USER=... O2_PASS=... python3 setup_o2.py [--title "Suricata Security Overview"]

Env: O2_HOST (default http://localhost:5080), O2_ORG (default default).
"""

import argparse
import base64
import json
import os
import sys
import urllib.request


def req(base, org, auth, method, path, payload=None):
    url = f"{base}/api/{org}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if auth:
        r.add_header("Authorization", "Basic " + base64.b64encode(auth.encode()).decode())
    with urllib.request.urlopen(r, timeout=60) as resp:
        body = resp.read()
        return json.loads(body) if body else {}


def field_x(col, label=None):
    return {"label": label or col, "alias": col, "column": col,
            "color": None, "aggregationFunction": None}


def field_y(col, alias=None, non_ts=True):
    return {"label": alias or col, "alias": alias or col, "column": col,
            "color": None, "aggregationFunction": None,
            "treatAsNonTimeseries": non_ts}


def query_fields(stream):
    return {
        "stream": stream, "stream_type": "logs",
        "x": [], "z": [], "breakdown": [],
        "y": [],
        "filter": {"filterType": "group", "logicalOperator": "AND", "conditions": []},
    }


def panel(pid, ptype, title, sql, stream, xcols, ycol, layout, y_alias=None,
          non_ts=True, config=None):
    f = query_fields(stream)
    f["x"] = [field_x(c) for c in xcols]
    f["y"] = [field_y(ycol, y_alias, non_ts)]
    return {
        "id": pid, "type": ptype, "title": title, "description": "",
        "queryType": "sql",
        "queries": [{
            "query": sql, "vrlFunctionQuery": "", "customQuery": True,
            "fields": f,
            "config": {"promql_legend": "", "layer_type": "scatter",
                       "weight_fixed": 1, "limit": 0, "min": 0, "max": 100},
        }],
        "config": {"show_legends": True, "decimals": 2, "unit": "numbers",
                   **(config or {})},
        "layout": layout,
    }


def build_panels(stream, tag):
    S = f'"{stream}"'
    P = []
    i = 1
    def lay(w=24, h=8, x=None, y=None):
        nonlocal i
        l = {"x": x if x is not None else (i * 24) % 96,
             "y": y if y is not None else (i // 4) * 8,
             "w": w, "h": h, "i": i}
        i += 1
        return l

    P.append(panel(f"{tag}-metric-total", "metric", f"{tag}: total events",
                   f"SELECT COUNT(*) AS value FROM {S}", stream, [], "value",
                   {"x": 0, "y": 0, "w": 24, "h": 7, "i": 1},
                   config={"unit": "numbers", "decimals": 0}))
    P.append(panel(f"{tag}-metric-alerts", "metric", f"{tag}: alerts",
                   f"SELECT COUNT(*) AS value FROM {S} WHERE event_type='alert'",
                   stream, [], "value", {"x": 24, "y": 0, "w": 24, "h": 7, "i": 2},
                   config={"unit": "numbers", "decimals": 0}))
    P.append(panel(f"{tag}-ts-events", "line", f"{tag}: events per hour",
                   f"SELECT histogram(_timestamp, '1 hour') AS bucket, COUNT(*) AS c "
                   f"FROM {S} GROUP BY bucket ORDER BY bucket", stream,
                   ["bucket"], "c", {"x": 48, "y": 0, "w": 48, "h": 9, "i": 3},
                   y_alias="events", non_ts=False,
                   config={"show_legends": True}))
    P.append(panel(f"{tag}-pie-types", "pie", f"{tag}: event types",
                   f"SELECT event_type, COUNT(*) AS c FROM {S} "
                   f"GROUP BY event_type ORDER BY c DESC", stream,
                   ["event_type"], "c", {"x": 0, "y": 9, "w": 24, "h": 9, "i": 4}))
    P.append(panel(f"{tag}-bar-src", "h-bar", f"{tag}: top source IPs (flows)",
                   f"SELECT src_ip, COUNT(*) AS flows FROM {S} "
                   f"WHERE event_type='flow' GROUP BY src_ip "
                   f"ORDER BY flows DESC LIMIT 15", stream,
                   ["src_ip"], "flows", {"x": 24, "y": 9, "w": 36, "h": 9, "i": 5}))
    P.append(panel(f"{tag}-table-sig", "table", f"{tag}: top alert signatures",
                   f"SELECT alert_signature AS signature, COUNT(*) AS c "
                   f"FROM {S} WHERE event_type='alert' "
                   f"GROUP BY alert_signature ORDER BY c DESC LIMIT 15", stream,
                   ["signature"], "c", {"x": 60, "y": 9, "w": 36, "h": 9, "i": 6}))
    P.append(panel(f"{tag}-pie-proto", "pie", f"{tag}: app protocols",
                   f"SELECT app_proto, COUNT(*) AS flows FROM {S} "
                   f"WHERE event_type='flow' GROUP BY app_proto "
                   f"ORDER BY flows DESC LIMIT 10", stream,
                   ["app_proto"], "flows", {"x": 0, "y": 18, "w": 24, "h": 9, "i": 7}))
    P.append(panel(f"{tag}-table-alertip", "table", f"{tag}: alerts by source IP",
                   f"SELECT src_ip, COUNT(*) AS c FROM {S} "
                   f"WHERE event_type='alert' GROUP BY src_ip "
                   f"ORDER BY c DESC LIMIT 15", stream,
                   ["src_ip"], "c", {"x": 24, "y": 18, "w": 36, "h": 9, "i": 8}))
    P.append(panel(f"{tag}-bar-dst", "h-bar", f"{tag}: top destination IPs (flows)",
                   f"SELECT dest_ip, COUNT(*) AS flows FROM {S} "
                   f"WHERE event_type='flow' GROUP BY dest_ip "
                   f"ORDER BY flows DESC LIMIT 15", stream,
                   ["dest_ip"], "flows", {"x": 60, "y": 18, "w": 36, "h": 9, "i": 9}))
    return P


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", default="Suricata Security Overview")
    ap.add_argument("--streams", default="suricata_ips,suricata_ids")
    args = ap.parse_args()

    base = os.environ.get("O2_HOST", "http://localhost:5080").rstrip("/")
    org = os.environ.get("O2_ORG", "default")
    user = os.environ.get("O2_USER")
    pw = os.environ.get("O2_PASS")
    if not user or not pw:
        sys.exit("O2_USER and O2_PASS env vars are required")
    auth = f"{user}:{pw}"

    existing = req(base, org, auth, "GET", "/dashboards?folder=default")
    dashboards = existing if isinstance(existing, list) else existing.get("dashboards", [])
    for d in dashboards:
        title = d.get("title") or (d.get("v8") or {}).get("title")
        if title == args.title:
            print(f"dashboard '{args.title}' already exists (id={d.get('dashboard_id') or d.get('id')})")
            return

    panels = []
    for stream in [s.strip() for s in args.streams.split(",") if s.strip()]:
        tag = stream.replace("suricata_", "").upper()
        panels.extend(build_panels(stream, tag))

    payload = {
        "title": args.title,
        "description": "Suricata IDS/IPS traffic overview - auto-created by suricata-trend-report skill",
        "version": 8,
        "tabs": [{"tabId": "default", "name": "Overview", "panels": panels}],
        "variables": {"list": [], "showDynamicFilters": True},
        "defaultDatetimeDuration": {"type": "relative", "relativeTimePeriod": "24h"},
    }
    resp = req(base, org, auth, "POST", "/dashboards?folder=default", payload)
    print("created dashboard:", json.dumps(resp)[:400])


if __name__ == "__main__":
    main()
