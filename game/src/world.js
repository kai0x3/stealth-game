// The game's rules and state, with no drawing and no browser in it: the thief, the guards
// and their patrols, vision cones and line of sight, the detection meter, thrown coins,
// artifacts, the exit, lives and score. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react without the world knowing about screens
// or sound. Nothing here allocates after createWorld returns.
import { DETECTION, FIELD, GUARD, LIVES, PLAYER } from './config.js';
import { blocksMovement, blocksSight, findTiles, isShadowTile, parseLevel, tileAt, walkable } from './level.js';

export const EVENT_COIN = 1;
export const EVENT_ARTIFACT = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_LEVEL_CLEAR = 16;
export const EVENT_GAME_OVER = 32;
export const EVENT_WIN = 64;

export const GUARD_CALM = 0;
export const GUARD_SUSPICIOUS = 1;
export const GUARD_ALERT = 2;
export const GUARD_SEARCH = 3;
export const GUARD_RETURN = 4;

const TAU = Math.PI * 2;

function clamp(value, low, high) {
  return value < low ? low : value > high ? value : value;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** True when the circle at (x, y) with radius r touches a movement-blocking tile. */
export function collidesWithWalls(level, x, y, radius) {
  const left = Math.floor((x - radius) / FIELD.tile);
  const right = Math.floor((x + radius) / FIELD.tile);
  const top = Math.floor((y - radius) / FIELD.tile);
  const bottom = Math.floor((y + radius) / FIELD.tile);
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (!blocksMovement(level, col, row)) continue;
      const tileLeft = col * FIELD.tile;
      const tileTop = row * FIELD.tile;
      const nearX = clamp(x, tileLeft, tileLeft + FIELD.tile);
      const nearY = clamp(y, tileTop, tileTop + FIELD.tile);
      if ((x - nearX) * (x - nearX) + (y - nearY) * (y - nearY) < radius * radius) return true;
    }
  }
  return false;
}

/** Slide movement: try the full step, then each axis on its own, so walls feel smooth. */
function moveCircle(level, body, dx, dy) {
  if (!collidesWithWalls(level, body.x + dx, body.y + dy, body.radius)) {
    body.x += dx;
    body.y += dy;
    return;
  }
  if (!collidesWithWalls(level, body.x + dx, body.y, body.radius)) body.x += dx;
  else if (!collidesWithWalls(level, body.x, body.y + dy, body.radius)) body.y += dy;
}

/** Line of sight between two points: sample along the ray, walls and crates block it. */
export function hasLineOfSight(level, ax, ay, bx, by) {
  const dist = distance(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    const col = Math.floor((ax + (bx - ax) * t) / FIELD.tile);
    const row = Math.floor((ay + (by - ay) * t) / FIELD.tile);
    if (blocksSight(level, col, row)) return false;
  }
  return true;
}

function angleDifference(a, b) {
  let diff = (b - a) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return diff;
}

/**
 * How strongly a guard at (gx, gy) facing `facing` can see the point (x, y): 0 when out of
 * range, outside the cone or behind cover, rising to 1 at point-blank range.
 */
export function visibilityAt(level, gx, gy, facing, x, y) {
  const dist = distance(gx, gy, x, y);
  if (dist > GUARD.sightRange) return 0;
  const angleTo = Math.atan2(y - gy, x - gx);
  if (Math.abs(angleDifference(facing, angleTo)) > GUARD.sightHalfAngle) return 0;
  if (!hasLineOfSight(level, gx, gy, x, y)) return 0;
  return 1 - (dist / GUARD.sightRange) * 0.55;
}

