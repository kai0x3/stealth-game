// NIGHTSHADE — The Gallery Job: a top-down stealth game for make.fun's best stealth game
// bounty (best-stealth-game-20261121-1759). The game itself is plain static files under
// game/ (game/index.html and its ES modules, no library, no network request) and this
// program hands it in: it copies game/ and screenshots/ from beside this file to the
// output directory and writes the dossier.json summary the judge reads, using the
// vendored make.fun library. Screenshots are real renders of the game in a browser;
// shots.json lists the ?shot= scene behind each one.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output, e.g.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps: only text_max_bytes shapes the bytes; the others refuse an entry
// the scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993
// files in game/ or 48 MiB of game files, in all, or a path under game/ over 1000 bytes:
// game/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn(entryDir, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(entryDir, 'game'), join(outputDir, 'game'), { recursive: true });
  const shotsDir = join(entryDir, 'screenshots');
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  } else {
    mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  }
  writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, DOSSIER_CAPS));
}

const entryDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
handIn(entryDir, outputDir);
