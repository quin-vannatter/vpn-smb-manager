#!/bin/bash

sudo chmod 555 /share
sudo chown root.root /share

sudo mkdir -p /share/users/"$1"

sudo chmod 555 /share/users
sudo chown root.root /share/users

sudo chmod 550 /share/users/"$1"

cd /share

for drive in drive* ; do
    sudo chmod 555 /share/"$drive"
    sudo chown root.root /share/"$drive"

    sudo mkdir -p /share/"$drive"/public
    sudo chown root.root /share/"$drive"/public
    sudo chmod 777 /share/"$drive"/public

    sudo mkdir -p /share/"$drive"/"$1"/private
    
    sudo chown -R root."$1" /share/"$drive"/"$1"
    sudo chmod 750 /share/"$drive"/"$1"
    sudo chmod 770 /share/"$drive"/"$1"/private

    sudo rm /share/"$drive"/"$1"/public
    sudo ln -s /share/"$drive"/public /share/"$drive"/"$1"/public

    sudo rm /share/users/"$1"/"$drive"
    sudo ln -s /share/"$drive"/"$1" /share/users/"$1"/"$drive"
done

sudo chown root."$1" /share/users/"$1"
