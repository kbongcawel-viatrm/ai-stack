---
name: input-leap
 description: Install, configure, troubleshoot, and develop Input Leap keyboard-and-mouse sharing across Linux, Windows, macOS, and BSD systems.
---

# Input Leap Skill

## Purpose

Use this skill when a user asks about Input Leap setup, server/client configuration, multi-computer keyboard and mouse sharing, Linux desktop integration, networking, troubleshooting, building from source, or project development.

## Source of truth and project status

- Upstream repository: https://github.com/input-leap/input-leap
- Documentation/wiki: https://github.com/input-leap/input-leap/wiki
- Issues: https://github.com/input-leap/input-leap/issues
- Releases: https://github.com/input-leap/input-leap/releases
- The upstream repository was observed as **archived** during preparation of this skill. Treat upstream code and documentation as a historical reference; verify whether a maintained successor or community fork is appropriate before recommending new deployments or security-sensitive use.
- The project README describes Input Leap as a software KVM: one computer acts as the server with the keyboard and mouse; other computers run clients. Input Leap must be installed on every participating machine.
- The README says Input Leap is not compatible with Synergy.

## Core operating model

- **Server:** the computer physically connected to the keyboard and mouse. It accepts clients and controls their input sessions.
- **Client:** each computer receiving keyboard and mouse input from the server.
- Screen transitions normally happen by moving the pointer to the configured edge of a screen; a keypress can also switch focus.
- The server configuration contains a screen entry for every client. Each configured screen name must exactly match the client's reported screen name; matching is case-sensitive.
- The server address is supplied to each client. The documented default TCP port is **24800**.
- A working setup reports `Input Leap is running` on both server and clients.

## Standard setup workflow

1. Install a compatible Input Leap build on every computer that will participate.
2. Start the GUI or the relevant server/client executable on each computer.
3. On the computer with the physical keyboard and mouse, select **Server**.
4. Open **Configure server** and place a screen for every client in the grid at the relative positions matching the physical monitor layout.
5. Copy each client screen name from its Input Leap window. Configure the exact, case-sensitive name on the server.
6. On each client, enter the server's reachable IP address or use Bonjour/automatic configuration when offered.
7. Start the server and clients. Confirm that both sides report `Input Leap is running`.
8. Move the pointer across the configured screen edge to verify the transition. Test keyboard input as well.
9. Check that Scroll Lock is not active; the upstream README notes that Scroll Lock prevents mouse-driven screen switching.

## CLI reference

The repository's June 2025 man pages describe the following binaries and options. Confirm installed binary names and options with `--help` because distributions and builds can differ.

### Server

Typical form:

```bash
input-leaps [OPTIONS]
```

Documented options include:

- `-a, --address <address>`: listen on the specified address. Form: `[<hostname>][:<port>]`; default is all interfaces on port `24800`.
- `-c, --config <pathname>`: load the specified configuration file.
- `-n, --name <screen-name>`: use an explicit screen name rather than the hostname.
- `-d, --debug <level>`: set logging verbosity (`FATAL`, `ERROR`, `WARNING`, `NOTE`, `INFO`, `DEBUG`, `DEBUG1`, `DEBUG2`).
- `-l, --log <file>`: write logs to a file.
- `-f, --no-daemon`: run in the foreground.
- `--daemon`: run as a daemon (documented default).
- `--restart` / `-1, --no-restart`: enable or disable automatic restart after failure.
- `--no-tray`: disable the system tray icon.
- `--enable-crypto`: enable the crypto/SSL plugin.
- `--enable-drag-drop`: enable drag and drop; Linux drag-and-drop is listed as unsupported in the README FAQ, so do not assume this option makes it work on Linux.
- `--display <display>`: connect to the specified X server.
- `--screen-change-script <path>`: run a script when screen changes; the new screen name is passed as the first argument.
- `--help`, `--version`.

Default configuration lookup, if `--config` is omitted:

1. `$HOME/.config/InputLeap/input-leap.conf`
2. `/etc/input-leap.conf`

### Client

Typical form:

```bash
input-leapc [OPTIONS] <server-address>
```

Documented options include:

- `-n, --name <screen-name>`: explicit client screen name.
- `-d, --debug <level>`: logging verbosity using the server levels above.
- `-l, --log <file>`: write logs to a file.
- `-f, --no-daemon` / `--daemon`: foreground or daemon mode.
- `--restart` / `-1, --no-restart`: restart behavior.
- `--no-tray`: disable system tray icon.
- `--enable-crypto`: enable crypto/SSL plugin.
- `--enable-drag-drop`: enable drag/drop option, subject to platform limitations.
- `--display <display>`: X server display.
- `--yscroll <delta>`: vertical scroll delta; documented default is `120`.
- `--help`, `--version`.

