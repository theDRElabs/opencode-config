#!/bin/bash
export DISPLAY="${DISPLAY:-:0}"
exec /home/DRE/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome --ozone-platform=x11 "$@"
