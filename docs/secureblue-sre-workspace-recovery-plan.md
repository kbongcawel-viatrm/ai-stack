# Secureblue SRE Workspace: Golden Image, Recovery and Implementation Plan

**Document status:** Proposed implementation plan  
**Target platform:** Fedora Secureblue desktop, Fedora Toolbox, rootless Podman where supported  
**Configuration management:** Ansible  
**Infrastructure as code:** Terraform  
**Source control and CI/CD:** GitHub and GitHub Actions  
**Workspace backup/synchronization:** `rsync`  
**Host desktop restoration:** Existing `desktop-config` Flatpak application  
**Agent tooling:** OpsCode initially; TalkOps as a later optional operations supervisor

---

## 1. Executive summary

The goal is to make the workstation and its development environment recoverable after either:

1. A Fedora Secureblue host failure, including an update or configuration that leaves the host unusable; or
2. A development-workspace failure, such as a corrupted Toolbox, broken toolchain, damaged agent configuration, or lost project checkout.

The recovery process must not depend on the normal host or the agent runtime being operational.

The proposed host recovery sequence follows the user's intended approach:

1. Reinstall Fedora Secureblue from verified installation media.
2. Run the `desktop-config` Flatpak application to restore host Flatpaks and general desktop configuration/state.
3. Use `rsync` to restore the workspace's non-project files and configuration from an external backup.
4. Use Git to clone project repositories into the workspace.
5. Run the workspace bootstrap to create the Toolbox from a pinned golden image and apply Ansible configuration.
6. Reauthenticate to GitHub and cloud providers.
7. Run validation and resume development.

**Important boundary:** the `desktop-config` application is treated here as the user's existing restoration mechanism. Its exact backup format, coverage, and restore semantics have not been independently verified. Test it before relying on it as the sole source for host configuration recovery.

The design has two independent recovery paths:

- **Host recovery:** installation media, a saved Secureblue deployment reference, the desktop configuration backup, and workspace backup.
- **Workspace recovery:** Git, a golden OCI image, Ansible, and `rsync` backups.

OpsCode and TalkOps are optional orchestration/assistance layers. Neither is a recovery dependency.

---

## 2. Architecture and responsibility boundaries

| Layer | Primary responsibility | Source of truth |
|---|---|---|
| Secureblue host | Boot, kernel, security policy, desktop session | Secureblue image/deployment and documented host configuration |
| Host desktop state | Flatpak applications and supported desktop preferences | `desktop-config` backup/export |
| Workspace files | Dotfiles, agent configuration, scripts, workspace metadata | Git plus `rsync` backup |
| Project source | Application and infrastructure repositories | Git remotes |
| Development environment | CLI tools, libraries, agent runtime | Versioned Toolbox OCI image |
| Workspace configuration | Idempotent setup and validation | Ansible |
| Cloud infrastructure | AWS/Azure resources | Terraform and remote state |
| Backup | Recovery copies of files not safely reconstructible from Git | `rsync` destination with snapshots/versioning |
| Agentic development | Engineering task execution | OpsCode |
| Operations coordination | Optional multi-agent operational workflows | TalkOps, if adopted |

### Design rules

- Keep the host minimal. Prefer development dependencies inside Toolbox.
- Keep host recovery independent from Toolbox and AI agents.
- Do not store credentials, private keys, access tokens, or plaintext secrets in Git or OCI images.
- Do not treat cloud synchronization as a backup unless historical versions and deletion recovery are available.
- Use Git for project source and `rsync` for workspace state that is not represented by Git.
- Keep Terraform state in a supported remote backend with locking/versioning where available; do not casually copy a live local state file while Terraform may be running.
- Use explicit human approval for destructive restore, host changes, production Terraform applies, and credential/security-policy changes.

---

## 3. Secureblue deployment commit: capture, pin, store and boot

### 3.1 Understand what the commit hash represents

Secureblue is delivered as bootable images and uses the Fedora Atomic/rpm-ostree deployment model. An OSTree deployment is associated with a commit checksum. The bootloader menu entries are generated for deployments that are installed/staged on the machine.

The checksum is **not normally typed into the GRUB command line**. Instead:

