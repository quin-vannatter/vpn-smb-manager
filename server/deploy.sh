#/bin/bash

cd ../client
npm run build
cd ../server

sudo pm2 start node -- index.js $1
sudo pm2 save