# FCOS Butane Configuration

The FCOS first-boot configuration is composed from modular Butane fragments:

- `fcos.bu` — base fragment: accounts, NetworkManager static IPv4, sysctl
  hardening, rootless Podman plumbing, the rpm-ostree package layer, the
  cross-service preflight oneshot, logrotate and masked rootful sockets.
- `diskless-os/services/<service>/<service>.bu` — one fragment per service
  (aide, clamav, firewalld, lynis, ssh, suricata). Each fragment owns its
  config files, `/usr/local/sbin` payload scripts and systemd units, including
  a first-boot `provision-<service>.service` oneshot where applicable.

`compose-bu.py` renders every fragment, inlining repository files referenced
by `@@include <path>@@` markers inside `contents.inline` blocks, and generates
`root.bu`, which merges all fragments through `ignition.config.merge`.

## Build

From the repository root (Python 3.10+, no third-party packages):

```bash
python3 diskless-os/butane/compose-bu.py --out-dir build/bu
```

Then substitute the deployment variables in each rendered `*.bu` (except
`root.bu`) and transpile:

```bash
for bu in build/bu/*.bu; do
  n="${bu%.bu}"
  [ "$n" = "build/bu/root" ] && continue
  envsubst '${FCOS_SSH_PUBLIC_KEY} ${FCOS_CORE_PASSWORD_HASH} ${FCOS_LAN_IP} ${FCOS_LAN_CIDR} ${FCOS_GATEWAY}' \
    < "$bu" > "$n.rendered.bu"
  butane --strict --pretty --output "$n.ign" "$n.rendered.bu"
done
butane --strict --pretty --files-dir build/bu --output build/fcos.ign build/bu/root.bu
```

The Deploy Host VM and Validate workflows perform this sequence automatically.
The final `fcos.ign` contains `ignition.config.merge` entries with embedded
fragment configs; Ignition merges them at first boot.

## Deployment variables

| Variable | Default | Purpose |
|---|---|---|
| FCOS_SSH_PUBLIC_KEY | Required | Public key for FCOS core |
| FCOS_LAN_IP | 192.168.1.201 | Static guest IPv4 address |
| FCOS_LAN_CIDR | 192.168.1.0/24 | Trusted LAN and Suricata HOME_NET |
| FCOS_GATEWAY | 192.168.1.1 | Default gateway and DNS |
| ~~FCOS_INTERFACE~~ | — | Deprecated: guest NIC name is auto-detected; config is interface-name agnostic |

Only these placeholders are substituted. Do not substitute every shell
variable in embedded scripts; that would corrupt shell expressions such as
`BASH_VERSION` or `${FCOS_ZONE:-public}` defaults inside provision scripts.

## Provisioned by Butane/Ignition

- **SSH:** core public-key authentication, password and keyboard-interactive
  authentication disabled, root remote login only by key, forwarding/tunneling
  disabled, bounded login grace and authentication retries. `ssh-provision`
  validates `sshd -t` once at boot.
- **NetworkManager:** static IPv4 on the configured NIC, configured
  gateway/DNS, IPv6 disabled in this profile.
- **Kernel/sysctl:** disables IP forwarding and applies network, ptrace, BPF,
  kexec, core-dump and kernel-information hardening. Review these settings
  before changing the workload; they are intended for a host VM, not a general
  router.
- **Firewalld:** public zone on the FCOS NIC, inbound target DROP, SSH only
  from FCOS_LAN_CIDR; fcos-host-egress is a HOST -> ANY policy with default
  DROP and source FCOS_LAN_IP. It permits HTTP/HTTPS, DNS and NTP, including
  explicit TCP 80/443 and DNS/NTP ports. `firewalld-provision` verifies the
  running firewall matches the declarative policy. The bootstrap nftables
  table protects first boot until firewalld is layered and active.