1. Capture and preserve the desired deployment checksum.
2. Ensure that deployment is still present locally, or that the exact commit can be retrieved from a trusted remote.
3. Deploy/stage that commit using the OSTree/rpm-ostree tooling supported by the installed system.
4. Reboot.
5. Select the corresponding generated deployment entry in GRUB.

A commit hash written in a text file does not itself preserve the deployment or guarantee that the remote will continue to serve it.

### 3.2 Capture the currently booted and available deployments

Run on the **Secureblue host**, not inside Toolbox:

```bash
rpm-ostree status -v
ostree admin status
```

Record:

- The booted deployment (marked with `*` in `ostree admin status`).
- Its full OSTree checksum.
- The origin/refspec.
- Secureblue image variant and architecture.
- Fedora major version.
- Date captured.
- `rpm-ostree` version.
- Whether the deployment is pinned.
- The signed image reference/digest, if available from the image release/build metadata.

Do not record only a short Git commit from the Secureblue source repository. The OSTree deployment checksum and the source Git commit are different identifiers.

### 3.3 Pin a known-good deployment

After confirming the current boot is healthy and the intended deployment is the currently booted entry, pin it:

```bash
sudo ostree admin pin 0
```

Then verify:

```bash
ostree admin status
rpm-ostree status -v
```

The index is positional and can change after updates or other deployment operations. Check the output immediately before pinning; do not assume index `0` always means the same deployment in every context.

Pinning helps keep a known-good deployment available in the local boot menu. It is not an off-device backup and does not protect against disk failure or a full reinstallation.

### 3.4 Store a deployment manifest outside the host

Store the manifest in the recovery repository and copy it to the external backup location. Example:

```yaml
# host/secureblue-deployment.yml
captured_at: "YYYY-MM-DD"
distribution: "secureblue"
fedora_major: "<major-version>"
architecture: "<x86_64-or-aarch64>"
image_variant: "<exact-secureblue-image-variant>"

deployment:
  ostree_checksum: "<full-ostree-commit-checksum>"
  origin_refspec: "<origin-refspec-from-ostree-admin-status>"
  pinned: true

image:
  registry_reference: "<exact-signed-image-reference>"
  digest: "sha256:<image-digest-if-known>"

boot:
  bootloader: "GRUB"
  note: "Select the generated menu entry for the staged/pinned deployment."

verification:
  rpm_ostree_version: "<version>"
  capture_command: "rpm-ostree status -v && ostree admin status"
```

The values above are placeholders. Populate them from the actual machine; do not copy a sample checksum or invent an image digest.

Also preserve the raw command output for forensic/recovery use:

```bash
mkdir -p "$HOME/secureblue-recovery"
rpm-ostree status -v > "$HOME/secureblue-recovery/rpm-ostree-status.txt"
ostree admin status > "$HOME/secureblue-recovery/ostree-admin-status.txt"
rpm-ostree --version > "$HOME/secureblue-recovery/rpm-ostree-version.txt"
```

Copy this directory to the external recovery backup.

### 3.5 Booting a known-good deployment

**Normal update failure, where the previous deployment remains installed:**

1. Show the GRUB menu during startup (the exact key/timing depends on firmware and boot configuration).
2. Select the previous/pinned Secureblue deployment.
3. Boot and verify the system.
4. Once booted, inspect:

```bash
rpm-ostree status -v
ostree admin status
```

Secureblue's FAQ describes selecting the previous deployment at GRUB entry position 1 after a new deployment has been staged. Do not rely solely on a fixed numeric menu position: read the labels and identify the intended deployment.

**When a specific saved checksum must be staged:**

Only do this after confirming that the exact commit is available locally or can be fetched from the configured trusted remote, and after checking the installed `rpm-ostree` version and Secureblue's current instructions.

The rpm-ostree administrator interface supports deploying a specific commit/version. The general form is:

```bash
sudo rpm-ostree deploy <FULL_OSTREE_COMMIT_CHECKSUM>
```

Then inspect the pending deployment:

```bash
rpm-ostree status -v
ostree admin status
```

Reboot only after confirming that the expected deployment is staged and that its origin/signature/trust chain is appropriate.

