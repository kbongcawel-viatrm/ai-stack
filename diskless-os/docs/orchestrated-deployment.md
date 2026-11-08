# Orchestrated FCOS deployment

The `.github/workflows/orchestrate-deployment.yml` workflow provides a checkbox-driven, sequential pipeline.

## Pipeline stages

The manual workflow dispatch inputs select which stages to run:

1. **Host OS artifacts** — builds and publishes the Alpine diskless boot artifacts. This does not change router DHCP/PXE settings, reboot the physical host, or install the host OS.
2. **Deploy isolated FCOS VM** — deploys the `fcos-kasm-poc` libvirt guest on an already configured hypervisor.
3. **Kasm compatibility gate** — tests the Docker-compatible API and Compose interface against the guest's rootless Podman socket. It does not install Kasm.
4. **Provision FCOS services** — layers/configures services on the same test guest.
5. **Health check** — checks the hypervisor and the same test guest.

Each selected stage waits for the preceding stages. An unchecked stage is skipped and does not block later selected stages. A failed or cancelled selected stage prevents subsequent stages from running. For example, if the Kasm compatibility gate fails, service provisioning and health checks are skipped.

## Required repository-level Actions variables

The orchestrator passes these values to reusable workflows, so define them as **repository or organization variables**, not only as environment-scoped variables:

| Variable | Purpose |
|---|---|
| `HOST_OS` | Existing hypervisor OS: `alpine`, `secureblue`, `arch`, or `ubuntu` |
| `FCOS_QCOW2_URL` | Pinned Fedora CoreOS QCOW2 URL |
| `FCOS_QCOW2_SHA256` | SHA256 checksum for that exact image |
| `KASM_POC_FCOS_IP` | Static IP reserved for the isolated FCOS test VM |
| `KASM_POC_SSH_USER` | SSH account on the test VM; normally `core` |
| `FCOS_LAN_CIDR` | Guest LAN CIDR, e.g. `192.168.1.0/24` |
| `FCOS_GATEWAY` | Guest LAN gateway |
| `FCOS_INTERFACE` | FCOS guest NIC, e.g. `enp1s0` |
| `FCOS_NETWORK_BRIDGE` | Existing libvirt bridge on the hypervisor |
| `FCOS_STORAGE_MOUNTPOINT` | Persistent local storage mountpoint |
| `FCOS_VM_STORAGE_PATH` | Persistent local VM image directory |
| `STORAGE_UUID` | UUID of the Alpine host's persistent ext4 volume; required when Host OS artifacts are selected |
| `ALPINE_HOST_NIC` | Physical NIC for the Alpine host bridge |
| `ALPINE_HOST_BRIDGE` | Alpine host bridge name |
| `STORAGE_FSTYPE` | Must be `ext4` for the current Alpine apkovl builder |
| `ALPINE_VERSION` | Alpine version; current builder accepts the configured 3.24 stable series |

The deployment defaults to a 2 GiB, 2-vCPU, 40 GiB test VM. This is a conservative starting point for the 8 GiB host, not validated Kasm sizing.

## Environment variables and secrets

Keep the existing GitHub environments and configure their values:

- **`host-vm-production`**: `HYPERVISOR_HOST`, `HYPERVISOR_USER`, optional `LIBVIRT_QEMU_USER` and `LIBVIRT_QEMU_GROUP`; secrets `HYPERVISOR_SSH_PRIVATE_KEY`, `HYPERVISOR_KNOWN_HOSTS`, and `FCOS_SSH_PUBLIC_KEY`.
- **Repository variable and `kasm-poc` environment**: `KASM_POC_SSH_USER` (normally `core`); secrets `KASM_POC_SSH_PRIVATE_KEY` and `KASM_POC_KNOWN_HOSTS`.
- **`fcos-production`**: `HYPERVISOR_HOST`, `HYPERVISOR_USER`, `FCOS_LAN_CIDR`, `FCOS_INTERFACE`, and any existing FCOS variables; secrets `FCOS_SSH_PRIVATE_KEY`, `FCOS_KNOWN_HOSTS`, `HYPERVISOR_SSH_PRIVATE_KEY`, and `HEALTH_KNOWN_HOSTS`.
- **`pxe-production`**: secrets `PXE_SSH_PRIVATE_KEY`, `PXE_KNOWN_HOSTS`, `PXE_HOST`, `PXE_USER`, and `PXE_HTTP_ROOT`.
- **Repository secret**: `ALPINE_SSH_PUBLIC_KEY`, used to build the Alpine host overlay.

The `FCOS_SSH_PUBLIC_KEY` used during Ignition must match the private key installed as `KASM_POC_SSH_PRIVATE_KEY` and `FCOS_SSH_PRIVATE_KEY` in their respective environments. The known-hosts values must contain the verified host key for the test VM. Do not disable SSH host-key checking to work around a mismatch.

## Dispatch procedure

1. Open **Actions → Orchestrate infrastructure deployment → Run workflow**.
2. Select the required stages using the checkboxes.
3. If the Kasm POC is selected, explicitly check **Confirm isolated test VM**.
4. If service provisioning is selected, provide the IP of a controlled LAN HTTP server for Suricata IDS/IPS validation.
5. Keep **Enable AIDE timer** unchecked unless the AIDE baseline has already been initialized, reviewed, and approved; supply the approval reason if enabling it.
6. Dispatch and inspect each stage's result before proceeding.

## Operational boundaries

- Host OS artifact publication is not physical host installation. Router DHCP/PXE configuration, boot-order changes, and the physical reboot remain operator actions.
- Host VM deployment requires an already configured KVM/libvirt hypervisor, bridge, and mounted persistent local storage. It does not bootstrap the hypervisor.
- The VM deployment refuses to overwrite an existing libvirt domain or orphaned overlay. Inspect/remove old test resources only through a separately approved recovery procedure.
- The Kasm gate deliberately fails closed if the observed engine is Podman rather than the required Docker Engine/Compose implementation. It does not switch to rootful Podman.
- The service-provisioning and health-check stages are pointed at `KASM_POC_FCOS_IP` and use the FCOS CoreOS account. Ensure the private key in `fcos-production` is the key pair corresponding to the public key injected during VM deployment.
- Do not run this pipeline against a production guest. It is designed for the disposable `fcos-kasm-poc` VM.
