// Paints the world on a canvas: the museum floor, cover and shadows, the guards with
// their vision cones, the thief, the relics and the exit, plus the HUD and every screen.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window.
import { FIELD, FONT, GUARD, PALETTE } from './config.js';
import { GUARD_ALERT, GUARD_SEARCH, GUARD_SUSPICIOUS } from './world.js';
import { blocksSight, isShadowTile } from './level.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_CLEAR = 4;
export const SCREEN_WIN = 5;

const TAU = Math.PI * 2;

/** How far a vision cone ray marches in one step while looking for a wall. */
const CONE_RAY_STEP = 10;
const CONE_RAYS = 26;

function coneColor(guard) {
  if (guard.mode === GUARD_ALERT) return PALETTE.coneAlert;
  if (guard.mode === GUARD_SUSPICIOUS || guard.mode === GUARD_SEARCH) return PALETTE.coneSuspicious;
  return PALETTE.coneCalm;
}

function coneAlpha(guard) {
  if (guard.mode === GUARD_ALERT) return 0.4;
  if (guard.mode === GUARD_SUSPICIOUS || guard.mode === GUARD_SEARCH) return 0.32;
  return 0.24;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fitCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const scale = Math.min(width / FIELD.width, height / FIELD.height) * ratio;
    const offsetX = (canvas.width - FIELD.width * scale) / 2;
    const offsetY = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  }

  function drawFloor(level) {
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        const x = col * FIELD.tile;
        const y = row * FIELD.tile;
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, FIELD.tile, FIELD.tile);
        ctx.strokeStyle = PALETTE.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, FIELD.tile - 1, FIELD.tile - 1);
      }
    }
    // Shadow patches: dark pools where the thief is hard to spot.
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        if (!isShadowTile(level.def, col, row)) continue;
        const x = col * FIELD.tile;
        const y = row * FIELD.tile;
        ctx.fillStyle = PALETTE.shadow;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y, FIELD.tile, FIELD.tile);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = PALETTE.shadowEdge;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(x + 2, y + 2, FIELD.tile - 4, FIELD.tile - 4);
        ctx.setLineDash([]);
      }
    }
  }

  function drawExit(level, unlocked) {
    const exit = level.exit;
    const cx = exit.x;
    const cy = exit.y;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = unlocked ? PALETTE.exit : PALETTE.exitLocked;
    ctx.globalAlpha = unlocked ? 0.28 : 0.14;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#10131a';
    ctx.fillRect(-26, -30, 52, 60);
    ctx.strokeStyle = unlocked ? PALETTE.exit : PALETTE.exitLocked;
    ctx.lineWidth = 4;
    ctx.strokeRect(-26, -30, 52, 60);
    ctx.fillStyle = unlocked ? PALETTE.exit : PALETTE.exitLocked;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', 0, -2);
    if (unlocked) {
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText('▲', 0, -44);
    }
    ctx.restore();
  }

  function drawArtifacts(level) {
    for (const artifact of level.artifacts) {
      if (artifact.taken) continue;
      const colors = [PALETTE.artifactCyan, PALETTE.artifactRuby, PALETTE.artifactGold];
      const color = colors[artifact.kind % 3];
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 350 + artifact.x);
      ctx.save();
      ctx.translate(artifact.x, artifact.y);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.18 + 0.12 * pulse;
      ctx.beginPath();
      ctx.arc(0, 0, 26 + 4 * pulse, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = PALETTE.pedestal;
      ctx.beginPath();
      ctx.arc(0, 6, 13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(9, -4);
      ctx.lineTo(0, 6);
      ctx.lineTo(-9, -4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(-3, -7, 2.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCratesAndWalls(level) {
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        const tile = level.def.map[row][col];
        const x = col * FIELD.tile;
        const y = row * FIELD.tile;
        if (tile === 'c') {
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(x + 3, y + 3, FIELD.tile - 6, FIELD.tile - 6);
          ctx.fillStyle = PALETTE.crateTop;
          ctx.fillRect(x + 3, y + 3, FIELD.tile - 6, 8);
          ctx.strokeStyle = PALETTE.crateEdge;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3, y + 3, FIELD.tile - 6, FIELD.tile - 6);
          ctx.beginPath();
          ctx.moveTo(x + 3, y + 3);
          ctx.lineTo(x + FIELD.tile - 3, y + FIELD.tile - 3);
          ctx.moveTo(x + FIELD.tile - 3, y + 3);
          ctx.lineTo(x + 3, y + FIELD.tile - 3);
          ctx.stroke();
        } else if (tile === '#') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, FIELD.tile, FIELD.tile);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(x, y, FIELD.tile, 7);
          ctx.strokeStyle = PALETTE.wallEdge;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, FIELD.tile - 1, FIELD.tile - 1);
        }
      }
    }
  }

  /** A vision cone clipped by walls: march a fan of rays, stop each at the first cover. */
  function drawVisionCone(guard, level) {
    const range = GUARD.sightRange;
    const half = GUARD.sightHalfAngle;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (let index = 0; index <= CONE_RAYS; index += 1) {
      const angle = guard.facing - half + (2 * half * index) / CONE_RAYS;
      let reach = range;
      for (let dist = CONE_RAY_STEP; dist <= range; dist += CONE_RAY_STEP) {
        const px = guard.x + Math.cos(angle) * dist;
        const py = guard.y + Math.sin(angle) * dist;
        const col = Math.floor(px / FIELD.tile);
        const row = Math.floor(py / FIELD.tile);
        if (blocksSight(level.def, col, row)) {
          reach = dist - CONE_RAY_STEP;
          break;
        }
      }
      ctx.lineTo(guard.x + Math.cos(angle) * Math.max(0, reach), guard.y + Math.sin(angle) * Math.max(0, reach));
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(${coneColor(guard)}, ${coneAlpha(guard)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${coneColor(guard)}, 0.55)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawGuard(guard) {
    const bob = Math.sin(guard.stepPhase * 2) * 1.5;
    ctx.save();
    ctx.translate(guard.x, guard.y + bob * 0.3);
    // Footstep ring: the sound of a guard's patrol, visible on the floor.
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20 + 3 * Math.sin(guard.stepPhase), 0, TAU);
    ctx.stroke();
    // Body: a maroon uniform with a cap, facing the cone's direction.
    ctx.rotate(guard.facing);
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(0, 0, guard.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardCap;
    ctx.beginPath();
    ctx.arc(5, 0, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(guard.radius - 2, 0, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Suspicion and alarm marks float above the guard's head.
    ctx.save();
    ctx.translate(guard.x, guard.y - 30);
    ctx.font = `bold 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (guard.mode === GUARD_ALERT) {
      ctx.fillStyle = '#ff5040';
      ctx.fillText('!', 0, 0);
    } else if (guard.mode === GUARD_SUSPICIOUS || guard.mode === GUARD_SEARCH) {
      ctx.fillStyle = '#ffb03a';
      ctx.fillText('?', 0, 0);
    }
    ctx.restore();
  }

  function drawPlayer(player, detection) {
    ctx.save();
    ctx.translate(player.x, player.y);
    // The thief's lantern light: a soft pool that marks where they stand.
    const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 64);
    glow.addColorStop(0, 'rgba(53, 208, 186, 0.20)');
    glow.addColorStop(1, 'rgba(53, 208, 186, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, TAU);
    ctx.fill();
    if (player.sneaking) {
      ctx.strokeStyle = 'rgba(53, 208, 186, 0.5)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.rotate(player.facing);
    // Hooded figure: dark teal cloak, pale face in the hood's shadow.
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(2, 0, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0d0f14';
    ctx.beginPath();
    ctx.arc(6, -3, 2.4, 0, TAU);
    ctx.arc(6, 3, 2.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#eef1f5';
    ctx.beginPath();
    ctx.arc(6.5, -3, 1, 0, TAU);
    ctx.arc(6.5, 3, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
    // A thin detection ring over the thief while any guard is watching.
    if (detection > 0.02) {
      ctx.save();
      ctx.translate(player.x, player.y - 26);
      ctx.fillStyle = detection > 0.8 ? '#ff5040' : detection > 0.35 ? '#ffb03a' : '#ffd94d';
      ctx.fillRect(-18, -3, 36 * Math.min(1, detection), 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-18, -3, 36, 6);
      ctx.restore();
    }
  }

  function drawCoins(world) {
    for (const coin of world.coins) {
      if (!coin.active) continue;
      ctx.save();
      ctx.translate(coin.x, coin.y);
      ctx.strokeStyle = `rgba(242, 201, 76, ${Math.max(0, 0.8 - coin.ring / 320)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, coin.ring), 0, TAU);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function gemIcon(x, y, color, taken) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = taken ? 1 : 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, -2);
    ctx.lineTo(0, 6);
    ctx.lineTo(-6, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHud(world) {
    const state = world.state;
    const level = state.level;
    ctx.save();
    // Top bar.
    ctx.fillStyle = PALETTE.panel;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 46.5);
    ctx.lineTo(FIELD.width, 46.5);
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`NIGHTSHADE — ${level.name}`, 14, 24);
    // Relics collected.
    const gemColors = [PALETTE.artifactCyan, PALETTE.artifactRuby, PALETTE.artifactGold];
    for (let index = 0; index < level.artifactTotal; index += 1) {
      gemIcon(360 + index * 26, 24, gemColors[index % 3], index < state.artifactsTaken);
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONT}`;
    ctx.fillText(`${state.artifactsTaken}/${level.artifactTotal}`, 445, 24);
    // Coins and lives.
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(520, 24, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`× ${state.coinsLeft}`, 532, 24);
    ctx.fillStyle = state.lives > 1 ? PALETTE.text : PALETTE.danger;
    ctx.fillText(`♥ × ${state.lives}`, 590, 24);
    // Timer and score, right side.
    const minutes = Math.floor(state.levelTime / 60);
    const seconds = Math.floor(state.levelTime % 60);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${minutes}:${String(seconds).padStart(2, '0')}`, 1150, 24);
    ctx.fillText(`Score ${state.score}`, 1266, 24);
    // Detection meter, top centre: the eye that is always watching.
    const meterX = 700;
    const meterY = 24;
    const meterWidth = 180;
    const detection = state.detection;
    ctx.textAlign = 'left';
    ctx.fillStyle = detection > 0.8 ? '#ff5040' : detection > 0.35 ? '#ffb03a' : PALETTE.muted;
    ctx.font = `bold 15px ${FONT}`;
    const label = detection > 0.8 ? 'SPOTTED' : detection > 0.35 ? 'SUSPICIOUS' : 'UNSEEN';
    ctx.fillText(`◉ ${label}`, meterX, meterY);
    ctx.fillStyle = '#10131a';
    ctx.fillRect(meterX + 108, meterY - 6, 96, 12);
    ctx.fillStyle = detection > 0.8 ? '#ff5040' : detection > 0.35 ? '#ffb03a' : '#ffd94d';
    ctx.fillRect(meterX + 108, meterY - 6, 96 * Math.min(1, detection), 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(meterX + 108, meterY - 6, 96, 12);
    // Alarm banner while a guard is chasing.
    if (state.alarm >= 1) {
      ctx.fillStyle = 'rgba(255, 60, 40, 0.16)';
      ctx.fillRect(0, 46, FIELD.width, 34);
      ctx.fillStyle = '#ff6b5e';
      ctx.font = `bold 17px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED — BREAK LINE OF SIGHT!', FIELD.width / 2, 64);
    }
    // Bottom hint line.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('WASD / arrows move · Shift sneak · Click or F toss a coin · P pause', FIELD.width / 2, FIELD.height - 12);
    ctx.restore();
  }

  function drawPanel(title, lines, accent) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const panelWidth = 640;
    const panelHeight = 150 + lines.length * 30;
    const x = (FIELD.width - panelWidth) / 2;
    const y = (FIELD.height - panelHeight) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, panelWidth, panelHeight, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = `bold 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, FIELD.width / 2, y + 52);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `18px ${FONT}`;
    lines.forEach((line, index) => {
      ctx.fillText(line, FIELD.width / 2, y + 106 + index * 30);
    });
    ctx.restore();
  }

  function draw(state, world, screen, best) {
    fitCanvas();
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(-100, -100, FIELD.width + 200, FIELD.height + 200);
    const level = state.level;
    drawFloor(level);
    drawExit(level, state.artifactsTaken >= level.artifactTotal);
    drawArtifacts(level);
    for (const guard of world.guards) drawVisionCone(guard, level);
    drawCratesAndWalls(level);
    for (const guard of world.guards) drawGuard(guard);
    drawPlayer(world.player, state.detection);
    drawCoins(world);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(world);

    if (screen === SCREEN_TITLE) {
      drawPanel('NIGHTSHADE', [
        'The Gallery Job — steal every relic, reach the exit unseen.',
        'Guards patrol with vision cones. Shadows hide you. Coins distract.',
        `Best score ${best} · Press SPACE or click to begin`,
      ], PALETTE.player);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['Press P or SPACE to keep sneaking.'], PALETTE.muted);
    } else if (screen === SCREEN_OVER) {
      drawPanel('CAUGHT!', [
        `The guards found you. Score ${state.score} · Best ${best}`,
        'Press SPACE to try the gallery again.',
      ], PALETTE.danger);
    } else if (screen === SCREEN_CLEAR) {
      drawPanel(`${state.clearedLevelName.toUpperCase()} CLEARED`, [
        `Score ${state.score}${state.levelAlerted ? '' : ' · GHOST BONUS +300'}`,
        'Press SPACE for the next floor.',
      ], PALETTE.exit);
    } else if (screen === SCREEN_WIN) {
      drawPanel('THE COLLECTION IS YOURS', [
        `Every relic, every floor. Final score ${state.score} · Best ${best}`,
        'Press SPACE to play again.',
      ], PALETTE.gold);
    }
  }

  return { draw, fitCanvas };
}
