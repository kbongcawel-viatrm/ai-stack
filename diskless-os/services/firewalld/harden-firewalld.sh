#!/usr/bin/env bash
set -Eeuo pipefail

# CIS-oriented firewalld hardening
#
# Execute:
#   run0 -i ./harden-firewalld.sh
#
# Optional environment variables:
#   ALLOW_SSH=yes       Keep SSH access (default: yes)
#   ALLOW_DNS=yes       Allow inbound DNS TCP/UDP (default: yes)
#   ALLOW_HTTPS=yes     Allow inbound HTTPS (default: yes)

ZONE="public"

ALLOW_SSH="${ALLOW_SSH:-yes}"
ALLOW_DNS="${ALLOW_DNS:-yes}"
ALLOW_HTTPS="${ALLOW_HTTPS:-yes}"

BACKUP_DIR="/var/backups/firewalld"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

log() {
    printf '[INFO] %s\n' "$*"
}

die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 1
}

# Require root.
[[ "${EUID}" -eq 0 ]] || die "Run with: run0 -i $0"

# Validate options.
for value in "$ALLOW_SSH" "$ALLOW_DNS" "$ALLOW_HTTPS"; do
    [[ "$value" == yes || "$value" == no ]] ||
        die "Options must be yes or no."
done

command -v firewall-cmd >/dev/null ||
    die "firewall-cmd is not installed."

systemctl is-active --quiet firewalld ||
    die "firewalld is not running."

firewall-cmd --get-zones | grep -qw "$ZONE" ||
    die "Zone does not exist: $ZONE"

# Backup permanent configuration.
log "Backing up firewalld configuration..."

install -d -m 0700 "$BACKUP_DIR"

if [[ -d /etc/firewalld ]]; then
    tar -czf "${BACKUP_DIR}/firewalld-${TIMESTAMP}.tar.gz" \
        -C /etc firewalld
fi

# Display current topology before modification.
log "Current active zones:"
firewall-cmd --get-active-zones

log "Current default zone:"
firewall-cmd --get-default-zone

log "Checking existing forwarding policies..."
firewall-cmd --permanent --get-policies

# Set default zone.
log "Setting default zone to public..."
firewall-cmd --set-default-zone="$ZONE"

# Set strict default inbound behavior.
log "Setting public zone target to DROP..."
firewall-cmd --permanent --zone="$ZONE" --set-target=DROP

# Remove all existing services from public.
log "Removing existing public-zone services..."

for service in $(firewall-cmd --permanent \
    --zone="$ZONE" --list-services); do

    log "Removing service: $service"
    firewall-cmd --permanent \
        --zone="$ZONE" --remove-service="$service"
done

# Remove all explicitly allowed ports.
log "Removing existing public-zone ports..."

for port in $(firewall-cmd --permanent \
    --zone="$ZONE" --list-ports); do

    log "Removing port: $port"
    firewall-cmd --permanent \
        --zone="$ZONE" --remove-port="$port"
done

# Apply required service allowlist.
if [[ "$ALLOW_HTTPS" == yes ]]; then
    log "Allowing HTTPS..."
    firewall-cmd --permanent \
        --zone="$ZONE" --add-service=https
fi

if [[ "$ALLOW_DNS" == yes ]]; then
    log "Allowing DNS TCP/UDP..."
    firewall-cmd --permanent \
        --zone="$ZONE" --add-port=53/tcp

    firewall-cmd --permanent \
        --zone="$ZONE" --add-port=53/udp
fi

if [[ "$ALLOW_SSH" == yes ]]; then
    log "Preserving SSH access..."
    firewall-cmd --permanent \
        --zone="$ZONE" --add-service=ssh
else
    log "SSH access will be removed from public zone."
fi

# Do not modify forwarding, masquerading, or inter-zone policies.
log "Preserving forwarding, masquerading and existing policies."

# Validate permanent configuration.
log "Validating permanent firewalld configuration..."
firewall-cmd --check-config ||
    die "Firewalld configuration validation failed."

# Apply permanent configuration.
log "Reloading firewalld..."
firewall-cmd --reload

# Verify resulting configuration.
log "Verifying public zone..."

firewall-cmd --zone="$ZONE" --list-all

log "Verifying default zone..."
[[ "$(firewall-cmd --get-default-zone)" == "$ZONE" ]] ||
    die "Default zone verification failed."

log "Verifying public zone target..."
[[ "$(firewall-cmd --zone="$ZONE" --get-target)" == DROP ]] ||
    die "Public zone target verification failed."

log "Verifying firewalld service..."
systemctl is-active --quiet firewalld ||
    die "Firewalld service is not active."

log "Firewalld hardening completed."
log "Backup: ${BACKUP_DIR}/firewalld-${TIMESTAMP}.tar.gz"
