#!/bin/bash

cd /usr/share/easy-rsa
echo $2 > password
rm ./pki/issued/$1.crt
rm ./pki/private/$1.key
rm ./pki/reqs/$1.req
./easyrsa --passout=file:password build-client-full $1
rm password
