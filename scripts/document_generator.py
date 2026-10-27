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
