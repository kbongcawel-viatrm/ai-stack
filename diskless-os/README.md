# Diskless setup
Host OS: Alpine
Workload OS: Fedora CoreOS using Butane for configuration
Ansible: For configuration management on the services and workload
Github: For CICD and ease of deployment (Runner is the physical machine name (home-server))

# Runs:
       1. Kasm Workspace
            - Linux and Windows terminal
            - Firefox Browser
            - Chromium/Trivalent/Chrome Browser
            - TPlink Archer AX55 SMB for network storage (NAS) holds the PXE images being used.
       2. Suricata (IDS/IPS) with NFQueue enabled on ethernet WAN facing NIC.
       3. Firewalld with predefined rules.
       4. Aide (FIM) ran as a service scanning.
       5. ClamAV (Malware) ran as service scanning.

```bash
                 GitHub Actions
                       |
              Self-hosted LAN Runner
                       |
             +---------+----------+
             |                    |
       Ansible Deploy       Ansible Health
             |                    |
     +-------+--------+-----------+--------+
     |                |                    |
  Alpine           FCOS VM             Ubuntu VM
  Diskless         Security             Kasm
     |                |                    |
  OpenRC           Suricata             Docker
  Networking       Firewalld            Kasm Services
  SSH              AIDE                 HTTPS Endpoint
                   ClamAV                  |
                   Lynis                   +
                                           |
                                           +--------------------------------+
                                           |                                |           
                               Windows / Linux Environment       Chrome/Firefox Browser
```
