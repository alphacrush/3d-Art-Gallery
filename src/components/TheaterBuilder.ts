import * as THREE from "three";
import { HALL } from "@/lib/gallery";
import { velvet } from "@/lib/textures";

/* ═══════════════════════════════════════════════════════════════
   1. HELPERS
   ═══════════════════════════════════════════════════════════════ */

const _boxCache = new Map<string, THREE.BoxGeometry>();
function boxGeo(w: number, h: number, d: number) {
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  let g = _boxCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); _boxCache.set(k, g); }
  return g;
}

function cylGeo(rt: number, rb: number, h: number, seg = 24, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
}

function tiled(t: THREE.Texture, rx: number, ry: number) {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  const srgb = (THREE as any).SRGBColorSpace;
  if (srgb) c.colorSpace = srgb;
  return c;
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mergeGeoms(parts: { geo: THREE.BufferGeometry; color: number }[]): THREE.BufferGeometry {
  const flat = parts.map(({ geo, color }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  let total = 0; flat.forEach((g) => (total += g.attributes.position.count));
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of flat) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    uv.set(g.attributes.uv.array as Float32Array, o * 2);
    col.set(g.attributes.color.array as Float32Array, o * 3);
    o += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

function noPick(o: THREE.Object3D) {
  (o as any).raycast = () => {};
  o.traverse((c) => { (c as any).raycast = () => {}; });
}

function enablePick(o: THREE.Object3D) {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.raycast = THREE.Mesh.prototype.raycast;
    }
  });
}

function makeSignTexture(o: { title: string; sub?: string; w?: number; h?: number; bg?: string; fg?: string; accent?: string; titleSize?: number; }) {
  const w = o.w ?? 512, h = o.h ?? 128;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d")!;
  x.fillStyle = o.bg ?? "#0a0a0c"; x.fillRect(0, 0, w, h);
  const grd = x.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "rgba(255,255,255,0.07)"); grd.addColorStop(1, "rgba(0,0,0,0.25)");
  x.fillStyle = grd; x.fillRect(0, 0, w, h);
  x.strokeStyle = o.accent ?? "#c09a4a"; x.lineWidth = Math.max(2, w * 0.005);
  x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth);
  x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = o.fg ?? "#f3eee3";
  x.font = `600 ${Math.round(h * (o.titleSize ?? 0.42))}px Georgia, serif`;
  x.fillText(o.title, w / 2, o.sub ? h * 0.40 : h * 0.52);
  if (o.sub) {
    x.font = `300 ${Math.round(h * 0.19)}px Helvetica, Arial, sans-serif`;
    x.fillStyle = "rgba(243,238,227,0.6)"; x.fillText(o.sub, w / 2, h * 0.71);
  }
  const t = new THREE.CanvasTexture(c);
  const srgb = (THREE as any).SRGBColorSpace; if (srgb) t.colorSpace = srgb;
  t.anisotropy = 4;
  return t;
}

/* ═══════════════════════════════════════════════════════════════
   2. TYPES
   ═══════════════════════════════════════════════════════════════ */
export type TheaterAction = "play" | "upload" | "mute" | "lights" | "dim";
export interface TheaterState { playing?: boolean; muted?: boolean; lightsOn?: boolean; dimMode?: boolean; progress?: number; }
export interface TheaterOptions { videoTexture?: THREE.Texture | null; onUpload?: () => void; }

export interface TheaterHandle {
  theaterLights: THREE.Light[]; screenGlow: THREE.PointLight; beamMat: THREE.MeshBasicMaterial;
  controlBtns: THREE.Mesh[]; controlHitTargets: THREE.Mesh[]; root: THREE.Group; screen: THREE.Mesh;
  screenMaterial: THREE.MeshBasicMaterial; beam: THREE.Mesh; dust: THREE.Points; houseLights: THREE.PointLight[];
  console: THREE.Group; state: { playing: boolean; muted: boolean; lightsOn: boolean; dimMode: boolean };
  press: (action: TheaterAction) => void; setState: (s: Partial<TheaterState>) => void;
  setVideoTexture: (texture: THREE.Texture) => void;
  onControl?: (action: TheaterAction, theater: TheaterHandle) => void;
  heightAt: (z: number) => number; stepHeightAt: (z: number) => number;
  update: (dt: number, elapsed: number, state?: TheaterState) => void; dispose: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   3. BUILD THEATER
   ═══════════════════════════════════════════════════════════════ */
export function buildTheater(scene: THREE.Scene, seatMeshes: THREE.Mesh[], floorMeshes: THREE.Mesh[], offsetX: number = 0, options: TheaterOptions = {}): TheaterHandle {
  const root = new THREE.Group();
  root.name = "theater";
  scene.add(root);
  const add = <T extends THREE.Object3D>(o: T): T => { root.add(o); return o; };
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T) => { owned.push(x); return x; };

  /* ─────────────── DIMENSIONS ─────────────── */
  const W_HALF = 11;
  const Z_FRONT = -42.0; 
  const Z_BACK = -17.0;  
  const CEIL = Math.max(12, Math.min(17, (HALL?.h ?? 12) + 4));
  const PIT_Y = -5.2;    
  const CONC_Y = 0.0;    
  const DOOR_W = 4.6, DOOR_H = 3.0;

  const ROWS = 12, TREAD = 1.10;
  const RISE = (CONC_Y - PIT_Y) / ROWS;
  const Z_R0 = -37.6;
  const Z_R1 = Z_R0 + ROWS * TREAD;

  const AISLE_C = 3.0, AISLE_S = 2.0;
  const BLOCK_IN = AISLE_C / 2;
  const BLOCK_OUT = W_HALF - AISLE_S;
  const SEAT_PITCH = 1.05;
  const SEAT_XS: number[] = [];
  for (let s = 0; s < 7; s++) { const x = 2.15 + s * SEAT_PITCH; SEAT_XS.push(-x, x); }
  SEAT_XS.sort((a, b) => a - b);

