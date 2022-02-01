#!/bin/bash

ssh pi@ca -t "/var/easy-rsa/update_crl.sh"
scp pi@ca:/var/easy-rsa/pki/crl.pem /tmp/
sudo mv /tmp/crl.pem /etc/openvpn/server/
sudo systemctl restart openvpn-server@server.service