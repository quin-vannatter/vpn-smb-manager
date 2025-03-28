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
sudo cp ./vpn-conf/*.conf /etc/openvpn/

# Start and enable the VPN
sudo service openvpn restart
