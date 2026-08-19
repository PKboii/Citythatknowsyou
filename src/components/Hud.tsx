import { ACTS, actAt } from "../lib/story";
import { ANOMALY_IDS, formatClock } from "../lib/observer";

interface HudProps {
  p: number;
  name: string;
  anomalies: Set<string>;
  elapsedMs: number;
  soundOn: boolean;
  onToggleSound: () => void;
  onSeek: (fraction: number) => void;
  live: boolean;
}

export function Hud({ p, name, anomalies, elapsedMs, soundOn, onToggleSound, onSeek, live }: HudProps) {
  const act = actAt(p);

  return (
    <>
      {/* top-left: system + act */}
      <div className="fixed left-5 z-30 select-none sm:left-7" style={{ top: "calc(4.2vh + 20px)" }}>
        <div className="font-display text-[13px] tracking-[0.24em] text-nova-ink">
          NOVA<span className="text-nova-blue">//</span>OS
        </div>
        <div className="font-term mt-0.5 text-[9px] tracking-[0.34em] text-nova-dim">
          v7.4.19 — MUNICIPAL FEED
        </div>
        <div className="mt-4 border-l border-[#2a3550] pl-3">
          <div className="font-term text-[9px] tracking-[0.4em] text-nova-blue">
            ACT {act.roman} / VII
          </div>
          <div className="font-display mt-1 text-sm tracking-[0.18em] text-nova-ink">{act.name}</div>
          <div className="font-term mt-1 text-[9px] tracking-[0.28em] text-nova-dim">{act.district}</div>
        </div>
      </div>

      {/* top-right: session telemetry */}
      <div
        className="fixed right-5 z-30 select-none text-right sm:right-7"
        style={{ top: "calc(4.2vh + 20px)" }}
      >
        <div className="flex items-center justify-end gap-2.5">
          <span className="rec-dot inline-block h-2 w-2 rounded-full bg-nova-red shadow-[0_0_10px_rgba(255,0,60,0.9)]" />
          <span className="font-term text-[10px] tracking-[0.3em] text-nova-ink">
            REC {formatClock(elapsedMs)}
          </span>
        </div>
        <div className="font-term mt-1.5 text-[9px] tracking-[0.3em] text-nova-dim">
          VISITOR: <span className="text-nova-cyan">{name.toUpperCase()}</span>
        </div>
        <button
          onClick={onToggleSound}
          className="btn-ghost mt-4 inline-flex items-center gap-2 px-3 py-2 text-[9px]"
          title="Toggle municipal audio"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5 6 9H2v6h4l5 4V5z" strokeLinejoin="round" />
            {soundOn ? (
              <>
                <path d="M15.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
                <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" strokeLinecap="round" />
              </>
            ) : (
              <path d="m16 9 6 6M22 9l-6 6" strokeLinecap="round" />
            )}
          </svg>
          {soundOn ? "AUDIO ON" : "AUDIO OFF"}
        </button>
      </div>

      {/* bottom-left: anomaly tracker */}
      <div className="fixed bottom-5 left-5 z-30 select-none sm:bottom-6 sm:left-7" style={{ marginBottom: "4.2vh" }}>
        <div className="font-term text-[9px] tracking-[0.4em] text-nova-dim">
          ANOMALIES <span className="text-nova-ink">{anomalies.size}</span> / {ANOMALY_IDS.length}
        </div>
        <div className="mt-2 flex gap-1.5">
          {ANOMALY_IDS.map((id) => {
            const found = anomalies.has(id);
            return (
              <span
                key={id}
                className="inline-block h-2 w-3.5 border transition-all duration-500"
                style={
                  found
                    ? { background: "#ff003c", borderColor: "#ff003c", boxShadow: "0 0 9px rgba(255,0,60,0.8)" }
                    : { borderColor: "#2a3550" }
                }
              />
            );
          })}
        </div>
      </div>

      {/* bottom-right: observer status */}
      <div
        className="fixed bottom-5 right-5 z-30 hidden select-none text-right sm:bottom-6 sm:right-7 sm:block"
        style={{ marginBottom: "4.2vh" }}
      >
        <div className="font-term text-[9px] tracking-[0.34em] text-nova-dim">
          OBSERVER STATUS
        </div>
        <div className="font-term mt-1 text-[10px] tracking-[0.3em]" style={{ color: p > 0.66 ? "#ff003c" : "#00ffe1" }}>
          {p > 0.9 ? "SIGNAL LOST" : p > 0.66 ? "HOSTILE — AWARE" : p > 0.52 ? "TRACKING YOU" : p > 0.4 ? "CURIOUS" : "NOMINAL"}
        </div>
      </div>

      {/* scroll hint */}
      {live && p < 0.02 && (
        <div className="pointer-events-none fixed inset-x-0 z-30 flex flex-col items-center" style={{ bottom: "calc(4.2vh + 64px)" }}>
          <div className="hint-drift flex flex-col items-center gap-2">
            <div className="font-term text-[10px] tracking-[0.5em] text-nova-ink">SCROLL TO DESCEND</div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5c8dff" strokeWidth="2">
              <path d="m5 9 7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}

      {/* act rail */}
      <div className="fixed inset-x-0 z-30 hidden justify-center sm:flex" style={{ bottom: "calc(4.2vh + 14px)" }}>
        <div className="relative h-6 w-[min(60vw,560px)]">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[#1c2638]" />
          <div
            className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-nova-blue transition-[width] duration-300"
            style={{ width: `${p * 100}%`, boxShadow: "0 0 8px rgba(92,141,255,0.7)" }}
          />
          {ACTS.map((a) => {
            const passed = p >= a.start;
            const current = act.id === a.id;
            return (
              <button
                key={a.id}
                title={`ACT ${a.roman} — ${a.name}`}
                onClick={() => onSeek(a.start + 0.004)}
                className="rail-tick absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 cursor-pointer bg-[#2a3550]"
                style={{ left: `${a.start * 100}%` }}
                data-passed={passed}
                ref={(el) => {
                  if (el) {
                    el.classList.toggle("passed", passed && !current);
                    el.classList.toggle("current", current);
                  }
                }}
              />
            );
          })}
          <div className="font-term absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] tracking-[0.5em] text-[#3a4658]">
            DESCENT {Math.round(p * 100)}%
          </div>
        </div>
      </div>
    </>
  );
}
