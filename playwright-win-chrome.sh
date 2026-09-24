#!/bin/bash
# Launch Playwright MCP on the Windows side so it drives the REAL Windows Chrome
# with a persistent, sandboxed profile (signed-out until you log in once).
# A watcher resizes the Chrome window to the current RDP screen when it doesn't fit.
setsid cmd.exe /c "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\\Users\\Administrator\\.playwright\\resize-chrome.ps1" </dev/null >/dev/null 2>&1 &
exec /mnt/c/Windows/System32/cmd.exe /c "cd /d C:\\Users\\Administrator && npx -y @playwright/mcp@0.0.79 --browser chrome --user-data-dir C:/Users/Administrator/.playwright-chrome --viewport-size 1920x1080 --init-script C:/Users/Administrator/.playwright/stealth-init.js --config C:/Users/Administrator/.playwright/mcp-config.json"