import * as THREE from "three";
import {
  makeWindowTexture,
  makeRoadTexture,
  makeSidewalkTexture,
  makeCloudTexture,
  makeSoftDot,
  makeBoardSurface,
  makeServerTexture,
  makeNumberTexture,
  type BoardSurface,
} from "./textures";

/* ---------------------------------------------------------------- types */

export interface CarDatum {
  x: number;
  z: number;
  v: number;
  cruise: number;
  dir: 1 | -1;
  hover: number;
}

export interface PedDatum {
  x: number;
  z: number;
  v: number;
  dir: 1 | -1;
  phase: number;
  mode: "walk" | "idle" | "phone";
  yaw: number;
  frozen: boolean;
}

export interface Board {
  id: string;
  surf: BoardSurface;
  mesh: THREE.Mesh;
  key: string;
}

export interface World {
  skyline: THREE.InstancedMesh;
  skylineMat: THREE.MeshLambertMaterial;
  corridorMats: THREE.MeshLambertMaterial[];
  corridorMeshes: THREE.Mesh[];
  b17: THREE.Mesh;
  b17Window: THREE.Mesh;
  windowGlow: THREE.InstancedMesh;
  flickerPhase: Float32Array;
  watcher: THREE.Mesh;
  cars: { body: THREE.InstancedMesh; cabin: THREE.InstancedMesh; lights: THREE.InstancedMesh; data: CarDatum[] };
  crossCars: { body: THREE.InstancedMesh; lights: THREE.InstancedMesh; data: CarDatum[] };
  crossCar: { group: THREE.Group };
  peds: {
    body: THREE.InstancedMesh;
    head: THREE.InstancedMesh;
    visor: THREE.InstancedMesh;
    data: PedDatum[];
  };
  boards: Board[];
  drones: { group: THREE.Group; lightMat: THREE.MeshBasicMaterial; cx: number; cy: number; cz: number; r: number; s: number }[];
  cams: { head: THREE.Group; lensMat: THREE.MeshBasicMaterial; baseYaw: number; seed: number }[];
  lampMat: THREE.MeshBasicMaterial;
  shaftRings: THREE.Mesh[];
  server: {
    group: THREE.Group;
    core: THREE.Mesh;
    coreMat: THREE.MeshBasicMaterial;
    rings: THREE.Mesh[];
    dust: THREE.Points;
    screen: Board;
    coreLight: THREE.PointLight;
  };
  neural: {
    group: THREE.Group;
    pointsMat: THREE.PointsMaterial;
    linesMat: THREE.LineBasicMaterial;
    hub: THREE.Mesh;
    hubMat: THREE.MeshBasicMaterial;
  };
  cloudMat: THREE.MeshBasicMaterial;
  stars: THREE.Points;
  nodePositions: THREE.Vector3[];
}

/* ---------------------------------------------------------------- build */

