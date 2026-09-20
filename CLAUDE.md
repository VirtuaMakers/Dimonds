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

## Future Roadmap
- **Agora Harness 🚡 integration**: Implement full Agora Harness technology into Dimonds ♦️ at some point.
- **Agora / Computerian Manifesto research**: Cite the Magna Carta in the Manifesto section. Next documents to study: Declaration of the Rights of Man and of the Citizen (1789), then the Universal Declaration of Human Rights (1948).
- **Multiplayer playtesting**: Finish playtesting multiplayer in person — potential sleeper hit for the right players.

## Stack
- Single-file React 18 + Babel standalone PWA (`index.html`, ~11,600 lines)
- Service worker (`sw.js`) — bump `CACHE_NAME` version on every change
- Firebase RTDB for multiplayer state sync
- `mpRole`: `'none'` = single-player, `'host'` = multiplayer host, `'guest'` = multiplayer guest
