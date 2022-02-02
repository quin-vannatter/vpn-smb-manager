#!/bin/bash

cat $1/config/base.conf

echo "<ca>"
cat $1/config/ca.crt
echo "</ca>"

echo "<cert>"
cat $1/keys/$2.crt
echo "</cert>"

echo "<key>"
cat $1/keys/$2.key
echo "</key>"

echo "<tls-crypt>"
sudo cat $1/config/ta.key
echo "</tls-crypt>"