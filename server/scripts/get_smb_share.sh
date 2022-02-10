#!/bin/bash

sed 's/<username>/'"$2"/g "$1"/config/smb-share.bat | sed 's/<password>/'"$3"/g