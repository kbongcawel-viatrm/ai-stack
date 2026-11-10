#!/usr/bin/env bash
# suricata-prepare — runs before suricata.service on first boot and after
# package layering. Installed to /usr/local/sbin/suricata-prepare by the
# suricata Butane fragment.
set -Eeuo pipefail
/usr/local/sbin/fcos-services-preflight
install -d -o suricata -g suricata -m 0770 /var/log/suricata
install -d -o suricata -g suricata -m 0750 /var/run/suricata
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
trap - EXIT
find /var/lib/suricata -maxdepth 1 -type d -name 'rules.rollback.*' -mtime +7 -exec rm -rf -- {} +
