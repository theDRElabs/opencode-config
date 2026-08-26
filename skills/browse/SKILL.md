# Browse Skill — Stealth Browser Automation

Use the `browse` CLI at `~/bin/browse` for all web browsing tasks. It launches Chromium with anti-detection hardening (stealth plugin, real UA, webdriver patched, behavioral simulation).

## Global Flags
All commands start with:
```bash
NODE_PATH=$(npm root -g) ~/bin/browse <url> [options]
```

## Quick Reference

| Task | Command |
|---|---|
| Open page, screenshot | `browse <url> -o /tmp/page.png` |
| Search a site | `browse <url> --search "query" -o /tmp/result.png` |
| Click element | `browse <url> --click "a.some-link" -o /tmp/after.png` |
| Type into field | `browse <url> --selector "input#q" --type "text" -o /tmp/typed.png` |
| Scroll down | `browse <url> --scroll 1000 -o /tmp/scrolled.png` |
| Read page text | `browse <url> --text` |
| Full page screenshot | `browse <url> --full -o /tmp/full.png` |
| Run JS in page | `browse <url> --js "document.title"` |
| Persistent session | `browse <url> --profile reddit -o /tmp/r.png` |

## Behavioral Simulation
- Random delays between keystrokes (30-150ms)
- Occasional typing pauses (5% chance)
- Mouse moves to element before clicking (bezier-like path)
- Random scroll distances
- Random wait after page load (3-5s)

## Session Persistence
Use `--profile <name>` to save cookies/localStorage between runs. State is saved to `~/.browse-state/<name>/state.json` on browser close.

## Tips
- Always use `-o /tmp/something.png` to get a screenshot back
- Use `--text` to read page content without screenshotting
- Chain actions: `--search "query" --scroll 500 --click "a:first-child" -o /tmp/result.png`
- For the agent: prefer `--text` for data extraction, screenshots for visual verification
- Reddit/new sites: use `--profile` for session persistence to avoid login walls
