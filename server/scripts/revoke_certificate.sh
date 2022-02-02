#!/bin/bash

ssh pi@ca -t "/var/easy-rsa/revoke_certificate $2"
$1/scripts/update_crl.sh