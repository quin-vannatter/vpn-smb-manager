# Setup Instructions

## Prerequisites
- 2 Ubuntu servers on the same network
  - VPN Server
  - CA Server
  - Ensure the main user on each is `pi`

## Server Network Setup
- Ensure both servers have static IP addresses
- Port forward ports 443, 80, 1194 and 1195 on VPN server **(No ports on the CA server should be port forwarded)**
- Update VPN Server `/etc/hosts` file to have an entry for `ca` to be pointed to the static IP address of the CA Server
- Update the CA Server `/etc/hosts` file to have an entry for `server` to be pointed to the static IP address of the VPN Server
- On each server, generate an SSH key using `ssh-keygen` and place the contents of the `id_rsa.pub` file into the other server's `authorized_keys` file. **(Ensure there's no password and you may need to create the `authorized_keys` file)**
- Update `/etc/sysctl.conf` on the VPN server and uncomment the line `net.ipv4.ip_forward=1` by removing the `#`
- Run the command `sudo sysctl -p`

## Server Setup
- Ensure both servers are running and can communicate with each other at `pi@ca` and `pi@server`
- Run `create-server.sh` script

## Firewall Configuration
- Update `/etc/default/ufw` line `DEFAULT_FORWARD_POLICY` from `DROP` to `ACCEPT`

- Create rules for the following using the following command `sudo ufw allow proto <tcp/udp> from <ip/any> to <outgoing> port <port>`

```
To                         Action      From
--                         ------      ----
10.8.0.0/24 1:65535/tcp    ALLOW       10.8.0.0/24
10.8.0.0/24 1:65535/udp    ALLOW       10.8.0.0/24
10.7.0.0/24 1:65535/tcp    ALLOW       10.7.0.0/24
10.7.0.0/24 1:65535/udp    ALLOW       10.7.0.0/24
[SERVER IP] 22/tcp         ALLOW       [SERVER/CA SUBNET]
[SERVER IP] 1194,1195/udp  ALLOW       Anywhere
[SERVER IP] 80,443/tcp     ALLOW       Anywhere

[CA IP]     22            ALLOW OUT   [SERVER IP]
```
- Note that when you need to do things on the server that involve the internet, you should do `sudo ufw disable`.

## HTTPS Certificates
- Use `certbot` to keep https certificates up to date. Use the standalone server settings.
- The command is pretty straight forwards. Ensure the domain is pointing to the public IP address you're using

## Running the Server
- Within `/server` run `npm start -- example.org` (example.org being the domain the server is running from). Also, this script assumes you're sshing into the server machine. It
determines the host IP based on $SSH_CLIENT. See `start.sh`.

## Deploying the Server
- Within `/server` run `npm run deploy -- example.org` (example.org being the domain the server is running from).

## Hard Drives
- Mount 1 or more drives within `/share`. Each mount should be prefixed with `drive`. Use `blkid` to get the device UUID values and add each device to fstab
```
UUID=f65ea3bb-2c67-4cf1-b65e-23044f7c3ffe /share/drive15TB ext4 defaults,nofail 0 2
``` 
- It's recommended to format the drives as ext4. I don't remember why but I was very passionate about that so I probably ran into a bunch of issues.

## Database
- Running reset-database.sh will delete and create the database. Use it to refresh data. However any unix/smb/vpn users won't be deleted this way.
