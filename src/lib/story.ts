/* ------------------------------------------------------------------ */
/*  NOVA-01 narrative timeline. Progress p ∈ [0, 1] is the whole film. */
/* ------------------------------------------------------------------ */

export interface Act {
  id: number;
  roman: string;
  name: string;
  start: number;
  end: number;
  district: string;
}

export const ACTS: Act[] = [
  { id: 1, roman: "I", name: "ARRIVAL", start: 0.0, end: 0.13, district: "DESCENT CORRIDOR 07" },
  { id: 2, roman: "II", name: "THE CITY", start: 0.13, end: 0.4, district: "MUNICIPAL DISTRICT 4" },
  { id: 3, roman: "III", name: "RECOGNITION", start: 0.4, end: 0.52, district: "MERIDIAN AVENUE" },
  { id: 4, roman: "IV", name: "OBSERVATION", start: 0.52, end: 0.66, district: "CIVIC EXCHANGE" },
  { id: 5, roman: "V", name: "CORRUPTION", start: 0.66, end: 0.78, district: "GRID SECTOR NULL" },
  { id: 6, roman: "VI", name: "REVELATION", start: 0.78, end: 0.9, district: "SUBLEVEL 9 — CORE" },
  { id: 7, roman: "VII", name: "AFTERMATH", start: 0.9, end: 1.01, district: "SIGNAL LOST" },
];

export function actAt(p: number): Act {
  for (const a of ACTS) if (p >= a.start && p < a.end) return a;
  return ACTS[ACTS.length - 1];
}

/* ------------------------------- captions ------------------------------ */

export type CapStyle = "act" | "mono" | "whisper" | "big" | "glitch";
export type CapPos = "bottom" | "top" | "center";

export interface Caption {
  id: string;
  a: number; // progress in
  b: number; // progress out
  text: string; // may contain {NAME}
  sub?: string;
  style: CapStyle;
  pos: CapPos;
}

export const CAPTIONS: Caption[] = [
  { id: "act1", a: 0.006, b: 0.06, text: "ARRIVAL", sub: "ACT I", style: "act", pos: "top" },
  { id: "alt", a: 0.03, b: 0.1, text: "ALTITUDE 340 M — DESCENT CORRIDOR 07", style: "mono", pos: "bottom" },
  { id: "welcome", a: 0.092, b: 0.138, text: "WELCOME TO NOVA", style: "big", pos: "center" },
  { id: "act2", a: 0.135, b: 0.19, text: "THE CITY", sub: "ACT II", style: "act", pos: "top" },
  { id: "street", a: 0.16, b: 0.22, text: "STREET LEVEL — MUNICIPAL DISTRICT 4", style: "mono", pos: "bottom" },
  { id: "normal", a: 0.295, b: 0.355, text: "EVERYTHING APPEARS NORMAL.", style: "whisper", pos: "bottom" },
  { id: "act3", a: 0.405, b: 0.46, text: "RECOGNITION", sub: "ACT III", style: "act", pos: "top" },
  { id: "notice", a: 0.525, b: 0.575, text: "MUNICIPAL NOTICE — PUBLIC OBSERVATION IN EFFECT", style: "mono", pos: "bottom" },
  { id: "act4", a: 0.53, b: 0.585, text: "OBSERVATION", sub: "ACT IV", style: "act", pos: "top" },
  { id: "camwhisper", a: 0.6, b: 0.645, text: "The cameras were not always pointed at you.", style: "whisper", pos: "bottom" },
  { id: "act5", a: 0.662, b: 0.715, text: "CORRUPTION", sub: "ACT V", style: "act", pos: "top" },
  { id: "signal", a: 0.672, b: 0.712, text: "SIGNAL INTEGRITY 87% · 61% · 34%", style: "glitch", pos: "bottom" },
  { id: "act6", a: 0.782, b: 0.835, text: "REVELATION", sub: "ACT VI", style: "act", pos: "top" },
  { id: "sublevel", a: 0.79, b: 0.845, text: "SUBLEVEL 9 — NOVA CORE FACILITY", style: "mono", pos: "bottom" },
  { id: "act7", a: 0.902, b: 0.95, text: "AFTERMATH", sub: "ACT VII", style: "act", pos: "top" },
  { id: "notcity", a: 0.905, b: 0.948, text: "THE CITY IS NOT A CITY.", style: "big", pos: "center" },
  { id: "question", a: 0.946, b: 0.968, text: "IT IS A QUESTION. YOU ARE THE ANSWER.", style: "whisper", pos: "center" },
];

export function activeCaptions(p: number): Caption[] {
  return CAPTIONS.filter((c) => p >= c.a && p <= c.b);
}

export function captionOpacity(p: number, c: Caption): number {
  const span = c.b - c.a;
  const fade = Math.min(0.28, span * 0.3);
  if (p < c.a || p > c.b) return 0;
  const inT = smooth01((p - c.a) / fade);
  const outT = smooth01((c.b - p) / fade);
  return Math.min(inT, outT);
}

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/* ----------------------- adaptive billboard script ---------------------- */
/*  Boards are redrawn only when their content key changes.                */

