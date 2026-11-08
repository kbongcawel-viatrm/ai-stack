# Architecture

```text
GitHub repo -> Actions -> self-hosted runner: home-server
                            |                    |
                     PXE build/publish      Ansible/health
                            |                    |
                    DHCP / iPXE / HTTP      Alpine / FCOS / Ubuntu
                            |                    |
                    Physical Alpine host     KVM guests
                                                |       |
                                              FCOS    Ubuntu
                                            security   Kasm
```

## Storage
Keep boot assets versioned and reproducible; persist required Alpine state with LBU. Put VM disks and application state on durable storage. Backups must be separate from live VM disks. Retain previous known-good boot releases.

The Archer AX55 SMB share may store files if performance and firmware permit. Verify TFTP/HTTP support before treating it as a PXE server. Otherwise run PXE services elsewhere.

## Network and Suricata
Define management, service and capture paths. Suricata cannot inspect traffic not delivered to its interface. AF_PACKET passive IDS and NFQUEUE inline IPS are different modes; NFQUEUE requires packet redirection and Suricata NFQUEUE mode. Test before enabling blocking.

## Security
FCOS Firewalld inbound default-drop with explicit allows. SSH is limited to `192.168.1.0/24`, public-key only, root key login. Keep sshd and firewall source restrictions aligned. CI secrets never belong in Git or boot artifacts. Keep console recovery.
