[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/kai0x3/stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/kai0x3/stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

# NIGHTSHADE — The Gallery Job

Entry for "Make the best stealth game" ($50, 10 places paid), a make.fun bounty.
Free entry, no fee. Closes Sun 22 Nov 2026 05:59 UTC (12:59 WIB).

A top-down stealth game in plain static files: sneak through three museum floors at
night, steal every relic, and reach the exit unseen. Guards patrol with vision cones
that are clipped by walls and crates; a detection meter fills while you are seen and
drains while you hide, so a near miss can still be recovered. Shadows hide you, crates
block sight, and a tossed coin draws a guard away to investigate the sound.

## How to play

- **WASD / arrow keys** — move
- **Shift** — sneak (slower, quieter, harder to spot)
- **Click / F** — toss a coin where you click; guards in earshot go and look
- **P / Esc** — pause

Steal all three relics on a floor to unlock the exit. Three floors: The Grand Gallery,
The Vault Wing, The Rooftop Garden. Getting caught costs a life — three lives, then the
night is over. Clear a floor without ever being spotted for a +300 ghost bonus.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

No build step, no network requests, no libraries: `game/index.html` and its ES modules,
plus synthesised WebAudio sounds. Screenshots in `screenshots/` are real renders of the
game in a browser (`shots.json` lists the `?shot=` scene for each one).