The client server-address format is `[<hostname>][:<port>]`; the default port is `24800`. Brackets are required around an IPv6 address when a port is also specified.

## Network and firewall checks

- Ensure the client can reach the server's IP address and TCP port `24800`.
- Bind the server only to the intended interface/address when the host has multiple network interfaces or untrusted networks.
- Do not expose the service to the public Internet. Prefer a trusted LAN or a VPN/private overlay network and restrict inbound access to known client addresses.
- On Linux with firewalld, inspect the active zone before making changes:

```bash
firewall-cmd --get-active-zones
firewall-cmd --list-all
```

Example to allow TCP 24800 in a chosen zone (replace `public` with the correct active zone; limit source addresses where possible):

```bash
sudo firewall-cmd --permanent --zone=public --add-port=24800/tcp
sudo firewall-cmd --reload
```

To remove the rule:

```bash
sudo firewall-cmd --permanent --zone=public --remove-port=24800/tcp
sudo firewall-cmd --reload
```

Verify reachability from a client:

```bash
nc -vz SERVER_IP 24800
```

A successful TCP connection confirms transport reachability only; it does not validate screen names, session authentication, or input handling.

## Linux and Fedora Secureblue notes

- Input Leap's README lists Linux as a supported platform, but desktop-session capabilities differ.
- The README explicitly states that clipboard sharing is **not currently supported on Linux/Wayland**. Do not promise clipboard synchronization on Wayland.
- The README lists drag-and-drop as unsupported on Linux.
- The build system exposes `INPUTLEAP_BUILD_X11` and `INPUTLEAP_BUILD_LIBEI` options. X11 support is enabled by default in CMake; libei support is disabled by default. One of X11 or libei is required for non-Apple Unix builds.
- The repository's CMake configuration uses Qt 6 by default, requiring Qt 6.2 or newer when building the GUI. Qt 5 is an available build selection and has a lower stated minimum of Qt 5.9.
- On Fedora Secureblue, prefer a trusted Flatpak or distribution package where available. Secureblue is image-based: use `rpm-ostree install <package>` for host RPM layering where supported, not `dnf install` on the host. Reboot into the staged deployment after layering.
- Do not disable Secureblue hardening or broaden privileges merely to make Input Leap work. Establish the actual blocker first (Wayland/X11 backend, permission, firewall, or service issue).
- Input Leap needs keyboard/mouse input access. Treat any portal or input-capture permission prompt as security-sensitive and grant only the access required for the intended machine.

## Known limitations from the upstream README

