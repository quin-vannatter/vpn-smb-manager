#!/bin/bash

cd /usr/share/easy-rsa
echo "yes" | ./easyrsa revoke $1
