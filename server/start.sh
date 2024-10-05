#!/bin/bash

ssh_client_location=$(echo $SSH_CLIENT | grep -Eo "[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}");
ip_address=$(ifconfig | grep -Eo "inet $ssh_client_location\.[0-9]{1,3}" | grep -Eo "$ssh_client_location\.[0-9]{1,3}" | head -1)

TMP=$(mktemp).json

cat proxy-config.json | sed "s/IP_ADDRESS/$ip_address/g" > $TMP

{ { node index.js "$1" headless; } & { cd ../client; npm start -- --proxy-config $TMP --host $ip_address; } }