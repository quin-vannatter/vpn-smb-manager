#!/bin/bash

sudo userdel -r "$1"
sudo smbpasswd -x "$1"
sudo mv /share/base/"$1" /tmp/