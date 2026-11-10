#!/usr/bin/env python3
"""
Session Forensics Document Generator
"""

import json
import os
from datetime import datetime
import argparse
import sys
from typing import Dict, List, Any


def parse_session_data(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Parse raw session data"""
    report = {
        "metadata": {
            "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "disclaimer": "TENTATIVE - Requires Human Review",
            "data_sources": ["who", "w", "loginctl", "last", "journalctl", "ps"],
            "analysis_timestamp": session_data.get("metadata", {}).get("timestamp", ""),
            "hostname": session_data.get("metadata", {}).get("hostname", "")
        },
        "active_sessions": {"users": [], "total_count": 0},
        "login_history": [],
        "authentication_events": [],
        "active_processes": [],
        "findings": [],
        "recommendations": [],
        "timeline": []
    }

    if "who" in session_data.get("session_data", {}):
        for line in session_data["session_data"]["who"]:
            parts = line.split()
            if len(parts) >= 3:
                report["active_sessions"]["users"].append({
                    "user": parts[0], "tty": parts[1], "from": parts[2],
                    "login_time": " ".join(parts[3:]) if len(parts) > 3 else ""
                })
        report["active_sessions"]["total_count"] = len(report["active_sessions"]["users"])

    if "w" in session_data.get("session_data", {}):
        for line in session_data["session_data"]["w"]:
            if line.strip():
                report["timeline"].append({
                    "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "w_command",
                    "description": f"System load: {line}"
                })

    if "loginctl_sessions" in session_data.get("session_data", {}):
        for line in session_data["session_data"]["loginctl_sessions"]:
            parts = line.split()
            if len(parts) >= 3:
                report["active_sessions"]["users"].append({
                    "user": parts[2],
                    "session_id": parts[0],
                    "type": parts[1],
                    "status": "active" if len(parts) > 3 and parts[3] == "(active)" else "inactive"
                })

    if "last_logins" in session_data.get("session_data", {}):
        for line in session_data["session_data"]["last_logins"]:
            if line.strip() and not line.startswith(("wtmp", "reboot", "shutdown")):
                parts = line.split()
                if len(parts) >= 7:
                    report["login_history"].append({
                        "user": parts[3],
                        "login_time": " ".join(parts[0:3]),
                        "from": parts[4] if parts[4] != "still" else "local",
                        "duration": " ".join(parts[5:7]) if len(parts) > 7 else "current"
                    })

    if "auth_events" in session_data.get("session_data", {}):
        for event in session_data["session_data"]["auth_events"]:
            try:
                event_data = json.loads(event)
                report["authentication_events"].append({
                    "timestamp": event_data.get("__REALTIME_TIMESTAMP", ""),
                    "priority": event_data.get("PRIORITY", ""),
                    "message": event_data.get("_MESSAGE", ""),
                    "unit": event_data.get("UNIT", ""),
                    "source": "journalctl"
                })
            except:
                continue

    if "active_processes" in session_data.get("session_data", {}):
        for line in session_data["session_data"]["active_processes"]:
            if line.strip():
                parts = line.split(None, 10)
                if len(parts) >= 11:
                    report["active_processes"].append({
                        "user": parts[0], "pid": parts[1], "cpu": parts[2], "mem": parts[3],
                        "vsz": parts[4], "rss": parts[5], "tty": parts[6], "stat": parts[7],
                        "start": parts[8], "time": parts[9],
                        "command": parts[10] if len(parts) > 10 else ""
                    })

    report = generate_findings(report)
    return report


def generate_findings(report: Dict[str, Any]) -> Dict[str, Any]:
    findings = []
    recommendations = []

    user_sessions = {}
    for session in report["active_sessions"]["users"]:
        user = session.get("user", "")
        user_sessions[user] = user_sessions.get(user, 0) + 1
    
    for user, count in user_sessions.items():
        if count > 1:
            findings.append({
                "severity": "medium", "type": "multiple_sessions",
                "title": f"User '{user}' has {count} active sessions",
                "description": f"User '{user}' is logged in from multiple locations.",
                "evidence": f"Active sessions: {count}"
            })
            recommendations.append(f"Review user '{user}' sessions")

    for login in report["login_history"]:
        login_time_str = login.get("login_time", "")
        if login_time_str:
            try:
                login_time = datetime.strptime(login_time_str.split()[1], "%H:%M")
                if login_time.hour < 7 or login_time.hour > 19:
                    findings.append({
                        "severity": "low", "type": "off_hours_login",
                        "title": "Login outside business hours",
                        "description": f"User logged in at {login_time_str}",
                        "evidence": f"Login time: {login_time_str}"
                    })
            except:
                pass

    failed_auths = sum(1 for event in report["authentication_events"] 
                      if "failed" in event.get("message", "").lower())
    
    if failed_auths > 0:
        findings.append({
            "severity": "high", "type": "failed_authentications",
            "title": f"{failed_auths} failed authentication attempts",
            "description": "Multiple failed authentication attempts detected.",
            "evidence": f"Failed auth events: {failed_auths}"
        })
        recommendations.append("Investigate source IP addresses")

    root_logins = sum(1 for login in report["login_history"] if login.get("user") == "root")
    if root_logins > 0:
        findings.append({
            "severity": "medium", "type": "root_login",
            "title": "Root login detected",
            "description": "Direct root login detected.",
            "evidence": f"Root logins: {root_logins}"
        })

    report["findings"] = findings
    report["recommendations"] = list(set(recommendations))
    return report


def generate_markdown_report(report: Dict[str, Any]) -> str:
    """Generate a markdown report from parsed session data"""
    md = []
    md.append(f"# Session Forensics Report")
    md.append(f"\n**Host:** {report['metadata']['hostname']}")
    md.append(f"**Analysis Timestamp:** {report['metadata']['analysis_timestamp']}")
    md.append(f"**Generated:** {report['metadata']['generated_at']}")
    md.append(f"\n> {report['metadata']['disclaimer']}")
    md.append("\n---\n")

    # Executive Summary
    md.append("## Executive Summary")
    md.append(f"\nTotal active sessions: {report['active_sessions']['total_count']}")
    md.append(f"Total findings: {len(report['findings'])}")
    md.append(f"Total recommendations: {len(report['recommendations'])}")
    md.append("\n---\n")

    # Active Sessions
    md.append("## Active Sessions")
    if report['active_sessions']['users']:
        for user in report['active_sessions']['users']:
            md.append(f"- **User:** {user.get('user', 'N/A')}")
            md.append(f"  - Session ID: {user.get('session_id', 'N/A')}")
            md.append(f"  - TTY: {user.get('tty', 'N/A')}")
            md.append(f"  - From: {user.get('from', 'N/A')}")
            md.append(f"  - Status: {user.get('status', 'N/A')}")
            md.append("")
    else:
        md.append("No active sessions detected.")
    md.append("\n---\n")

    # Findings
    md.append("## Findings")
    if report['findings']:
        for finding in report['findings']:
            severity_emoji = {
                'high': '🔴',
                'medium': '🟡',
                'low': '🟢'
            }.get(finding['severity'], '⚪')
            md.append(f"\n### {severity_emoji} {finding['title']}")
            md.append(f"**Severity:** {finding['severity']}")
            md.append(f"**Type:** {finding['type']}")
            md.append(f"\n{finding['description']}")
            md.append(f"\n**Evidence:** {finding['evidence']}")
    else:
        md.append("No security findings detected.")
    md.append("\n---\n")

    # Recommendations
    md.append("## Recommendations")
    if report['recommendations']:
        for i, rec in enumerate(report['recommendations'], 1):
            md.append(f"{i}. {rec}")
    else:
        md.append("No recommendations at this time.")
    md.append("\n---\n")

    # Authentication Events
    md.append("## Authentication Events")
    if report['authentication_events']:
        for event in report['authentication_events'][:10]:  # Limit to last 10
            md.append(f"- **{event['timestamp']}** [{event['priority']}] {event['message']}")
    else:
        md.append("No recent authentication events.")
    md.append("\n---\n")

    # Login History
    md.append("## Recent Login History")
    if report['login_history']:
        for login in report['login_history'][:10]:  # Limit to last 10
            md.append(f"- **{login['user']}** logged in at {login['login_time']} from {login['from']}")
    else:
        md.append("No login history available.")
    md.append("\n---\n")

    # Data Sources
    md.append("## Data Sources")
    md.append(f"Sources used: {', '.join(report['metadata']['data_sources'])}")
    md.append("\n---\n")
    md.append("*End of Report*")

    return "\n".join(md)


def generate_json_report(report: Dict[str, Any]) -> str:
    """Generate a JSON report from parsed session data"""
    return json.dumps(report, indent=2)


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Generate session forensics reports from collected data"
    )
    parser.add_argument(
        "--input",
        "-i",
        default="/tmp/latest-session-forensics.json",
        help="Path to session forensics JSON input file"
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output file path (default: stdout or auto-generated)"
    )
    parser.add_argument(
        "--format",
        "-f",
        choices=["markdown", "json", "both"],
        default="markdown",
        help="Output format (default: markdown)"
    )
    parser.add_argument(
        "--output-dir",
        "-d",
        default="/tmp",
        help="Output directory for reports (default: /tmp)"
    )

    args = parser.parse_args()

    # Read input file
    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    with open(args.input, 'r') as f:
        session_data = json.load(f)

    # Parse and analyze data
    report = parse_session_data(session_data)

    # Generate output
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    hostname = report['metadata']['hostname']

    if args.format == "markdown":
        output = generate_markdown_report(report)
        default_filename = f"session-forensics-{hostname}-{timestamp}.md"
    elif args.format == "json":
        output = generate_json_report(report)
        default_filename = f"session-forensics-{hostname}-{timestamp}.json"
    else:  # both
        md_output = generate_markdown_report(report)
        json_output = generate_json_report(report)
        md_filename = f"session-forensics-{hostname}-{timestamp}.md"
        json_filename = f"session-forensics-{hostname}-{timestamp}.json"
        md_path = os.path.join(args.output_dir, md_filename)
        json_path = os.path.join(args.output_dir, json_filename)
        with open(md_path, 'w') as f:
            f.write(md_output)
        with open(json_path, 'w') as f:
            f.write(json_output)
        print(f"Markdown report: {md_path}")
        print(f"JSON report: {json_path}")
        sys.exit(0)

    # Write output
    if args.output:
        output_path = args.output
    else:
        output_path = os.path.join(args.output_dir, default_filename)

    with open(output_path, 'w') as f:
        f.write(output)

    print(f"Report generated: {output_path}")


if __name__ == "__main__":
    main()
