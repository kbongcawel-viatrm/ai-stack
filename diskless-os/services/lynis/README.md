# Lynis

What it installs:
- Daily Lynis scan at 03:00, with up to 15 minutes randomized delay.
- Systemd service and timer.
- Timestamped logs in /var/log/lynis/.
- latest.log symlink to the latest scan.
- Log rotation: 12 weekly logs retained.
- Basic systemd service hardening.