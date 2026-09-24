#!/bin/bash
export DISPLAY="${DISPLAY:-:0}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
exec xvfb-run -a --server-args="-screen 0 1920x1080x24" npx -y @playwright/mcp@0.0.79 \
  --browser chrome \
  --executable-path /home/ubuntu/.config/opencode/chrome-wrapper.sh \
  --no-sandbox \
  --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36" \
  --viewport-size "1920x1080" \
  --init-script /home/ubuntu/.config/opencode/stealth-init.js \
  --proxy-server "socks5://127.0.0.1:40000" \
  "$@"
