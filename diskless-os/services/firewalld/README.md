# Firewalld

FCOS Ansible applies inbound default-drop with explicit allows. SSH is allowed only from `192.168.1.0/24`; sshd also restricts source and requires public keys. Root remote login is key-only. Keep console access. This does not set outbound/forwarding policy.
