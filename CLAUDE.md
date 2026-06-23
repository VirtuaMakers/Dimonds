# Dimonds — Project Notes

## Test Players
- **Chris** / Guest / Landscape / Laptop (Brave)
- **CT** / Guest / Portrait / Smaller Android phone (Brave)
- **River** / Host / Portrait / Larger Android phone (Brave)

All three are Christopher Thomas Bruckmann. Brave browser is the primary test environment. River is the host for now, but this may change.

## Deployment
Always push to BOTH branches:
```
git push origin main
git push origin main:claude/phone-playable-jsx-html-b2VVB
```

## Stack
- Single-file React 18 + Babel standalone PWA (`index.html`, ~11,600 lines)
- Service worker (`sw.js`) — bump `CACHE_NAME` version on every change
- Firebase RTDB for multiplayer state sync
- `mpRole`: `'none'` = single-player, `'host'` = multiplayer host, `'guest'` = multiplayer guest