export function createWorld(random) {
  const player = {
    x: 0, y: 0, radius: PLAYER.radius, facing: 0,
    moving: false, sneaking: false, inShadow: false,
  };
  const guards = [];
  const coins = [];
  const state = {
    levelIndex: 0,
    level: null,
    score: 0,
    lives: LIVES,
    elapsed: 0,
    artifactsTaken: 0,
    coinsLeft: PLAYER.coins,
    detection: 0,
    /** The highest detection any guard holds right now: what the HUD meter shows. */
    alarm: 0,
    everAlerted: false,
    everSpotted: false,
    /** Whether any guard has been fully alerted on the current floor (ghost bonus). */
    levelAlerted: false,
    /** The floor whose clear screen is showing (set when a floor is cleared). */
    clearedLevelName: '',
    levelStartScore: 0,
    levelTime: 0,
  };

  function loadLevel(index) {
    const level = parseLevel(index);
    state.level = level;
    state.levelIndex = index;
    state.artifactsTaken = 0;
    state.detection = 0;
    state.alarm = 0;
    state.levelAlerted = false;
    state.levelTime = 0;
    state.levelStartScore = state.score;
    player.x = level.playerStart.x;
    player.y = level.playerStart.y;
    player.facing = 0;
    player.moving = false;
    player.sneaking = false;
    guards.length = 0;
    for (const spawn of level.guardSpawns) {
      guards.push({
        x: spawn.waypoints[0].x,
        y: spawn.waypoints[0].y,
        radius: GUARD.radius,
        facing: 0,
        waypointIndex: 1,
        waypointDirection: 1,
        pause: 0,
        mode: GUARD_CALM,
        speed: GUARD.patrolSpeed * spawn.speed,
        suspicion: 0,
        lastSeenX: 0,
        lastSeenY: 0,
        loseSight: 0,
        searchLeft: 0,
        heardX: 0,
        heardY: 0,
        stepPhase: random() * TAU,
      });
    }
    coins.length = 0;
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.elapsed = 0;
    state.everAlerted = false;
    state.everSpotted = false;
    loadLevel(0);
  }

  /** The guard's current patrol target, walking out and back along its waypoints. */
  function patrolTarget(guard) {
    const points = state.level.guardSpawns[guards.indexOf(guard)].waypoints;
    return points[guard.waypointIndex];
  }

  function steerGuard(guard, targetX, targetY, speed, dt) {
    const dx = targetX - guard.x;
    const dy = targetY - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return true;
    const step = Math.min(dist, speed * dt);
    const body = { x: guard.x, y: guard.y, radius: guard.radius };
    moveCircle(state.level.def, body, (dx / dist) * step, (dy / dist) * step);
    guard.x = body.x;
    guard.y = body.y;
    guard.facing = Math.atan2(dy, dx);
    guard.stepPhase += dt * (speed / 14);
    return dist - step < 3;
  }

  function guardSeesPlayer(guard) {
    return visibilityAt(state.level.def, guard.x, guard.y, guard.facing, player.x, player.y);
  }

  /** A guard goes fully alert: chase the thief, sound the alarm, spoil the ghost bonus. */
  function raiseAlarm(guard) {
    guard.mode = GUARD_ALERT;
    state.everAlerted = true;
    state.everSpotted = true;
    state.levelAlerted = true;
    return EVENT_SPOTTED;
  }

  function updateGuard(guard, dt, harmless) {
    const level = state.level;
    const seen = harmless ? 0 : guardSeesPlayer(guard);
    const playerCol = Math.floor(player.x / FIELD.tile);
    const playerRow = Math.floor(player.y / FIELD.tile);
    player.inShadow = isShadowTile(level.def, playerCol, playerRow);

    if (seen > 0) {
      guard.lastSeenX = player.x;
      guard.lastSeenY = player.y;
      guard.loseSight = 0;
      let rate = DETECTION.baseRate * seen;
      if (player.sneaking) rate *= DETECTION.sneakFactor;
      if (player.inShadow) rate *= DETECTION.shadowFactor;
      if (!player.moving) rate *= DETECTION.stillFactor;
      guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - DETECTION.decayRate * dt);
      guard.loseSight += dt;
    }

    if (guard.mode === GUARD_CALM) {
      if (guard.suspicion >= GUARD.alertAt) return raiseAlarm(guard);
      if (guard.suspicion >= GUARD.suspiciousAt) guard.mode = GUARD_SUSPICIOUS;
      if (guard.pause > 0) {
        guard.pause -= dt;
        return 0;
      }
      const target = patrolTarget(guard);
      if (steerGuard(guard, target.x, target.y, guard.speed, dt)) {
        const points = level.guardSpawns[guards.indexOf(guard)].waypoints;
        guard.waypointIndex += guard.waypointDirection;
        if (guard.waypointIndex >= points.length || guard.waypointIndex < 0) {
          guard.waypointDirection *= -1;
          guard.waypointIndex += guard.waypointDirection * 2;
          guard.pause = GUARD.pauseAtWaypoint;
        }
      }
      return 0;
    }

    if (guard.mode === GUARD_SUSPICIOUS) {
      // Freeze, stare at where the player was glimpsed, then go and look.
      guard.facing += angleDifference(guard.facing, Math.atan2(guard.lastSeenY - guard.y, guard.lastSeenX - guard.x)) * Math.min(1, dt * 6);
      if (guard.suspicion >= GUARD.alertAt) return raiseAlarm(guard);
      if (guard.suspicion <= 0.05) {
        guard.mode = GUARD_CALM;
        return 0;
      }
      if (guard.loseSight > 1.2) {
        guard.mode = GUARD_SEARCH;
        guard.searchLeft = GUARD.searchTime;
      }
      return 0;
    }

    if (guard.mode === GUARD_ALERT) {
      if (seen > 0) guard.loseSight = 0;
      if (guard.loseSight > GUARD.loseSightAfter) {
        guard.mode = GUARD_SEARCH;
        guard.searchLeft = GUARD.searchTime;
        return 0;
      }
      steerGuard(guard, guard.lastSeenX, guard.lastSeenY, GUARD.chaseSpeed, dt);
      return 0;
    }

    if (guard.mode === GUARD_SEARCH) {
      guard.searchLeft -= dt;
      if (seen > 0 && guard.suspicion >= GUARD.alertAt) return raiseAlarm(guard);
      if (guard.searchLeft <= 0) {
        guard.mode = GUARD_RETURN;
        return 0;
      }
      steerGuard(guard, guard.lastSeenX, guard.lastSeenY, GUARD.searchSpeed, dt);
      return 0;
    }

    // GUARD_RETURN: walk back to the nearest patrol waypoint, then resume the patrol.
    const points = level.guardSpawns[guards.indexOf(guard)].waypoints;
    let nearest = points[0];
    let nearestDist = Infinity;
    for (const point of points) {
      const dist = distance(guard.x, guard.y, point.x, point.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = point;
      }
    }
    if (steerGuard(guard, nearest.x, nearest.y, GUARD.patrolSpeed, dt)) {
      guard.waypointIndex = points.indexOf(nearest);
      guard.mode = GUARD_CALM;
      guard.suspicion = 0;
    }
    return 0;
  }

  function updateCoins(dt) {
    for (const coin of coins) {
      if (!coin.active) continue;
      coin.ring += dt * 260;
      coin.life -= dt;
      if (coin.life <= 0) coin.active = false;
    }
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1 (WASD/arrows), `sneak` holds Shift,
   * `toss` is a world point the player clicked (or null). With `harmless` set (the title
   * screen's backdrop) guards patrol but nothing is ever spotted and nothing scores.
   */
  function step(dt, move, sneak, toss, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.levelTime += dt;
    const level = state.level;

    const speed = sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const magnitude = Math.hypot(move.x, move.y);
    player.moving = magnitude > 0.05;
    player.sneaking = sneak && player.moving;
    if (player.moving) {
      const nx = move.x / Math.max(1, magnitude);
      const ny = move.y / Math.max(1, magnitude);
      moveCircle(level.def, player, nx * speed * dt, ny * speed * dt);
      player.facing = Math.atan2(ny, nx);
    }

    if (toss !== null && state.coinsLeft > 0 && !harmless) {
      const dist = distance(player.x, player.y, toss.x, toss.y);
      if (dist > 24 && dist < 420) {
        state.coinsLeft -= 1;
        coins.push({ x: toss.x, y: toss.y, ring: 0, life: 1.6, active: true });
        events |= EVENT_COIN;
        for (const guard of guards) {
          if (distance(guard.x, guard.y, toss.x, toss.y) < PLAYER.coinHearing) {
            guard.heardX = toss.x;
            guard.heardY = toss.y;
            guard.lastSeenX = toss.x;
            guard.lastSeenY = toss.y;
            if (guard.mode === GUARD_CALM || guard.mode === GUARD_SUSPICIOUS) {
              guard.mode = GUARD_SEARCH;
              guard.searchLeft = GUARD.searchTime;
            }
          }
        }
      }
    }

    updateCoins(dt);

    // Artifacts: walk over a pedestal to pocket the relic.
    for (const artifact of level.artifacts) {
      if (artifact.taken) continue;
      if (distance(player.x, player.y, artifact.x, artifact.y) < 30) {
        artifact.taken = true;
        state.artifactsTaken += 1;
        state.score += 100;
        events |= EVENT_ARTIFACT;
      }
    }

    // Guards: vision, suspicion, chase. The HUD meter follows the hottest guard.
    let hottest = 0;
    for (const guard of guards) {
      events |= updateGuard(guard, dt, harmless);
      if (guard.suspicion > hottest) hottest = guard.suspicion;
    }
    state.detection = hottest;
    state.alarm = Math.max(...guards.map((guard) => (guard.mode === GUARD_ALERT ? 1 : guard.mode === GUARD_SUSPICIOUS ? 0.5 : 0)), 0);

    // Caught: an alerted guard close enough to grab the thief.
    if (!harmless) {
      for (const guard of guards) {
        if (guard.mode === GUARD_ALERT && distance(guard.x, guard.y, player.x, player.y) < guard.radius + player.radius + 4) {
          state.lives -= 1;
          events |= EVENT_CAUGHT;
          if (state.lives <= 0) {
            events |= EVENT_GAME_OVER;
          } else {
            state.score = state.levelStartScore;
            loadLevel(state.levelIndex);
          }
          return events;
        }
      }
    }

    // The exit opens once every relic is pocketed; reaching it clears the floor.
    if (!harmless && state.artifactsTaken >= level.artifactTotal) {
      if (distance(player.x, player.y, level.exit.x, level.exit.y) < 34) {
        state.score += 250 + (state.levelAlerted ? 0 : 300);
        state.clearedLevelName = level.name;
        events |= EVENT_LEVEL_CLEAR;
        if (state.levelIndex + 1 >= 3) {
          events |= EVENT_WIN;
        } else {
          loadLevel(state.levelIndex + 1);
        }
      }
    }
    return events;
  }

  reset();

  return {
    state,
    player,
    guards,
    coins,
    step,
    reset,
    loadLevel,
    /** How strongly any guard can see the point (x, y) right now (for the autopilot). */
    dangerAt(x, y) {
      let worst = 0;
      for (const guard of guards) {
        const seen = visibilityAt(state.level.def, guard.x, guard.y, guard.facing, x, y);
        if (seen > worst) worst = seen;
      }
      return worst;
    },
  };
}
