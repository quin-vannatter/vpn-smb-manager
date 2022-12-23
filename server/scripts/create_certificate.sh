#!/bin/bash

ssh pi@ca -tt "/usr/share/easy-rsa/create_certificate.sh \"$2\" \"$3\""
mkdir -p "$1"/keys/
scp pi@ca:/usr/share/easy-rsa/pki/issued/"$2".crt "$1"/keys/
scp pi@ca:/usr/share/easy-rsa/pki/private/"$2".key "$1"/keys/
