import * as THREE from "three";
import { buildWorld, type World, type Board } from "./world";
import { createFX, type FXRig } from "./fx";
import { boardScript, type BoardCue } from "../lib/story";
import type { Behavior, AnomalyId } from "../lib/observer";
import type { NovaAudio } from "../lib/audio";

export interface EngineHooks {
  onFrame: (p: number, frozen: number) => void;
  onAnomaly: (id: AnomalyId) => void;
}

/* ---------------------- palette keyframes (color IS the story) --------- */

interface PalKey {
  p: number;
  bg: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  bloom: number;
  grain: number;
  aber: number;
  vign: number;
  glitch: number;
  fade: number;
}

const PALETTE: PalKey[] = [
  { p: 0.0, bg: "#020409", fog: "#050a14", fogNear: 40, fogFar: 540, bloom: 0.5, grain: 0.05, aber: 0.0006, vign: 0.5, glitch: 0, fade: 1 },
  { p: 0.05, bg: "#04070f", fog: "#081020", fogNear: 36, fogFar: 620, bloom: 0.46, grain: 0.05, aber: 0.0007, vign: 0.46, glitch: 0, fade: 0 },
  { p: 0.15, bg: "#070c17", fog: "#0c1526", fogNear: 30, fogFar: 760, bloom: 0.42, grain: 0.05, aber: 0.0008, vign: 0.42, glitch: 0, fade: 0 },
  { p: 0.4, bg: "#0a0f1c", fog: "#101a2c", fogNear: 25, fogFar: 820, bloom: 0.45, grain: 0.055, aber: 0.001, vign: 0.42, glitch: 0, fade: 0 },
  { p: 0.55, bg: "#090d18", fog: "#0e1626", fogNear: 22, fogFar: 780, bloom: 0.62, grain: 0.08, aber: 0.0016, vign: 0.46, glitch: 0.05, fade: 0 },
  { p: 0.665, bg: "#0b0912", fog: "#150e1c", fogNear: 20, fogFar: 700, bloom: 0.85, grain: 0.11, aber: 0.0026, vign: 0.5, glitch: 0.15, fade: 0 },
  { p: 0.735, bg: "#0d070f", fog: "#1a0d18", fogNear: 18, fogFar: 640, bloom: 1.0, grain: 0.13, aber: 0.0032, vign: 0.55, glitch: 0.3, fade: 0 },
  { p: 0.8, bg: "#030a0d", fog: "#04141a", fogNear: 10, fogFar: 300, bloom: 1.05, grain: 0.14, aber: 0.003, vign: 0.55, glitch: 0.1, fade: 0 },
  { p: 0.9, bg: "#02040c", fog: "#060a18", fogNear: 30, fogFar: 900, bloom: 0.85, grain: 0.16, aber: 0.004, vign: 0.55, glitch: 0.38, fade: 0 },
  { p: 0.955, bg: "#02040c", fog: "#060a18", fogNear: 30, fogFar: 900, bloom: 0.8, grain: 0.17, aber: 0.004, vign: 0.6, glitch: 0.4, fade: 0 },
  { p: 0.978, bg: "#02040c", fog: "#060a18", fogNear: 30, fogFar: 900, bloom: 0.8, grain: 0.17, aber: 0.004, vign: 0.6, glitch: 0.4, fade: 1 },
  { p: 1.001, bg: "#02040c", fog: "#060a18", fogNear: 30, fogFar: 900, bloom: 0.8, grain: 0.17, aber: 0.004, vign: 0.6, glitch: 0.4, fade: 1 },
];

/* progress → path-A parameter (piecewise, so shots land where the story needs them) */
const MAP_A: [number, number][] = [
  [0, 0], [0.08, 0.07], [0.16, 0.24], [0.22, 0.42], [0.3, 0.5],
  [0.4, 0.575], [0.52, 0.655], [0.6, 0.72], [0.66, 0.78],
  [0.72, 0.926], [0.78, 0.972], [0.88, 1], [1, 1],
];

