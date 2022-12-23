#!/bin/bash

cd /usr/share/easy-rsa
rm ./pki/issued/$1.crt
rm ./pki/private/$1.key
rm ./pki/reqs/$1.req
echo "$2" > password
./easyrsa build-client-full $1 file
rm password
