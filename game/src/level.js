// The three museum floors, drawn as tile maps (32 by 18 tiles, 40px each).
//   #  wall          .  floor         c  crate (cover: blocks sight and movement)
//   s  shadow floor  a  artifact      e  exit door     p  player start
//   g  guard spawn (patrol waypoints live in the level definition, not the map)
//
// Guards patrol the waypoint lists; each list is walked out and back, pausing at the ends.
import { FIELD } from './config.js';

const LEVELS = [
  {
    name: 'The Grand Gallery',
    hint: 'Three relics, then the east door. Stay out of the cones.',
    map: [
      '################################',
      '#a....s.......cc......s........#',
      '#.............cc...............#',
      '#..cc....s...............s.....#',
      '#..cc.............cc.........e.#',
      '#.......cc.....................#',
      '#.......cc....s......cc........#',
      '#..s..........cc......cc.......#',
      '#...........a..................#',
      '#..cc............s....cc.......#',
      '#..cc.................cc.......#',
      '#......s......cc...............#',
      '#............cc......s.........#',
      '#..cc........s.........cc......#',
      '#..cc..................cc..a...#',
      '#p.....s..........cc...........#',
      '#......cc......................#',
      '################################'
    ],
    guards: [
      { waypoints: [[6, 3], [25, 3]], speed: 1.0 },
      { waypoints: [[20, 8], [20, 15]], speed: 1.0 },
    ],
  },
  {
    name: 'The Vault Wing',
    hint: 'Tighter halls, sharper eyes. The coin is your friend.',
    map: [
      '################################',
      '#a.............s...............#',
      '#......cc.....##.....cc........#',
      '#..s....cc....##...cc....s.....#',
      '#.............##...............#',
      '######..#######..######..###...#',
      '#..............................#',
      '#..cc......s....cc....s...cc...#',
      '#..cc...........cc........cc...#',
      '#........a...........s.........#',
      '#..s...........cc..............#',
      '######..#######..######..###...#',
      '#.............##...............#',
      '#..cc....s....##....cc....s....#',
      '#.............##...........a...#',
      '#p....cc.......##.....cc.......#',
      '#......s.............s.....e...#',
      '################################'
    ],
    guards: [
      { waypoints: [[4, 1], [27, 1]], speed: 1.1 },
      { waypoints: [[10, 6], [10, 10]], speed: 1.0 },
      { waypoints: [[22, 6], [22, 10]], speed: 1.15 },
    ],
  },
  {
    name: 'The Rooftop Garden',
    hint: 'Four guards, one way out. Ghost it if you can.',
    map: [
      '################################',
      '#a....s.....cc......s..........#',
      '#..............................#',
      '#..cc...s...cc.....cc...s......#',
      '#..cc.............cc.........e.#',
      '#......cc....s........cc.......#',
      '#......cc............cc....s...#',
      '#..s........cc.................#',
      '#..........cc......a...........#',
      '#..cc............s.............#',
      '#..cc....s..........cc....cc...#',
      '#.............cc...............#',
      '#....s.......cc......s.........#',
      '#..cc....................cc....#',
      '#..cc....a......s....cc....s...#',
      '#p..........cc.................#',
      '#.....s..........cc.......s....#',
      '################################'
    ],
    guards: [
      { waypoints: [[5, 2], [26, 2]], speed: 1.25 },
      { waypoints: [[8, 16], [8, 7]], speed: 1.15 },
      { waypoints: [[24, 16], [24, 6]], speed: 1.25 },
      { waypoints: [[16, 9], [28, 9]], speed: 1.1 },
    ],
  },
];

/** A wall or crate tile blocks sight; a wall or crate tile blocks movement. */
export function tileAt(level, col, row) {
  if (col < 0 || row < 0 || col >= FIELD.cols || row >= FIELD.rows) return '...............................#';
  return level.map[row][col];
}

export function isWallTile(level, col, row) {
  return tileAt(level, col, row) === '...............................#';
}

export function isCrateTile(level, col, row) {
  return tileAt(level, col, row) === 'c';
}

export function blocksSight(level, col, row) {
  const tile = tileAt(level, col, row);
  return tile === '...............................#' || tile === 'c';
}

export function blocksMovement(level, col, row) {
  const tile = tileAt(level, col, row);
  return tile === '...............................#' || tile === 'c';
}

export function isShadowTile(level, col, row) {
  return tileAt(level, col, row) === 's';
}

/** Walkable for the player and the guards: anything that is not a wall or a crate. */
export function walkable(level, col, row) {
  return !blocksMovement(level, col, row);
}

/** Find every tile holding `char` in the map, as pixel centres. */
export function findTiles(level, char) {
  const found = [];
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let col = 0; col < FIELD.cols; col += 1) {
      if (level.map[row][col] === char) {
        found.push({ x: (col + 0.5) * FIELD.tile, y: (row + 0.5) * FIELD.tile, col, row });
      }
    }
  }
  return found;
}

/** Parse a level definition into the structures the world uses. */
export function parseLevel(index) {
  const def = LEVELS[index];
  const artifacts = findTiles(def, 'a').map((tile) => ({ ...tile, taken: false, kind: index }));
  const exits = findTiles(def, 'e');
  const starts = findTiles(def, 'p');
  const guardSpawns = def.guards.map((guard) => ({
    waypoints: guard.waypoints.map(([col, row]) => ({
      x: (col + 0.5) * FIELD.tile,
      y: (row + 0.5) * FIELD.tile,
    })),
    speed: guard.speed,
  }));
  return {
    index,
    name: def.name,
    hint: def.hint,
    def,
    artifacts,
    exit: exits[0],
    playerStart: starts[0],
    guardSpawns,
    artifactTotal: artifacts.length,
  };
}

export function levelCount() {
  return LEVELS.length;
}
