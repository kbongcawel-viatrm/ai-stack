# 1. Set manual addressing on br0
   run0 nmcli con mod br0 ipv4.method manual \
	   ipv4.addresses 192.168.1.100/24 \
	   ipv4.gateway 192.168.1.1 \
	   ipv4.dns 192.168.1.1 \
	   ipv6.method disabled
 
   # 2. Cutover (brief outage expected)
   run0 nmcli con down wired-dhcp
   run0 nmcli con up br0
   # if enp1s0-slave doesn't auto-activate:
   run0 nmcli con up enp1s0-slave
 

 # Recovery if the bridge fails:
   run0 nmcli con down br0
   run0 nmcli con up wired-dhcp

