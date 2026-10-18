#!/bin/bash

# Create Nginx temp folders
mkdir -p /home/user/nginx_client_body \
         /home/user/nginx_proxy \
         /home/user/nginx_fastcgi \
         /home/user/nginx_uwsgi \
         /home/user/nginx_scgi

# 1. Start virtual display (masked as system-display)
system-display :0 -screen 0 1280x800x24 >/dev/null 2>&1 &
export DISPLAY=:0
sleep 2

# 2. Start telemetry relay service on internal port 3456
PORT=3456 node /home/user/server.js &
sleep 2

# 3. Start Nginx on external port 7860 in foreground
nginx -c /home/user/nginx.conf -g "daemon off;"