Do not use an unverified registry reference or weaken Secureblue's container/image trust policy just to make a deployment install. Secureblue documents signed image handling and its default image trust policy.

**If the commit is no longer available:** a checksum alone cannot recreate it. Use the pinned local deployment if the disk is intact, or reinstall a currently supported Secureblue release and restore configuration. If exact historical host-image reproduction is a requirement, maintain a trusted, retained image artifact and its verification/provenance data; validate that the Secureblue-supported deployment process can consume it before depending on it.

### 3.6 GRUB configuration warning

Secureblue documents that Fedora 41 and later Atomic desktop GRUB configuration is static. Do not edit `/boot/grub2/grub.cfg` or run `grub2-mkconfig` as a routine way to add deployment entries. Let rpm-ostree/OSTree manage its deployment entries. Secureblue documents `/boot/grub2/user.cfg` and `/boot/grub2/console.cfg` as supported inclusion points for certain manual configuration, but this plan does not require custom GRUB scripting.

---

## 4. Host disaster-recovery procedure

This is the proposed full-reinstall path when the existing Secureblue deployment cannot be recovered.

### Phase A — Prepare before a disaster

Maintain an external recovery bundle containing:

- Verified Secureblue installation media and its checksum/signature verification material.
- Secureblue image variant, Fedora major version, architecture, and deployment manifest.
- `desktop-config` export/backup and restore instructions.
- Workspace `rsync` backup.
- Recovery repository URL and a local copy of essential recovery instructions/scripts.
- Git repository URLs and required access/authentication instructions.
- Toolbox image reference and immutable digest.
- Ansible playbooks and version manifest.
- Network/VPN and disk-encryption recovery instructions.
- Recovery test report.

Keep this bundle on storage independent of the workstation's internal disk. Protect it against unauthorized access.

### Phase B — Reinstall Secureblue

1. Boot the verified Secureblue installation media.
2. Install the correct desktop/image variant and architecture.
3. Enable disk encryption and Secure Boot according to the current Secureblue installation guidance and the machine's requirements.
4. Complete first boot and Secureblue post-install steps.
5. Verify the system before restoring user data:

```bash
rpm-ostree status -v
ujust audit-secureblue
```

The exact post-install requirements may vary by image and release. Follow the current Secureblue installation and post-install documentation.

### Phase C — Restore desktop configuration

1. Install/open the existing `desktop-config` Flatpak application using its documented installation procedure.
2. Point it at the known-good backup/export.
3. Restore the supported host Flatpak application inventory and general desktop configuration/state.
4. Reboot or log out/in if the application requires it.
5. Verify critical applications and desktop settings manually.

Do not assume this restores every host setting. Explicitly test coverage for Flatpak remotes, application IDs, user/system installation scope, app data, permissions/overrides, desktop preferences, extensions, fonts, themes, and any settings the app claims to support.

### Phase D — Restore workspace files with rsync

Restore non-project workspace state from the external backup. Examples include:

- Workspace bootstrap/recovery repository (if not already cloned).
- Dotfiles and shell configuration.
- Agent prompts, skills, and configuration.
- MCP configuration **without embedded credentials**.
- Workspace scripts and manifests.
- Local notes and other explicitly selected user files.

Do not restore the old Toolbox container's internal filesystem as the primary recovery method. Recreate the Toolbox from the golden image.

Use a dry run first. Example (adjust both paths and filters before use):

```bash
rsync -aHAXn --info=progress2 \
  /run/media/"$USER"/RECOVERY/workspace-state/ \
  "$HOME/Workspace/"
```

Review the proposed changes. If correct, repeat without `-n`:

```bash
rsync -aHAX --info=progress2 \
  /run/media/"$USER"/RECOVERY/workspace-state/ \
  "$HOME/Workspace/"
```

Notes:

