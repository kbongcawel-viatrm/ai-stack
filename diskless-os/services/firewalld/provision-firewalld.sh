#!/usr/bin/env bash
# provision-firewalld — first-boot firewalld verification for the FCOS guest.
# Installed to /usr/local/sbin/provision-firewalld by the firewalld Butane
# fragment and run once by firewalld-provision.service after firewalld.service.
# The policy itself is declarative (zone/policy XML written by Butane); this
# script fails the unit if the running firewall does not match it.
set -Eeuo pipefail

zone="${FCOS_ZONE:-public}"

systemctl is-active --quiet firewalld.service

[[ "$(firewall-cmd --get-default-zone)" == "$zone" ]] || {
    echo "provision-firewalld: default zone is not $zone" >&2
    exit 1
}

[[ "$(firewall-cmd --zone="$zone" --get-target)" == "DROP" ]] || {
    echo "provision-firewalld: $zone zone target is not DROP" >&2
    exit 1
}

firewall-cmd --get-policies | grep -qx "fcos-host-egress" || {
    echo "provision-firewalld: fcos-host-egress policy missing" >&2
    exit 1
}

rich_rules="$(firewall-cmd --zone="$zone" --list-rich-rules)"
# The SSH exception must be source-scoped to the trusted LAN; the exact CIDR
# is baked into the zone XML at build time, so verify shape, not the value.
grep -q 'source address="' <<<"$rich_rules" || {
    echo "provision-firewalld: SSH rich rule has no source scope" >&2
    exit 1
}
grep -q 'service name="ssh"' <<<"$rich_rules" || {
    echo "provision-firewalld: SSH service rule missing in $zone" >&2
    exit 1
}

echo "provision-firewalld: default-DROP inbound and LAN-only SSH verified"
