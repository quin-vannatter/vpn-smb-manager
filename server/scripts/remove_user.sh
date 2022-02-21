#!/bin/bash

sudo userdel -r "$1"
sudo smbpasswd -x "$1"

cd /share

sudo rm -r /share/users/"$1"

for drive in drive* ; do
    sudo rm -r /share/"$drive"/"$1"/readonly
    sudo rm -r /share/"$drive"/"$1"/public


    sudo chown -R root.root /share/"$drive"/"$1"
    sudo chmod -R 777 /share/"$drive"/"$1"

    sudo mv /share/"$drive"/"$1"/private/* /share/"$drive"/public/

    sudo chown -R root.root /share/"$drive"/readonly/"$1"
    sudo chmod -R 777 /share/"$drive"/readonly/"$1"

    sudo mv /share/"$drive"/readonly/"$1"/* /share/"$drive"/public/

    sudo rm -r /share/"$drive"/"$1"
    sudo rm -r /share/"$drive"/readonly/"$1"
done