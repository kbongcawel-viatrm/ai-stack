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
| `HOST_OS` | Existing hypervisor OS: `alpine`, `secureblue`, `arch`, or `ubuntu`. Set to `secureblue` when deploying directly onto an installed Fedora Secureblue host; the Alpine defaults below only apply when it is unset or `alpine` |
| `FCOS_QCOW2_URL` | Optional pin for the Fedora CoreOS QCOW2 URL — `https://`, `smb://`, `ftp://` or `ftps://`; when unset, the latest stable `qemu` image is resolved from the official stream metadata at deploy time. NAS credentials come from the `NAS_USER`/`NAS_PW` secrets |
| `FCOS_QCOW2_SHA256` | Optional SHA256 checksum matching `FCOS_QCOW2_URL`; must be set together with the URL |
| `KASM_POC_FCOS_IP` | Static IP reserved for the isolated FCOS test VM, e.g. `10.1.29.201` |
| `KASM_POC_SSH_USER` | SSH account on the test VM; normally `core` |
| `FCOS_LAN_CIDR` | Guest LAN CIDR, e.g. `10.1.29.0/24` |
| `FCOS_GATEWAY` | Guest LAN gateway, e.g. `10.1.29.1` |
| `FCOS_INTERFACE` | FCOS guest NIC, e.g. `enp1s0` |
| `FCOS_NETWORK_BRIDGE` | Existing libvirt bridge on the hypervisor |
| `FCOS_STORAGE_MOUNTPOINT` | Persistent local storage mountpoint (Alpine hosts only; ignored for other host OSes) |
| `FCOS_VM_STORAGE_PATH` | Persistent local VM image directory. Defaults to `/mnt/nvme/libvirt/images` on Alpine and `/var/lib/libvirt/images` on `secureblue`/`arch`/`ubuntu` |
| `STORAGE_UUID` | UUID of the Alpine host's persistent ext4 volume; required only when Host OS artifacts are selected |
| `ALPINE_HOST_NIC` | Physical NIC for the Alpine host bridge; Host OS artifacts stage only |
| `ALPINE_HOST_BRIDGE` | Alpine host bridge name; Host OS artifacts stage only |
| `STORAGE_FSTYPE` | Must be `ext4` for the current Alpine apkovl builder; Host OS artifacts stage only |
| `ALPINE_VERSION` | Alpine version; current builder accepts the configured 3.24 stable series; Host OS artifacts stage only |

The deployment defaults to a 2 GiB, 2-vCPU, 40 GiB test VM. This is a conservative starting point for the 8 GiB host, not validated Kasm sizing.

### Deploying onto an existing Secureblue host

The Host OS artifacts stage can be skipped entirely when the hypervisor already runs an installed OS such as Fedora Secureblue. In that case:

- Set `HOST_OS` to `secureblue` (repository variable) so the deploy and health-check stages use `/var/lib/libvirt/images` and Secureblue-specific handling (SELinux `restorecon`, `qemu` QEMU account).
- `FCOS_VM_STORAGE_PATH`/`FCOS_STORAGE_MOUNTPOINT` are not needed — the `/var/lib/libvirt/images` default applies.
- The Alpine-only variables (`STORAGE_UUID`, `ALPINE_*`, `STORAGE_FSTYPE`) can remain unset.
- The hypervisor must already have KVM, `libvirt`/`virt-install`, `qemu-img`, the `br0` (or configured) bridge, and `libvirtd` running. The pipeline does not bootstrap the host OS.

## Environment variables and secrets

Keep the existing GitHub environments and configure their values:

- **`host-vm-production`**: `HYPERVISOR_HOST`, `HYPERVISOR_USER`, optional `LIBVIRT_QEMU_USER` and `LIBVIRT_QEMU_GROUP`; secrets `HYPERVISOR_SSH_PRIVATE_KEY`, `HYPERVISOR_KNOWN_HOSTS`, `FCOS_SSH_PUBLIC_KEY`, and `NAS_USER`/`NAS_PW` when `FCOS_QCOW2_URL` points at an `smb://`/`ftp://`/`ftps://` share.
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