- The trailing slash on the source means “copy the contents of this directory”.
- `-a` preserves common metadata; `-HAX` requests hard-link, ACL and extended-attribute preservation where supported by source, destination, and filesystem.
- If the backup filesystem or destination does not support ACLs/xattrs, adjust flags deliberately and document the limitation.
- Do not add `--delete` to the initial restore. It can remove destination files that are not present in the backup.
- Confirm ownership and permissions after restore. Do not blindly apply root ownership from a backup to user workspace files.
- Exclude caches, generated artifacts, container storage, and project working trees if those are intentionally rebuilt from other sources.

### Phase E — Clone projects with Git

Clone each project into the workspace from its authoritative remote:

```bash
mkdir -p "$HOME/Workspace/projects"
cd "$HOME/Workspace/projects"

git clone <PROJECT_GIT_URL>
```

For multiple projects, maintain a version-controlled repository manifest, for example:

```yaml
# config/projects.yml
projects:
  - name: infrastructure
    url: "<git-remote-url>"
    branch: "<default-branch>"
  - name: application
    url: "<git-remote-url>"
    branch: "<default-branch>"
```

Use a script or Ansible task to clone missing repositories and fetch existing ones. Do not overwrite local changes. For projects that contain uncommitted work at failure time, restore the relevant working-tree backup to a separate recovery directory or branch and reconcile it manually before continuing.

### Phase F — Rebuild development workspace

1. Authenticate to GitHub.
2. Pull the golden Toolbox image by immutable digest.
3. Create the Toolbox using the supported Toolbox workflow.
4. Run Ansible to configure tools, shell environment, OpsCode, skills and MCP definitions.
5. Reauthenticate to AWS/Azure using short-lived credentials or supported identity flows.
6. Recreate any required Podman volumes/services from declarative definitions.
7. Run workspace validation.

Example validation commands (adapt to actual repository paths and installed versions):

```bash
git --version
podman --version
toolbox --version
ansible --version
terraform version
ops --version
```

Run the repository's own validation playbook after these basic checks.

---

## 5. Workspace recovery and golden image lifecycle

### 5.1 Golden image contents

Build a Toolbox-compatible image, not an arbitrary Fedora container image. Start from the documented Toolbox base/image conventions and validate the result using the installed Toolbox version.

The image should contain stable, common development dependencies:

- Git and Git LFS
- Python runtime and selected build tooling
- Ansible
- Terraform (pinned version)
- GitHub CLI
- Shell utilities and editors
- Linters and test tools
- Required CA certificates and common libraries

Keep volatile project-specific dependencies, agent credentials, personal data, and secrets outside the image.

### 5.2 Configuration applied after image creation

Use Ansible for:

- OpsCode installation and version verification.
- Agent skills, policies and prompts.
- MCP server definitions (credentials injected separately).
- Shell configuration and dotfiles.
- Project-specific toolchains.
- Repository cloning and validation.
- User-level services where appropriate.

### 5.3 Release manifest

Every golden image release should record:

```yaml
workspace:
  release: "1.0.0"

image:
  reference: "<registry>/<namespace>/<image>"
  digest: "sha256:<verified-digest>"
  base_image: "<toolbox-compatible-base>"
  fedora_version: "<version>"

toolchain:
  terraform: "<pinned-version>"
  ansible_core: "<pinned-version>"
  github_cli: "<pinned-version>"
  opscode: "<pinned-version>"

configuration:
  ansible_revision: "<git-commit>"
  workspace_revision: "<git-commit>"
```

Use immutable image digests for recovery. A mutable tag such as `latest` may be convenient for development, but must not be the only recovery reference.

---

## 6. rsync backup strategy

`rsync` is a file synchronization tool, not a complete backup system by itself. It does not automatically provide immutable history, point-in-time snapshots, or protection against propagating accidental deletion. The destination should therefore provide versioning/snapshots, or the workflow must maintain dated backup generations.

### 6.1 Suggested data classes