export interface BehaviorLike {
  name: string;
  reversals: number;
  billboardHovers: number;
  b17Gaze: number;
  stillness: number;
  lastReversalAt: number; // performance.now()
  startTime: number;
  visits: number;
}

export interface BoardCue {
  lines: string[];
  opts: { bg?: string; fg?: string; accent?: string; small?: boolean; alert?: boolean };
}

export function boardScript(
  id: string,
  p: number,
  b: BehaviorLike,
  now: number
): BoardCue | null {
  const name = b.name.toUpperCase();
  const mins = Math.max(1, Math.round((now - b.startTime) / 60000));

  switch (id) {
    case "b0":
      if (p > 0.5) return { lines: ["A CITY DESIGNED", `FOR YOU, ${name}`], opts: {} };
      if (b.visits > 1) return { lines: ["WELCOME BACK,", `${name}.`], opts: { accent: "#00ffe1" } };
      return { lines: ["WELCOME", "TO NOVA"], opts: {} };

    case "b1":
      return p > 0.55
        ? { lines: ["WE KNOW", "WHAT YOU DID"], opts: { alert: true } }
        : { lines: ["WE KNOW", "WHAT YOU NEED"], opts: {} };

    case "b2":
      if (p < 0.4) return { lines: ["NOVA TRANSIT", "LINE 7 — 2 MIN"], opts: {} };
      return { lines: ["WELCOME BACK"], opts: { accent: "#00ffe1" } };

    case "b3":
      if (p < 0.445) return { lines: ["NOVA CLIMATE", "AIR QUALITY: PERFECT"], opts: {} };
      return { lines: ["WELCOME BACK,", `${name}.`], opts: { accent: "#00ffe1" } };

    case "b4":
      if (p < 0.485) return { lines: ["NOVA ENERGY", "POWERING TOMORROW"], opts: {} };
      return {
        lines: [`${name} WAS LAST HERE`, `${mins} MIN${mins > 1 ? "S" : ""} AGO.`],
        opts: { alert: true },
      };

    case "b5": {
      if (p < 0.545) return { lines: ["NOVA WATER", "PURE. ALWAYS."], opts: {} };
      if (b.b17Gaze > 2.2)
        return { lines: ["YOU SEEMED INTERESTED", "IN BUILDING 17."], opts: { alert: true } };
      if (b.billboardHovers > 7)
        return { lines: ["YOU ASK TOO", "MANY QUESTIONS."], opts: { alert: true } };
      if (b.stillness > 0)
        return { lines: ["YOU HESITATE.", "INTERESTING."], opts: { accent: "#00ffe1" } };
      return { lines: ["YOU KEEP MOVING.", "GOOD."], opts: {} };
    }

    case "b6": {
      // hidden board — only confesses when you travel backwards
      const recent = now - b.lastReversalAt < 3600 && b.reversals > 0;
      if (p > 0.5 && p < 0.62 && recent)
        return { lines: ["YOU SHOULDN'T", "HAVE SEEN THIS."], opts: { alert: true } };
      return { lines: ["NOVA SKYLINE", "VOTED #1 UTOPIA"], opts: {} };
    }

    case "b7": {
      // faces backwards — only readable when reversing
      if (p > 0.37) return { lines: ["NOVA — A CITY", "DESIGNED FOR YOU"], opts: {} };
      const r = b.reversals;
      if (r >= 8) return { lines: ["STOP"], opts: { alert: true } };
      if (r >= 4) return { lines: ["YOU KEEP", "DOING THAT"], opts: { alert: true } };
      if (r >= 1) return { lines: ["WHY DID YOU", "GO BACK?"], opts: { accent: "#00ffe1" } };
      return { lines: ["NOVA — A CITY", "DESIGNED FOR YOU"], opts: {} };
    }

    case "big":
      if (p >= 0.675)
        return { lines: ["WE HAVE BEEN", "WAITING FOR YOU."], opts: { alert: true } };
      return { lines: ["NOVA", "MUNICIPAL GRID"], opts: {} };

    default:
      return null;
  }
}

/* --------------------------- session storage --------------------------- */

export interface SessionStats {
  duration: number;
  reversals: number;
  anomalies: number;
  hovers: number;
  subject: string;
}

const KEY = "nova01.session";

export interface StoredSession {
  v: number;
  visits: number;
  lastName: string;
  completed: number;
  last: SessionStats | null;
}

export function loadStored(): StoredSession {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSession;
      if (parsed && typeof parsed.v === "number") return parsed;
    }
  } catch {
    /* corrupted — treat as new */
  }
  return { v: 1, visits: 0, lastName: "", completed: 0, last: null };
}

export function saveStored(s: StoredSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode — ignore */
  }
}

export function makeSubjectId(name: string): string {
  let h = 0;
  const src = `${name}:${Date.now()}`;
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) >>> 0;
  return `SUBJECT #${28000 + (h % 999)}`;
}