function mapA(p: number): number {
  for (let i = 1; i < MAP_A.length; i++) {
    if (p <= MAP_A[i][0]) {
      const [p0, t0] = MAP_A[i - 1];
      const [p1, t1] = MAP_A[i];
      const f = (p - p0) / Math.max(1e-6, p1 - p0);
      return t0 + (t1 - t0) * f;
    }
  }
  return 1;
}

const FOV_KEYS: [number, number][] = [
  [0, 66], [0.13, 60], [0.25, 55], [0.66, 54], [0.72, 50], [0.8, 58], [0.9, 56], [1, 62],
];

function fovAt(p: number): number {
  for (let i = 1; i < FOV_KEYS.length; i++) {
    if (p <= FOV_KEYS[i][0]) {
      const [p0, f0] = FOV_KEYS[i - 1];
      const [p1, f1] = FOV_KEYS[i];
      return f0 + (f1 - f0) * ((p - p0) / (p1 - p0));
    }
  }
  return 62;
}

function ramp01(x: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ------------------------------------------------------------------ engine */

export class NovaEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private fx: FXRig;
  private world: World;
  private behavior: Behavior;
  private audio: NovaAudio;
  private hooks: EngineHooks;

  private camA: THREE.CatmullRomCurve3;
  private lookA: THREE.CatmullRomCurve3;
  private camB: THREE.CatmullRomCurve3;
  private lookB: THREE.CatmullRomCurve3;

  private p = 0;
  private targetP = 0;
  private time = 0;
  private cityTime = 0;
  private fov = 66;
  private mouseRaw = new THREE.Vector2(0, 0);
  private mouseSm = new THREE.Vector2(0, 0);
  private raycaster = new THREE.Raycaster();
  private hoverId: string | null = null;
  private pulseT = 0;
  private boardClock = 0;
  private frameClock = 0;
  private screenDrawn = false;
  private raf = 0;
  private prevNow = performance.now();
  private disposed = false;
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpE = new THREE.Euler();
  private tmpC = new THREE.Color();
  private colA = new THREE.Color();
  private colB = new THREE.Color();

  constructor(canvas: HTMLCanvasElement, behavior: Behavior, audio: NovaAudio, hooks: EngineHooks) {
    this.behavior = behavior;
    this.audio = audio;
    this.hooks = hooks;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x020409);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x050a14, 40, 540);

    this.camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 3200);
    this.camera.position.set(0, 340, 900);

    const hemi = new THREE.HemisphereLight(0x3a4c74, 0x0a0d14, 1.15);
    const dir = new THREE.DirectionalLight(0xcfe0ff, 0.7);
    dir.position.set(-120, 220, 140);
    const amb = new THREE.AmbientLight(0x202a40, 0.7);
    this.scene.add(hemi, dir, amb);

    this.world = buildWorld(this.scene);
    this.fx = createFX(this.renderer, this.scene, this.camera);

    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    this.camA = new THREE.CatmullRomCurve3(
      [V(0, 340, 900), V(0, 238, 758), V(-42, 122, 622), V(-10, 40, 520), V(0, 13, 468),
       V(0, 3, 400), V(2, 2.6, 300), V(-3, 2.6, 180), V(2, 2.6, 60), V(0, 2.8, -60),
       V(-2, 3, -180), V(0, 3.2, -300), V(0, 3.4, -368), V(0, -4, -398), V(0, -58, -418),
       V(0, -84, -448), V(0, -86, -478)],
      false, "centripetal", 0.5
    );
    this.lookA = new THREE.CatmullRomCurve3(
      [V(0, 190, 420), V(0, 120, 320), V(0, 42, 260), V(0, 10, 240), V(0, 5, 210),
       V(0, 3, 150), V(0, 3, 60), V(0, 3, -60), V(0, 3, -180), V(0, 4, -300),
       V(0, 6, -380), V(0, 10, -432), V(0, -20, -440), V(0, -70, -458), V(0, -82, -500),
       V(0, -84, -552), V(0, -84, -556)],
      false, "centripetal", 0.5
    );
    this.camB = new THREE.CatmullRomCurve3(
      [V(0, -86, -478), V(0, -42, -468), V(0, 60, -432), V(0, 250, -352), V(0, 430, -190)],
      false, "centripetal", 0.5
    );
    this.lookB = new THREE.CatmullRomCurve3(
      [V(0, -84, -556), V(0, -60, -520), V(0, -6, -438), V(0, 0, -380), V(0, 20, -340)],
      false, "centripetal", 0.5
    );

    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointer);
  }

  setTarget(p: number) {
    this.targetP = Math.min(1, Math.max(0, p));
  }

  /** external kick — used when the visitor does something the city notices */
  pulse(strength = 1) {
    this.pulseT = Math.min(1.4, this.pulseT + 0.5 * strength);
  }

  start() {
    // redraw all signage with the proper typefaces once they arrive
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (this.disposed) return;
        this.world.boards.forEach((b) => (b.key = ""));
        this.screenDrawn = false;
      });
    }
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onPointer);
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.renderer.dispose();
  }

  /* ------------------------------ listeners ------------------------------ */

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.fx.composer.setSize(w, h);
  };

  private onPointer = (e: PointerEvent) => {
    this.mouseRaw.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  };

  /* -------------------------------- frame -------------------------------- */

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.0001, (now - this.prevNow) / 1000));
    this.prevNow = now;

    // smooth scroll → camera
    this.p += (this.targetP - this.p) * (1 - Math.exp(-dt * 3.4));
    const p = this.p;

    // the freeze: everything stops at the intersection
    const freezeAmt = ramp01(p, 0.687, 0.717);
    const timeScale = 1 - freezeAmt;
    this.time += dt;
    this.cityTime += dt * timeScale;
    this.pulseT = Math.max(0, this.pulseT - dt * 1.3);

    this.audio.setProgress(p, dt);
    this.updateCamera(p, dt, freezeAmt);
    this.updateCars(dt * timeScale, p);
    this.updatePeds(dt * timeScale, p, freezeAmt);
    this.updateDrones();
    this.updateCams(p, freezeAmt);
    this.updateEnvironment(p, dt);
    this.updateBoards(p, dt, now);
    this.updateServer(p, dt);
    this.updateNeural(p, dt);
    this.updateRaycast(dt);

    // palette
    const pal = this.samplePalette(p);
    this.renderer.setClearColor(this.colA.set(pal.bg));
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(pal.fog);
    fog.near = pal.fogNear;
    fog.far = pal.fogFar;
    this.fx.bloom.strength = pal.bloom + this.pulseT * 0.3;
    const u = this.fx.gradeUniforms;
    u.uTime.value = this.time;
    u.uGrain.value = pal.grain;
    u.uAber.value = pal.aber + this.pulseT * 0.004;
    u.uVign.value = pal.vign;
    u.uGlitch.value = Math.min(1, pal.glitch + this.pulseT * 0.55);
    u.uFade.value = pal.fade;

    this.fx.composer.render();

    this.frameClock += dt;
    if (this.frameClock > 0.12) {
      this.frameClock = 0;
      this.hooks.onFrame(p, freezeAmt);
    }
  }

  private samplePalette(p: number): PalKey {
    let i = 1;
    while (i < PALETTE.length - 1 && PALETTE[i].p < p) i++;
    const a = PALETTE[i - 1];
    const b = PALETTE[i];
    const f = Math.min(1, Math.max(0, (p - a.p) / Math.max(1e-6, b.p - a.p)));
    const lerp = (x: number, y: number) => x + (y - x) * f;
    this.colA.set(a.bg);
    this.colB.set(b.bg);
    const bg = "#" + this.colA.lerp(this.colB, f).getHexString();
    this.colA.set(a.fog);
    this.colB.set(b.fog);
    const fogC = "#" + this.colA.lerp(this.colB, f).getHexString();
    return {
      p, bg, fog: fogC,
      fogNear: lerp(a.fogNear, b.fogNear),
      fogFar: lerp(a.fogFar, b.fogFar),
      bloom: lerp(a.bloom, b.bloom),
      grain: lerp(a.grain, b.grain),
      aber: lerp(a.aber, b.aber),
      vign: lerp(a.vign, b.vign),
      glitch: lerp(a.glitch, b.glitch),
      fade: lerp(a.fade, b.fade),
    };
  }

  /* -------------------------------- camera -------------------------------- */

  private updateCamera(p: number, dt: number, freezeAmt: number) {
    const pos = this.tmpV;
    const look = new THREE.Vector3();
    if (p < 0.9) {
      const t = Math.min(1, Math.max(0, mapA(p)));
      this.camA.getPointAt(t, pos);
      this.lookA.getPointAt(Math.min(1, t + 0.001), look);
    } else {
      const t = ramp01(p, 0.9, 0.968);
      this.camB.getPointAt(t, pos);
      this.lookB.getPointAt(t, look);
    }
    this.camera.position.copy(pos);

    // damped mouse parallax — your attention nudges the frame
    this.mouseSm.x += (this.mouseRaw.x - this.mouseSm.x) * Math.min(1, dt * 2.6);
    this.mouseSm.y += (this.mouseRaw.y - this.mouseSm.y) * Math.min(1, dt * 2.6);
    const par = 2.4 + freezeAmt * 1.2 + ramp01(p, 0.78, 0.86) * 2.0;
    look.x += this.mouseSm.x * par;
    look.y += this.mouseSm.y * par * 0.6;

    // instability shakes the frame
    const shake = this.pulseT * 0.35 + ramp01(p, 0.665, 0.74) * 0.12;
    if (shake > 0.003) {
      look.x += (Math.random() - 0.5) * shake;
      look.y += (Math.random() - 0.5) * shake * 0.7;
    }
    this.camera.lookAt(look);

    const targetFov = fovAt(p);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 2.5);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  /* --------------------------------- cars --------------------------------- */

  private updateCars(dt2: number, p: number) {
    const w = this.world;
    const mainGreen = (this.cityTime * 0.075) % 1 < 0.55;

    w.cars.data.forEach((c, i) => {
      const shouldStop =
        !mainGreen &&
        ((c.dir === -1 && c.z > -356 && c.z < -290) || (c.dir === 1 && c.z < -404 && c.z > -470));
      const stopLine = c.dir === -1 ? -352 : -408;
      const distToStop = Math.abs(c.z - stopLine);
      if (shouldStop && distToStop < 34) {
        c.v = Math.max(0, c.v - 14 * Math.max(dt2, 0.0001) * (distToStop < 4 ? 60 : 1));
        if (distToStop < 1.2) c.v = 0;
      } else {
        c.v += (c.cruise - c.v) * Math.min(1, dt2 * 1.4);
      }
      c.z += c.dir * c.v * dt2;
      if (c.z > 760) c.z = -560;
      if (c.z < -560) c.z = 760;

      const y = 0.85 + Math.sin(this.cityTime * 2 + c.hover) * 0.05;
      const yaw = c.dir === -1 ? 0 : Math.PI;
      this.tmpQ.setFromEuler(this.tmpE.set(0, yaw, 0));
      this.tmpM.compose(this.tmpV.set(c.x, y, c.z), this.tmpQ, new THREE.Vector3(1, 1, 1));
      w.cars.body.setMatrixAt(i, this.tmpM);
      this.tmpM.compose(this.tmpV.set(c.x, y + 0.62, c.z - (c.dir === -1 ? 0.3 : -0.3)), this.tmpQ, new THREE.Vector3(1, 1, 1));
      w.cars.cabin.setMatrixAt(i, this.tmpM);
      this.tmpM.compose(this.tmpV.set(c.x, y + 0.05, c.z + (c.dir === -1 ? -2.15 : 2.15)), this.tmpQ, new THREE.Vector3(1, 1, 1));
      w.cars.lights.setMatrixAt(i, this.tmpM);
    });
    w.cars.body.instanceMatrix.needsUpdate = true;
    w.cars.cabin.instanceMatrix.needsUpdate = true;
    w.cars.lights.instanceMatrix.needsUpdate = true;

    w.crossCars.data.forEach((c, i) => {
      const shouldStop =
        mainGreen &&
        ((c.dir === -1 && c.x > -70 && c.x < 30) || (c.dir === 1 && c.x < 70 && c.x > -30));
      const stopLine = c.dir === -1 ? 26 : -26;
      const d = Math.abs(c.x - stopLine);
      if (shouldStop && d < 34) {
        c.v = Math.max(0, c.v - 14 * Math.max(dt2, 0.0001) * (d < 4 ? 60 : 1));
        if (d < 1.2) c.v = 0;
      } else {
        c.v += (c.cruise - c.v) * Math.min(1, dt2 * 1.4);
      }
      c.x += c.dir * c.v * dt2;
      if (c.x > 175) c.x = -175;
      if (c.x < -175) c.x = 175;

      const y = 0.85 + Math.sin(this.cityTime * 2 + c.hover) * 0.05;
      const yaw = c.dir === -1 ? Math.PI / 2 : -Math.PI / 2;
      this.tmpQ.setFromEuler(this.tmpE.set(0, yaw, 0));
      this.tmpM.compose(this.tmpV.set(c.x, y, c.z), this.tmpQ, new THREE.Vector3(1, 1, 1));
      w.crossCars.body.setMatrixAt(i, this.tmpM);
      this.tmpM.compose(this.tmpV.set(c.x + (c.dir === -1 ? -2.15 : 2.15), y + 0.05, c.z), this.tmpQ, new THREE.Vector3(1, 1, 1));
      w.crossCars.lights.setMatrixAt(i, this.tmpM);
    });
    w.crossCars.body.instanceMatrix.needsUpdate = true;
    w.crossCars.lights.instanceMatrix.needsUpdate = true;

    // car 062 — the scripted crossing, scrubbed by scroll
    const active = p > 0.185 && p < 0.255;
    w.crossCar.group.visible = active;
    if (active) {
      const t = ramp01(p, 0.19, 0.245);
      const e = t * t * (3 - 2 * t);
      w.crossCar.group.position.x = 34 - 68 * e;
      w.crossCar.group.position.y = 0.85 + Math.sin(this.time * 3) * 0.04;
      if (t > 0.25 && t < 0.9) this.flag("car_crossing");
    }
  }

  /* ------------------------------- pedestrians ------------------------------- */

  private updatePeds(dt2: number, p: number, freezeAmt: number) {
    const w = this.world;
    const cam = this.camera.position;
    const recentReverse = performance.now() - this.behavior.lastReversalAt < 2600;

    w.peds.data.forEach((pd, i) => {
      // act V: a third of the crowd stops and turns to face you
      const willFreeze = i % 3 === 0 && freezeAmt > 0.5 && p < 0.86;
      pd.frozen = willFreeze;

      let looking = false;
      if (i === 1) {
        // the watcher pedestrian — reacts to your timeline, not the clock
        looking = recentReverse && p < 0.62 && p > 0.3;
        if (!looking) looking = freezeAmt > 0.5 && p < 0.86;
      } else if (willFreeze) {
        looking = true;
      }

      let yaw: number;
      if (looking) {
        const dx = cam.x - pd.x;
        const dz = cam.z - pd.z;
        yaw = Math.atan2(-dx, -dz);
      } else {
        yaw = pd.dir === -1 ? 0 : Math.PI;
      }
      pd.yaw = yaw;

      if (!pd.frozen && pd.mode === "walk") {
        pd.z += pd.dir * pd.v * dt2;
        if (pd.z > 478) pd.z = -545;
        if (pd.z < -545) pd.z = 478;
      }
      const step = pd.mode === "walk" && !pd.frozen ? Math.abs(Math.sin(this.cityTime * pd.v * 3.2 + pd.phase)) * 0.06 : 0;
      const bob = Math.sin(this.cityTime * 0.8 + pd.phase) * (pd.mode === "idle" ? 0.015 : 0);

      this.tmpQ.setFromEuler(this.tmpE.set(0, yaw, 0));
      this.tmpM.compose(this.tmpV.set(pd.x, 0.95 + step * 0.5 + bob, pd.z), this.tmpQ, new THREE.Vector3(1, 1, 1));
      w.peds.body.setMatrixAt(i, this.tmpM);
      this.tmpM.compose(this.tmpV.set(pd.x, 1.78 + step + bob, pd.z), this.tmpQ, new THREE.Vector3(1, 1, 1));
      w.peds.head.setMatrixAt(i, this.tmpM);
      const vx = -Math.sin(yaw) * 0.19;
      const vz = -Math.cos(yaw) * 0.19;
      this.tmpM.compose(this.tmpV.set(pd.x + vx, 1.8 + step + bob, pd.z + vz), this.tmpQ, new THREE.Vector3(1, 1, 1));
      w.peds.visor.setMatrixAt(i, this.tmpM);

      // visor color tells you who is looking
      if (i === 0) this.tmpC.set("#00ffe1");
      else if (looking) this.tmpC.set("#ff003c");
      else if (pd.mode === "phone") this.tmpC.set("#9fb4d8");
      else this.tmpC.set("#141c28");
      w.peds.visor.setColorAt(i, this.tmpC);
    });
    w.peds.body.instanceMatrix.needsUpdate = true;
    w.peds.head.instanceMatrix.needsUpdate = true;
    w.peds.visor.instanceMatrix.needsUpdate = true;
    if (w.peds.visor.instanceColor) w.peds.visor.instanceColor.needsUpdate = true;
  }

  /* --------------------------------- drones --------------------------------- */

  private updateDrones() {
    this.world.drones.forEach((d, i) => {
      const a = this.cityTime * d.s + i * 2.1;
      d.group.position.set(d.cx + Math.cos(a) * d.r, d.cy + Math.sin(this.cityTime * 0.7 + i) * 3.4, d.cz + Math.sin(a) * d.r);
      d.group.rotation.y = -a;
      const on = Math.sin(this.cityTime * 5.5 + i * 1.7) > 0;
      d.lightMat.color.set(on ? "#ff2233" : "#360710");
    });
  }

  /* ---------------------------- security cameras ---------------------------- */

  private updateCams(p: number, freezeAmt: number) {
    const track = ramp01(p, 0.545, 0.6);
    const snap = ramp01(p, 0.662, 0.682);
    const f = Math.max(track, snap);
    const cam = this.camera.position;
    this.world.cams.forEach((c) => {
      const idleYaw = c.baseYaw + Math.sin(this.cityTime * 0.4 + c.seed) * 0.5;
      if (f > 0.01) {
        const dx = cam.x - c.head.position.x;
        const dz = cam.z - c.head.position.z;
        const lookYaw = Math.atan2(dx, dz);
        c.head.rotation.y = idleYaw + (lookYaw - idleYaw) * f;
      } else {
        c.head.rotation.y = idleYaw;
      }
      c.lensMat.color.copy(this.tmpC.set("#5c8dff").lerp(this.colB.set("#ff003c"), f));
    });
    if (snap > 0.5) this.flag("all_cameras");
    void freezeAmt;
  }

  /* ------------------------------ environment ------------------------------ */

  private updateEnvironment(p: number, dt: number) {
    const w = this.world;
    const corruption = ramp01(p, 0.58, 0.75);

    // flickering windows — some burn red as the city corrupts
    for (let i = 0; i < w.flickerPhase.length; i++) {
      const ph = w.flickerPhase[i];
      const on = (this.time * (0.05 + (ph % 1) * 0.12) + ph) % 1 > 0.42;
      const base = on ? 1 : 0.1;
      this.tmpC.set("#cfe2ff").lerp(this.colB.set("#ff5577"), corruption * 0.65);
      this.tmpC.multiplyScalar(base);
      w.windowGlow.setColorAt(i, this.tmpC);
    }
    w.windowGlow.instanceMatrix.needsUpdate = true;
    if (w.windowGlow.instanceColor) w.windowGlow.instanceColor.needsUpdate = true;

    // Building 17's red window wakes
    const w17 = ramp01(p, 0.52, 0.6);
    (w.b17Window.material as THREE.MeshBasicMaterial).opacity =
      w17 * (0.7 + 0.3 * Math.sin(this.time * 2.6)) * 0.9;

    // the figure in the window — always watching once revealed
    const wo = ramp01(p, 0.48, 0.56);
    const wmat = w.watcher.material as THREE.MeshBasicMaterial;
    wmat.opacity = wo * (0.78 + 0.22 * Math.sin(this.time * 1.9));
    if (wo > 0.02) {
      w.watcher.lookAt(this.camera.position);
    }
    if (wo > 0.5) this.flag("window_watcher");

    // buildings breathe — barely perceptibly
    if (corruption > 0.001 && p < 0.86) {
      w.corridorMeshes.forEach((msh, i) => {
        const base = msh.userData.baseScale as THREE.Vector3;
        if (!base) return;
        const s = 1 + Math.sin(this.time * 1.25 + i * 1.7) * 0.006 * corruption;
        msh.scale.set(base.x * s, base.y, base.z * s);
      });
    }

    // lamps dim as the palette turns
    w.lampMat.color.copy(this.tmpC.set("#dce9ff").lerp(this.colB.set("#1b2436"), ramp01(p, 0.86, 0.92)));

    // clouds drift
    w.cloudMat.opacity = 0.5 * (1 - ramp01(p, 0.3, 0.45));

    void dt;
  }

  /* -------------------------------- billboards -------------------------------- */

  private updateBoards(p: number, dt: number, now: number) {
    this.boardClock += dt;
    if (this.boardClock < 0.22) return;
    this.boardClock = 0;
    const corruption = ramp01(p, 0.58, 0.75);

    this.world.boards.forEach((b: Board) => {
      let cue: BoardCue | null = boardScript(b.id, p, this.behavior, now);
      if (!cue) return;
      if (this.hoverId === b.id && p > 0.4) {
        cue = { lines: ["I SEE YOU"], opts: { alert: true } };
      }
      if (b.id === "b6" && cue.opts.alert) this.flag("hidden_sign");
      const key = cue.lines.join("|") + (cue.opts.alert ? "!" : "") + (corruption > 0.3 ? "g" : "");
      if (key !== b.key) {
        b.key = key;
        b.surf.draw(cue.lines, { ...cue.opts, glitch: corruption * 0.75 + this.pulseT * 0.4 });
      }
    });
  }

  /* --------------------------------- server --------------------------------- */

  private updateServer(p: number, dt: number) {
    const w = this.world;
    w.server.core.rotation.y += dt * 0.5;
    w.server.rings[0].rotation.x += dt * 0.6;
    w.server.rings[0].rotation.y += dt * 0.3;
    w.server.rings[1].rotation.x -= dt * 0.4;
    w.server.rings[1].rotation.z += dt * 0.5;
    w.server.dust.rotation.y += dt * 0.02;
    const beat = 0.75 + 0.25 * Math.sin(this.time * 5.1);
    (w.server.coreMat as THREE.MeshBasicMaterial).color.copy(
      this.tmpC.set("#00ffe1").multiplyScalar(ramp01(p, 0.78, 0.84) * beat + 0.15)
    );
    w.server.coreLight.intensity = 260 * ramp01(p, 0.78, 0.84) * beat;

    if (!this.screenDrawn && p > 0.8) {
      this.screenDrawn = true;
      const b = this.behavior;
      const mins = Math.max(1, Math.round((performance.now() - b.startTime) / 60000));
      w.server.screen.surf.draw(
        [
          "VISITOR PROFILE",
          `NAME: ${b.name.toUpperCase()}`,
          `FIRST VISIT: ${mins} MIN AGO`,
          `REVERSALS: ${b.reversals}`,
          `ANOMALIES: ${b.anomalies.size} / 6`,
          "STATUS: YOU ARE NOT THE USER.",
          "YOU ARE THE DATA.",
        ],
        { bg: "#02100e", fg: "#c9fff6", accent: "#00ffe1", small: true, glitch: 0.12 }
      );
    }
    if (p > 0.865) this.flag("the_core");
    if (ramp01(p, 0.687, 0.717) > 0.85) this.flag("the_freeze");
  }

  /* --------------------------------- neural --------------------------------- */

  private updateNeural(p: number, dt: number) {
    const w = this.world;
    const amt = ramp01(p, 0.885, 0.945);
    w.neural.group.visible = amt > 0.01;
    if (!w.neural.group.visible) return;
    w.neural.pointsMat.opacity = amt * 0.9;
    w.neural.linesMat.opacity = amt * 0.22;
    w.neural.hubMat.opacity = amt * 0.85;
    w.neural.hub.rotation.y += dt * 0.25;
    w.neural.hub.rotation.x += dt * 0.08;

    // the physical city goes dark as its true shape appears
    const dark = amt;
    w.skylineMat.color.copy(this.colA.set("#232f45").lerp(this.colB.set("#04060c"), dark));
    w.skylineMat.emissiveIntensity = 0.5 * (1 - dark) + 0.02;
    w.corridorMats.forEach((m) => {
      m.color.copy(this.colA.set("#dde5ef").lerp(this.colB.set("#0a0f18"), dark));
      m.emissiveIntensity = 0.32 * (1 - dark);
    });
  }

  /* -------------------------------- raycast -------------------------------- */

  private lastRay = 0;
  private updateRaycast(dt: number) {
    if (this.hoverId === "b17") this.behavior.b17Gaze += dt;

    const now = performance.now();
    if (now - this.lastRay < 130) return;
    this.lastRay = now;

    this.raycaster.setFromCamera(this.mouseRaw, this.camera);
    const targets: THREE.Object3D[] = this.world.boards.map((b) => b.mesh);
    if (this.world.b17) targets.push(this.world.b17);
    const hits = this.raycaster.intersectObjects(targets, false);
    let id: string | null = null;
    if (hits.length > 0) {
      const o = hits[0].object;
      id = (o.userData.boardId as string) ?? (o === this.world.b17 ? "b17" : null);
    }
    if (id && id !== "b17" && id !== this.hoverId) {
      if (!this.behavior.hoveredBoards.has(id)) {
        this.behavior.hoveredBoards.add(id);
        this.behavior.billboardHovers += 1;
        this.audio.blip(1060, 0.03);
      }
    }
    this.hoverId = id;
  }

  /* -------------------------------- anomaly -------------------------------- */

  private flag(id: AnomalyId) {
    if (this.behavior.anomalies.has(id)) return;
    this.behavior.anomalies.add(id);
    this.pulse(0.8);
    this.hooks.onAnomaly(id);
  }
}