| Data | Primary recovery source | rsync backup? |
|---|---|---|
| Git project source | Git remote | Optional; required for unpushed work |
| Uncommitted project changes | Working-tree backup | Yes |
| Dotfiles | Git | Optional additional copy |
| Agent configuration and skills | Git | Yes, if locally modified |
| Agent memory/session data | Export supported by the agent + backup | Yes, after defining supported paths |
| Workspace scripts/manifests | Git | Yes |
| Desktop config export | `desktop-config` backup | Copy/export independently |
| Flatpak app data | `desktop-config` if supported | Verify coverage; otherwise explicitly back up selected data |
| Toolbox image | OCI registry by digest | No filesystem copy required |
| Container volumes | Application-aware export or stopped-volume backup | Yes, with consistency controls |
| Terraform state | Remote backend/versioning | Do not use ordinary live rsync as the only backup |
| Credentials | Reissue/re-authenticate or approved secret manager | Do not copy plaintext credentials into general workspace backup |

### 6.2 Safe synchronization pattern

Use a dedicated backup destination, for example an external disk mounted at `/run/media/$USER/WORKSPACE_BACKUP`.

First preview:

```bash
rsync -aHAXn --delete --itemize-changes \
  "$HOME/Workspace/" \
  "/run/media/$USER/WORKSPACE_BACKUP/Workspace/"
```

Only use `--delete` if the destination is intentionally an exact mirror, the dry run has been reviewed, and the destination has independent snapshots/versioning. For normal recovery backups, prefer dated destination directories or snapshot-capable storage and omit `--delete`.

A simple dated copy pattern:

```bash
backup_root="/run/media/$USER/WORKSPACE_BACKUP"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$backup_root/workspace-$timestamp"

mkdir -p "$destination"

rsync -aHAX --info=progress2 \
  "$HOME/Workspace/" \
  "$destination/"
```

The backup job should fail if the expected destination is not mounted. Never silently fall back to writing into an ordinary local directory with the same path.

For unattended use, add mount identity checks (for example UUID/label verification), logs, exit-code handling, and a retention process that does not delete the last known-good generation.

### 6.3 Restore pattern

- Restore into a new or empty recovery directory first.
- Review file ownership, symlinks, ACLs and extended attributes.
- Merge selected files into the active workspace only after review.
- Keep the original backup generation unchanged.
- Validate restored configuration before starting agents or services.

---

## 7. Orchestration tool selection

### 7.1 Recommended roles

| Tool | Role | Recommendation |
|---|---|---|
| Bootstrap CLI (Bash/Python) | Single entrypoint and preflight | Required |
| Ansible | Deterministic host/user/workspace configuration | Required |
| OpsCode | Interactive DevOps coding and engineering agent | Keep as primary development agent |
| TalkOps | Optional multi-agent operations supervisor | Evaluate after recovery is deterministic |
| GitHub Actions | Image build, tests, release | Required for golden image lifecycle |
| Podman/Toolbox | Development runtime | Required |
| rsync | Workspace file copy/restore | Required by this plan |

### 7.2 Why not let TalkOps/OpsCode own host recovery?

A host recovery can begin while the host has no working network, desktop, Toolbox, container runtime, or AI agent. Therefore the recovery path must be a small set of documented, deterministic scripts and procedures that can run from a clean installation or recovery environment.

Agents can:
- Diagnose logs and status output.
- Generate Ansible changes.
- Propose recovery steps.
- Validate configuration.
- Prepare pull requests.

Agents must not automatically:
- Change Secure Boot or image trust policy.
- Edit GRUB's generated configuration.
- Delete backup generations.
- Overwrite project directories.
- Run destructive `rsync --delete`.
- Reinstall/rebase the host.
- Apply production Terraform changes.

Require explicit approval for those operations.

### 7.3 Tool adoption sequence

1. Keep the existing OpsCode installation in Toolbox.
2. Make bootstrap and Ansible workflows work without OpsCode.
3. Define a narrow, auditable interface for agent-triggered diagnostics and non-destructive validation.
4. Evaluate TalkOps in a disposable Toolbox or VM.
5. Integrate TalkOps only if its supervisor, CI/headless operation, integrations, and approval controls provide measurable value.
6. Avoid installing competing tools that claim the same executable name without isolating their environments.

Product features and interfaces change; verify current upstream documentation and exact versions before implementation.

---

## 8. Single-command workspace deployment

Target user experience after a working Secureblue host has been installed:

```bash
git clone <WORKSPACE_REPOSITORY_URL> "$HOME/sre-workspace"
cd "$HOME/sre-workspace"
./bootstrap/install.sh
```

