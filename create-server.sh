#!/bin/bash

# Log into the Certificate Authority, download easy-rsa, generate a CA certificate and Server certiticate.
ssh pi@ca -t "sudo apt-get install easy-rsa;sudo chown -R pi.pi /usr/share/easy-rsa"

# Copy the CA scripts onto the CA server
scp ./ca-config/* pi@ca:/tmp/ca-config/
ssh pi@ca -t "sudo mv /tmp/ca-config/* /usr/share/easy-rsa/"

ssh pi@ca -t "cd /usr/share/easy-rsa;./easyrsa init-pki;./easyrsa build-ca nopass;./easyrsa build-server-full vpn-server nopass;mkdir -p /tmp/ca-config"

# Copy the ca.crt and server certificates back to the VPN server
mkdir -p /tmp/ca-config
scp pi@ca:/usr/share/easy-rsa/pki/ca.crt pi@ca:/usr/share/easy-rsa/pki/private/vpn-server.key pi@ca:/usr/share/easy-rsa/pki/issued/vpn-server.crt /tmp/ca-config/

# Move the certs and keys to the VPN server
sudo mv /tmp/ca-config/* /etc/openvpn/

# Install required components
sudo apt-get install npm openvpn bridge-utils ufw sqlite3 samba

# Generate a ta.key
openvpn --genkey secret ta.key
sudo mv ./ta.key /etc/openvpn/

# Copy the server.conf to the VPN Server
sudo cp ./vpn-config/*.conf /etc/openvpn/

# Start and enable the VPN
sudo service openvpn restart

# Install node dependencies
sudo npm install -g n
sudo n stable

# Create the database and install server
cd ./server
sqlite3 vpn-smb-manager.db < ./config/tables.sql
npm install

# Install and build client
cd ../client
npm install
npm run build

# Set up samba server conf
cd ..
sudo cp ./smb-config/smb.conf /etc/samba/
sudo cp ./dfree.sh /etc/samba/
sudo chmod 777 /etc/samba/dfree.sh

# Create bridge and eth interfaces to facilitate communication
sudo cp ./create-interfaces /etc/init.d/
sudo chmod +x /etc/init.d/create-interfaces
sudo update-rc.d create-interfaces defaults
sudo service create-interfaces start