import { useEffect, useRef, useState } from "react";
import type { StoredSession } from "../lib/story";
import { formatClock } from "../lib/observer";

/* ------------------------------ entry gate ------------------------------ */

export function Gate({ store, onSubmit }: { store: StoredSession; onSubmit: (name: string) => void }) {
  const [name, setName] = useState(store.lastName || "");
  const returning = store.visits > 0 && !!store.lastName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nova-bg">
      <div className="gate-bg-grid absolute inset-0" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 120%, rgba(92,141,255,0.14), transparent 55%)" }}
      />

      <div className="relative w-[min(92vw,620px)] px-6">
        {/* header strip */}
        <div className="mb-10 flex items-end justify-between border-b border-[#1c2638] pb-4">
          <div>
            <div className="font-term text-[10px] uppercase tracking-[0.5em] text-nova-dim">
              Autonomous Metropolitan System
            </div>
            <h1 className="font-display mt-3 text-3xl tracking-[0.18em] text-nova-ink sm:text-5xl">
              NOVA<span className="text-nova-blue">·</span>01
            </h1>
          </div>
          <div className="hidden text-right font-term text-[10px] leading-5 tracking-[0.25em] text-nova-dim sm:block">
            <div>VERSION 7.4.19</div>
            <div className="text-nova-blue">ENTRY TERMINAL 07</div>
          </div>
        </div>

        {/* returning citizen */}
        {returning && store.last && (
          <div className="mb-8 border border-[#1c2638] bg-[#060a14]/80 p-5 flicker-in">
            <div className="font-term text-[10px] uppercase tracking-[0.4em] text-nova-cyan">
              Returning citizen detected
            </div>
            <div className="font-display mt-3 text-lg tracking-[0.14em] text-nova-ink sm:text-2xl">
              WELCOME BACK, {store.lastName.toUpperCase()}.
            </div>
            <div className="font-term mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[11px] tracking-[0.18em] text-nova-dim sm:grid-cols-4">
              <div>
                LAST SESSION
                <div className="mt-0.5 text-nova-ink">{formatClock(store.last.duration)}</div>
              </div>
              <div>
                REVERSALS
                <div className="mt-0.5 text-nova-ink">{store.last.reversals}</div>
              </div>
              <div>
                ANOMALIES
                <div className="mt-0.5 text-nova-ink">{store.last.anomalies} / 6</div>
              </div>
              <div>
                DESIGNATION
                <div className="mt-0.5 text-nova-red">{store.last.subject}</div>
              </div>
            </div>
            <div className="font-term mt-4 text-[10px] tracking-[0.3em] text-nova-dim">
              THE CITY REMEMBERS YOU. IT HAS BEEN <span className="text-nova-cyan">WAITING</span>.
            </div>
          </div>
        )}

        {/* identity prompt */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(name.trim());
          }}
        >
          <label className="font-term block text-[11px] uppercase tracking-[0.45em] text-nova-dim">
            {returning ? "Confirm identity" : "Identify yourself"}
          </label>
          <input
            className="gate-input mt-4 w-full py-3 text-xl sm:text-2xl"
            maxLength={14}
            autoFocus
            placeholder={returning ? store.lastName.toUpperCase() : "YOUR NAME"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            spellCheck={false}
          />
          <div className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="submit" className="btn-nova px-8 py-3.5 text-xs">
              Initialize Descent
            </button>
            <p className="font-term max-w-[260px] text-[9px] leading-4 tracking-[0.22em] text-nova-dim">
              BY ENTERING NOVA-01 YOU CONSENT TO BEING OBSERVED. NOTHING IS TRANSMITTED. EVERYTHING IS
              REMEMBERED.
            </p>
          </div>
        </form>

        <div className="font-term mt-12 flex items-center justify-between text-[9px] tracking-[0.3em] text-[#3a4658]">
          <span>MUNICIPAL GRID // SECTOR 4</span>
          <span>
            VISITS ON RECORD: {String(store.visits).padStart(3, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ boot sequence ------------------------------ */

const BOOT_LINES = [
  "NOVA CITY",
  "AUTONOMOUS METROPOLITAN SYSTEM — VERSION 7.4.19",
  "INITIALIZING ...",
  "CALIBRATING SENSORS ............... OK",
  "CITIZEN PROFILE: {NAME}",
  "DESCENT CLEARED.",
];

export function Boot({ name, onDone }: { name: string; onDone: () => void }) {
  const [count, setCount] = useState(0); // fully printed lines
  const [partial, setPartial] = useState(0); // chars of current line
  const doneRef = useRef(false);

  useEffect(() => {
    let line = 0;
    let ch = 0;
    let timer: number;
    const step = () => {
      const current = BOOT_LINES[line]?.replace("{NAME}", name.toUpperCase()) ?? "";
      if (ch <= current.length) {
        setPartial(ch);
        ch++;
        timer = window.setTimeout(step, line === 0 ? 55 : 14);
      } else {
        setCount(line + 1);
        setPartial(0);
        line++;
        ch = 0;
        if (line >= BOOT_LINES.length) {
          timer = window.setTimeout(() => {
            if (!doneRef.current) {
              doneRef.current = true;
              onDone();
            }
          }, 900);
        } else {
          timer = window.setTimeout(step, line === 1 ? 300 : 210);
        }
      }
    };
    timer = window.setTimeout(step, 350);
    return () => window.clearTimeout(timer);
  }, [name, onDone]);

  const skip = () => {
    if (!doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex cursor-pointer items-center justify-center bg-nova-bg/95" onClick={skip}>
      <div className="w-[min(92vw,640px)]">
        {BOOT_LINES.slice(0, count + 1).map((raw, i) => {
          const text = raw.replace("{NAME}", name.toUpperCase());
          const shown = i < count ? text : text.slice(0, partial);
          const isLast = i === count;
          const isTitle = i === 0;
          return (
            <div
              key={i}
              className={
                isTitle
                  ? "font-display mb-5 text-2xl tracking-[0.2em] text-nova-ink sm:text-3xl"
                  : "term-line text-[11px] leading-6 tracking-[0.2em] text-nova-dim sm:text-xs"
              }
            >
              <span className={i > 0 && i < 5 ? "text-nova-blue/70" : undefined}>
                {i > 0 && i < 5 ? "> " : ""}
              </span>
              {shown}
              {isLast && <span className="term-caret" />}
            </div>
          );
        })}
        <div className="font-term mt-10 text-[9px] tracking-[0.4em] text-[#3a4658]">
          CLICK TO SKIP — SCROLL WILL BEGIN YOUR DESCENT
        </div>
      </div>
    </div>
  );
}