The bootstrap should:

1. Check OS, architecture, available storage, network, Podman and Toolbox.
2. Verify the workspace repository revision and release manifest.
3. Pull the golden image by digest and verify its trust/signature according to the configured policy.
4. Create or update the Toolbox without deleting existing user data.
5. Run Ansible in the Toolbox.
6. Configure OpsCode and agent definitions.
7. Restore selected workspace files from rsync backup only when explicitly requested.
8. Clone missing Git repositories without overwriting local modifications.
9. Check authentication state without printing secrets.
10. Run validation and produce a recovery report.

Suggested interface:

```bash
./bootstrap/install.sh --check
./bootstrap/install.sh
./bootstrap/install.sh --repair
./bootstrap/install.sh --restore-workspace
./bootstrap/install.sh --doctor
```

Do not make `install.sh` reinstall or modify the Secureblue host. Host installation/recovery is a separate, human-guided procedure.

---

## 9. Complete implementation sequence

### Phase 0 — Inventory and baseline

- [ ] Record Secureblue image variant, Fedora version, architecture and current deployment checksum.
- [ ] Save `rpm-ostree status -v`, `ostree admin status`, and `rpm-ostree --version`.
- [ ] Pin a known-good deployment and verify it appears in deployment status.
- [ ] Export/test `desktop-config` backup.
- [ ] Inventory Flatpaks, user data, workspace directories, Toolbox containers and Podman volumes.
- [ ] Identify Git remotes and projects with uncommitted work.
- [ ] Identify all secret locations and define reauthentication/recovery procedures.

**Exit criteria:** the current workstation has a documented inventory and a tested copy of its recovery metadata.

### Phase 1 — External host recovery bundle

- [ ] Create verified Secureblue installation media.
- [ ] Store the deployment manifest and raw OSTree status outputs off-device.
- [ ] Store the `desktop-config` export and restore instructions.
- [ ] Store the workspace backup and recovery repository.
- [ ] Store disk-encryption and account recovery instructions securely.
- [ ] Perform a tabletop walkthrough of reinstalling the host without relying on the old disk.

**Exit criteria:** the required recovery information is available when the original host disk is unavailable.

### Phase 2 — rsync backup and restore

- [ ] Define exact source directories and exclusions.
- [ ] Define destination mount identity and filesystem capabilities.
- [ ] Implement dry-run-first backup and restore scripts.
- [ ] Add logs, error handling and mount checks.
- [ ] Add destination generations or snapshot/versioning.
- [ ] Test restoration to a separate directory.
- [ ] Verify permissions, symlinks, ACLs and extended attributes.
- [ ] Verify recovery of uncommitted project changes.

**Exit criteria:** a restore test succeeds without relying on the original workspace directory.

### Phase 3 — Git project recovery

- [ ] Create a project repository manifest.
- [ ] Verify all projects have usable remotes.
- [ ] Ensure important branches and tags are pushed.
- [ ] Define how uncommitted/untracked files are backed up.
- [ ] Implement safe clone/fetch logic.
- [ ] Test recovery into an empty projects directory.

**Exit criteria:** all committed projects can be reconstructed from Git, and uncommitted work has a separate tested recovery route.

### Phase 4 — Golden Toolbox image

- [ ] Confirm the supported Toolbox base image conventions.
- [ ] Create the Containerfile and package/version manifest.
- [ ] Pin base image and tool versions.
- [ ] Build the image.
- [ ] Run Toolbox compatibility tests.
- [ ] Scan image and dependencies; generate SBOM.
- [ ] Publish immutable version and record digest.
- [ ] Test creation of a fresh Toolbox from the published digest.

**Exit criteria:** a clean Toolbox can be created from the exact release digest.

### Phase 5 — Ansible workspace configuration

- [ ] Separate host and Toolbox playbooks.
- [ ] Implement idempotent roles.
- [ ] Add OpsCode installation and version verification.
- [ ] Restore agent skills/configuration without secrets.
- [ ] Configure MCP endpoints and least-privilege access.
- [ ] Configure shell/dotfiles and developer tools.
- [ ] Add validation playbook.
- [ ] Run syntax, lint and idempotence checks.

