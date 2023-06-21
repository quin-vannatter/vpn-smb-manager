#!/bin/bash

ssh pi@ca -tt "/usr/share/easy-rsa/revoke_certificate.sh \"$2\""
"$1"/scripts/update_crl.sh
rm "$1"/keys/"$2"*