- **Suricata:** FCOS override sets HOME_NET, EXTERNAL_NET, suricata.rules plus
  local.rules, NFQ mode accept, EVE logging and queue 0. nftables hooks queue
  host INPUT/OUTPUT traffic on the configured NIC at priority -150, with queue
  bypass. `suricata-prepare.service` runs package preflight,
  suricata-update update-sources, enables free ET Open (et/open), updates
  rules and runs `suricata -T` on the base config and the FCOS override; a
  failed update/test restores the previous rules directory and prevents
  Suricata startup. `suricata-rule-refresh.timer` reruns the transactional
  update weekly and restarts Suricata only after validation succeeds.
- **ClamAV:** one daily clamav-scan.timer at 02:00. The scan service starts
  the freshclam one-shot dependency first, then performs a read-only scan of
  /etc, /usr, /opt and /var/home. No automatic deletion or quarantine. The
  separate freshclam timer is disabled to avoid a second daily update.
  `clamav-provision` seeds the signature database once if absent.
- **Lynis:** daily audit at 03:00; `lynis-provision` verifies the environment.
- **AIDE:** daily check at 04:00. Its timer is disabled until a trusted
  baseline is initialized and explicitly reviewed; `aide-provision` reports
  baseline status but never creates one.
- **Logrotate:** daily rotation for ClamAV, Lynis and AIDE logs.
- **Rootless Podman:** rootless user socket for core UID 1000, linger,
  CONTAINER_HOST and DOCKER_HOST exports, and interactive docker/
  docker-compose aliases. Rootful system Podman/Docker sockets are masked.
- **Preflight:** systemd service checks that required binaries and Suricata
  NFQUEUE support exist before security services start.
- **Package layer:** fcos-package-layer.service is a first-boot oneshot gated
  by /var/lib/rpm-ostree-install.stamp. It runs rpm-ostree install
  --idempotent --allow-inactive for python3, firewalld, nftables, suricata,
  aide, clamav, clamav-freshclam, lynis, podman-compose and logrotate, writes
  the stamp, then reboots into the staged deployment. A reboot is required:
  --apply-live cannot materialize package-owned /etc files (e.g.
  /etc/suricata/suricata.yaml). Output streams to journald and the boot
  console; failures abort before the stamp.
- **Quadlet directory:** /var/home/core/.config/containers/systemd/ is created
  for rootless application Quadlets. Podman's quadlet generator turns
  *.container files there into core user units, started at boot because
  linger is enabled.

Butane writes files, policy and systemd units, and its first-boot oneshot
performs the RPM layering followed by a reboot into the staged deployment.
Ansible playbooks handle configuration management and validation only; they
do not perform sequential package installation. Butane does not download
signatures, initialize an AIDE database, or prove packet inspection.

## Operational gates

1. Confirm the FCOS static IP and interface match the DHCP reservation and Ansible inventory.
2. Preserve console recovery before applying the default-DROP firewall and SSH hardening.
3. Confirm fcos-package-layer.service completed and FCOS rebooted into the layered deployment before relying on the services.
4. Confirm Firewalld public target is DROP and its only inbound exception is LAN SSH. Kasm HTTPS ingress is intentionally not opened.
5. Confirm the egress policy contains the explicit FCOS source IP, HTTP/HTTPS services and TCP 80/443 ports.
6. Run suricata -T -c /etc/suricata/suricata.yaml --include /etc/suricata/fcos-overrides.yaml. The Ansible prepare unit performs the initial update/test before Suricata starts.
7. Validate IDS alerting and IPS dropping with a separate controlled HTTP endpoint on the trusted LAN. Service status alone is not proof.
8. Initialize AIDE once, review the baseline, then run enable-aide-check.yml. Never automatically rebaseline after an unexplained change.
9. Verify podman info reports rootless: true and the remote socket points to the FCOS core user's runtime directory. A Toolbox connected to the host socket is not FCOS validation.

## Render and validate

Set FCOS_SSH_PUBLIC_KEY, FCOS_LAN_IP, FCOS_LAN_CIDR, FCOS_GATEWAY and
FCOS_CORE_PASSWORD_HASH in the environment. Run
compose-bu.py, substitute only the allowlisted variables in each rendered
fragment, transpile with `butane --strict`, then transpile `root.bu` with
`--files-dir`. The repository validation workflow performs this operation
automatically.