**Exit criteria:** Ansible configures a fresh Toolbox consistently and a second run produces no unintended changes.

### Phase 6 — Bootstrap CLI

- [ ] Implement preflight and diagnostics.
- [ ] Implement image digest verification/pull.
- [ ] Implement safe Toolbox create/update logic.
- [ ] Invoke Ansible.
- [ ] Add optional rsync workspace restore.
- [ ] Add Git project clone/fetch.
- [ ] Add validation and recovery report.
- [ ] Ensure normal execution never deletes existing data.
- [ ] Test `--check`, normal, repair and restore modes.

**Exit criteria:** one command reconstructs a development workspace on a clean Secureblue host without manual package installation inside the Toolbox.

### Phase 7 — CI/CD and release governance

- [ ] Validate shell, YAML, Ansible and Containerfile changes in CI.
- [ ] Build golden image on approved changes.
- [ ] Run integration tests.
- [ ] Scan image and generate SBOM.
- [ ] Sign/publish image and record digest.
- [ ] Publish a versioned workspace release manifest.
- [ ] Protect release workflows and pin GitHub Actions by commit SHA.
- [ ] Require approval for production-facing changes.

**Exit criteria:** a tagged release identifies the exact image digest and configuration revisions used for recovery.

### Phase 8 — Agent orchestration

- [ ] Keep OpsCode as the initial development agent.
- [ ] Define specialist agent roles and allowed tools.
- [ ] Use separate Git worktrees for parallel agent changes.
- [ ] Add human review and approval gates.
- [ ] Evaluate TalkOps in an isolated environment.
- [ ] Integrate only approved diagnostics and non-destructive operations.
- [ ] Test failure behavior when the agent service is unavailable.

**Exit criteria:** development agents improve engineering throughput but are not required for recovery.

### Phase 9 — Full disaster-recovery drill

Perform the drill on a spare disk or test machine where practical:

1. Start with no usable original host installation.
2. Install Secureblue from verified media.
3. Run first-boot and Secureblue validation.
4. Restore desktop state with `desktop-config`.
5. Restore workspace files with `rsync`.
6. Clone projects using Git.
7. Recreate Toolbox from the golden image digest.
8. Run Ansible.
9. Reauthenticate.
10. Validate agents, projects and development tools.
11. Record elapsed time, missing state, manual steps and failures.
12. Fix gaps and repeat.

**Exit criteria:** recovery succeeds from external artifacts alone, with no dependency on the original host disk or its running agent runtime.

---

## 10. Recovery objectives and operational controls

Initial targets (to be measured and adjusted after drills):

| Metric | Initial target |
|---|---:|
| Host reinstall and desktop restoration | < 60 minutes, excluding download/install variability |
| Workspace reconstruction | < 30 minutes with image cached |
| Project clone/fetch | Depends on repository size/network |
| Configuration recovery point | Latest committed configuration |
| Project source recovery point | Latest pushed Git commit |
| Uncommitted work recovery point | Last successful rsync backup |
| Backup frequency | At least daily; more often for active uncommitted work |
| Recovery test | Monthly and after major architecture changes |

### Operational controls

- Monitor and report backup failures.
- Verify backup destination identity before writing.
- Retain multiple backup generations.
- Periodically test restore, not merely backup completion.
- Never place credentials in rsync workspace backups unless they are separately encrypted and explicitly approved.
- Keep the host deployment manifest outside the host disk.
- Keep a known-good Secureblue deployment pinned locally where possible.
- Keep image digests and configuration revisions in every workspace release.
- Document rollback to the previous golden image digest.
- Require approval for destructive operations.

---

## 11. Risks and design decisions to resolve

