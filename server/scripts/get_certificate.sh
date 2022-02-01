#!/bin/bash

cat ../config/base.conf

echo "<ca>"
cat ../config/ca.crt
echo "</ca>"

echo "<cert>"
cat ../keys/$1.crt
echo "</cert>"

echo "<key>"
cat ../keys/$1.key
echo "</key>"

echo "<tls-crypt>"
sudo cat ../config/ta.key
echo "</tls-crypt>"