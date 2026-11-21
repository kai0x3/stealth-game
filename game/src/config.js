// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area made of 40px tiles (32 by 18); the renderer scales it to the window, so no rule below
// depends on the screen size.
export const FIELD = { width: 1280, height: 720, tile: 40, cols: 32, rows: 18 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 178,
  sneakSpeed: 102,
  /** How far a guard can be and still hear a coin land. */
  coinHearing: 300,
  coins: 5,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 86,
  chaseSpeed: 198,
  searchSpeed: 120,
  /** Vision range in pixels and half-angle of the cone, in radians. */
  sightRange: 205,
  sightHalfAngle: 0.56,
  /** Seconds a guard waits at each patrol waypoint. */
  pauseAtWaypoint: 1.4,
  /** Detection (0..1) at which a guard turns suspicious, then fully alerted. */
  suspiciousAt: 0.35,
  alertAt: 0.8,
  /** Seconds of no sight before an alerted guard gives up the chase and searches. */
  loseSightAfter: 2.4,
  /** Seconds a guard searches the last seen spot before walking back to patrol. */
  searchTime: 3.2,
};

export const DETECTION = {
  /** Detection gained per second at point-blank range, in the open, walking. */
  baseRate: 1.15,
  /** Multiplier while sneaking, while standing in shadow, while running is n/a (no run). */
  sneakFactor: 0.45,
  shadowFactor: 0.4,
  /** Detection drained per second while the player is unseen. */
  decayRate: 0.55,
  /** Standing still is a little harder to spot than moving. */
  stillFactor: 0.8,
};

export const LIVES = 3;

export const PALETTE = {
  backdrop: '#0d0f14',
  floorA: '#2e2620',
  floorB: '#2a221b',
  floorLine: '#241d16',
  wall: '#454b5c',
  wallTop: '#5d6579',
  wallEdge: '#2c303c',
  crate: '#6e4f27',
  crateTop: '#8a6534',
  crateEdge: '#4a3419',
  shadow: '#101a3a',
  shadowEdge: '#2c3f7d',
  player: '#35d0ba',
  playerDark: '#1d8a7c',
  guard: '#e5534b',
  guardDark: '#a33327',
  guardCap: '#7d241c',
  coneCalm: '255, 217, 77',
  coneSuspicious: '255, 150, 60',
  coneAlert: '255, 70, 60',
  artifactCyan: '#4fd8ff',
  artifactRuby: '#ff5d7a',
  artifactGold: '#ffd94d',
  pedestal: '#3a3f4a',
  exit: '#58d68d',
  exitLocked: '#7d8a7d',
  panel: '#171a21',
  panelEdge: '#2c3140',
  text: '#eef1f5',
  muted: '#9aa1b1',
  danger: '#ff6b5e',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nightshade.best';