export function buildWorld(scene: THREE.Scene): World {
  const corridorMats: THREE.MeshLambertMaterial[] = [];
  const nodePositions: THREE.Vector3[] = [];

  /* ------------------------------ ground ------------------------------ */
  const ground = new THREE.Mesh(
    new THREE.RingGeometry(22, 1800, 64),
    new THREE.MeshLambertMaterial({ color: 0x0a0e15, side: THREE.DoubleSide })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.06, -405);
  scene.add(ground);

  const roadTex = makeRoadTexture();
  roadTex.repeat.set(1, 29);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 1160),
    new THREE.MeshLambertMaterial({ map: roadTex })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.0, 180);
  scene.add(road);

  const crossTex = makeRoadTexture();
  crossTex.repeat.set(9, 1);
  crossTex.center.set(0.5, 0.5);
  crossTex.rotation = Math.PI / 2;
  const crossRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 16),
    new THREE.MeshLambertMaterial({ map: crossTex })
  );
  crossRoad.rotation.x = -Math.PI / 2;
  crossRoad.position.set(0, 0.01, -380);
  scene.add(crossRoad);

  const walkTex = makeSidewalkTexture();
  walkTex.repeat.set(2, 116);
  [-13, 13].forEach((x) => {
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 1160),
      new THREE.MeshLambertMaterial({ map: walkTex })
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(x, 0.02, 180);
    scene.add(walk);
  });

  /* ------------------------------ skyline ------------------------------ */
  const skyTex = makeWindowTexture(10, 26, 0.34, "#141b28", "#b7cdf5");
  skyTex.repeat.set(2, 6);
  const skylineMat = new THREE.MeshLambertMaterial({
    color: 0x232f45,
    emissive: 0x27406b,
    emissiveIntensity: 0.5,
    emissiveMap: skyTex,
  });
  const skyline = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), skylineMat, 178);
  skyline.frustumCulled = false;
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const col = new THREE.Color();
  let si = 0;
  for (let i = 0; i < 178 && si < 178; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 240 + Math.pow(Math.random(), 0.7) * 720;
    const x = Math.cos(angle) * radius;
    const z = -60 + Math.sin(angle) * radius;
    const tall = i < 7;
    const h = tall ? 230 + Math.random() * 90 : 36 + Math.pow(Math.random(), 1.6) * 150;
    const w = 22 + Math.random() * 34;
    const d = 22 + Math.random() * 34;
    m4.compose(new THREE.Vector3(x, h / 2 - 1, z), q0, new THREE.Vector3(w, h, d));
    skyline.setMatrixAt(si, m4);
    col.setHSL(0.6 + Math.random() * 0.05, 0.25, 0.12 + Math.random() * 0.1);
    skyline.setColorAt(si, col);
    nodePositions.push(new THREE.Vector3(x, h, z));
    si++;
  }
  skyline.count = si;
  skyline.instanceMatrix.needsUpdate = true;
  scene.add(skyline);

  /* --------------------------- corridor towers --------------------------- */
  const corridor = new THREE.Group();
  const corridorMeshes: THREE.Mesh[] = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const slots: { x: number; z: number }[] = [];
  for (let z = 430; z >= -345; z -= 52) {
    slots.push({ x: -(26 + Math.random() * 15), z: z + (Math.random() - 0.5) * 18 });
    slots.push({ x: 26 + Math.random() * 15, z: z + (Math.random() - 0.5) * 18 });
  }
  // deterministically crown the left-side slot nearest z=40 as Building 17
  const b17Slot = slots
    .filter((s) => s.x < 0)
    .reduce((best, s) => (Math.abs(s.z - 40) < Math.abs(best.z - 40) ? s : best), slots[0]);
  slots.forEach((slot) => {
    const is17 = slot === b17Slot;
    const w = 15 + Math.random() * 9;
    const h = is17 ? 46 : 16 + Math.pow(Math.random(), 1.4) * 46;
    const d = 16 + Math.random() * 10;
    const px = slot.x;
    const pz = slot.z;
    const tex = makeWindowTexture(8, 18, 0.3 + Math.random() * 0.25, "#0c1220", "#cfe2ff");
    tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 5)));
    const mat = new THREE.MeshLambertMaterial({
      color: 0xdde5ef,
      emissive: 0x9fb8e8,
      emissiveIntensity: 0.32,
      emissiveMap: tex,
    });
    corridorMats.push(mat);
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(px, h / 2, pz);
    mesh.userData.baseScale = new THREE.Vector3(w, h, d);
    corridor.add(mesh);
    corridorMeshes.push(mesh);
    nodePositions.push(new THREE.Vector3(px, h, pz));
    if (is17) mesh.name = "b17";
  });
  scene.add(corridor);
  const b17 = corridor.getObjectByName("b17") as THREE.Mesh;

  // Building 17 signage + the red window that wakes later
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: makeNumberTexture("17") })
  );
  sign.position.set(b17Slot.x + 12.6, 27, b17Slot.z);
  sign.rotation.y = Math.PI / 2;
  scene.add(sign);

  const b17Window = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 3.2),
    new THREE.MeshBasicMaterial({ color: 0xff003c, transparent: true, opacity: 0 })
  );
  b17Window.position.set(b17Slot.x + 12.6, 34, b17Slot.z + 4);
  b17Window.rotation.y = Math.PI / 2;
  scene.add(b17Window);

  /* ------------------------ flickering window quads ------------------------ */
  const glowCount = 120;
  const windowGlow = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.1, 0.8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
    glowCount
  );
  windowGlow.frustumCulled = false;
  const flickerPhase = new Float32Array(glowCount);
  const eul = new THREE.Euler();
  const qq = new THREE.Quaternion();
  for (let i = 0; i < glowCount; i++) {
    const left = i % 2 === 0;
    const x = left ? -(18.6 + Math.random() * 20) : 18.6 + Math.random() * 20;
    const z = 430 - Math.random() * 760;
    const y = 4 + Math.random() * 42;
    eul.set(0, left ? Math.PI / 2 : -Math.PI / 2, 0);
    qq.setFromEuler(eul);
    m4.compose(new THREE.Vector3(x, y, z), qq, new THREE.Vector3(1, 1, 1));
    windowGlow.setMatrixAt(i, m4);
    windowGlow.setColorAt(i, col.set("#cfe2ff"));
    flickerPhase[i] = Math.random() * 10;
  }
  windowGlow.instanceMatrix.needsUpdate = true;
  scene.add(windowGlow);

  /* --------------------------- window watcher --------------------------- */
  const watcher = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 3.4),
    new THREE.MeshBasicMaterial({ color: 0x04060b, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  watcher.position.set(-18.4, 39, 122);
  watcher.rotation.y = Math.PI / 2;
  scene.add(watcher);

  /* ------------------------------- cars ------------------------------- */
  const carBodyGeo = new THREE.BoxGeometry(1.9, 0.72, 4.3);
  const carCabinGeo = new THREE.BoxGeometry(1.5, 0.55, 2.1);
  const carLightGeo = new THREE.BoxGeometry(1.6, 0.14, 0.12);
  const carMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const carData: CarDatum[] = [];
  for (let i = 0; i < 22; i++) {
    const dir: 1 | -1 = i % 2 === 0 ? -1 : 1;
    const lane = dir === -1 ? (i % 4 === 0 ? -3.1 : -5.9) : i % 4 === 1 ? 3.1 : 5.9;
    carData.push({
      x: lane,
      z: -560 + Math.random() * 1300,
      v: 0,
      cruise: dir === -1 ? 7 + Math.random() * 5 : 13 + Math.random() * 6,
      dir,
      hover: Math.random() * 6,
    });
  }
  const carBody = new THREE.InstancedMesh(carBodyGeo, carMat, carData.length);
  const carCabin = new THREE.InstancedMesh(carCabinGeo, carMat, carData.length);
  const carLights = new THREE.InstancedMesh(carLightGeo, lightMat, carData.length);
  [carBody, carCabin, carLights].forEach((mm) => (mm.frustumCulled = false));
  const carPalette = ["#e8edf4", "#c3ccd9", "#8a97ab", "#5c8dff", "#10151d", "#e8edf4", "#2a3550"];
  carData.forEach((c, i) => {
    col.set(carPalette[i % carPalette.length]);
    carBody.setColorAt(i, col);
    carCabin.setColorAt(i, col.clone().multiplyScalar(0.82));
    carLights.setColorAt(i, new THREE.Color(c.dir === -1 ? "#eaf4ff" : "#ff3355"));
  });
  scene.add(carBody, carCabin, carLights);

  // crossing traffic on the avenue at z = -380
  const crossData: CarDatum[] = [];
  for (let i = 0; i < 6; i++) {
    const dir: 1 | -1 = i % 2 === 0 ? -1 : 1;
    crossData.push({
      x: -170 + Math.random() * 340,
      z: dir === -1 ? -376.6 : -383.4,
      v: 0,
      cruise: 10 + Math.random() * 5,
      dir,
      hover: Math.random() * 6,
    });
  }
  const crossBody = new THREE.InstancedMesh(carBodyGeo, carMat.clone(), crossData.length);
  const crossLights = new THREE.InstancedMesh(carLightGeo, lightMat.clone(), crossData.length);
  [crossBody, crossLights].forEach((mm) => (mm.frustumCulled = false));
  crossData.forEach((c, i) => {
    crossBody.setColorAt(i, col.set(carPalette[(i + 3) % carPalette.length]));
    crossLights.setColorAt(i, new THREE.Color(c.dir === -1 ? "#ff3355" : "#eaf4ff"));
  });
  scene.add(crossBody, crossLights);

  // the scripted car that crosses right in front of you (car 062)
  const crossCarGroup = new THREE.Group();
  const ccBody = new THREE.Mesh(carBodyGeo, new THREE.MeshLambertMaterial({ color: 0xf2f6fb }));
  const ccCabin = new THREE.Mesh(carCabinGeo, new THREE.MeshLambertMaterial({ color: 0xc3ccd9 }));
  ccCabin.position.y = 0.62;
  const ccLight = new THREE.Mesh(carLightGeo, new THREE.MeshBasicMaterial({ color: 0xeaf4ff }));
  ccLight.position.set(0, 0, -2.15);
  crossCarGroup.add(ccBody, ccCabin, ccLight);
  crossCarGroup.rotation.y = Math.PI / 2;
  crossCarGroup.position.set(34, 0.85, 430);
  scene.add(crossCarGroup);

  /* ----------------------------- pedestrians ----------------------------- */
  const pedData: PedDatum[] = [];
  for (let i = 0; i < 34; i++) {
    const left = i % 2 === 0;
    const r = Math.random();
    pedData.push({
      x: (left ? -1 : 1) * (11.2 + Math.random() * 4.6),
      z: -540 + Math.random() * 1010,
      v: 0.8 + Math.random() * 0.9,
      dir: Math.random() < 0.5 ? -1 : 1,
      phase: Math.random() * 9,
      mode: r < 0.6 ? "walk" : r < 0.85 ? "idle" : "phone",
      yaw: 0,
      frozen: false,
    });
  }
  pedData[1].x = 13.4; // the watcher pedestrian
  pedData[1].z = -235;
  pedData[1].mode = "walk";

  const pedBodyGeo = new THREE.CapsuleGeometry(0.26, 0.85, 3, 8);
  const pedHeadGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const pedVisorGeo = new THREE.PlaneGeometry(0.2, 0.09);
  const pedMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const pedBody = new THREE.InstancedMesh(pedBodyGeo, pedMat, pedData.length);
  const pedHead = new THREE.InstancedMesh(pedHeadGeo, pedMat.clone(), pedData.length);
  const pedVisor = new THREE.InstancedMesh(
    pedVisorGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    pedData.length
  );
  [pedBody, pedHead, pedVisor].forEach((mm) => (mm.frustumCulled = false));
  const coatPalette = ["#c8d2e0", "#9aa8bd", "#6b7a92", "#31405a", "#e8edf4", "#41546f"];
  pedData.forEach((p, i) => {
    pedBody.setColorAt(i, col.set(coatPalette[i % coatPalette.length]));
    pedHead.setColorAt(i, new THREE.Color("#d8c8b8"));
    pedVisor.setColorAt(i, new THREE.Color(i === 0 ? "#00ffe1" : "#141c28"));
  });
  scene.add(pedBody, pedHead, pedVisor);

  /* ------------------------------ billboards ------------------------------ */
  const boards: Board[] = [];
  const boardDefs: { id: string; x: number; y: number; z: number; w: number; h: number; ry: number; big?: boolean }[] = [
    { id: "b0", x: 12.5, y: 7.6, z: 250, w: 9.5, h: 5.4, ry: -Math.PI / 2 },
    { id: "b1", x: -12.5, y: 8.2, z: 170, w: 9.5, h: 5.4, ry: Math.PI / 2 },
    { id: "b7", x: 12.5, y: 7.6, z: 210, w: 9.5, h: 5.4, ry: -Math.PI / 2 },
    { id: "b2", x: 12.5, y: 7.6, z: 70, w: 9.5, h: 5.4, ry: -Math.PI / 2 },
    { id: "b3", x: -12.5, y: 8.6, z: -30, w: 9.5, h: 5.4, ry: Math.PI / 2 },
    { id: "b6", x: 12.5, y: 7.6, z: -40, w: 9.5, h: 5.4, ry: -Math.PI / 2 },
    { id: "b4", x: 12.5, y: 7.6, z: -130, w: 9.5, h: 5.4, ry: -Math.PI / 2 },
    { id: "b5", x: -12.5, y: 8.6, z: -230, w: 9.5, h: 5.4, ry: Math.PI / 2 },
    { id: "big", x: 0, y: 21, z: -452, w: 34, h: 17, ry: 0, big: true },
  ];
  const poleGeo = new THREE.BoxGeometry(0.25, 1, 0.25);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a4658 });
  boardDefs.forEach((def) => {
    const surf = makeBoardSurface(def.big ? 1024 : 512, def.big ? 512 : 288);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(def.w, def.h),
      new THREE.MeshBasicMaterial({ map: surf.texture, toneMapped: false })
    );
    mesh.position.set(def.x, def.y, def.z);
    mesh.rotation.y = def.ry;
    mesh.userData.boardId = def.id;
    scene.add(mesh);
    if (!def.big) {
      [-def.w / 3, def.w / 3].forEach((ox) => {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.scale.y = def.y - def.h / 2;
        pole.position.set(0, -(def.h / 2) - pole.scale.y / 2 + 0.5, 0);
        pole.position.x = ox;
        const holder = new THREE.Group();
        holder.add(pole);
        holder.position.copy(mesh.position);
        holder.rotation.y = def.ry;
        pole.position.set(ox, -(def.h / 2) - pole.scale.y / 2, 0);
        scene.add(holder);
      });
    }
    boards.push({ id: def.id, surf, mesh, key: "" });
  });

  /* -------------------------------- drones -------------------------------- */
  const droneGeo = new THREE.BoxGeometry(1.15, 0.32, 1.15);
  const droneMat = new THREE.MeshLambertMaterial({ color: 0x1a222e });
  const drones: World["drones"] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(droneGeo, droneMat);
    const lightMatD = new THREE.MeshBasicMaterial({ color: 0xff2233 });
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lightMatD);
    light.position.y = -0.28;
    g.add(body, light);
    const cx = (i % 2 === 0 ? -1 : 1) * (16 + Math.random() * 22);
    const cy = 26 + Math.random() * 42;
    const cz = 320 - i * 110;
    g.position.set(cx, cy, cz);
    scene.add(g);
    drones.push({ group: g, lightMat: lightMatD, cx, cy, cz, r: 14 + Math.random() * 30, s: 0.25 + Math.random() * 0.35 });
  }

  /* --------------------------- security cameras --------------------------- */
  const cams: World["cams"] = [];
  const camHeadGeo = new THREE.BoxGeometry(0.62, 0.4, 0.95);
  const camBodyMat = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
  for (let i = 0; i < 12; i++) {
    const left = i % 2 === 0;
    const head = new THREE.Group();
    const box = new THREE.Mesh(camHeadGeo, camBodyMat);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x5c8dff });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lensMat);
    lens.position.set(0, 0, 0.5);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.3), camBodyMat);
    arm.position.z = -0.85;
    head.add(box, lens, arm);
    head.position.set((left ? -1 : 1) * 18.2, 6.6 + (i % 3), 390 - i * 66);
    head.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
    scene.add(head);
    cams.push({ head, lensMat, baseYaw: head.rotation.y, seed: Math.random() * 9 });
  }

  /* ----------------------------- street lamps ----------------------------- */
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xdce9ff });
  const lampCount = 36;
  const lampHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 8, 6), lampMat, lampCount);
  const lampPoles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.09, 0.11, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a4658 }),
    lampCount
  );
  lampHeads.frustumCulled = false;
  for (let i = 0; i < lampCount; i++) {
    const left = i % 2 === 0;
    const z = 440 - Math.floor(i / 2) * 45;
    const x = (left ? -1 : 1) * 9.4;
    m4.compose(new THREE.Vector3(x, 7, z), q0, new THREE.Vector3(1, 1, 1));
    lampHeads.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 3.5, z), q0, new THREE.Vector3(1, 1, 1));
    lampPoles.setMatrixAt(i, m4);
  }
  lampHeads.instanceMatrix.needsUpdate = true;
  lampPoles.instanceMatrix.needsUpdate = true;
  scene.add(lampHeads, lampPoles);

  /* --------------------------- descent shaft --------------------------- */
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(21, 21, 94, 24, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x0b1018, side: THREE.BackSide })
  );
  shaft.position.set(0, -47, -405);
  scene.add(shaft);
  const shaftRings: THREE.Mesh[] = [];
  [-14, -40, -66].forEach((y) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(20.2, 0.3, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x5c8dff, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, y, -405);
    scene.add(ring);
    shaftRings.push(ring);
  });

  /* ----------------------------- server room ----------------------------- */
  const serverGroup = new THREE.Group();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(190, 62, 190),
    new THREE.MeshLambertMaterial({ color: 0x060a10, side: THREE.BackSide })
  );
  room.position.set(0, -62, -470);
  serverGroup.add(room);

  const rackTex = makeServerTexture();
  const rackMat = new THREE.MeshLambertMaterial({
    color: 0x0a0f16,
    emissive: 0x9adfe8,
    emissiveIntensity: 0.55,
    emissiveMap: rackTex,
    map: rackTex,
  });
  const rackPos: THREE.Vector3[] = [];
  for (let xi = -4; xi <= 4; xi++) {
    if (xi === 0) continue;
    for (let zi = 0; zi < 8; zi++) {
      rackPos.push(new THREE.Vector3(xi * 12, -86, -445 - zi * 13));
    }
  }
  const racks = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 12, 2.4), rackMat, rackPos.length);
  rackPos.forEach((p, i) => {
    m4.compose(p, q0, new THREE.Vector3(1, 1, 1));
    racks.setMatrixAt(i, m4);
  });
  racks.instanceMatrix.needsUpdate = true;
  serverGroup.add(racks);

  const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffe1, toneMapped: false });
  const core = new THREE.Mesh(new THREE.SphereGeometry(5, 28, 20), coreMat);
  core.position.set(0, -80, -560);
  const coreLight = new THREE.PointLight(0x00ffe1, 260, 160, 1.8);
  coreLight.position.copy(core.position);
  serverGroup.add(core, coreLight);
  const ringA = new THREE.Mesh(
    new THREE.TorusGeometry(8.5, 0.22, 8, 56),
    new THREE.MeshBasicMaterial({ color: 0x5c8dff })
  );
  const ringB = new THREE.Mesh(
    new THREE.TorusGeometry(11.5, 0.16, 8, 56),
    new THREE.MeshBasicMaterial({ color: 0x00ffe1, transparent: true, opacity: 0.7 })
  );
  ringA.position.copy(core.position);
  ringB.position.copy(core.position);
  serverGroup.add(ringA, ringB);

  const dustGeo = new THREE.BufferGeometry();
  const dustN = 360;
  const dustArr = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustArr[i * 3] = (Math.random() - 0.5) * 170;
    dustArr[i * 3 + 1] = -92 + Math.random() * 56;
    dustArr[i * 3 + 2] = -470 + (Math.random() - 0.5) * 170;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustArr, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0x7fd8ff,
      size: 0.55,
      map: makeSoftDot(),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  serverGroup.add(dust);

  const screenSurf = makeBoardSurface(1024, 576);
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 16.8),
    new THREE.MeshBasicMaterial({ map: screenSurf.texture, toneMapped: false })
  );
  screenMesh.position.set(0, -63, -556);
  serverGroup.add(screenMesh);
  scene.add(serverGroup);

  /* ----------------------------- neural net ----------------------------- */
  const neuralGroup = new THREE.Group();
  const hub = new THREE.Vector3(0, 300, -80);
  const pts: number[] = [];
  const lines: number[] = [];
  const used = nodePositions.filter((_, i) => i % 2 === 0);
  used.forEach((n) => {
    pts.push(n.x, n.y, n.z);
    lines.push(n.x, n.y, n.z, hub.x, hub.y, hub.z);
  });
  pts.push(hub.x, hub.y, hub.z);
  const netGeo = new THREE.BufferGeometry();
  netGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const pointsMat = new THREE.PointsMaterial({
    color: 0x5c8dff,
    size: 7,
    map: makeSoftDot(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const netPoints = new THREE.Points(netGeo, pointsMat);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const linesMat = new THREE.LineBasicMaterial({
    color: 0x5c8dff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const netLines = new THREE.LineSegments(lineGeo, linesMat);
  const hubMat = new THREE.MeshBasicMaterial({
    color: 0x00ffe1,
    wireframe: true,
    transparent: true,
    opacity: 0,
  });
  const hubMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(42, 1), hubMat);
  hubMesh.position.copy(hub);
  neuralGroup.add(netPoints, netLines, hubMesh);
  neuralGroup.visible = false;
  scene.add(neuralGroup);

  /* ------------------------------ atmosphere ------------------------------ */
  const cloudMat = new THREE.MeshBasicMaterial({
    map: makeCloudTexture(),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const clouds = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), cloudMat, 54);
  clouds.frustumCulled = false;
  for (let i = 0; i < 54; i++) {
    eul.set(-Math.PI / 2, 0, Math.random() * Math.PI);
    qq.setFromEuler(eul);
    const s = 70 + Math.random() * 130;
    m4.compose(
      new THREE.Vector3((Math.random() - 0.5) * 900, 175 + Math.random() * 90, 150 + Math.random() * 850),
      qq,
      new THREE.Vector3(s, s, 1)
    );
    clouds.setMatrixAt(i, m4);
    clouds.setColorAt(i, col.setHSL(0.6, 0.2, 0.75 + Math.random() * 0.2));
  }
  clouds.instanceMatrix.needsUpdate = true;
  scene.add(clouds);

  const starGeo = new THREE.BufferGeometry();
  const starN = 700;
  const starArr = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 900 + Math.random() * 500;
    starArr[i * 3] = Math.cos(a) * r;
    starArr[i * 3 + 1] = 120 + Math.random() * 900;
    starArr[i * 3 + 2] = Math.sin(a) * r - 100;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starArr, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0x9fb4d8, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.8 })
  );
  scene.add(stars);

  return {
    skyline,
    skylineMat,
    corridorMats,
    corridorMeshes,
    b17,
    b17Window,
    windowGlow,
    flickerPhase,
    watcher,
    cars: { body: carBody, cabin: carCabin, lights: carLights, data: carData },
    crossCars: { body: crossBody, lights: crossLights, data: crossData },
    crossCar: { group: crossCarGroup },
    peds: { body: pedBody, head: pedHead, visor: pedVisor, data: pedData },
    boards,
    drones,
    cams,
    lampMat,
    shaftRings,
    server: {
      group: serverGroup,
      core,
      coreMat,
      rings: [ringA, ringB],
      dust,
      screen: { id: "screen", surf: screenSurf, mesh: screenMesh, key: "" },
      coreLight,
    },
    neural: { group: neuralGroup, pointsMat, linesMat, hub: hubMesh, hubMat },
    cloudMat,
    stars,
    nodePositions,
  };
}
