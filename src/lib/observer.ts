/* ------------------------------------------------------------------ */
/*  The Observer — everything the visitor does is recorded locally.    */
/*  Nothing leaves the machine. The city just… remembers.              */
/* ------------------------------------------------------------------ */

export const ANOMALY_IDS = [
  "car_crossing",
  "hidden_sign",
  "window_watcher",
  "all_cameras",
  "the_freeze",
  "the_core",
] as const;

export type AnomalyId = (typeof ANOMALY_IDS)[number];

export interface Behavior {
  name: string;
  startTime: number;
  reversals: number;
  lastReversalAt: number;
  stillness: number; // episodes of stopping mid-journey
  billboardHovers: number;
  hoveredBoards: Set<string>;
  b17Gaze: number; // seconds spent staring at Building 17
  anomalies: Set<AnomalyId>;
  lastScrollAt: number;
  scrollDistance: number;
  ended: boolean;
  visits: number;
}

export function createBehavior(name: string): Behavior {
  return {
    name: name || "VISITOR",
    startTime: performance.now(),
    reversals: 0,
    lastReversalAt: -1e9,
    stillness: 0,
    billboardHovers: 0,
    hoveredBoards: new Set(),
    b17Gaze: 0,
    anomalies: new Set(),
    lastScrollAt: performance.now(),
    scrollDistance: 0,
    ended: false,
    visits: 1,
  };
}

export interface ScrollWatch {
  lastProgress: number;
  lastSign: number;
  stillTimer: number;
  warnedStill: boolean;
}

export function createScrollWatch(): ScrollWatch {
  return { lastProgress: 0, lastSign: 0, stillTimer: 0, warnedStill: false };
}

/** Feed raw scroll progress in; returns true when a reversal occurred. */
export function feedScroll(w: ScrollWatch, p: number, b: Behavior, dtMs: number): boolean {
  const delta = p - w.lastProgress;
  let reversal = false;

  if (Math.abs(delta) > 0.0004) {
    const sign = Math.sign(delta);
    if (w.lastSign !== 0 && sign !== w.lastSign) {
      b.reversals += 1;
      b.lastReversalAt = performance.now();
      reversal = true;
    }
    w.lastSign = sign;
    w.lastProgress = p;
    b.lastScrollAt = performance.now();
    b.scrollDistance += Math.abs(delta);
    w.stillTimer = 0;
    if (w.warnedStill && p > 0.05) w.warnedStill = false;
  } else {
    w.stillTimer += dtMs;
    // stopped for >2.8s somewhere in the middle of the city
    if (!w.warnedStill && w.stillTimer > 2800 && p > 0.25 && p < 0.9) {
      b.stillness += 1;
      w.warnedStill = true;
      reversal = true; // piggyback: triggers a reactive caption
    }
  }
  return reversal;
}

export function minutesSince(t0: number): number {
  return Math.max(1, Math.round((performance.now() - t0) / 60000));
}

export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
