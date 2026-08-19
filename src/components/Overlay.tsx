import { useEffect, useMemo, useState } from "react";
import { activeCaptions, captionOpacity, type Caption } from "../lib/story";
import type { Behavior } from "../lib/observer";
import { minutesSince } from "../lib/observer";

/* ------------------------------- captions ------------------------------- */

function CaptionView({ c, p, name }: { c: Caption; p: number; name: string }) {
  const op = captionOpacity(p, c);
  if (op <= 0.01) return null;
  const text = c.text.replace("{NAME}", name.toUpperCase());

  const posCls =
    c.pos === "top"
      ? "inset-x-0 text-center"
      : c.pos === "center"
        ? "inset-x-0 top-1/2 -translate-y-1/2 text-center px-6"
        : "inset-x-0 text-center";
  const posStyle =
    c.pos === "top"
      ? { top: "11vh" }
      : c.pos === "bottom"
        ? { bottom: "13vh" }
        : {};

  let body: React.ReactNode;
  switch (c.style) {
    case "act":
      body = (
        <div>
          <div className="cap-act-kicker text-nova-blue">{c.sub}</div>
          <div className="cap-act-word mt-3 text-4xl text-nova-ink sm:text-6xl">{text}</div>
        </div>
      );
      break;
    case "mono":
      body = <div className="cap-mono text-nova-dim">{text}</div>;
      break;
    case "whisper":
      body = <div className="cap-whisper text-lg text-nova-ink/85 sm:text-2xl">{text}</div>;
      break;
    case "big":
      body = <div className="cap-big text-3xl text-nova-ink sm:text-5xl">{text}</div>;
      break;
    case "glitch":
      body = (
        <div className="glitch-text cap-mono text-nova-red" data-text={text}>
          {text}
        </div>
      );
      break;
  }

  return (
    <div
      className={`pointer-events-none fixed z-20 ${posCls}`}
      style={{ ...posStyle, opacity: op, transition: "opacity 120ms linear" }}
    >
      {body}
    </div>
  );
}

/* ---------------------------- profile dossier ---------------------------- */

function ProfileCard({ p, b }: { p: number; b: Behavior }) {
  if (p < 0.815 || p > 0.905) return null;
  const op = Math.min(
    1,
    Math.min((p - 0.815) / 0.02, (0.905 - p) / 0.02)
  );
  const attention = b.billboardHovers > 7 ? "EXCESSIVE" : b.billboardHovers > 3 ? "CURIOUS" : "PASSIVE";
  const movement = b.reversals > 6 ? "RESTLESS" : "LINEAR";

  return (
    <div
      className="pointer-events-none fixed right-5 z-20 w-[300px] border border-[#0e3d38] bg-[#020c0b]/85 p-4 sm:right-8"
      style={{ bottom: "calc(4.2vh + 96px)", opacity: op }}
    >
      <div className="font-term text-[9px] tracking-[0.4em] text-nova-cyan">NOVA CORE — READOUT</div>
      <div className="font-display mt-2 text-sm tracking-[0.2em] text-nova-ink">VISITOR PROFILE</div>
      <div className="font-term mt-3 space-y-1 text-[10px] leading-4 tracking-[0.14em] text-nova-dim">
        <div>NAME .............. <span className="text-nova-ink">{b.name.toUpperCase()}</span></div>
        <div>FIRST VISIT ....... <span className="text-nova-ink">{minutesSince(b.startTime)} MIN AGO</span></div>
        <div>REVERSALS ......... <span className="text-nova-ink">{b.reversals}</span></div>
        <div>HESITATIONS ....... <span className="text-nova-ink">{b.stillness}</span></div>
        <div>ANOMALIES ......... <span className="text-nova-ink">{b.anomalies.size} / 6</span></div>
        <div>ATTENTION ......... <span className="text-nova-ink">{attention}</span></div>
        <div>MOVEMENT .......... <span className="text-nova-ink">{movement}</span></div>
        <div>BEHAVIORAL MODEL .. <span className="text-nova-cyan">COMPLETE</span></div>
      </div>
      {p > 0.848 && (
        <div className="font-term mt-3 border-t border-[#0e3d38] pt-2.5 text-[10px] tracking-[0.18em] text-nova-red">
          STATUS: YOU ARE NOT THE USER.
        </div>
      )}
      {p > 0.874 && (
        <div className="font-display mt-2 text-base tracking-[0.14em] text-nova-cyan flicker-in">
          YOU ARE THE DATA.
        </div>
      )}
    </div>
  );
}

