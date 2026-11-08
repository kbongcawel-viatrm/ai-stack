# FCOS Butane Configuration

fcos.bu is the first-boot baseline for the FCOS guest. It is declarative: Ignition writes configuration, scripts and systemd unit definitions before normal userspace starts. Butane does not install RPM packages, download Suricata rules, initialize an AIDE database, or prove that IPS is working. Those runtime operations belong to Ansible after package prerequisites are present.

## Provisioned by Butane/Ignition

- SSH: public-key-only authentication, no password or keyboard-interactive authentication, root key login only, forwarding disabled, bounded login grace and retries.
- Firewalld: public zone attached to enp1s0, inbound target DROP, SSH accepted only from 192.168.1.0/24; host egress policy defaults to DROP and explicitly permits HTTP, HTTPS, DNS and NTP only when the source address is 192.168.1.20.
- Suricata: HOME_NET 192.168.1.0/24, EVE/fast logging, NFQ mode, local rules file, nftables input/output queues on enp1s0 with queue-bypass, and a dedicated NFQUEUE systemd service. The IPS service stays disabled until Ansible updates sources, enables ET Open, runs suricata -T, and completes post-deployment checks.
- Rootless Podman: shell export and docker/docker-compose aliases plus executable wrappers. A dedicated bootstrap script enables linger and the user's Podman socket. Ansible enables it only after confirming the configured user exists.
- Daily services: ClamAV signature update (01:40), ClamAV scan (02:00), Lynis audit (03:00), AIDE check (04:00). AIDE timer is disabled until its baseline has been initialized and reviewed. Suricata rule-update timer is disabled until the initial rule update passes.
- Logs: dedicated directories under /var/log/{suricata,clamav,lynis,aide}.

## Required inventory alignment

The example policy assumes:
- FCOS NIC: enp1s0
- FCOS LAN address: 192.168.1.20 (must be statically configured or DHCP-reserved)
- Trusted LAN: 192.168.1.0/24
- FCOS login user: core

If the FCOS address or interface differs, update the Butane file and Ansible inventory together before deployment. Do not deploy the default-drop egress policy with an unknown or dynamic source address; DNS and HTTP(S) will be blocked if the source does not match.

## Package boundary

The following executables must be installed in the FCOS deployment/image before their units can run: firewall-cmd, nft, podman, podman-compose, suricata, suricata-update, clamscan, freshclam, lynis, and aide. FCOS is image-based; use the dedicated Ansible package/layering workflow and reboot into the resulting deployment before enabling services. Do not assume Toolbox packages are available inside the FCOS VM.

## Render and validate

```bash
podman run --rm -i quay.io/coreos/butane:release --strict --pretty < diskless-os/butane/fcos.bu > /tmp/fcos.ign
jq -e '.ignition.version and .systemd.units' /tmp/fcos.ign >/dev/null
```

The repository validation workflow runs the strict Butane transpiler. YAML parsing alone is not a substitute for Butane schema validation.

## Operational gates

1. Confirm the FCOS SSH key and console recovery before applying SSH hardening.
2. Confirm 192.168.1.20 is the FCOS VM address and the router reserves it.
3. Run firewall-cmd --get-active-zones and verify enp1s0 is in public.
4. Run suricata-update update-sources, enable et/open, update rules, then run suricata -T -c /etc/suricata/suricata.yaml. Enable suricata-nfq.service only after success.
5. Validate IDS alerting and IPS dropping with a separate LAN test endpoint. A running process or populated EVE log is not sufficient.
6. Initialize AIDE once, review the baseline, then enable aide-check.timer. Never automatically reinitialize the baseline after a failed check.
7. Verify docker info identifies Fedora CoreOS and rootless: true; a Toolbox connected to the host socket is not an FCOS validation.
