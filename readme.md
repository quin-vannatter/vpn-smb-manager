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

```
To                         Action      From
--                         ------      ----
192.168.0.105 445/tcp      ALLOW       192.168.0.0/24
192.168.0.105 22/tcp       ALLOW       192.168.0.240
192.168.0.105 80/tcp       ALLOW       Anywhere
192.168.0.105 443/tcp      ALLOW       Anywhere
192.168.0.105 8080/tcp     ALLOW       192.168.0.0/24
192.168.0.105 8081/tcp     ALLOW       192.168.0.0/24
192.168.0.105 1194/udp     ALLOW       Anywhere
192.168.0.105 22/tcp       ALLOW       192.168.0.241
10.8.0.0/24 1:65535/tcp    ALLOW       10.8.0.0/24
10.8.0.0/24 1:65535/udp    ALLOW       10.8.0.0/24
192.168.0.105 1195/udp     ALLOW       Anywhere
10.7.0.0/24 1:65535/tcp    ALLOW       10.7.0.0/24
10.7.0.0/24 1:65535/udp    ALLOW       10.7.0.0/24
```

## HTTPS Certificates
- Use `certbot` to keep https certificates up to date. Use the standalone server settings.
- The command is pretty straight forwards. Ensure the domain is pointing to the public IP address you're using

## Running the Server
- First ensure the client application is built by running `npm run build` in `./client` 
- Run the server using `npm start` in `./server`
- For Development, use `npm start headless` then run the angular app from `./client` using `npm start`

## Hard Drives
- Mount the main hard drive at /share/base in fstab
- FOR THE LOVE OF GOD, FORMAT AS EXT4. please and thank you.
- Once the mount is made, run setup-smb.sh to make the initial folders with various permissions.

## Database
- Running reset-database.sh will delete and create the database. Use it to refresh data. However any unix/smb/vpn users won't be deleted this way.

## Downloading Torrents
- 