| Risk / open question | Required action |
|---|---|
| Secureblue OSTree checksum may no longer be fetchable after reinstall | Test exact commit retrieval and retain a supported signed image artifact if exact historical recovery is required |
| GRUB menu order can change | Identify entries by deployment label/checksum; do not hard-code a menu index |
| `desktop-config` coverage is unknown | Test app inventory, app data, permissions, preferences and restore behavior |
| rsync can propagate deletion/corruption | Use dry runs, separate generations/snapshots, and avoid `--delete` for ordinary backup |
| rsync may not preserve metadata across filesystems | Test ACL/xattr/ownership behavior on the actual backup filesystem |
| Project changes may not be committed | Back up uncommitted and untracked files separately |
| Secrets may be lost or exposed | Reauthenticate or use a dedicated secret manager |
| Toolbox image may not be trusted by host policy | Verify signatures and use only approved image trust configuration |
| Agent may execute unsafe operations | Least privilege, worktree isolation, human approval and audit logs |
| Terraform state may be inconsistent | Use remote state locking/versioning and supported backup procedures |

---

## 12. Reference commands

### Host deployment inventory

Run on Secureblue host:

```bash
rpm-ostree status -v
ostree admin status
rpm-ostree --version
```

### Pin currently booted deployment

Run on Secureblue host after verifying deployment index:

```bash
sudo ostree admin pin 0
ostree admin status
```

### Request a specific available OSTree commit

Run on Secureblue host only after verifying the commit is available and trusted:

```bash
sudo rpm-ostree deploy <FULL_OSTREE_COMMIT_CHECKSUM>
rpm-ostree status -v
ostree admin status
```

### Inspect backup changes before restore

```bash
rsync -aHAXn --info=progress2 \
  /path/to/backup/workspace-state/ \
  "$HOME/Workspace/"
```

### Restore workspace state

```bash
rsync -aHAX --info=progress2 \
  /path/to/backup/workspace-state/ \
  "$HOME/Workspace/"
```

### Clone projects

```bash
mkdir -p "$HOME/Workspace/projects"
cd "$HOME/Workspace/projects"
git clone <PROJECT_GIT_URL>
```

---

## 13. Official references

Use current upstream documentation at implementation time; command behavior and image release practices can change.

- [Secureblue installation](https://secureblue.dev/install)
- [Secureblue post-install](https://secureblue.dev/post-install)
- [Secureblue FAQ: OSTree rollback, pinning and GRUB](https://secureblue.dev/faq)
- [Secureblue build architecture and image provenance](https://secureblue.dev/articles/build-architecture)
- [Secureblue contributing: building and rebasing images](https://secureblue.dev/contributing)
- [OSTree deployments](https://ostreedev.github.io/ostree/deployment/)
- [rpm-ostree administrator handbook](https://coreos.github.io/rpm-ostree/administrator-handbook/)
- [Fedora Toolbox documentation](https://docs.fedoraproject.org/en-US/fedora-silverblue/toolbox/)
- [rsync manual](https://download.samba.org/pub/rsync/rsync.1.html)
- [Ansible documentation](https://docs.ansible.com/)
- [Terraform documentation](https://developer.hashicorp.com/terraform/docs)
- [GitHub Actions documentation](https://docs.github.com/en/actions)

---

## 14. Final recommended recovery sequence

The intended full host recovery process is:

```text
HOST FAILURE
    |
    v
Boot verified Secureblue installation media
    |
    v
Reinstall Secureblue
    |
    v
Complete first boot and Secureblue validation
    |
    v
Restore host Flatpaks and desktop state
using desktop-config
    |
    v
Restore non-project workspace files
using rsync from external backup
    |
    v
Clone project repositories
using Git
    |
    v
Pull golden Toolbox image by immutable digest
    |
    v
Create Toolbox and run Ansible
    |
    v
Restore agent configuration and MCP definitions
    |
    v
Reauthenticate GitHub and cloud providers
    |
    v
Run validation and resume development
```

For a recoverable update failure where the old host deployment is still installed, use the pinned/previous OSTree deployment through the GRUB menu instead of reinstalling. For a full disk failure or reinstall, the old local deployment is gone; the saved checksum is useful only if the corresponding trusted commit/image remains retrievable.

**Final design principle:** Secureblue is restored through its supported installation and OSTree mechanisms; desktop state is restored by `desktop-config`; workspace state is restored with `rsync`; project source is reconstructed with Git; and the development environment is rebuilt from a pinned Toolbox image plus Ansible. AI agents assist with engineering and operations but are never a prerequisite for recovery.