  const SCREEN_W = 18.4, SCREEN_H = 12.8, SCREEN_R = 90;
  const SCREEN_Z = -41.4;
  const SCREEN_CY = PIT_Y + 1.6 + SCREEN_H / 2;
  const halfArc = Math.asin((SCREEN_W / 2) / SCREEN_R);

  /* ─────────────── MATERIALS ─────────────── */
  const INK = own(new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5, metalness: 0.3 }));
  const DARK_WOOD = own(new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.6, metalness: 0.05 }));
  const PANEL = own(new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.78, metalness: 0.04 }));
  const PANEL2 = own(new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.7, metalness: 0.04 }));
  const BRASS = own(new THREE.MeshStandardMaterial({ color: 0xc09a4a, roughness: 0.26, metalness: 0.95 }));
  const BRASS_D = own(new THREE.MeshStandardMaterial({ color: 0x6a5224, roughness: 0.4, metalness: 0.9 }));
  const WALL = own(new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.96 }));
  const CEILM = own(new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.97 }));
  const MATTE_BLACK = own(new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 1, metalness: 0 }));
  
  const CARPET = own(new THREE.MeshStandardMaterial({ map: tiled(velvet("#191014"), 6, 6), roughness: 0.97, color: 0x3a2026 }));
  const RUNNER = own(new THREE.MeshStandardMaterial({ map: tiled(velvet("#5c1010"), 1, 14), roughness: 0.95, color: 0x8a1c1c }));
  const SEAT_MAT = own(new THREE.MeshPhysicalMaterial({
    map: tiled(velvet("#3c0c0c"), 1, 1), vertexColors: true, color: 0xffffff,
    roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xd03030), sheenRoughness: 0.55,
  }));

  /* ═══════════════════════════════════════════════════════════════
     4. SOLID FLOOR PHYSICS
     ═══════════════════════════════════════════════════════════════ */
  const stepTop = (i: number) => PIT_Y + (i + 1) * RISE;
  const stepZ0 = (i: number) => Z_R0 + i * TREAD;

  const mkBlock = (w: number, d: number, z0: number, top: number, mat: THREE.Material, cx: number = 0) => {
    const h = 0.5;
    const m = add(new THREE.Mesh(boxGeo(w, h, d), mat));
    m.position.set(offsetX + cx, top - h / 2, z0 + d / 2);
    m.receiveShadow = true;
    floorMeshes.push(m);
    return m;
  };

  // Pit (Front) + Concourse (Rear)
  mkBlock(W_HALF * 2, Z_R0 - Z_FRONT, Z_FRONT, PIT_Y, CARPET);
  mkBlock(W_HALF * 2, Z_BACK - Z_R1, Z_R1, CONC_Y, CARPET);

  // Stepped Seating Blocks (Left and Right)
  const BLOCK_W = BLOCK_OUT - BLOCK_IN;
  const BLOCK_C = (BLOCK_OUT + BLOCK_IN) / 2;
  for (let i = 0; i < ROWS; i++) {
    const z = stepZ0(i), top = stepTop(i);
    mkBlock(BLOCK_W, TREAD, z, top, CARPET, BLOCK_C);  // Right Side
    mkBlock(BLOCK_W, TREAD, z, top, CARPET, -BLOCK_C); // Left Side
  }

  // Smooth Aisle Ramps
  const RAMP_ANGLE = Math.atan2(CONC_Y - PIT_Y, Z_R1 - Z_R0);
  const RAMP_LEN = Math.hypot(CONC_Y - PIT_Y, Z_R1 - Z_R0);
  
  const mkRamp = (w: number, cx: number) => {
    const h = 0.5;
    const c = add(new THREE.Mesh(boxGeo(w, h, RAMP_LEN), RUNNER));
    c.rotation.x = -RAMP_ANGLE;
    const cy = (PIT_Y + CONC_Y) / 2 - (h / 2) * Math.cos(RAMP_ANGLE);
    const cz = (Z_R0 + Z_R1) / 2 + (h / 2) * Math.sin(RAMP_ANGLE);
    c.position.set(offsetX + cx, cy, cz);
    c.receiveShadow = true;
    floorMeshes.push(c);
  };
  mkRamp(AISLE_C, 0); // Center aisle
  mkRamp(AISLE_S, (BLOCK_OUT + W_HALF) / 2); // Right aisle
  mkRamp(AISLE_S, -(BLOCK_OUT + W_HALF) / 2); // Left aisle

  /* ═══════════════════════════════════════════════════════════════
     5. SHELL
     ═══════════════════════════════════════════════════════════════ */
  const wallCY = (CEIL + PIT_Y - 1.0) / 2;
  const wallH = CEIL - (PIT_Y - 1.0);
  
  const mkWall = (w: number, d: number, x: number, z: number) => {
    const m = add(new THREE.Mesh(boxGeo(w, wallH, d), WALL));
    m.position.set(offsetX + x, wallCY, z);
    return m;
  };
  mkWall(W_HALF * 2 + 1.4, 0.7, 0, Z_FRONT - 0.35); // Screen Wall
  mkWall(0.7, Z_BACK - Z_FRONT, -(W_HALF + 0.35), (Z_FRONT + Z_BACK) / 2); // Left
  mkWall(0.7, Z_BACK - Z_FRONT, W_HALF + 0.35, (Z_FRONT + Z_BACK) / 2); // Right

  const segW = (W_HALF * 2 + 0.7 - DOOR_W) / 2;
  mkWall(segW, 0.7, -(DOOR_W / 2 + segW / 2), Z_BACK + 0.35);
  mkWall(segW, 0.7, DOOR_W / 2 + segW / 2, Z_BACK + 0.35);
  
  const aboveDoor = add(new THREE.Mesh(boxGeo(DOOR_W, CEIL - DOOR_H, 0.7), WALL));
  aboveDoor.position.set(offsetX, (DOOR_H + CEIL) / 2, Z_BACK + 0.35);

  const lintel = add(new THREE.Mesh(boxGeo(DOOR_W + 0.6, 0.3, 0.95), BRASS_D));
  lintel.position.set(offsetX, DOOR_H, Z_BACK + 0.3);
  for (const s of [-1, 1]) {
    const j = add(new THREE.Mesh(boxGeo(0.26, DOOR_H, 0.95), BRASS_D));
    j.position.set(offsetX + s * (DOOR_W / 2 + 0.13), DOOR_H / 2, Z_BACK + 0.3);
  }
  const soffitMat = own(new THREE.MeshStandardMaterial({ color: 0x101014, emissive: 0xffd9a0, emissiveIntensity: 1.5, roughness: 0.5 }));
  add(new THREE.Mesh(boxGeo(DOOR_W + 0.4, 0.08, 0.7), soffitMat)).position.set(offsetX, DOOR_H + 0.22, Z_BACK + 0.55);

  // Vestibule
  const vest = add(new THREE.Mesh(new THREE.PlaneGeometry(W_HALF * 2, 3.6), RUNNER));
  vest.rotation.x = -Math.PI / 2; vest.position.set(offsetX, 0.01, Z_BACK + 1.8);
  floorMeshes.push(vest);

  // Ceiling
  const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(W_HALF * 2, Z_BACK - Z_FRONT), CEILM));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(offsetX, CEIL, (Z_FRONT + Z_BACK) / 2);

  const dummy = new THREE.Object3D();
  const coff = new THREE.InstancedMesh(boxGeo(0.26, 0.34, Z_BACK - Z_FRONT), INK, 7);
  for (let i = 0; i < 7; i++) {
    dummy.position.set(offsetX - 8.4 + i * 2.8, CEIL - 0.18, (Z_FRONT + Z_BACK) / 2);
    dummy.updateMatrix(); coff.setMatrixAt(i, dummy.matrix);
  }
  coff.instanceMatrix.needsUpdate = true; add(coff);

  // Acoustic Flutes
  const flutes = new THREE.InstancedMesh(boxGeo(0.18, 5.2, 0.26), PANEL2, 84);
  let fi = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 42; i++) {
      dummy.position.set(offsetX + side * (W_HALF - 0.14), 4.2, Z_BACK - 1.0 - i * 0.55);
      dummy.updateMatrix(); flutes.setMatrixAt(fi++, dummy.matrix);
    }
  }
  flutes.instanceMatrix.needsUpdate = true; add(flutes);

  // Ceiling Clouds
  const cloud = new THREE.InstancedMesh(boxGeo(1.2, 0.2, 1.2), PANEL, 48);
  let ci = 0;
  for (let a = 0; a < 6; a++) {
    for (let b = 0; b < 8; b++) {
      dummy.position.set(offsetX - 7.1 + a * 2.85, CEIL - 0.6, Z_BACK - 2.4 - b * 2.6);
      dummy.updateMatrix(); cloud.setMatrixAt(ci++, dummy.matrix);
    }
  }
  cloud.instanceMatrix.needsUpdate = true; add(cloud);

  /* ═══════════════════════════════════════════════════════════════
     6. THE SCREEN
     ═══════════════════════════════════════════════════════════════ */
  const srgb = (THREE as any).SRGBColorSpace;
  const filmCanvas = document.createElement("canvas");
  filmCanvas.width = 1024; filmCanvas.height = 576;
  const fctx = filmCanvas.getContext("2d")!;
  const filmTex = own(new THREE.CanvasTexture(filmCanvas));
  if (srgb) filmTex.colorSpace = srgb;

  let screenMap: THREE.Texture = filmTex;
  if (options.videoTexture) {
    const vt = options.videoTexture.clone(); vt.needsUpdate = true;
    if (srgb) vt.colorSpace = srgb; screenMap = own(vt);
  }
  const screenMaterial = own(new THREE.MeshBasicMaterial({ map: screenMap, toneMapped: false }));

  const mkArc = (r: number, h: number, segs = 72) => new THREE.CylinderGeometry(r, r, h, segs, 1, true, -halfArc, halfArc * 2);
  const screen = add(new THREE.Mesh(own(mkArc(SCREEN_R, SCREEN_H, 96)), screenMaterial));
  screen.position.set(offsetX, SCREEN_CY, SCREEN_Z - SCREEN_R);
  screen.name = "theater-screen"; noPick(screen);

  const mkBand = (r: number, h: number, y: number, mat: THREE.Material) => {
    const m = add(new THREE.Mesh(own(mkArc(r, h)), mat));
    m.position.set(offsetX, y, SCREEN_Z - SCREEN_R); noPick(m);
  };
  mkBand(SCREEN_R + 0.02, 0.5, SCREEN_CY + SCREEN_H / 2 + 0.25, MATTE_BLACK);
  mkBand(SCREEN_R + 0.02, 0.5, SCREEN_CY - SCREEN_H / 2 - 0.25, MATTE_BLACK);
  mkBand(SCREEN_R + 0.16, 0.1, SCREEN_CY + SCREEN_H / 2 + 0.55, BRASS_D);
  mkBand(SCREEN_R + 0.16, 0.1, SCREEN_CY - SCREEN_H / 2 - 0.55, BRASS_D);

  const edgeX = SCREEN_R * Math.sin(halfArc);
  const edgeZ = SCREEN_Z - SCREEN_R + SCREEN_R * Math.cos(halfArc);
  for (const s of [-1, 1]) {
    const m = add(new THREE.Mesh(boxGeo(0.45, SCREEN_H + 1.0, 0.3), MATTE_BLACK));
    m.position.set(offsetX + s * (edgeX + 0.24), SCREEN_CY, edgeZ + 0.1); m.rotation.y = -s * halfArc;
    const f = add(new THREE.Mesh(boxGeo(0.1, SCREEN_H + 1.1, 0.34), BRASS_D));
    f.position.set(offsetX + s * (edgeX + 0.48), SCREEN_CY, edgeZ + 0.12); f.rotation.y = -s * halfArc;
  }

  const openH = SCREEN_H + 1.6, openW = SCREEN_W + 1.4;
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(boxGeo(0.9, openH, 0.9), DARK_WOOD)).position.set(offsetX + s * (openW / 2 + 0.45), SCREEN_CY, SCREEN_Z + 0.9);
    add(new THREE.Mesh(boxGeo(0.12, openH, 0.96), BRASS_D)).position.set(offsetX + s * (openW / 2 + 0.92), SCREEN_CY, SCREEN_Z + 0.9);
  }
  add(new THREE.Mesh(boxGeo(openW + 2.6, 1.0, 0.9), DARK_WOOD)).position.set(offsetX, SCREEN_CY + openH / 2 + 0.5, SCREEN_Z + 0.9);

  const logoTex = own(makeSignTexture({ title: "IMAX", sub: "THE RITZ PICTURE HOUSE", w: 1024, h: 256, bg: "#08080a" }));
  const logo = add(new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.25), own(new THREE.MeshBasicMaterial({ map: logoTex, toneMapped: false }))));
  logo.position.set(offsetX, SCREEN_CY + SCREEN_H / 2 + 1.35, SCREEN_Z + 0.5); noPick(logo);

  /* ═══════════════════════════════════════════════════════════════
     7. SEATING & SIGNS
     ═══════════════════════════════════════════════════════════════ */
  const cp = new THREE.Shape();
  cp.moveTo(0.0, 0.0); cp.lineTo(0.78, 0.0); cp.lineTo(0.78, 1.16); cp.lineTo(0.6, 1.16); cp.lineTo(0.6, 0.47); cp.lineTo(0.0, 0.47); cp.closePath();
  const shellG = own(new THREE.ExtrudeGeometry(cp, { depth: 0.66, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 2, curveSegments: 1 }));
  shellG.rotateY(-Math.PI / 2); shellG.translate(0.33, 0, -0.3);
  const armL = own(new THREE.BoxGeometry(0.08, 0.1, 0.58)); armL.translate(-0.3, 0.71, -0.06);
  const armR = own(new THREE.BoxGeometry(0.08, 0.1, 0.58)); armR.translate(0.3, 0.71, -0.06);
  const chairGeo = own(mergeGeoms([{ geo: shellG, color: 0xffffff }, { geo: armL, color: 0x40301f }, { geo: armR, color: 0x40301f }]));

  for (let r = 0; r < ROWS; r++) {
    const z = stepZ0(r) + TREAD * 0.55;
    const y = stepTop(r);
    SEAT_XS.forEach((x) => {
      const g = new THREE.Group(); g.position.set(offsetX + x, y, z);
      const seat = new THREE.Mesh(chairGeo, SEAT_MAT);
      seat.userData = { isSeat: true, sitPose: { x: offsetX + x, y: y + 0.47, z: z + 0.02, rotY: Math.PI }, seatY: y + 0.47, row: String.fromCharCode(65 + r) };
      g.add(seat); seatMeshes.push(seat); add(g);
    });
  }

  for (let r = 0; r < ROWS; r++) {
    const tex = own(makeSignTexture({ title: String.fromCharCode(65 + r), sub: "ROW", w: 256, h: 128, bg: "#0a0a0c" }));
    const mat = own(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    for (const s of [-1, 1]) {
      const sign = add(new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), mat));
      sign.position.set(offsetX + s * (W_HALF - 0.2), stepTop(r) + 1.5, stepZ0(r) + TREAD * 0.55); sign.rotation.y = s * -Math.PI / 2; noPick(sign);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     8. RAILS & STEP LIGHTS
     ═══════════════════════════════════════════════════════════════ */
  const railMat = own(new THREE.MeshStandardMaterial({ color: 0xb9924a, roughness: 0.28, metalness: 0.95 }));
  const mkRail = (x: number) => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= ROWS * 2; k++) {
      const t = k / (ROWS * 2);
      pts.push(new THREE.Vector3(offsetX + x, PIT_Y + t * (CONC_Y - PIT_Y) + 0.95, Z_R0 + t * (Z_R1 - Z_R0)));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.05);
    add(new THREE.Mesh(own(new THREE.TubeGeometry(curve, 64, 0.042, 8, false)), railMat));
    for (let k = 0; k <= ROWS; k += 2) {
      const t = k / ROWS;
      add(new THREE.Mesh(cylGeo(0.032, 0.032, 0.95, 8), railMat)).position.set(offsetX + x, PIT_Y + t * (CONC_Y - PIT_Y) + 0.475, Z_R0 + t * (Z_R1 - Z_R0));
    }
  };
  mkRail(BLOCK_IN + 0.18); mkRail(-(BLOCK_IN + 0.18)); mkRail(BLOCK_OUT + 0.2); mkRail(-(BLOCK_OUT + 0.2));

  // Small step LEDs on riser faces
  const stepMat = own(new THREE.MeshStandardMaterial({ color: 0x1a0800, emissive: 0xffaa44, emissiveIntensity: 0.8, roughness: 0.45 }));
  for (let i = 0; i < ROWS; i++) {
    const y = stepTop(i) - RISE + 0.04; 
    const z = stepZ0(i) + 0.02;
    for (const sx of [-AISLE_C * 0.35, AISLE_C * 0.35]) {
      add(new THREE.Mesh(boxGeo(0.35, 0.04, 0.04), stepMat)).position.set(offsetX + sx, y, z);
    }
    for (const side of [-1, 1]) {
      const ax = side * ((BLOCK_OUT + W_HALF) / 2);
      add(new THREE.Mesh(boxGeo(0.5, 0.04, 0.04), stepMat)).position.set(offsetX + ax, y, z);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     9. INTERACTIVE CONTROLS
     ═══════════════════════════════════════════════════════════════ */
  const controlBtns: THREE.Mesh[] = [];
  const controlHitTargets: THREE.Mesh[] = [];
  const BTN_DEF: { action: TheaterAction; color: number; label: string }[] = [
    { action: "play", color: 0x2bff57, label: "PLAY" },
    { action: "upload", color: 0xff2b2b, label: "LOAD" },
    { action: "mute", color: 0xffd22b, label: "AUDIO" },
    { action: "lights", color: 0x2bb6ff, label: "HOUSE" },
    { action: "dim", color: 0x9944ff, label: "DIM" },
  ];

  const mkButton = (parent: THREE.Object3D, x: number, y: number, z: number, tilt: number, def: typeof BTN_DEF[number]) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.x = tilt; parent.add(g);
    const bezel = own(new THREE.TorusGeometry(0.26, 0.05, 8, 24)); bezel.rotateX(Math.PI / 2); bezel.translate(0, -0.02, 0);
    const cap = own(new THREE.CylinderGeometry(0.23, 0.23, 0.13, 24)); cap.translate(0, 0.05, 0);
    
    const btn = new THREE.Mesh(own(mergeGeoms([{ geo: bezel, color: 0x6a5224 }, { geo: cap, color: def.color }])), own(new THREE.MeshStandardMaterial({
      vertexColors: true, color: 0xffffff, emissive: def.color, emissiveIntensity: 0.6, roughness: 0.28, metalness: 0.1,
    })));
    
    btn.userData = { isControlBtn: true, controlAction: def.action, action: def.action, label: def.label };
    btn.name = "control-btn"; g.add(btn); controlBtns.push(btn);
    
    const padMat = own(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.75), padMat);
    pad.position.set(0, 0.18, 0); pad.rotation.x = -Math.PI / 2; pad.userData = { ...btn.userData };
    g.add(pad); controlHitTargets.push(btn, pad);

    const halo = new THREE.Mesh(own(new THREE.RingGeometry(0.3, 0.4, 28)), own(new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })));
    halo.rotation.x = -Math.PI / 2; halo.position.set(0, 0.02, 0); g.add(halo); noPick(halo);
    
    enablePick(g);
    return btn;
  };

  const pitPanel = new THREE.Group(); pitPanel.position.set(offsetX, PIT_Y, -39.6);
  const pitBody = add(new THREE.Mesh(boxGeo(3.0, 0.85, 0.85), DARK_WOOD)); pitBody.position.set(offsetX, PIT_Y + 0.42, -39.6); noPick(pitBody);
  const pitTop = add(new THREE.Mesh(boxGeo(3.1, 0.07, 0.95), INK)); pitTop.position.set(offsetX, PIT_Y + 0.87, -39.6); noPick(pitTop);
  pitPanel.position.set(offsetX, PIT_Y + 0.92, -39.6); pitPanel.rotation.x = -0.5;
  BTN_DEF.forEach((d, i) => mkButton(pitPanel, -1.04 + i * 0.52, 0, 0, 0, d));
  add(pitPanel); enablePick(pitPanel);

  // Renamed to deskConsole to avoid shadowing window.console!
  const deskConsole = new THREE.Group(); deskConsole.name = "theater-console"; deskConsole.position.set(offsetX - 6.6, CONC_Y, -20.4); deskConsole.rotation.y = 0.5;
  const deskBody = new THREE.Mesh(boxGeo(3.2, 0.86, 0.95), DARK_WOOD); deskBody.position.y = 0.43; deskConsole.add(deskBody); noPick(deskBody);
  const deskTop = new THREE.Mesh(boxGeo(3.3, 0.08, 1.02), INK); deskTop.position.set(0, 0.88, 0); deskTop.rotation.x = 0.26; deskConsole.add(deskTop); noPick(deskTop);
  const btnRow = new THREE.Group(); btnRow.position.set(0, 0.95, 0); btnRow.rotation.x = 0.26; deskConsole.add(btnRow);
  BTN_DEF.forEach((d, i) => mkButton(btnRow, -1.04 + i * 0.52, 0, 0, 0, d));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.42), own(new THREE.MeshBasicMaterial({ map: own(makeSignTexture({ title: "CONTROL DESK", sub: "PLAY · LOAD · AUDIO · HOUSE · DIM", w: 1024, h: 160, bg: "#0a0a0c" })), toneMapped: false })));
  sign.position.set(0, 0.58, 0.49); sign.rotation.x = -0.26; deskConsole.add(sign); noPick(sign);
  add(deskConsole); enablePick(deskConsole);

  const mkWallSwitch = (x: number, z: number) => {
    const g = new THREE.Group(); g.position.set(offsetX + x, 1.3, z);
    g.add(new THREE.Mesh(boxGeo(0.35, 0.5, 0.06), INK));
    const sw = new THREE.Mesh(boxGeo(0.18, 0.18, 0.08), own(new THREE.MeshStandardMaterial({ color: 0x2bb6ff, emissive: 0x2bb6ff, emissiveIntensity: 1.2, roughness: 0.3 })));
    sw.position.z = 0.06; sw.userData = { isControlBtn: true, controlAction: "lights", action: "lights", label: "HOUSE" };
    g.add(sw); controlBtns.push(sw); controlHitTargets.push(sw);
    
    const hitMat = own(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), hitMat);
    hit.position.z = 0.1; hit.userData = { ...sw.userData }; g.add(hit); controlHitTargets.push(hit);
    add(g); enablePick(g);
  };
  mkWallSwitch(-(DOOR_W / 2 + 0.8), Z_BACK + 0.05); mkWallSwitch((DOOR_W / 2 + 0.8), Z_BACK + 0.05);

  /* ═══════════════════════════════════════════════════════════════
     10. LIGHTING
     ═══════════════════════════════════════════════════════════════ */
  const theaterLights: THREE.Light[] = []; const houseLights: THREE.PointLight[] = [];
  const ambientLight = new THREE.AmbientLight(0x1a1520, 0.35); add(ambientLight); theaterLights.push(ambientLight);
  const hemiLight = new THREE.HemisphereLight(0x2a2040, 0x0a0808, 0.3); add(hemiLight); theaterLights.push(hemiLight);

  const coveMat = own(new THREE.MeshStandardMaterial({ color: 0x0a0a0c, emissive: 0x9fd0ff, emissiveIntensity: 1.8, roughness: 0.4 }));
  const downMat = own(new THREE.MeshStandardMaterial({ color: 0x151517, emissive: 0xffd7a0, emissiveIntensity: 1.2, roughness: 0.4 }));
  
  for (const x of [-7.2, 0, 7.2]) {
    add(new THREE.Mesh(boxGeo(0.34, 0.1, Z_BACK - Z_FRONT - 2), coveMat)).position.set(offsetX + x, CEIL - 0.42, (Z_FRONT + Z_BACK) / 2);
    add(new THREE.Mesh(boxGeo(0.62, 0.24, Z_BACK - Z_FRONT - 2), INK)).position.set(offsetX + x, CEIL - 0.26, (Z_FRONT + Z_BACK) / 2);
  }

  const lampGeo = own(cylGeo(0.17, 0.22, 0.09, 14));
  const DL = [[0, -38], [0, -33], [0, -28], [0, -23], [0, -19], [-5, -35], [5, -35], [-5, -27], [5, -27], [-5, -21], [5, -21], [-8, -32], [8, -32], [-8, -24], [8, -24], [0, -40.5], [-4, -40.5], [4, -40.5]];
  DL.forEach(([lx, lz], i) => {
    add(new THREE.Mesh(lampGeo, downMat)).position.set(offsetX + lx, CEIL - 0.24, lz);
    if (i % 2 === 0) {
      const pl = new THREE.PointLight(0xffd9ae, 3.2, 17, 2); pl.position.set(offsetX + lx, CEIL - 0.75, lz);
      add(pl); theaterLights.push(pl); houseLights.push(pl);
    }
  });

  const sconceMat = own(new THREE.MeshStandardMaterial({ color: 0x0a0a0c, emissive: 0xffd090, emissiveIntensity: 1.0, roughness: 0.4 }));
  for (let z = Z_FRONT + 4; z < Z_BACK - 2; z += 4.5) {
    [-(W_HALF - 0.3), W_HALF - 0.3].forEach((sx) => {
      add(new THREE.Mesh(boxGeo(0.18, 0.3, 0.12), sconceMat)).position.set(offsetX + sx, 3.2, z);
      const sLight = new THREE.PointLight(0xffc880, 1.2, 8, 2); sLight.position.set(offsetX + sx + (sx > 0 ? -0.3 : 0.3), 3.2, z);
      add(sLight); theaterLights.push(sLight); houseLights.push(sLight);
    });
  }

  const screenGlow = new THREE.PointLight(0xaaccff, 0, 46, 1.5); screenGlow.position.set(offsetX, SCREEN_CY, SCREEN_Z + 2.6); add(screenGlow);
  const bounce = new THREE.PointLight(0x88aaff, 0, 50, 1.3); bounce.position.set(offsetX, SCREEN_CY - 2.6, SCREEN_Z + 7); add(bounce);
  const deskLight = new THREE.PointLight(0xffc98a, 1.4, 7, 2); deskLight.position.set(offsetX - 6.4, CONC_Y + 1.4, -20.1); add(deskLight); theaterLights.push(deskLight);
  
  const exitMat = own(new THREE.MeshStandardMaterial({ map: own(makeSignTexture({ title: "EXIT", sub: "↔", w: 256, h: 128, bg: "#0a0c0a", accent: "#3ad07a" })), emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.6 }));
  [[offsetX - 4.8, 2.4, Z_BACK - 0.3, 0], [offsetX + 4.8, 2.4, Z_BACK - 0.3, 0], [offsetX - (W_HALF - 0.2), 1.8, -30.0, -Math.PI / 2], [offsetX + (W_HALF - 0.2), 1.8, -30.0, Math.PI / 2]].forEach((p) => {
    const ex = add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), exitMat)); ex.position.set(p[0], p[1], p[2]); ex.rotation.y = p[3]; noPick(ex);
  });

  /* ═══════════════════════════════════════════════════════════════
     11. PROJECTOR BEAM
     ═══════════════════════════════════════════════════════════════ */
  const beamStart = new THREE.Vector3(offsetX, CEIL - 1.6, -20.6);
  const beamEnd = new THREE.Vector3(offsetX, SCREEN_CY, SCREEN_Z + 0.2);
  const beamDir = beamEnd.clone().sub(beamStart);
  const beamQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir.clone().normalize());
  
  const beamMat = own(new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  const beam = add(new THREE.Mesh(own(cylGeo(SCREEN_W * 0.4, 0.12, beamDir.length(), 40, true)), beamMat));
  beam.position.copy(beamStart).add(beamEnd).multiplyScalar(0.5); beam.quaternion.copy(beamQ); beam.renderOrder = 3; noPick(beam);

  const coreMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  const core = add(new THREE.Mesh(own(cylGeo(SCREEN_W * 0.4 * 0.36, 0.06, beamDir.length(), 24, true)), coreMat));
  core.position.copy(beam.position); core.quaternion.copy(beamQ); core.renderOrder = 4; noPick(core);

  const proj = new THREE.Group(); proj.position.copy(beamStart); proj.lookAt(beamEnd); proj.rotateX(Math.PI / 2);
  proj.add(new THREE.Mesh(boxGeo(1.0, 0.66, 1.6), INK));
  const pLens = new THREE.Mesh(cylGeo(0.18, 0.22, 0.32, 16), BRASS_D); pLens.rotation.x = Math.PI / 2; pLens.position.set(0, -0.06, -0.88); proj.add(pLens);
  add(proj); noPick(proj);

  const DUST = 460; const dustPos = new Float32Array(DUST * 3), dU = new Float32Array(DUST), dR = new Float32Array(DUST), dA = new Float32Array(DUST), dS = new Float32Array(DUST);
  const dr = mulberry32(99); for (let i = 0; i < DUST; i++) { dU[i] = dr(); dR[i] = Math.sqrt(dr()); dA[i] = dr() * Math.PI * 2; dS[i] = 0.004 + dr() * 0.012; }
  const dustGeo = own(new THREE.BufferGeometry()); dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = own(new THREE.PointsMaterial({ color: 0xfff4d8, size: 0.05, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  const dust = add(new THREE.Points(dustGeo, dustMat)); dust.frustumCulled = false; dust.renderOrder = 5; noPick(dust);
  const bRight = new THREE.Vector3(1, 0, 0).cross(beamDir.clone().normalize()).normalize(), bUp = beamDir.clone().normalize().cross(bRight).normalize();

  /* ═══════════════════════════════════════════════════════════════
     12. FILM LOGIC
     ═══════════════════════════════════════════════════════════════ */
  const drawFilm = (t: number, playing: boolean) => {
    const W = 1024, H = 576;
    fctx.clearRect(0, 0, W, H);
    if (!playing) {
      fctx.fillStyle = "#0d0f14"; fctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, R = 205;
      fctx.strokeStyle = "rgba(200,210,225,0.28)"; fctx.lineWidth = 3;
      fctx.beginPath(); fctx.arc(cx, cy, R, 0, Math.PI * 2); fctx.stroke();
      fctx.beginPath(); fctx.arc(cx, cy, R * 0.62, 0, Math.PI * 2); fctx.stroke();
      fctx.beginPath(); fctx.moveTo(cx - R, cy); fctx.lineTo(cx + R, cy); fctx.moveTo(cx, cy - R); fctx.lineTo(cx, cy + R); fctx.stroke();
      const phase = t % 3.4; const n = Math.max(1, Math.ceil(3.4 - phase)); const frac = 1 - ((phase % 1.4) / 1.4);
      fctx.save(); fctx.translate(cx, cy); fctx.rotate(-frac * Math.PI * 2);
      fctx.fillStyle = "rgba(220,228,240,0.22)"; fctx.beginPath(); fctx.moveTo(0, 0); fctx.arc(0, 0, R, 0, Math.PI * 2); fctx.fill(); fctx.restore();
      fctx.textAlign = "center"; fctx.textBaseline = "middle"; fctx.fillStyle = "rgba(235,240,250,0.85)";
      fctx.font = "700 200px Georgia, serif"; fctx.fillText(String(n), cx, cy + 6);
      fctx.font = "300 24px Helvetica, Arial, sans-serif"; fctx.fillStyle = "rgba(200,210,225,0.5)";
      fctx.fillText("PICTURE  START", cx, cy + R + 50);
    } else {
      const sky = fctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#050d2c"); sky.addColorStop(0.55, "#3a1a4e"); sky.addColorStop(1, "#c2762f");
      fctx.fillStyle = sky; fctx.fillRect(0, 0, W, H);
      fctx.beginPath(); fctx.arc(760, 120, 50, 0, Math.PI * 2); fctx.fillStyle = "rgba(255,238,200,0.9)"; fctx.fill();
      const vg = fctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.6)"); fctx.fillStyle = vg; fctx.fillRect(0, 0, W, H);
      fctx.textAlign = "center"; fctx.fillStyle = "rgba(255,255,255,0.8)"; fctx.font = "600 40px Georgia, serif"; fctx.fillText("THE RITZ PICTURE HOUSE", W / 2, 92);
      fctx.font = "300 20px Helvetica, Arial, sans-serif"; fctx.fillStyle = "rgba(255,255,255,0.42)"; fctx.fillText("NOW SHOWING", W / 2, 124);
    }
    filmTex.needsUpdate = true;
  };
  drawFilm(0, false);

  /* ═══════════════════════════════════════════════════════════════
     13. STATE & UPDATE LOGIC
     ═══════════════════════════════════════════════════════════════ */
  const state = { playing: false, muted: false, lightsOn: true, dimMode: false };
  const houseBase = houseLights.map((l) => l.intensity);
  
  const applyLights = () => {
    const on = state.lightsOn;
    const dim = state.dimMode;
    const playMul = state.playing ? 0.55 : 1.0;

    if (!on) {
      houseLights.forEach((l) => { l.intensity = 0; });
      ambientLight.intensity = 0.04; hemiLight.intensity = 0.03;
      coveMat.emissiveIntensity = 0; downMat.emissiveIntensity = 0; sconceMat.emissiveIntensity = 0;
      stepMat.emissiveIntensity = 2.5; exitMat.emissiveIntensity = 2.8; soffitMat.emissiveIntensity = 0.5; deskLight.intensity = 0.2;
    } else if (dim) {
      houseLights.forEach((l, i) => { l.intensity = houseBase[i] * 0.15 * playMul; });
      ambientLight.intensity = 0.10; hemiLight.intensity = 0.08;
      coveMat.emissiveIntensity = 0.3; downMat.emissiveIntensity = 0.2; sconceMat.emissiveIntensity = 0.2;
      stepMat.emissiveIntensity = 2.0; exitMat.emissiveIntensity = 2.2; soffitMat.emissiveIntensity = 0.6; deskLight.intensity = 0.5;
    } else {
      houseLights.forEach((l, i) => { l.intensity = houseBase[i] * playMul; });
      ambientLight.intensity = 0.35; hemiLight.intensity = 0.30;
      coveMat.emissiveIntensity = 1.9; downMat.emissiveIntensity = 1.3; sconceMat.emissiveIntensity = 1.0;
      stepMat.emissiveIntensity = 0.7; exitMat.emissiveIntensity = 1.6; soffitMat.emissiveIntensity = 1.5; deskLight.intensity = 1.5;
    }
  };
  applyLights();

  const promptVideoUpload = (h: TheaterHandle) => {
    const choice = window.confirm(
      "Click OK to enter a Video URL, or CANCEL to pick a video file from disk."
    );
    if (choice) {
      const url = window.prompt(
        "Enter Direct MP4 Video URL:",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
      );
      if (url) {
        const v = document.createElement("video");
        v.crossOrigin = "anonymous";
        v.loop = true;
        v.playsInline = true;
        v.src = url;
        v.play().then(() => {
          const vt = new THREE.VideoTexture(v);
          h.setVideoTexture(vt);
          h.press("play");
        }).catch((e) => globalThis.console.log("Video load error:", e));
      }
    } else {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "video/*";
      fileInput.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const fileURL = URL.createObjectURL(file);
          const v = document.createElement("video");
          v.loop = true;
          v.playsInline = true;
          v.src = fileURL;
          v.play().then(() => {
            const vt = new THREE.VideoTexture(v);
            h.setVideoTexture(vt);
            h.press("play");
          });
        }
      };
      fileInput.click();
    }
  };

  const handle: TheaterHandle = {
    theaterLights, screenGlow, beamMat, controlBtns, controlHitTargets, root, screen, screenMaterial, beam, dust, houseLights,
    console: deskConsole, // Properly mapped to deskConsole Group
    state,
    press: (action: TheaterAction) => {
      controlBtns.forEach((b) => {
        if (b.userData?.controlAction === action || b.userData?.action === action) {
          const startY = b.position.y;
          b.position.y = startY - 0.04;
          setTimeout(() => { b.position.y = startY; }, 150);
        }
      });

      switch (action) {
        case "play":
          state.playing = !state.playing;
          break;
        case "mute":
          state.muted = !state.muted;
          break;
        case "lights":
          state.lightsOn = !state.lightsOn;
          if (state.lightsOn) state.dimMode = false;
          break;
        case "dim":
          state.dimMode = !state.dimMode;
          if (state.dimMode) state.lightsOn = true;
          break;
        case "upload":
          if (options.onUpload) {
            options.onUpload();
          } else {
            promptVideoUpload(handle);
          }
          break;
      }
      applyLights(); handle.onControl?.(action, handle);
      window.dispatchEvent(new CustomEvent("theater-control", { detail: { action, state: { ...state }, theater: handle } }));
    },
    setState: (s) => { Object.assign(state, s); applyLights(); },
    setVideoTexture: (texture: THREE.Texture) => {
      const srgbSpace = (THREE as any).SRGBColorSpace;
      if (srgbSpace) texture.colorSpace = srgbSpace;
      texture.needsUpdate = true;
      screenMaterial.map = texture;
      screenMaterial.needsUpdate = true;
    },
    onControl: undefined,
    heightAt: (z) => {
      if (z <= Z_R0) return PIT_Y;
      if (z >= Z_R1) return CONC_Y;
      return PIT_Y + ((z - Z_R0) / (Z_R1 - Z_R0)) * (CONC_Y - PIT_Y);
    },
    stepHeightAt: (z) => {
      if (z <= Z_R0) return PIT_Y;
      if (z >= Z_R1) return CONC_Y;
      return stepTop(Math.min(ROWS - 1, Math.floor((z - Z_R0) / TREAD)));
    },
    update: (dt, el) => tick(dt, el), dispose: () => dispose(),
  };

  let raf = 0, lastT = performance.now(), elapsed = 0, flick = 0, filmAcc = 0;
  const tick = (dt: number, el: number) => {
    const d = Math.min(dt, 0.1);
    beamMat.opacity += ((state.playing ? 0.07 : 0) - beamMat.opacity) * Math.min(1, d * 5);
    coreMat.opacity = beamMat.opacity * 0.9; dustMat.opacity = beamMat.opacity * 7;
    for (let i = 0; i < DUST; i++) {
      dU[i] += dS[i] * d * 0.12; if (dU[i] > 1) dU[i] -= 1;
      const u = dU[i], r = (0.12 + (SCREEN_W * 0.4 - 0.12) * u) * dR[i] * 0.95, a = dA[i] + el * 0.12;
      dustPos[i * 3] = beamStart.x + beamDir.x * u + bRight.x * Math.cos(a) * r + bUp.x * Math.sin(a) * r;
      dustPos[i * 3 + 1] = beamStart.y + beamDir.y * u + bRight.y * Math.cos(a) * r + bUp.y * Math.sin(a) * r;
      dustPos[i * 3 + 2] = beamStart.z + beamDir.z * u + bRight.z * Math.cos(a) * r + bUp.z * Math.sin(a) * r;
    }
    dustGeo.attributes.position.needsUpdate = true;
    flick += d * (state.playing ? 9 : 3);
    screenGlow.intensity += ((state.playing ? 6.5 + Math.sin(flick) * 1.7 + Math.sin(flick * 2.7) * 0.7 : 0) - screenGlow.intensity) * Math.min(1, d * 6);
    bounce.intensity = screenGlow.intensity * 0.4;
    controlBtns.forEach((b) => {
      const mat = b.material as THREE.MeshStandardMaterial; const a = b.userData.controlAction as TheaterAction;
      mat.emissiveIntensity = a === "play" ? (state.playing ? 1.8 + Math.sin(el * 6) * 0.5 : 0.6) : a === "lights" ? (state.lightsOn ? (state.dimMode ? 0.6 : 1.7) : 0.22) : a === "mute" ? (state.muted ? 0.18 : 1.3) : a === "dim" ? (state.dimMode ? 2.0 + Math.sin(el * 4) * 0.4 : 0.5) : 0.95;
    });
    filmAcc += d; if (!options.videoTexture && filmAcc > 1 / 24) { drawFilm(el, state.playing); filmAcc = 0; }
  };
  const loop = () => { raf = requestAnimationFrame(loop); const now = performance.now(); const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; elapsed += dt; tick(dt, elapsed); };
  raf = requestAnimationFrame(loop);

  const dispose = () => { cancelAnimationFrame(raf); scene.remove(root); owned.forEach((d) => d.dispose()); for (let i = seatMeshes.length - 1; i >= 0; i--) if (!seatMeshes[i].parent) seatMeshes.splice(i, 1); for (let i = floorMeshes.length - 1; i >= 0; i--) if (!floorMeshes[i].parent) floorMeshes.splice(i, 1); };
  return handle;
}