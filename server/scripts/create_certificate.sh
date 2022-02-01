#!/bin/bash

ssh pi@ca -t "/var/easy-rsa/create_certificate.sh $1 $2"
scp pi@ca:/var/easy-rsa/pki/issued/$1.crt ../keys/
scp pi@ca:/var/easy-rsa/pki/private/$1.key ../keys/