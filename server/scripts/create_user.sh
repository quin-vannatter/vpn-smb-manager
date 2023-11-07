#!/bin/bash

sudo adduser --force-badname --gecos "" --no-create-home --disabled-password --disabled-login "$1"
sudo usermod -a -G "$1" pi
echo -e "$2\n$2\n" | sudo smbpasswd -s -a "$1"