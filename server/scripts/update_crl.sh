#!/bin/bash

ssh pi@ca -tt "/usr/share/easy-rsa/update_crl.sh"
scp pi@ca:/usr/share/easy-rsa/pki/crl.pem /tmp/
sudo mv /tmp/crl.pem /etc/openvpn/
sudo systemctl restart openvpn.service
