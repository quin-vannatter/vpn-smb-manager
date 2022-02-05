# Setup Instructions

## Prerequisites
- 2 raspberry pi servers on the same network
  - VPN Server
  - CA Server
  - Ensure the main user on each is `pi`

## Server Network Setup
- Ensure both servers have static IP addresses
- Port forward ports 443, 80 and 1194 on VPN server **(No ports on the CA server should be port forwarded)**
- Update VPN Server `/etc/hosts` file to have an entry for `ca` to be pointed to the static IP address of the CA Server
- Update the CA Server `/etc/hosts` file to have an entry for `server` to be pointed to the static IP address of the VPN Server
- On each server, generate an SSH key using `ssh-keygen` and place the contents of the `id_rsa.pub` file into the other server's `authorized_keys` file. **(Ensure there's no password and you may need to create the `authorized_keys` file)**
- Update `/etc/sysctl.conf` on the VPN server and uncomment the line `net.ipv4.ip_forward=1` by removing the `#`
- Run the command `sudo sysctl -p`

## Server Setup
- Update the server.conf to set the remote to the right location
- Ensure both servers are running and can communicate with each other at `pi@ca` and `pi@server`
- Run `create-server.sh` script

## Firewall Configuration
- Note interface name after `dev` when running `ip route | grep default` *(E.g. `eth0`)*
- Update `/etc/ufw/before.rules` and add the following, replacing ***\<interface>*** with the interface noted above.

```
*nat
:POSTROUTING ACCEPT [0:0]
-A POSTROUTING -s 10.8.0.0/8 -o <interface> -j MASQUERADE
COMMIT
```

- Update `/etc/default/ufw` line `DEFAULT_FORWARD_POLICY` from `DROP` to `ACCEPT`

- Create rules for the following using the following command `sudo ufw allow proto <tcp/udp> from <ip/any> to <outgoing> port <port>`

vpn-server -> Refers to the IP address of the VPN server in relation to the router. Eg. 192.168.0.112
ca-server -> Refers to the IP address of the CA server in relation to the router. Eg. 192.168.0.113
local-net -> Refers to the router network with the subnet of /24 E.g 192.168.0.0/24

```
from local-net to vpn-server port 445 tcp
from 10.8.0.0/24 to 10.8.0.1 port 445 tcp
from local-net to vpn-server port 22 tcp
from any to vpn-server port 80 tcp
from any to vpn-server port 443 tcp
from any to vpn-server port 1194 udp

(For Development)
from local-net to vpn-server port 8080 tcp
from local-net to vpn-server port 8081 tcp
```

## HTTPS Certificates
- Use `certbot` to keep https certificates up to date. Use the standalone server settings.
- The command is pretty straight forwards. Ensure the domain is pointing to the public IP address you're using

## Running the Server
- First ensure the client application is built by running `npm run build` in `./client` 
- Run the server using `npm start` in `./server`
- For Development, use `npm start headless` then run the angular app from `./client` using `npm start`