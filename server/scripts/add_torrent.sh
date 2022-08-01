#!/bin/bash

DOWNLOAD_DIR=/share/"$1"/torrents

sudo mkdir -p $DOWNLOAD_DIR
sudo chown pi.pi $DOWNLOAD_DIR
sudo chmod 755 $DOWNLOAD_DIR

transmission-daemon --bind-address-ipv4=$(ifconfig tun1 | grep -E "^\s*inet " | grep -oE "inet [0-9\.]+" | grep -Eo "[0-9\.]+")
transmission-remote --add="'""$2""'" --download-dir=$DOWNLOAD_DIR