/* ------------------------------ end terminal ------------------------------ */

interface EndLine {
  text: string;
  cls: string;
  hold: number;
}

function buildEndLines(subject: string, name: string): EndLine[] {
  return [
    { text: "> SYSTEM SHUTDOWN?", cls: "text-nova-dim", hold: 900 },
    { text: "[NO]", cls: "text-nova-red font-display tracking-[0.3em]", hold: 750 },
    { text: "> NEW SUBJECT DETECTED", cls: "text-nova-dim", hold: 1100 },
    { text: `WELCOME, ${subject}.`, cls: "font-display text-2xl sm:text-4xl tracking-[0.14em] text-nova-cyan", hold: 1200 },
    { text: `PREVIOUS DESIGNATION "${name.toUpperCase()}" HAS BEEN ARCHIVED.`, cls: "text-nova-dim", hold: 900 },
    { text: "SESSION SAVED.", cls: "text-nova-dim", hold: 800 },
    { text: "WE'LL SEE YOU AGAIN.", cls: "text-nova-red", hold: 600 },
  ];
}

export function Terminal({ subject, name, onDone }: { subject: string; name: string; onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [partial, setPartial] = useState(0);
  const [finished, setFinished] = useState(false);
  const lines = useMemo(() => buildEndLines(subject, name), [subject, name]);

  useEffect(() => {
    let line = 0;
    let ch = 0;
    let timer = 0;
    const step = () => {
      const current = lines[line]?.text ?? "";
      if (ch <= current.length) {
        setPartial(ch);
        ch++;
        timer = window.setTimeout(step, 26);
      } else {
        const hold = lines[line]?.hold ?? 400;
        setCount(line + 1);
        setPartial(0);
        line++;
        ch = 0;
        if (line >= lines.length) {
          timer = window.setTimeout(() => setFinished(true), 700);
        } else {
          timer = window.setTimeout(step, hold);
        }
      }
    };
    timer = window.setTimeout(step, 700);
    return () => window.clearTimeout(timer);
  }, [lines]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#010204]">
      <div className="w-[min(92vw,680px)]">
        {lines.slice(0, count + 1).map((l, i) => {
          const shown = i < count ? l.text : l.text.slice(0, partial);
          if (i > count) return null;
          return (
            <div key={i} className={`term-line text-xs leading-8 tracking-[0.2em] ${l.cls}`}>
              {shown}
              {i === count && !finished && <span className="term-caret" />}
            </div>
          );
        })}

        {finished && (
          <div className="mt-12 flicker-in">
            <button onClick={onDone} className="btn-nova px-8 py-3.5 text-xs">
              Leave Nova
            </button>
            <div className="font-term mt-5 text-[9px] tracking-[0.34em] text-[#3a4658]">
              RE-ENTRY WILL BE LOGGED AS A NEW SESSION
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- overlay -------------------------------- */

interface OverlayProps {
  p: number;
  name: string;
  behavior: Behavior | null;
  idleText: { text: string; key: number } | null;
  reversalText: { text: string; key: number } | null;
}

export function Overlay({ p, name, behavior, idleText, reversalText }: OverlayProps) {
  const caps = activeCaptions(p);
  return (
    <>
      {caps.map((c) => (
        <CaptionView key={c.id} c={c} p={p} name={name} />
      ))}

      {behavior && <ProfileCard p={p} b={behavior} />}

      {idleText && (
        <div key={idleText.key} className="pointer-events-none fixed inset-x-0 top-[38vh] z-20 text-center">
          <div className="glitch-text cap-mono text-nova-amber" data-text={idleText.text}>
            {idleText.text}
          </div>
        </div>
      )}

      {reversalText && (
        <div key={reversalText.key} className="pointer-events-none fixed inset-x-0 top-[30vh] z-20 text-center">
          <div className="glitch-text font-display text-xl tracking-[0.2em] text-nova-red sm:text-3xl" data-text={reversalText.text}>
            {reversalText.text}
          </div>
        </div>
      )}
    </>
  );
}
