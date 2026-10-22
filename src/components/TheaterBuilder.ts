import * as THREE from "three";
import { HALL } from "@/lib/gallery";
import { velvet } from "@/lib/textures";

/* ═══════════════════════════════════════════════════════════════
   1. HELPERS
   ═══════════════════════════════════════════════════════════════ */

const _boxCache = new Map<string, THREE.BoxGeometry>();
function boxGeo(w: number, h: number, d: number) {
  const k = `${w}|${h}|${d}`;
  let g = _boxCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); _boxCache.set(k, g); }
  return g;
}
function cylGeo(rt: number, rb: number, h: number, seg = 16, open = false) {
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
/** merge geometries with baked vertex colours → 1 mesh, 1 draw call */
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
/** make an object invisible to raycasting so it can never steal a click */
function noPick(o: THREE.Object3D) {
  (o as any).raycast = () => {};
  o.traverse((c) => { (c as any).raycast = () => {}; });
}
/** restore picking on control buttons after a noPick() pass */
function enablePick(o: THREE.Object3D) {
  o.traverse((c) => { if (c.userData?.isControlBtn) (c as any).raycast = THREE.Mesh.prototype.raycast; });
}

/* ── local signage: DARK plate + light text (never a white slab) ── */
function makeSignTexture(o: {
  title: string; sub?: string; w?: number; h?: number;
  bg?: string; fg?: string; accent?: string; titleSize?: number;
}) {
  const w = o.w ?? 512, h = o.h ?? 128;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d")!;
  x.fillStyle = o.bg ?? "#0a0a0c";
  x.fillRect(0, 0, w, h);
  const grd = x.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "rgba(255,255,255,0.07)");
  grd.addColorStop(1, "rgba(0,0,0,0.25)");
  x.fillStyle = grd; x.fillRect(0, 0, w, h);
  x.strokeStyle = o.accent ?? "#c09a4a";
  x.lineWidth = Math.max(2, w * 0.005);
  x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth);
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillStyle = o.fg ?? "#f3eee3";
  x.font = `600 ${Math.round(h * (o.titleSize ?? 0.42))}px Georgia, "Times New Roman", serif`;
  x.fillText(o.title, w / 2, o.sub ? h * 0.40 : h * 0.52);
  if (o.sub) {
    x.font = `300 ${Math.round(h * 0.19)}px Helvetica, Arial, sans-serif`;
    x.fillStyle = "rgba(243,238,227,0.6)";
    x.fillText(o.sub, w / 2, h * 0.71);
  }
  const t = new THREE.CanvasTexture(c);
  const srgb = (THREE as any).SRGBColorSpace;
  if (srgb) t.colorSpace = srgb;
  t.anisotropy = 4;
  return t;
}

/* ═══════════════════════════════════════════════════════════════
   2. TYPES
   ═══════════════════════════════════════════════════════════════ */

export type TheaterAction = "play" | "upload" | "mute" | "lights";
export interface TheaterState { playing?: boolean; muted?: boolean; lightsOn?: boolean; progress?: number; }
export interface TheaterOptions { videoTexture?: THREE.Texture | null; }

export interface TheaterHandle {
  theaterLights: THREE.Light[];
  screenGlow: THREE.PointLight;
  beamMat: THREE.MeshBasicMaterial;
  controlBtns: THREE.Mesh[];
  /** button meshes + their invisible hit pads (best target for a raycaster) */
  controlHitTargets: THREE.Mesh[];
  root: THREE.Group;
  screen: THREE.Mesh;
  screenMaterial: THREE.MeshBasicMaterial;
  beam: THREE.Mesh;
  dust: THREE.Points;
  houseLights: THREE.PointLight[];
  console: THREE.Group;
  state: { playing: boolean; muted: boolean; lightsOn: boolean };
  press: (action: TheaterAction) => void;
  setState: (s: TheaterState) => void;
  onControl?: (action: TheaterAction, theater: TheaterHandle) => void;
  /** walk-surface height (smooth aisle ramp) at a given z */
  heightAt: (z: number) => number;
  /** stepped surface height (seat blocks) at a given z */
  stepHeightAt: (z: number) => number;
  update: (dt: number, elapsed: number, state?: TheaterState) => void;
  dispose: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   3. BUILD
   ═══════════════════════════════════════════════════════════════ */

export function buildTheater(
  scene: THREE.Scene,
  seatMeshes: THREE.Mesh[],
  floorMeshes: THREE.Mesh[],
  offsetX: number = 0,
  options: TheaterOptions = {},
): TheaterHandle {
  const root = new THREE.Group();
  root.name = "theater";
  scene.add(root);
  const add = <T extends THREE.Object3D>(o: T): T => { root.add(o); return o; };
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T) => { owned.push(x); return x; };

  /* ─────────────── DIMENSIONS (IMAX single-volume bowl) ─────────────── */
  const W_HALF = 11;                    // room half width  (22 m)
  const Z_FRONT = -42.0;                // screen wall inner face
  const Z_BACK = -17.0;                 // rear wall inner face (entry door)
  const CEIL = Math.max(12, Math.min(17, (HALL?.h ?? 12) + 4));
  const PIT_Y = -5.2;                   // lowest floor (screen pit)
  const CONC_Y = 0.0;                   // concourse / gallery level
  const DOOR_W = 4.6, DOOR_H = 3.0;

  const ROWS = 12, TREAD = 1.10;
  const RISE = (CONC_Y - PIT_Y) / ROWS;         // 0.4333 m per row
  const Z_R0 = -37.6;                            // front edge of row 0
  const Z_R1 = Z_R0 + ROWS * TREAD;              // -24.4  top of the rake

  const AISLE_C = 3.0;                           // centre aisle width
  const AISLE_S = 2.0;                           // side aisle width
  const BLOCK_IN = AISLE_C / 2;                  // 1.5
  const BLOCK_OUT = W_HALF - AISLE_S;            // 9.0
  const SEAT_PITCH = 1.05;
  const SEAT_XS: number[] = [];
  for (let s = 0; s < 7; s++) { const x = 2.15 + s * SEAT_PITCH; SEAT_XS.push(-x, x); }
  SEAT_XS.sort((a, b) => a - b);

