 # 1. Create bridge
 run0 -i nmcli con add type bridge con-name br0 ifname br0
 
 # 2. Configure bridge IP/gateway/DNS
 run0 -i nmcli con mod br0 ipv4.method manual      ipv4.addresses 10.1.29.100/24      ipv4.gateway 10.1.29.2      ipv4.dns 10.1.29.2      ipv4.dns-search 
 
 # 3. Enslave enp1s0 to br0
 run0 -i nmcli con add type bridge-slave con-name enp1s0-slave ifname enp1s0 master br0
 
 # 4. Switch over (brief outage expected)
 sudo nmcli con down wired-dhcp
 sudo nmcli con up br0
 

 # Verify after it comes up:
echo 'Run these commands to validate'
echo ' 
 ip -br addr show br0                 # expect: br0 UP 10.1.29.100/24
 ip route                             # default via 10.1.29.2 dev br0
 ping -c2 10.1.29.2                   # gateway reachable
 ping -c1 8.8.8.8                     # internet
 virsh -c qemu:///system list --all   # still works as kim' 