- Clipboard sharing is not currently supported on Linux/Wayland.
- Linux drag and drop is not supported.
- UTF-8 support is limited; the project README notes issues processing some languages.
- AltGr combinations when the server is Linux and the client is Windows may not work out of the box; see upstream issue [#100](https://github.com/input-leap/input-leap/issues/100) for historical context.
- Scroll Lock prevents mouse-driven screen switching.
- Input Leap is not compatible with Synergy.
- The README's known-working platforms for the referenced latest release are Windows 10/11, macOS 10.12+, Linux, FreeBSD, and OpenBSD. It explicitly says 32-bit Windows and macOS versions before 10.12 are unsupported. Re-check current release notes before treating this list as current compatibility certification.

## Troubleshooting workflow

Collect facts before changing configuration. Ask for the OS and desktop session on both ends, server/client role, application version, exact error, and whether the connection reaches port 24800.

### 1. Check binaries and versions

```bash
command -v input-leaps input-leapc input-leap
input-leaps --version 2>&1 || true
input-leapc --version 2>&1 || true
```

The GUI executable/package naming may differ by distribution. Use the package manager's file list if the binary names differ.

### 2. Check process and service state

```bash
pgrep -a -f 'input-leap|input-leaps|input-leapc'
systemctl --user --no-pager --type=service | grep -i input || true
systemctl --no-pager --type=service | grep -i input || true
```

Do not assume a system service exists; the application may be launched from the desktop session.

### 3. Check listener and connectivity

On the server:

```bash
ss -ltnp | grep ':24800' || true
```

On the client:

```bash
nc -vz SERVER_IP 24800
```

If no listener exists, verify that the server is started and that its configured address/port is correct. If the port is listening but unreachable remotely, inspect routing, firewall zones, and address binding.

### 4. Check names and layout

- Confirm the client screen name exactly matches the server-side configured name, including case.
- Confirm each client has a corresponding screen tile in the server layout.
- Confirm the tile positions reflect the physical screen arrangement and that pointer movement is toward the intended edge.
- Check that Scroll Lock is off.

### 5. Check config selection

- If a saved configuration is not loaded, start the binary with `--config /absolute/path/to/config`.
- The README notes that a client configuration may still show an empty server IP field. In that case, its documented configuration uses a `section: options` entry named `serverhostname=<server-ip>`.
- When no server config path is supplied, check `$HOME/.config/InputLeap/input-leap.conf` and `/etc/input-leap.conf` in that order.
- Never overwrite a user's configuration before backing it up.

### 6. Capture logs

Run in the foreground with an appropriate debug level, for example:

```bash
input-leaps --no-daemon --debug INFO --log /tmp/input-leap-server.log
input-leapc --no-daemon --debug INFO --log /tmp/input-leap-client.log SERVER_IP
```

Use `DEBUG` or `DEBUG1` only when INFO is insufficient; redact IPs, hostnames, usernames, and other sensitive details before sharing logs publicly.

### 7. Consider platform constraints

- For Wayland clipboard complaints, explain that upstream documents this as unsupported; do not prescribe unsafe session changes as a guaranteed fix.
- For missing input capture on Linux, identify the selected backend and the distribution's documented permission mechanism before changing security settings.
- For AltGr issues in Linux-server/Windows-client combinations, consult the linked historical issue and test a reversible workaround.
- For Unicode/keymap problems, reproduce with the exact language/layout and record server/client OS and versions.

## Building from source (upstream CMake project)

Use a clean, isolated build directory and follow the dependency instructions for the exact checkout/release. The root `CMakeLists.txt` declares CMake 3.21 or newer and provides these options:

- `INPUTLEAP_BUILD_GUI` (default `ON`)
- `INPUTLEAP_BUILD_TESTS` (default `ON`)
- `INPUTLEAP_USE_EXTERNAL_GTEST` (default `OFF`)
- `INPUTLEAP_BUILD_X11` (default `ON`)
- `INPUTLEAP_BUILD_LIBEI` (default `OFF`)
- `INPUTLEAP_BUILD_GULRAK_FILESYSTEM` (default `OFF`)

The project uses C++17 by default with Qt 6, or C++14 when selecting Qt 5. The build requires OpenSSL 1.1.1 or newer. On Linux/Unix the CMake configuration checks for pkg-config, and GUI builds require Avahi compatibility/DNS-SD development support. X11 builds require X11-related development libraries; libei builds require `libei-1.0 >= 0.99.1`, xkbcommon, GLib/GIO, and libportal. Use the exact dependency names for the target distribution.

Generic build sequence (install dependencies first):

```bash
git clone https://github.com/input-leap/input-leap.git
cd input-leap
git submodule update --init --recursive
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
ctest --test-dir build --output-on-failure
```

These are generic CMake steps, not a complete platform-specific dependency installation recipe. Confirm submodule and build instructions for the selected tag/commit. Do not assume tests pass without running them.

## Configuration and support practices

- Prefer reversible changes and back up configuration before edits.
- Do not invent config syntax. Verify the exact schema against the project's wiki, sample configuration, or matching source version.
- For bug reports, use the upstream issue template and include OS/version on both endpoints, server/client roles, logs, network topology, reproduction steps, and whether the issue is reproducible without VPN/firewall changes.
- The README says issue tracker submissions are the way to draw maintainers' attention to bugs and asks users to follow its issue template.
- Most upstream pull requests may need a release-note fragment under `doc/newsfragments/`. Supported extensions documented by the repository are `.feature`, `.bugfix`, `.security`, `.doc`, and `.removal`.

## Response expectations

When helping with Input Leap:

1. Identify which machine is the server and which are clients.
2. Determine Linux desktop session type (Wayland/X11) on Linux endpoints.
3. Check exact screen names and TCP/24800 reachability before proposing broad changes.
4. Separate documented upstream behavior from distribution-specific advice and inference.
5. State the Wayland clipboard and Linux drag-and-drop limitations when relevant.
6. Account for the upstream repository's archived status; verify any successor/fork before recommending ongoing use.
7. Provide commands that can be pasted directly, with placeholders clearly marked and no destructive actions by default.

## References

- Repository and README: https://github.com/input-leap/input-leap
- Wiki: https://github.com/input-leap/input-leap/wiki
- Server man page: `doc/input-leaps.1` in the repository
- Client man page: `doc/input-leapc.1` in the repository
- Build configuration: `CMakeLists.txt` in the repository
- Release-note fragment guidance: `doc/newsfragments/README.md`
- Issue tracker: https://github.com/input-leap/input-leap/issues
- Releases: https://github.com/input-leap/input-leap/releases

---

**Preparation note:** This skill is based on the upstream README, root `CMakeLists.txt`, server and client man pages (dated June 2025), and release-note fragment guidance retrieved from the repository. Re-check the selected release/tag before relying on version-specific commands, build dependencies, platform compatibility, or security behavior.
