#!/bin/bash

sudo rm server/vpn-smb-manager.db
sqlite3 server/vpn-smb-manager.db < server/config/tables.sql