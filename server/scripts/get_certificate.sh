#!/bin/bash

cat "$1"/config/base-"$3".conf

echo "<ca>"
sudo cat /etc/openvpn/ca.crt
echo "</ca>"

echo "<cert>"
cat "$1"/keys/"$2".crt
echo "</cert>"

echo "<key>"
cat "$1"/keys/"$2".key
echo "</key>"

echo "<tls-crypt>"
sudo cat /etc/openvpn/ta.key
echo "</tls-crypt>"