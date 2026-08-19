import { useCallback, useEffect, useRef, useState } from "react";
import { NovaEngine } from "./three/engine";
import { NovaAudio } from "./lib/audio";
import {
  createBehavior,
  createScrollWatch,
  feedScroll,
  type Behavior,
} from "./lib/observer";
import { loadStored, saveStored, makeSubjectId, type StoredSession } from "./lib/story";
import { Gate, Boot } from "./components/Gate";
import { Hud } from "./components/Hud";
import { Overlay, Terminal } from "./components/Overlay";

type Phase = "gate" | "boot" | "live" | "end";

interface FlashText {
  text: string;
  key: number;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("gate");
  const [store] = useState<StoredSession>(() => loadStored());
  const [name, setName] = useState("VISITOR");
  const [p, setP] = useState(0);
  const [anomalies, setAnomalies] = useState<Set<string>>(new Set());
  const [soundOn, setSoundOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [idleText, setIdleText] = useState<FlashText | null>(null);
  const [revText, setRevText] = useState<FlashText | null>(null);
  const [subject, setSubject] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<NovaEngine | null>(null);
  const audioRef = useRef<NovaAudio | null>(null);
  const behaviorRef = useRef<Behavior | null>(null);
  const watchRef = useRef(createScrollWatch());
  const endStartedRef = useRef(false);
  const savedRef = useRef(false);
  const subjectRef = useRef("");
  const storeRef = useRef(store);
  const nameRef = useRef("VISITOR");

  const getAudio = () => {
    if (!audioRef.current) audioRef.current = new NovaAudio();
    return audioRef.current;
  };

  /* ------------------------------ persistence ------------------------------ */

  const saveStats = () => {
    const b = behaviorRef.current;
    if (!b || savedRef.current) return;
    savedRef.current = true;
    const subj = subjectRef.current || makeSubjectId(b.name);
    subjectRef.current = subj;
    saveStored({
      v: 1,
      visits: storeRef.current.visits + 1,
      lastName: b.name,
      completed: storeRef.current.completed + 1,
      last: {
        duration: performance.now() - b.startTime,
        reversals: b.reversals,
        anomalies: b.anomalies.size,
        hovers: b.billboardHovers,
        subject: subj,
      },
    });
  };

  /* -------------------------------- phases -------------------------------- */

  const handleGateSubmit = (nm: string) => {
    const finalName = (nm || "VISITOR").toUpperCase().slice(0, 14);
    setName(finalName);
    nameRef.current = finalName;
    behaviorRef.current = createBehavior(finalName);
    behaviorRef.current.visits = storeRef.current.visits + 1; // this session's number
    watchRef.current = createScrollWatch();
    endStartedRef.current = false;
    savedRef.current = false;
    subjectRef.current = "";
    getAudio().init();
    getAudio().setEnabled(soundOn);
    getAudio().blip(660, 0.04);
    storeRef.current = { ...storeRef.current, visits: storeRef.current.visits + 1, lastName: finalName };
    saveStored({ ...storeRef.current, completed: storeRef.current.completed, last: storeRef.current.last });
    setPhase("boot");
  };

  const handleBootDone = useCallback(() => {
    document.body.style.overflow = "";
    window.scrollTo(0, 0);
    setPhase("live");
  }, []);

  const beginEnd = () => {
    if (endStartedRef.current) return;
    endStartedRef.current = true;
    const b = behaviorRef.current;
    const subj = makeSubjectId(b?.name ?? nameRef.current);
    subjectRef.current = subj;
    setSubject(subj);
    if (b) b.ended = true;
    getAudio().chime();
    saveStats();
    setPhase("end");
  };

  /* ------------------------------ engine setup ------------------------------ */

  const wantEngine = phase === "boot" || phase === "live" || phase === "end";

  useEffect(() => {
    if (!wantEngine) return;
    if (engineRef.current || !canvasRef.current || !behaviorRef.current) return;

    const engine = new NovaEngine(canvasRef.current, behaviorRef.current, getAudio(), {
      onFrame: (fp) => {
        setP(fp);
        const b = behaviorRef.current;
        if (!b) return;

        const stillBefore = b.stillness;
        const event = feedScroll(watchRef.current, fp, b, 125);
        if (event) {
          if (b.stillness > stillBefore) {
            setIdleText({ text: "WHY DID YOU STOP?", key: Date.now() });
            window.setTimeout(() => setIdleText(null), 2400);
            engineRef.current?.pulse(0.7);
          } else if (fp > 0.3 && fp < 0.93) {
            const r = b.reversals;
            const text = r >= 8 ? "STOP." : r >= 4 ? "YOU KEEP DOING THAT." : "WHY DID YOU GO BACK?";
            setRevText({ text, key: Date.now() });
            window.setTimeout(() => setRevText(null), 1700);
            engineRef.current?.pulse(1);
            getAudio().blip(340, 0.05);
          }
        }

        if (fp > 0.885) saveStats();
        if (fp >= 0.965) beginEnd();
      },
      onAnomaly: () => {
        getAudio().sting();
        const b = behaviorRef.current;
        if (b) setAnomalies(new Set(b.anomalies));
      },
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [wantEngine]);

  /* ------------------------------ scroll input ------------------------------ */

  useEffect(() => {
    if (phase !== "live" && phase !== "end") return;
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      engineRef.current?.setTarget(window.scrollY / max);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [phase]);

  /* ------------------------------ body locking ------------------------------ */

  useEffect(() => {
    document.body.style.overflow = phase === "gate" || phase === "boot" ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [phase]);

  /* --------------------------------- clock --------------------------------- */

  useEffect(() => {
    if (phase !== "live") return;
    const t = window.setInterval(() => {
      const b = behaviorRef.current;
      if (b) setElapsed(performance.now() - b.startTime);
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  /* --------------------------------- render --------------------------------- */

  const inCity = phase === "live" || phase === "end";

  return (
    <div className="bg-nova-bg text-nova-ink">
      {/* cinema screen — the Three.js world lives here, pinned forever */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 block h-full w-full" />

      {/* scroll runway: the timeline underneath the film */}
      {inCity && <div style={{ height: "1150vh" }} aria-hidden="true" />}

      {/* cinematic furniture */}
      {inCity && (
        <>
          <div className="letterbox top" />
          <div className="letterbox bottom" />
          <div className="scanlines" />
          <div className="crt-vignette" />
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />
        </>
      )}

      {phase === "gate" && <Gate store={store} onSubmit={handleGateSubmit} />}
      {phase === "boot" && <Boot name={name} onDone={handleBootDone} />}

      {phase === "live" && (
        <>
          <Overlay p={p} name={name} behavior={behaviorRef.current} idleText={idleText} reversalText={revText} />
          <Hud
            p={p}
            name={name}
            anomalies={anomalies}
            elapsedMs={elapsed}
            soundOn={soundOn}
            onToggleSound={() => {
              setSoundOn((s) => {
                const next = !s;
                getAudio().setEnabled(next);
                return next;
              });
            }}
            onSeek={(f) => {
              const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
              window.scrollTo({ top: f * max, behavior: "smooth" });
            }}
            live={phase === "live"}
          />
        </>
      )}

      {phase === "end" && (
        <Terminal subject={subject} name={name} onDone={() => window.location.reload()} />
      )}
    </div>
  );
}