  const SCREEN_W = 18.4, SCREEN_H = 12.8, SCREEN_R = 90;
  const SCREEN_Z = -41.4;
  const SCREEN_BOT = PIT_Y + 1.6;
  const SCREEN_CY = SCREEN_BOT + SCREEN_H / 2;
  const halfArc = Math.asin((SCREEN_W / 2) / SCREEN_R);

  /* ─────────────── MATERIALS ─────────────── */
  const INK = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5, metalness: 0.3 });
  const DARK_WOOD = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.6, metalness: 0.05 });
  const PANEL = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.78, metalness: 0.04 });
  const PANEL2 = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.7, metalness: 0.04 });
  const BRASS = new THREE.MeshStandardMaterial({ color: 0xc09a4a, roughness: 0.26, metalness: 0.95 });
  const BRASS_D = new THREE.MeshStandardMaterial({ color: 0x6a5224, roughness: 0.4, metalness: 0.9 });
  const WALL = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.96 });
  const CEILM = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.97 });
  const CARPET = new THREE.MeshStandardMaterial({ map: tiled(velvet("#191014"), 6, 6), roughness: 0.97, color: 0x3a2026 });
  const RUNNER = new THREE.MeshStandardMaterial({ map: tiled(velvet("#5c1010"), 1, 14), roughness: 0.95, color: 0x8a1c1c });
  const SEAT_MAT = new THREE.MeshPhysicalMaterial({
    map: tiled(velvet("#3c0c0c"), 1, 1), vertexColors: true, color: 0xffffff,
    roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xd03030), sheenRoughness: 0.55,
    clearcoat: 0.08, clearcoatRoughness: 0.8, envMapIntensity: 0.1,
  });
  const MATTE_BLACK = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 1, metalness: 0 });
  owned.push(INK, DARK_WOOD, PANEL, PANEL2, BRASS, BRASS_D, WALL, CEILM, CARPET, RUNNER, SEAT_MAT, MATTE_BLACK);

  /* ═══════════════════════════════════════════════════════════════
     4. FLOOR — explicit step boxes (walkable) + sloped aisle ramps
     ═══════════════════════════════════════════════════════════════ */

  const stepTop = (i: number) => PIT_Y + (i + 1) * RISE;
  const stepZ0 = (i: number) => Z_R0 + i * TREAD;

  /** solid block whose TOP sits at `top` and which extends down to the base */
  const mkBlock = (w: number, d: number, z0: number, top: number, mat: THREE.Material) => {
    const base = PIT_Y - 0.4;
    const h = top - base;
    const m = add(new THREE.Mesh(boxGeo(w, h, d), mat));
    m.position.set(offsetX, top - h / 2, z0 + d / 2);
    m.receiveShadow = true;
    floorMeshes.push(m);
    return m;
  };

  // pit (front) + concourse (rear, at gallery level)
  mkBlock(W_HALF * 2, Z_R0 - Z_FRONT, Z_FRONT, PIT_Y, CARPET);
  mkBlock(W_HALF * 2, Z_BACK - Z_R1, Z_R1, CONC_Y, CARPET);
  // sub-floor slab so nothing shows through
  const sub = add(new THREE.Mesh(boxGeo(W_HALF * 2 + 1.4, 0.6, Z_BACK - Z_FRONT + 1.4), MATTE_BLACK));
  sub.position.set(offsetX, PIT_Y - 0.7, (Z_FRONT + Z_BACK) / 2);

  // stepped seating blocks (aisles are left open for the ramps)
  const BLOCK_W = BLOCK_OUT - BLOCK_IN;
  const BLOCK_C = (BLOCK_OUT + BLOCK_IN) / 2;
  for (let i = 0; i < ROWS; i++) {
    mkBlock(BLOCK_W, TREAD, stepZ0(i), stepTop(i), CARPET);
    const m2 = add(new THREE.Mesh(boxGeo(BLOCK_W, stepTop(i) - (PIT_Y - 0.4), TREAD), CARPET));
    m2.position.set(offsetX - BLOCK_C, stepTop(i) - (stepTop(i) - (PIT_Y - 0.4)) / 2, stepZ0(i) + TREAD / 2);
    m2.receiveShadow = true;
    floorMeshes.push(m2);
  }

  // sloped aisle ramps (centre + both sides) — smooth walking
  const RAMP_ANGLE = Math.atan2(CONC_Y - PIT_Y, Z_R1 - Z_R0);
  const RAMP_LEN = Math.hypot(CONC_Y - PIT_Y, Z_R1 - Z_R0);
  const mkRamp = (w: number, cx: number, mat: THREE.Material, collider: boolean) => {
    const m = add(new THREE.Mesh(boxGeo(w, 0.14, RAMP_LEN), mat));
    m.rotation.x = -RAMP_ANGLE;
    m.position.set(offsetX + cx, (PIT_Y + CONC_Y) / 2 - 0.07 / Math.cos(RAMP_ANGLE),
      (Z_R0 + Z_R1) / 2 + (CONC_Y - PIT_Y) / 2 / Math.tan(RAMP_ANGLE));
    m.receiveShadow = true;
    if (collider) floorMeshes.push(m);
    return m;
  };
  mkRamp(AISLE_C, 0, RUNNER, true);
  mkRamp(AISLE_S, (BLOCK_OUT + W_HALF) / 2, RUNNER, true);
  mkRamp(AISLE_S, -(BLOCK_OUT + W_HALF) / 2, RUNNER, true);

  /* ═══════════════════════════════════════════════════════════════
     5. SHELL — walls must reach BELOW the pit (no light leak)
     ═══════════════════════════════════════════════════════════════ */
  const WALL_BOT = PIT_Y - 0.8;
  const wallH = CEIL - WALL_BOT;
  const wallCY = (CEIL + WALL_BOT) / 2;
  const mkWall = (w: number, d: number, x: number, z: number) => {
    const m = add(new THREE.Mesh(boxGeo(w, wallH, d), WALL));
    m.position.set(offsetX + x, wallCY, z);
    return m;
  };
  mkWall(W_HALF * 2 + 1.4, 0.7, 0, Z_FRONT - 0.35);                      // screen wall
  mkWall(0.7, Z_BACK - Z_FRONT, -(W_HALF + 0.35), (Z_FRONT + Z_BACK) / 2);
  mkWall(0.7, Z_BACK - Z_FRONT, W_HALF + 0.35, (Z_FRONT + Z_BACK) / 2);
  // rear wall with a real door opening, nothing in front of it
  const segW = (W_HALF * 2 + 0.7 - DOOR_W) / 2;
  mkWall(segW, 0.7, -(DOOR_W / 2 + segW / 2), Z_BACK + 0.35);
  mkWall(segW, 0.7, DOOR_W / 2 + segW / 2, Z_BACK + 0.35);
  mkWall(DOOR_W, CEIL - DOOR_H, 0, Z_BACK + 0.35).position.set(
    offsetX, (DOOR_H + CEIL) / 2, Z_BACK + 0.35);

  // door frame + lit soffit
  const lintel = add(new THREE.Mesh(boxGeo(DOOR_W + 0.6, 0.3, 0.95), BRASS_D));
  lintel.position.set(offsetX, DOOR_H, Z_BACK + 0.3);
  for (const s of [-1, 1]) {
    const j = add(new THREE.Mesh(boxGeo(0.26, DOOR_H, 0.95), BRASS_D));
    j.position.set(offsetX + s * (DOOR_W / 2 + 0.13), DOOR_H / 2, Z_BACK + 0.3);
  }
  const soffitMat = new THREE.MeshStandardMaterial({
    color: 0x101014, emissive: 0xffd9a0, emissiveIntensity: 1.5, roughness: 0.5,
  });
  owned.push(soffitMat);
  const soffit = add(new THREE.Mesh(boxGeo(DOOR_W + 0.4, 0.08, 0.7), soffitMat));
  soffit.position.set(offsetX, DOOR_H + 0.22, Z_BACK + 0.55);

  // vestibule + corridor back to the gallery (all at y = 0)
  const vest = add(new THREE.Mesh(new THREE.PlaneGeometry(W_HALF * 2, 3.6), RUNNER));
  vest.rotation.x = -Math.PI / 2; vest.position.set(offsetX, 0.03, Z_BACK + 1.8);
  floorMeshes.push(vest);
  const corridor = add(new THREE.Mesh(new THREE.PlaneGeometry(5.0, 7.6), RUNNER));
  corridor.rotation.x = -Math.PI / 2; corridor.position.set(offsetX, 0.03, Z_BACK - 4.0);
  floorMeshes.push(corridor);

  // ceiling + coffers
  const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(W_HALF * 2, Z_BACK - Z_FRONT), CEILM));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(offsetX, CEIL, (Z_FRONT + Z_BACK) / 2);
  const dummy = new THREE.Object3D();
  const coff = new THREE.InstancedMesh(boxGeo(0.26, 0.34, Z_BACK - Z_FRONT), INK, 7);
  for (let i = 0; i < 7; i++) {
    dummy.position.set(offsetX - 8.4 + i * 2.8, CEIL - 0.18, (Z_FRONT + Z_BACK) / 2);
    dummy.scale.set(1, 1, 1); dummy.updateMatrix(); coff.setMatrixAt(i, dummy.matrix);
  }
  coff.instanceMatrix.needsUpdate = true; add(coff);

  /* ═══════════════════════════════════════════════════════════════
     6. ACOUSTICS
     ═══════════════════════════════════════════════════════════════ */
  const fluteGeo = boxGeo(0.18, 5.2, 0.26);
  const flutes = new THREE.InstancedMesh(fluteGeo, PANEL2, 84);
  let fi = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 42; i++) {
      dummy.position.set(offsetX + side * (W_HALF - 0.14), 4.2, Z_BACK - 1.0 - i * 0.55);
      dummy.scale.set(1, 1, 1); dummy.updateMatrix(); flutes.setMatrixAt(fi++, dummy.matrix);
    }
  }
  flutes.instanceMatrix.needsUpdate = true; add(flutes);
  const cloud = new THREE.InstancedMesh(boxGeo(1.2, 0.2, 1.2), PANEL, 48);
  let ci = 0;
  for (let a = 0; a < 6; a++) for (let b = 0; b < 8; b++) {
    dummy.position.set(offsetX - 7.1 + a * 2.85, CEIL - 0.6, Z_BACK - 2.4 - b * 2.6);
    dummy.scale.set(1, 1, 1); dummy.updateMatrix(); cloud.setMatrixAt(ci++, dummy.matrix);
  }
  cloud.instanceMatrix.needsUpdate = true; add(cloud);

  /* ═══════════════════════════════════════════════════════════════
     7. THE SCREEN — concave cylinder segment, correct winding
     ═══════════════════════════════════════════════════════════════ */
  const srgb = (THREE as any).SRGBColorSpace;
  const filmCanvas = document.createElement("canvas");
  filmCanvas.width = 1024; filmCanvas.height = 576;
  const fctx = filmCanvas.getContext("2d")!;
  const filmTex = new THREE.CanvasTexture(filmCanvas);
  if (srgb) filmTex.colorSpace = srgb;
  own(filmTex);

  let screenMap: THREE.Texture = filmTex;
  if (options.videoTexture) {
    const vt = options.videoTexture.clone();
    vt.needsUpdate = true;
    if (srgb) vt.colorSpace = srgb;
    screenMap = vt; own(vt);
  }
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenMap, toneMapped: false });
  own(screenMaterial);

  // NOTE: no rotateY. The arc sits on +Z of the cylinder, so the centre of the
  // cylinder goes BEHIND the wall → the screen curves AROUND the audience.
  const mkArc = (r: number, h: number, segs = 72) =>
    new THREE.CylinderGeometry(r, r, h, segs, 1, true, -halfArc, halfArc * 2);

  const screenGeo = own(mkArc(SCREEN_R, SCREEN_H, 96));
  const screen = add(new THREE.Mesh(screenGeo, screenMaterial));
  screen.position.set(offsetX, SCREEN_CY, SCREEN_Z - SCREEN_R);
  screen.name = "theater-screen";

  // masking bands (same construction → same facing)
  const mkBand = (r: number, h: number, y: number, mat: THREE.Material) => {
    const g = own(mkArc(r, h));
    const m = add(new THREE.Mesh(g, mat));
    m.position.set(offsetX, y, SCREEN_Z - SCREEN_R);
    return m;
  };
  mkBand(SCREEN_R + 0.02, 0.5, SCREEN_CY + SCREEN_H / 2 + 0.25, MATTE_BLACK);
  mkBand(SCREEN_R + 0.02, 0.5, SCREEN_CY - SCREEN_H / 2 - 0.25, MATTE_BLACK);
  mkBand(SCREEN_R + 0.16, 0.1, SCREEN_CY + SCREEN_H / 2 + 0.55, BRASS_D);
  mkBand(SCREEN_R + 0.16, 0.1, SCREEN_CY - SCREEN_H / 2 - 0.55, BRASS_D);

  // side masking + brass reveal, tilted to match the curve
  const edgeX = SCREEN_R * Math.sin(halfArc);
  const edgeZ = SCREEN_Z - SCREEN_R + SCREEN_R * Math.cos(halfArc);
  for (const s of [-1, 1]) {
    const m = add(new THREE.Mesh(boxGeo(0.45, SCREEN_H + 1.0, 0.3), MATTE_BLACK));
    m.position.set(offsetX + s * (edgeX + 0.24), SCREEN_CY, edgeZ + 0.1);
    m.rotation.y = -s * halfArc;
    const f = add(new THREE.Mesh(boxGeo(0.1, SCREEN_H + 1.1, 0.34), BRASS_D));
    f.position.set(offsetX + s * (edgeX + 0.48), SCREEN_CY, edgeZ + 0.12);
    f.rotation.y = -s * halfArc;
  }
  // black scrim behind everything (kills any bleed-through)
  const scrim = add(new THREE.Mesh(boxGeo(W_HALF * 2 + 1.2, CEIL + 4, 0.5), MATTE_BLACK));
  scrim.position.set(offsetX, CEIL / 2 - 1, Z_FRONT - 0.9);

  // proscenium frame
  const openH = SCREEN_H + 1.6, openW = SCREEN_W + 1.4;
  for (const s of [-1, 1]) {
    const p = add(new THREE.Mesh(boxGeo(0.9, openH, 0.9), DARK_WOOD));
    p.position.set(offsetX + s * (openW / 2 + 0.45), SCREEN_CY, SCREEN_Z + 0.9);
    const t = add(new THREE.Mesh(boxGeo(0.12, openH, 0.96), BRASS_D));
    t.position.set(offsetX + s * (openW / 2 + 0.92), SCREEN_CY, SCREEN_Z + 0.9);
  }
  const head = add(new THREE.Mesh(boxGeo(openW + 2.6, 1.0, 0.9), DARK_WOOD));
  head.position.set(offsetX, SCREEN_CY + openH / 2 + 0.5, SCREEN_Z + 0.9);

  // IMAX wordmark (dark plate, lit)
  const logoTex = own(makeSignTexture({ title: "IMAX", sub: "THE RITZ PICTURE HOUSE", w: 1024, h: 256, bg: "#08080a" }));
  const logoMat = own(new THREE.MeshBasicMaterial({ map: logoTex, toneMapped: false }));
  const logo = add(new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.25), logoMat));
  logo.position.set(offsetX, SCREEN_CY + SCREEN_H / 2 + 1.35, SCREEN_Z + 0.5);
  noPick(logo);

  /* ═══════════════════════════════════════════════════════════════
     8. SEATING — correct orientation (backrest at +Z, faces screen)
     ═══════════════════════════════════════════════════════════════ */
  const cp = new THREE.Shape();
  cp.moveTo(0.00, 0.00);   // front bottom
  cp.lineTo(0.78, 0.00);   // rear bottom
  cp.lineTo(0.78, 1.16);   // rear top of backrest
  cp.lineTo(0.60, 1.16);   // front face top
  cp.lineTo(0.60, 0.47);   // front face down to the seat pan
  cp.lineTo(0.00, 0.47);   // seat pan front edge
  cp.closePath();

  const shellG = own(new THREE.ExtrudeGeometry(cp, {
    depth: 0.66, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 2, curveSegments: 1,
  }));
  shellG.rotateY(-Math.PI / 2);        // profile depth d → world +Z (rear)
  shellG.translate(0.33, 0, -0.30);    // centre the width, centre the pan

  const armL = own(new THREE.BoxGeometry(0.08, 0.10, 0.58)); armL.translate(-0.30, 0.71, -0.06);
  const armR = own(new THREE.BoxGeometry(0.08, 0.10, 0.58)); armR.translate(0.30, 0.71, -0.06);
  const chairGeo = own(mergeGeoms([
    { geo: shellG, color: 0xffffff },
    { geo: armL, color: 0x40301f },
    { geo: armR, color: 0x40301f },
  ]));

  const mkChair = (x: number, z: number, y: number, tag: string) => {
    const g = new THREE.Group();
    g.position.set(offsetX + x, y, z);
    const sitPose = { x: offsetX + x, y: y + 0.47, z: z + 0.02, rotY: Math.PI };
    const seat = new THREE.Mesh(chairGeo, SEAT_MAT);
    seat.userData = { isSeat: true, sitPose, seatY: y + 0.47, row: tag };
    g.add(seat);
    seatMeshes.push(seat);
    add(g);
  };
  for (let r = 0; r < ROWS; r++) {
    const z = stepZ0(r) + TREAD * 0.55;
    const y = stepTop(r);
    SEAT_XS.forEach((x) => mkChair(x, z, y, String.fromCharCode(65 + r)));
  }

  // row-letter signs on the side walls
  for (let r = 0; r < ROWS; r++) {
    const tex = own(makeSignTexture({ title: String.fromCharCode(65 + r), sub: "ROW", w: 256, h: 128, bg: "#0a0a0c" }));
    const mat = own(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    for (const s of [-1, 1]) {
      const sign = add(new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), mat));
      sign.position.set(offsetX + s * (W_HALF - 0.2), stepTop(r) + 1.5, stepZ0(r) + TREAD * 0.55);
      sign.rotation.y = s * -Math.PI / 2;
      noPick(sign);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     9. HANDRAILS + STEP LIGHTS
     ═══════════════════════════════════════════════════════════════ */
  const railMat = new THREE.MeshStandardMaterial({ color: 0xb9924a, roughness: 0.28, metalness: 0.95 });
  owned.push(railMat);
  const mkRail = (x: number) => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= ROWS * 2; k++) {
      const t = k / (ROWS * 2);
      pts.push(new THREE.Vector3(offsetX + x, PIT_Y + t * (CONC_Y - PIT_Y) + 0.95, Z_R0 + t * (Z_R1 - Z_R0)));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.05);
    const g = own(new THREE.TubeGeometry(curve, 64, 0.042, 8, false));
    add(new THREE.Mesh(g, railMat));
    for (let k = 0; k <= ROWS; k += 2) {
      const t = k / ROWS;
      const post = new THREE.Mesh(cylGeo(0.032, 0.032, 0.95, 8), railMat);
      post.position.set(offsetX + x, PIT_Y + t * (CONC_Y - PIT_Y) + 0.475, Z_R0 + t * (Z_R1 - Z_R0));
      add(post);
    }
  };
  mkRail(BLOCK_IN + 0.18); mkRail(-(BLOCK_IN + 0.18));
  mkRail(BLOCK_OUT + 0.2); mkRail(-(BLOCK_OUT + 0.2));

  const stepMat = new THREE.MeshStandardMaterial({
    color: 0x2a0a0a, emissive: 0xff2a2a, emissiveIntensity: 0.6, roughness: 0.5,
  });
  owned.push(stepMat);
  for (let i = 0; i < ROWS; i++) {
    for (const x of [0, (BLOCK_OUT + W_HALF) / 2, -(BLOCK_OUT + W_HALF) / 2]) {
      const l = add(new THREE.Mesh(boxGeo(x === 0 ? 2.4 : 1.2, 0.06, 0.05), stepMat));
      l.position.set(offsetX + x, stepTop(i) - 0.03, stepZ0(i) + 0.03);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     10. CONTROL STATIONS
     ═══════════════════════════════════════════════════════════════ */
  const controlBtns: THREE.Mesh[] = [];
  const controlHitTargets: THREE.Mesh[] = [];
  const BTN_DEF: { action: TheaterAction; color: number; label: string }[] = [
    { action: "play", color: 0x2bff57, label: "PLAY" },
    { action: "upload", color: 0xff2b2b, label: "LOAD" },
    { action: "mute", color: 0xffd22b, label: "AUDIO" },
    { action: "lights", color: 0x2bb6ff, label: "HOUSE" },
  ];

  const mkButton = (parent: THREE.Object3D, x: number, y: number, z: number, tilt: number, def: typeof BTN_DEF[number]) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.x = tilt;
    parent.add(g);

    const bezel = own(new THREE.TorusGeometry(0.26, 0.05, 8, 24));
    bezel.rotateX(Math.PI / 2); bezel.translate(0, -0.02, 0);
    const cap = own(new THREE.CylinderGeometry(0.23, 0.23, 0.13, 24));
    cap.translate(0, 0.05, 0);
    const geo = own(mergeGeoms([
      { geo: bezel, color: 0x6a5224 },
      { geo: cap, color: def.color },
    ]));
    const mat = own(new THREE.MeshStandardMaterial({
      vertexColors: true, color: 0xffffff, emissive: def.color, emissiveIntensity: 0.6,
      roughness: 0.28, metalness: 0.1,
    }));
    const btn = new THREE.Mesh(geo, mat);
    btn.userData = { isControlBtn: def.action, controlAction: def.action, action: def.action, label: def.label };
    btn.name = "control-btn";
    g.add(btn);
    controlBtns.push(btn);

    // oversized invisible hit pad → the button is always the first ray hit
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.75), own(new THREE.MeshBasicMaterial({ visible: false })));
    pad.position.set(0, 0.18, 0);
    pad.rotation.x = -Math.PI / 2;
    pad.userData = { isControlBtn: def.action, controlAction: def.action, action: def.action, label: def.label };
    g.add(pad);
    controlHitTargets.push(btn, pad);

    // glow halo (visual only, never picks)
    const halo = new THREE.Mesh(
      own(new THREE.RingGeometry(0.30, 0.40, 28)),
      own(new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }))
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(0, 0.02, 0);
    g.add(halo);
    noPick(halo);
    return btn;
  };

  // (a) pit pedestal — dead centre, low, never blocks the image
  const pitPanel = new THREE.Group();
  pitPanel.position.set(offsetX, PIT_Y, -39.6);
  const pitBody = add(new THREE.Mesh(boxGeo(2.4, 0.85, 0.85), DARK_WOOD));
  pitBody.position.set(offsetX, PIT_Y + 0.42, -39.6);
  noPick(pitBody);
  const pitTop = add(new THREE.Mesh(boxGeo(2.5, 0.07, 0.95), INK));
  pitTop.position.set(offsetX, PIT_Y + 0.87, -39.6);
  noPick(pitTop);
  pitPanel.position.set(offsetX, PIT_Y + 0.92, -39.6);
  pitPanel.rotation.x = -0.5;
  BTN_DEF.forEach((d, i) => mkButton(pitPanel, -0.78 + i * 0.52, 0, 0, 0, d));
  add(pitPanel);
  noPick(pitPanel);
  enablePick(pitPanel);

  // (b) tech desk in the concourse, pushed to the side (the door stays clear)
  const console = new THREE.Group();
  console.name = "theater-console";
  console.position.set(offsetX - 6.6, CONC_Y, -20.4);
  console.rotation.y = 0.5;
  const deskBody = new THREE.Mesh(boxGeo(2.8, 0.86, 0.95), DARK_WOOD);
  deskBody.position.y = 0.43; console.add(deskBody);
  const deskTop = new THREE.Mesh(boxGeo(2.9, 0.08, 1.02), INK);
  deskTop.position.set(0, 0.88, 0); deskTop.rotation.x = 0.26; console.add(deskTop);
  const btnRow = new THREE.Group();
  btnRow.position.set(0, 0.95, 0); btnRow.rotation.x = 0.26; console.add(btnRow);
  BTN_DEF.forEach((d, i) => mkButton(btnRow, -0.78 + i * 0.52, 0, 0, 0, d));
  const signTex = own(makeSignTexture({
    title: "CONTROL DESK", sub: "PLAY · LOAD · AUDIO · HOUSE", w: 1024, h: 160, bg: "#0a0a0c",
  }));
  const signMat = own(new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.42), signMat);
  sign.position.set(0, 0.58, 0.49); sign.rotation.x = -0.26; console.add(sign);
  add(console);
  noPick(console);
  enablePick(console);

  /* ═══════════════════════════════════════════════════════════════
     11. LIGHTING
     ═══════════════════════════════════════════════════════════════ */
  const theaterLights: THREE.Light[] = [];
  const houseLights: THREE.PointLight[] = [];

  const coveMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, emissive: 0x9fd0ff, emissiveIntensity: 1.8, roughness: 0.4 });
  const downMat = new THREE.MeshStandardMaterial({ color: 0x151517, emissive: 0xffd7a0, emissiveIntensity: 1.2, roughness: 0.4 });
  owned.push(coveMat, downMat);

  for (const x of [-7.2, 0, 7.2]) {
    const cove = add(new THREE.Mesh(boxGeo(0.34, 0.1, Z_BACK - Z_FRONT - 2), coveMat));
    cove.position.set(offsetX + x, CEIL - 0.42, (Z_FRONT + Z_BACK) / 2);
    const hs = add(new THREE.Mesh(boxGeo(0.62, 0.24, Z_BACK - Z_FRONT - 2), INK));
    hs.position.set(offsetX + x, CEIL - 0.26, (Z_FRONT + Z_BACK) / 2);
  }
  const lampGeo = own(cylGeo(0.17, 0.22, 0.09, 14));
  const DL: [number, number][] = [
    [0, -38.0], [0, -33.0], [0, -28.0], [0, -23.0], [0, -19.0],
    [-5.0, -35.0], [5.0, -35.0], [-5.0, -27.0], [5.0, -27.0], [-5.0, -21.0], [5.0, -21.0],
  ];
  DL.forEach(([lx, lz], i) => {
    const l = add(new THREE.Mesh(lampGeo, downMat));
    l.position.set(offsetX + lx, CEIL - 0.24, lz);
    if (i % 2 === 0) {
      const pl = new THREE.PointLight(0xffd9ae, 3.2, 17, 2);
      pl.position.set(offsetX + lx, CEIL - 0.75, lz);
      add(pl); theaterLights.push(pl); houseLights.push(pl);
    }
  });
  const screenGlow = new THREE.PointLight(0xaaccff, 0, 46, 1.5);
  screenGlow.position.set(offsetX, SCREEN_CY, SCREEN_Z + 2.6);
  add(screenGlow);
  const bounce = new THREE.PointLight(0x88aaff, 0, 50, 1.3);
  bounce.position.set(offsetX, SCREEN_CY - 2.6, SCREEN_Z + 7);
  add(bounce);
  const deskLight = new THREE.PointLight(0xffc98a, 1.4, 7, 2);
  deskLight.position.set(offsetX - 6.4, CONC_Y + 1.4, -20.1);
  add(deskLight); theaterLights.push(deskLight);

  // exit signs (dark plates)
  const exitTex = own(makeSignTexture({ title: "EXIT", sub: "↔", w: 256, h: 128, bg: "#0a0c0a", accent: "#3ad07a" }));
  const exitMat = own(new THREE.MeshStandardMaterial({
    map: exitTex, emissiveMap: exitTex, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.6,
  }));
  for (const p of [
    [offsetX - 4.8, 2.4, Z_BACK - 0.3, 0],
    [offsetX + 4.8, 2.4, Z_BACK - 0.3, 0],
    [offsetX - (W_HALF - 0.2), 1.8, -30.0, -Math.PI / 2],
    [offsetX + (W_HALF - 0.2), 1.8, -30.0, Math.PI / 2],
  ] as [number, number, number, number][]) {
    const ex = add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), exitMat));
    ex.position.set(p[0], p[1], p[2]); ex.rotation.y = p[3];
    noPick(ex);
  }

  /* ═══════════════════════════════════════════════════════════════
     12. PROJECTOR + VOLUMETRIC BEAM
     ═══════════════════════════════════════════════════════════════ */
  const beamStart = new THREE.Vector3(offsetX, CEIL - 1.6, -20.6);
  const beamEnd = new THREE.Vector3(offsetX, SCREEN_CY, SCREEN_Z + 0.2);
  const beamDir = beamEnd.clone().sub(beamStart);
  const beamLen = beamDir.length();
  const beamQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir.clone().normalize());
  const rNear = 0.12, rFar = SCREEN_W * 0.4;

  const beamGeo = own(cylGeo(rFar, rNear, beamLen, 40, true));
  const beamMat = own(new THREE.MeshBasicMaterial({
    color: 0xe8f4ff, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  }));
  const beam = add(new THREE.Mesh(beamGeo, beamMat));
  beam.position.copy(beamStart).add(beamEnd).multiplyScalar(0.5);
  beam.quaternion.copy(beamQ); beam.renderOrder = 3;

  const coreGeo = own(cylGeo(rFar * 0.36, rNear * 0.5, beamLen, 24, true));
  const coreMat = own(new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  }));
  const core = add(new THREE.Mesh(coreGeo, coreMat));
  core.position.copy(beam.position); core.quaternion.copy(beamQ); core.renderOrder = 4;

  const proj = new THREE.Group();
  proj.position.copy(beamStart);
  proj.add(new THREE.Mesh(boxGeo(1.0, 0.66, 1.6), INK));
  const pLens = new THREE.Mesh(cylGeo(0.18, 0.22, 0.32, 16), BRASS_D);
  pLens.rotation.x = Math.PI / 2; pLens.position.set(0, -0.06, -0.88); proj.add(pLens);
  const pMount = new THREE.Mesh(cylGeo(0.05, 0.05, 1.4, 8), BRASS_D);
  pMount.position.set(0, 0.66, 0); proj.add(pMount);
  proj.lookAt(beamEnd); proj.rotateX(Math.PI / 2);
  add(proj); noPick(proj);

  // dust motes
  const DUST = 460;
  const dustPos = new Float32Array(DUST * 3);
  const dU = new Float32Array(DUST), dR = new Float32Array(DUST);
  const dA = new Float32Array(DUST), dS = new Float32Array(DUST);
  const dr = mulberry32(99);
  for (let i = 0; i < DUST; i++) { dU[i] = dr(); dR[i] = Math.sqrt(dr()); dA[i] = dr() * Math.PI * 2; dS[i] = 0.004 + dr() * 0.012; }
  const dustGeo = own(new THREE.BufferGeometry());
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = own(new THREE.PointsMaterial({
    color: 0xfff4d8, size: 0.05, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  const dust = add(new THREE.Points(dustGeo, dustMat));
  dust.frustumCulled = false; dust.renderOrder = 5;
  const bRight = new THREE.Vector3(1, 0, 0).cross(beamDir.clone().normalize()).normalize();
  const bUp = beamDir.clone().normalize().cross(bRight).normalize();

  /* ═══════════════════════════════════════════════════════════════
     13. FILM
     ═══════════════════════════════════════════════════════════════ */
  const skyline: { w: number; h: number; lit: number }[][] = [[], [], []];
  const sr = mulberry32(1337);
  for (let L = 0; L < 3; L++) {
    let x = 0;
    while (x < 1100) {
      const w = 30 + sr() * 70, h = 40 + sr() * (150 - L * 35);
      skyline[L].push({ w, h, lit: sr() }); x += w + 6;
    }
  }
  const grain = document.createElement("canvas");
  grain.width = 64; grain.height = 64;
  const gx = grain.getContext("2d")!;
  const gi = gx.createImageData(64, 64);
  for (let i = 0; i < gi.data.length; i += 4) {
    const v = 120 + Math.random() * 135;
    gi.data[i] = gi.data[i + 1] = gi.data[i + 2] = v; gi.data[i + 3] = 255;
  }
  gx.putImageData(gi, 0, 0);

  const drawFilm = (t: number, playing: boolean) => {
    const W = 1024, H = 576;
    fctx.clearRect(0, 0, W, H);
    if (!playing) {
      fctx.fillStyle = "#0d0f14"; fctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, R = 205;
      fctx.strokeStyle = "rgba(200,210,225,0.28)"; fctx.lineWidth = 3;
      fctx.beginPath(); fctx.arc(cx, cy, R, 0, Math.PI * 2); fctx.stroke();
      fctx.beginPath(); fctx.arc(cx, cy, R * 0.62, 0, Math.PI * 2); fctx.stroke();
      fctx.beginPath(); fctx.moveTo(cx - R, cy); fctx.lineTo(cx + R, cy);
      fctx.moveTo(cx, cy - R); fctx.lineTo(cx, cy + R); fctx.stroke();
      const phase = t % 3.4;
      const n = Math.max(1, Math.ceil(3.4 - phase));
      const frac = 1 - ((phase % 1.4) / 1.4);
      fctx.save(); fctx.translate(cx, cy); fctx.rotate(-frac * Math.PI * 2);
      fctx.fillStyle = "rgba(220,228,240,0.22)";
      fctx.beginPath(); fctx.moveTo(0, 0); fctx.arc(0, 0, R, 0, Math.PI * 2); fctx.fill();
      fctx.restore();
      fctx.textAlign = "center"; fctx.textBaseline = "middle";
      fctx.fillStyle = "rgba(235,240,250,0.85)";
      fctx.font = "700 200px Georgia, serif";
      fctx.fillText(String(n), cx, cy + 6);
      fctx.font = "300 24px Helvetica, Arial, sans-serif";
      fctx.fillStyle = "rgba(200,210,225,0.5)";
      fctx.fillText("PICTURE  START", cx, cy + R + 50);
    } else {
      const sky = fctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#050d2c"); sky.addColorStop(0.55, "#3a1a4e"); sky.addColorStop(1, "#c2762f");
      fctx.fillStyle = sky; fctx.fillRect(0, 0, W, H);
      fctx.beginPath(); fctx.arc(760, 120, 50, 0, Math.PI * 2);
      fctx.fillStyle = "rgba(255,238,200,0.9)"; fctx.fill();
      fctx.save(); fctx.translate(120, H); fctx.rotate(Math.sin(t * 0.5) * 0.6 - 1.2);
      const g2 = fctx.createLinearGradient(0, 0, 0, -H * 1.4);
      g2.addColorStop(0, "rgba(255,255,255,0.2)"); g2.addColorStop(1, "rgba(255,255,255,0)");
      fctx.fillStyle = g2; fctx.beginPath(); fctx.moveTo(-26, 0); fctx.lineTo(26, 0);
      fctx.lineTo(120, -H * 1.4); fctx.lineTo(-120, -H * 1.4); fctx.closePath(); fctx.fill(); fctx.restore();
      const cols = ["#05060c", "#0a0b14", "#11121d"];
      for (let L = 0; L < 3; L++) {
        const speed = 10 + L * 26, off = -((t * speed) % 1100), base = H * (0.62 + L * 0.09);
        fctx.fillStyle = cols[L];
        for (let rep = 0; rep < 2; rep++) {
          let x = off + rep * 1100;
          for (const b of skyline[L]) {
            fctx.fillRect(x, base - b.h, b.w, b.h + 200);
            for (let wy = base - b.h + 8; wy < base - 6; wy += 11)
              for (let wx = x + 4; wx < x + b.w - 6; wx += 9)
                if ((wx * 7 + wy * 13 + b.lit * 100) % 5 < 1.6) {
                  fctx.fillStyle = "rgba(255,205,120,0.5)"; fctx.fillRect(wx, wy, 3, 4); fctx.fillStyle = cols[L];
                }
            x += b.w + 6;
          }
        }
      }
      fctx.save(); fctx.globalAlpha = 0.06; fctx.globalCompositeOperation = "overlay";
      fctx.translate(-Math.random() * 64, -Math.random() * 64);
      fctx.fillStyle = fctx.createPattern(grain, "repeat")!; fctx.fillRect(0, 0, W + 64, H + 64); fctx.restore();
      fctx.fillStyle = "rgba(0,0,0,0.09)"; for (let y = 0; y < H; y += 3) fctx.fillRect(0, y, W, 1);
      const vg = fctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.6)");
      fctx.fillStyle = vg; fctx.fillRect(0, 0, W, H);
      fctx.textAlign = "center";
      fctx.fillStyle = "rgba(255,255,255,0.8)"; fctx.font = "600 40px Georgia, serif";
      fctx.fillText("THE RITZ PICTURE HOUSE", W / 2, 92);
      fctx.font = "300 20px Helvetica, Arial, sans-serif"; fctx.fillStyle = "rgba(255,255,255,0.42)";
      fctx.fillText("NOW SHOWING", W / 2, 124);
    }
    filmTex.needsUpdate = true;
  };
  drawFilm(0, false);

  /* ═══════════════════════════════════════════════════════════════
     14. STATE / BUTTONS / UPDATE
     ═══════════════════════════════════════════════════════════════ */
  const state = { playing: false, muted: false, lightsOn: true };
  const houseBase = houseLights.map((l) => l.intensity);
  let flick = 0;

  const applyLights = () => {
    const on = state.lightsOn;
    const dim = state.playing ? 0.6 : 1;
    houseLights.forEach((l, i) => { l.intensity = houseBase[i] * (on ? dim : 0); });
    coveMat.emissiveIntensity = on ? 1.9 : 0;
    downMat.emissiveIntensity = on ? 1.2 : 0;
    stepMat.emissiveIntensity = on ? 0.5 : 2.4;    // aisle safety lights
    exitMat.emissiveIntensity = on ? 1.6 : 2.6;
    soffitMat.emissiveIntensity = on ? 1.5 : 0.4;
    deskLight.intensity = on ? 1.4 : 0.6;
  };
  applyLights();

  const handle: TheaterHandle = {
    theaterLights, screenGlow, beamMat, controlBtns, controlHitTargets,
    root, screen, screenMaterial, beam, dust, houseLights, console, state,
    press: (a) => press(a),
    setState: (s) => { Object.assign(state, s); applyLights(); },
    onControl: undefined,
    heightAt: (z) => {
      const t = Math.max(0, Math.min(1, (z - Z_R0) / (Z_R1 - Z_R0)));
      return PIT_Y + t * (CONC_Y - PIT_Y);
    },
    stepHeightAt: (z) => {
      if (z <= Z_R0) return PIT_Y;
      if (z >= Z_R1) return CONC_Y;
      const i = Math.floor((z - Z_R0) / TREAD);
      return stepTop(i);
    },
    update: (dt, el, s) => update(dt, el, s),
    dispose: () => dispose(),
  };

  const press = (action: TheaterAction) => {
    switch (action) {
      case "play": state.playing = !state.playing; break;
      case "mute": state.muted = !state.muted; break;
      case "lights": state.lightsOn = !state.lightsOn; break;
      case "upload": break;
    }
    applyLights();
    handle.onControl?.(action, handle);
    window.dispatchEvent(new CustomEvent("theater-control", { detail: { action, theater: handle } }));
  };

  // host state merged with CHANGE DETECTION → a button press can never be stomped
  const lastHost: Record<string, unknown> = {};
  const mergeHost = (s: TheaterState) => {
    let changed = false;
    (Object.keys(s) as (keyof TheaterState)[]).forEach((k) => {
      const v = s[k];
      if (v === undefined || lastHost[k] === v) return;
      lastHost[k] = v;
      (state as any)[k] = v;
      changed = true;
    });
    if (changed) applyLights();
  };

  let raf = 0, lastT = performance.now(), elapsed = 0, filmAcc = 0;

  const tick = (dt: number, el: number) => {
    const d = Math.min(dt, 0.1);

    const target = state.playing ? 0.07 : 0;
    beamMat.opacity += (target - beamMat.opacity) * Math.min(1, d * 5);
    coreMat.opacity = beamMat.opacity * 0.9;
    dustMat.opacity = beamMat.opacity * 7;
    for (let i = 0; i < DUST; i++) {
      dU[i] += dS[i] * d * 0.12; if (dU[i] > 1) dU[i] -= 1;
      const u = dU[i], r = (rNear + (rFar - rNear) * u) * dR[i] * 0.95, a = dA[i] + el * 0.12;
      dustPos[i * 3] = beamStart.x + beamDir.x * u + bRight.x * Math.cos(a) * r + bUp.x * Math.sin(a) * r;
      dustPos[i * 3 + 1] = beamStart.y + beamDir.y * u + bRight.y * Math.cos(a) * r + bUp.y * Math.sin(a) * r;
      dustPos[i * 3 + 2] = beamStart.z + beamDir.z * u + bRight.z * Math.cos(a) * r + bUp.z * Math.sin(a) * r;
    }
    dustGeo.attributes.position.needsUpdate = true;

    flick += d * (state.playing ? 9 : 3);
    const lum = state.playing ? 6.5 + Math.sin(flick) * 1.7 + Math.sin(flick * 2.7) * 0.7 : 0;
    screenGlow.intensity += (lum - screenGlow.intensity) * Math.min(1, d * 6);
    bounce.intensity = screenGlow.intensity * 0.4;

    controlBtns.forEach((b) => {
      const mat = b.material as THREE.MeshStandardMaterial;
      const a = b.userData.controlAction as TheaterAction;
      mat.emissiveIntensity =
        a === "play" ? (state.playing ? 1.8 + Math.sin(el * 6) * 0.5 : 0.6)
          : a === "lights" ? (state.lightsOn ? 1.7 : 0.22)
            : a === "mute" ? (state.muted ? 0.18 : 1.3)
              : 0.95;
    });

    filmAcc += d;
    if (!options.videoTexture && filmAcc > 1 / 24) { drawFilm(el, state.playing); filmAcc = 0; }
  };

  const update = (dt: number, el: number, s?: TheaterState) => {
    if (s) mergeHost(s);
    tick(dt, el);
  };

  // self-driven loop so the room animates even if the host never calls update()
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now; elapsed += dt;
    tick(dt, elapsed);
  };
  raf = requestAnimationFrame(loop);

  const dispose = () => {
    cancelAnimationFrame(raf);
    scene.remove(root);
    owned.forEach((d) => d.dispose());
    for (let i = seatMeshes.length - 1; i >= 0; i--) if (!seatMeshes[i].parent) seatMeshes.splice(i, 1);
    for (let i = floorMeshes.length - 1; i >= 0; i--) if (!floorMeshes[i].parent) floorMeshes.splice(i, 1);
  };

  return handle;
}