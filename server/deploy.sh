#/bin/bash

cd ../client
npm run build
cd ../server

sudo pm2 start --name vpn-smb-manager node -- index.js $1
sudo pm2 save
