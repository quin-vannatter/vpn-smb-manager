#!/bin/bash

ssh pi@ca -t "/usr/share/easy-rsa/revoke_certificate.sh \"$2\""
"$1"/scripts/update_crl.sh