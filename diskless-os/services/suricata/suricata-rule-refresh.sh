#!/usr/bin/env bash
# suricata-rule-refresh — weekly transactional rule update. Installed to
# /usr/local/sbin/suricata-rule-refresh by the suricata Butane fragment and
# run by suricata-rule-refresh.timer.
set -Eeuo pipefail
rules_dir=/var/lib/suricata/rules
backup_dir="/var/lib/suricata/rules.rollback.$(date +%Y%m%d%H%M%S)"
had_rules=0
install -d -m 0755 "$rules_dir"
if [[ ! -e "$rules_dir/local.rules" ]]; then
  printf '# Local IDS/IPS validation rules are managed by Ansible.\n' > "$rules_dir/local.rules"
  chmod 0644 "$rules_dir/local.rules"
fi
cp -a "$rules_dir" "$backup_dir"
had_rules=1
rollback() {
  rc=$?
  if (( rc != 0 )); then
    rm -rf -- "$rules_dir"
    if (( had_rules == 1 )) && [[ -d "$backup_dir" ]]; then
      mv -- "$backup_dir" "$rules_dir"
    fi
  fi
  exit "$rc"
}
trap rollback EXIT
suricata-update update-sources
suricata-update enable-source et/open
suricata-update
chown -R suricata:suricata "$rules_dir"
suricata -T -c /etc/suricata/suricata.yaml
suricata -T -c /etc/suricata/suricata.yaml --include /etc/suricata/fcos-overrides.yaml
if systemctl is-active --quiet suricata.service; then
  systemctl restart suricata.service
fi
trap - EXIT
find /var/lib/suricata -maxdepth 1 -type d -name 'rules.rollback.*' -mtime +7 -exec rm -rf -- {} +
