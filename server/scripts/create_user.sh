#!/bin/bash

sudo adduser --no-create-home --disabled-password --disabled-login "$1"
echo -e "$2\n$2\n" | sudo smbpasswd -s -a "$1"
sudo mkdir -p /share/base/"$1"/private
sudo chmod 755 /share/base/"$1"
sudo chmod 700 /share/base/"$1"/private
sudo chown -R "$1"."$1" /share/base/"$1"
sudo ln -s /share/base/public /share/base/"$1"/public
