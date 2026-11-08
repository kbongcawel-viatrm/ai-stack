# Service Configuration

Ansible is the source of deployed FCOS configuration. Keep service notes/templates synchronized.

- Suricata: passive IDS baseline; validate interface and packet delivery. NFQUEUE IPS is a distinct mode.
- Firewalld: inbound default-drop; SSH from `192.168.1.0/24` only.
- SSH: key-only; password/keyboard-interactive disabled; root key login permitted.
- AIDE: daily check after trusted baseline initialization/review.
- ClamAV: daily clamscan, logs in `/var/log/clamav`; no automatic deletion.
- Lynis: daily audit/report under `/var/log/lynis`.
