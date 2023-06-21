#!/bin/bash

if [ -z "$3" ]; then
    ssh pi@ca -tt "/usr/share/easy-rsa/create_certificate_nopass.sh \"$2\""
else
    ssh pi@ca -tt "/usr/share/easy-rsa/create_certificate.sh \"$2\" \"$3\""
fi
mkdir -p "$1"/keys/
scp pi@ca:/usr/share/easy-rsa/pki/issued/"$2".crt "$1"/keys/
scp pi@ca:/usr/share/easy-rsa/pki/private/"$2".key "$1"/keys/
