// The screenshot scenes behind ?shot=cover|patrol|alarm|escape. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (try every direction, keep clear of vision cones, head for the target), so the
// frame is what a short game really looks like and the same seed always gives the same
// frame. The cover shows the thief in shadow near a relic while a cone sweeps past; the
// patrol shows the guards mid-round; the alarm catches the moment a guard spots the thief;
// the escape plays all three floors to the win screen.
import { FIELD, GUARD, PLAYER, STEP } from './config.js';
import { EVENT_GAME_OVER, EVENT_WIN, GUARD_ALERT, collidesWithWalls } from './world.js';
import { walkable } from './level.js';
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const SAMPLE = STEP;
const DIRECTIONS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
];

function length(x, y) {
  return Math.hypot(x, y);
}

/**
 * Breadth-first path over walkable tiles, from (fromCol, fromRow) to (toCol, toRow):
 * a list of tiles from the start to the goal, or null when no route exists. A greedy
 * autopilot alone strands the thief behind a crate wall; the path is what gets it around.
 */
function findPath(levelDef, fromCol, fromRow, toCol, toRow) {
  const key = (col, row) => row * FIELD.cols + col;
  const previous = new Map();
  const queue = [[fromCol, fromRow]];
  previous.set(key(fromCol, fromRow), null);
  while (queue.length > 0) {
    const [col, row] = queue.shift();
    if (col === toCol && row === toRow) {
      const path = [];
      let node = [col, row];
      while (node !== null) {
        path.unshift(node);
        node = previous.get(key(node[0], node[1]));
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextCol = col + dc;
      const nextRow = row + dr;
      if (!walkable(levelDef, nextCol, nextRow) || previous.has(key(nextCol, nextRow))) continue;
      previous.set(key(nextCol, nextRow), [col, row]);
      queue.push([nextCol, nextRow]);
    }
  }
  return null;
}

/** The pixel centre of the next tile on the path to `target`, or the target itself. */
function nextPathPoint(world, target) {
  const level = world.state.level;
  const fromCol = Math.floor(world.player.x / FIELD.tile);
  const fromRow = Math.floor(world.player.y / FIELD.tile);
  const toCol = Math.floor(target.x / FIELD.tile);
  const toRow = Math.floor(target.y / FIELD.tile);
  const path = findPath(level.def, fromCol, fromRow, toCol, toRow);
  if (path === null || path.length < 2) return target;
  const [col, row] = path[1];
  return { x: (col + 0.5) * FIELD.tile, y: (row + 0.5) * FIELD.tile };
}

/**
 * Of the nine ways to move, the one that gets closest to the next point on the path to
 * `target` while staying out of vision cones. `dangerWeight` is how much a seen square
 * costs; the alarm scene passes 0 and runs straight at the nearest guard. Standing still
 * costs a little extra, so the thief never waits out a detour.
 */
export function autopilot(world, target, dangerWeight) {
  const player = world.player;
  const level = world.state.level;
  const steer = nextPathPoint(world, target);
  let best = DIRECTIONS[0];
  let bestScore = Infinity;
  for (const direction of DIRECTIONS) {
    const magnitude = length(direction.x, direction.y) || 1;
    const speed = PLAYER.walkSpeed;
    const nx = player.x + (direction.x / magnitude) * speed * SAMPLE;
    const ny = player.y + (direction.y / magnitude) * speed * SAMPLE;
    if (collidesWithWalls(level.def, nx, ny, player.radius)) continue;
    const progress = length(steer.x - nx, steer.y - ny);
    const danger = world.dangerAt(nx, ny);
    const still = direction.x === 0 && direction.y === 0 ? 30 : 0;
    const score = 3 * progress + dangerWeight * danger + still;
    if (score < bestScore) {
      bestScore = score;
      best = direction;
    }
  }
  const magnitude = length(best.x, best.y) || 1;
  return { x: best.x / magnitude, y: best.y / magnitude };
}

function nearestArtifact(world) {
  const player = world.player;
  let best = null;
  let bestDist = Infinity;
  for (const artifact of world.state.level.artifacts) {
    if (artifact.taken) continue;
    const dist = length(artifact.x - player.x, artifact.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = artifact;
    }
  }
  return best;
}

/** The current objective: the nearest relic, or the exit once they are all pocketed. */
function objectiveTarget(world) {
  const artifact = nearestArtifact(world);
  if (artifact !== null) return { x: artifact.x, y: artifact.y };
  return { x: world.state.level.exit.x, y: world.state.level.exit.y };
}

/** Step the world once under the autopilot, heading for `target` with `dangerWeight`. */
function autoStep(world, target, dangerWeight) {
  const move = autopilot(world, target, dangerWeight);
  const sneak = world.dangerAt(world.player.x, world.player.y) > 0.12;
  return world.step(SAMPLE, move, sneak, null, false);
}

function playScene(world, seconds, driver) {
  const limit = Math.floor(seconds / SAMPLE);
  for (let index = 0; index < limit; index += 1) {
    const done = driver(index);
    if (done) return true;
  }
  return false;
}

/**
 * Set `world` to the named scene (cover, patrol, alarm or escape; any other name is the
 * title) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;

  if (name === 'cover') {
    // Sneak to the shadow by the centre relic and hold while a cone sweeps past.
    const hideout = { x: 12.5 * FIELD.tile, y: 6.5 * FIELD.tile };
    playScene(world, 26, () => {
      const dist = length(hideout.x - world.player.x, hideout.y - world.player.y);
      if (dist > 26) {
        autoStep(world, hideout, 600);
        return false;
      }
      // Hold still in the shadow until a guard's cone comes close, then take the frame.
      world.step(SAMPLE, { x: 0, y: 0 }, true, null, false);
      const near = world.guards.some((guard) => length(guard.x - world.player.x, guard.y - world.player.y) < 420);
      return near;
    });
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'patrol') {
    // Head for the first relic; the frame catches the patrol mid-round.
    playScene(world, 9, () => {
      autoStep(world, objectiveTarget(world), 500);
      return false;
    });
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'alarm') {
    // Run in front of the nearest guard — straight into its cone — until it sounds the alarm.
    playScene(world, 30, () => {
      let nearest = world.guards[0];
      let nearestDist = Infinity;
      for (const guard of world.guards) {
        const dist = length(guard.x - world.player.x, guard.y - world.player.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = guard;
        }
      }
      // A point just ahead of the guard, inside its cone: the thief steps into the light.
      const ahead = {
        x: nearest.x + Math.cos(nearest.facing) * 120,
        y: nearest.y + Math.sin(nearest.facing) * 120,
      };
      autoStep(world, ahead, 0);
      return world.guards.some((guard) => guard.mode === GUARD_ALERT) || state.detection >= 0.95;
    });
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'escape') {
    // Play all three floors to the win screen; the frame is the collection complete. The
    // run for the exit is bold (a spot on the way out is fine), the relic hunt careful.
    let won = false;
    playScene(world, 600, () => {
      const allTaken = world.state.artifactsTaken >= world.state.level.artifactTotal;
      const events = autoStep(world, objectiveTarget(world), allTaken ? 200 : 700);
      if (events & EVENT_WIN) {
        won = true;
        return true;
      }
      if (events & EVENT_GAME_OVER) {
        world.reset();
        return false;
      }
      return false;
    });
    return { screen: won ? SCREEN_WIN : SCREEN_PLAY, best: state.score };
  }

  // Title: the level alive behind the panel, guards patrolling, nobody ever spotted.
  for (let index = 0; index < 5 / SAMPLE; index += 1) {
    world.step(SAMPLE, { x: 0, y: 0 }, false, null, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
