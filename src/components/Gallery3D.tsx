"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HALL, getSlotPose, type ExhibitDTO, type Gender, type PlayerDTO } from "@/lib/gallery";
import { makeAvatar, triggerEmote, type AvatarParts } from "./avatar-model";
import { buildTheater } from "./TheaterBuilder";
import {
  marble, plaqueTexture, plaster, rugTexture, shaftTexture, signTexture,
  skylightTexture, softDot, velvet, wallTextTexture, woodFloor,
} from "@/lib/textures";

export type Identity = { name: string; gender: Gender; color: string; hat: string };
export type Quality = "cinematic" | "balanced";

type Props = {
  exhibits: ExhibitDTO[];
  identity: Identity;
  quality: Quality;
  remoteRef: React.MutableRefObject<PlayerDTO[]>;
  positionRef: React.MutableRefObject<{ x: number; z: number; rotY: number }>;
  teleportRef: React.MutableRefObject<{ x: number; z: number; rotY: number; nonce: number } | null>;
  emoteRef: React.MutableRefObject<{ emote: string; nonce: number } | null>;
  joystickRef: React.MutableRefObject<{ x: number; y: number }>;
  onNearExhibit: (ex: ExhibitDTO | null) => void;
  onFrameClick: (slotIndex: number, existingEx?: ExhibitDTO) => void;
};

/* ------------------------------------------------------------------ helpers */
type Puff = { sprite: THREE.Sprite; life: number };
const EMOTE_MS: Record<string, number> = { wave: 1800, dance: 2600, jump: 700, spin: 900, bow: 1600 };

const GRAVITY = 26;
const JUMP_VELOCITY = 5.9;
const STEP_DOWN_GLUE = 0.8;
const STEP_UP_REACH = 0.9;

function animateAvatar(
  a: AvatarParts,
  speed: number,
  dt: number,
  now: number,
  spawnPuff?: (x: number, y: number, z: number) => void,
  isSitting: boolean = false,
  groundY: number = 0,
) {
  const moving = speed > 0.15 && !isSitting;
  if (moving) a.walkPhase += dt * (4.4 + speed * 2.4);
  const p = a.walkPhase;
  const swing = moving ? Math.sin(p) * 0.8 : 0;

  if (isSitting) {
    a.legL.rotation.x = -Math.PI / 2.2; a.legR.rotation.x = -Math.PI / 2.2;
    a.armL.rotation.x = 0.1; a.armR.rotation.x = 0.1; a.armL.rotation.z = 0.2; a.armR.rotation.z = -0.2;
    a.body.position.y = 0.65; a.body.rotation.z = 0; a.body.rotation.x = 0;
    a.head.rotation.z = 0; a.head.rotation.y = Math.sin(now / 2000) * 0.15;
  } else {
    a.legL.rotation.x = swing; a.legR.rotation.x = -swing;
    a.armL.rotation.x = -swing * 0.85; a.armR.rotation.x = swing * 0.85;
    a.armL.rotation.z = 0.14; a.armR.rotation.z = -0.14;
    a.body.position.y = (moving ? Math.abs(Math.cos(p)) * 0.075 : Math.sin(now / 850 + p) * 0.018) + 1.15;
    a.body.rotation.z = moving ? Math.sin(p) * 0.035 : 0; a.body.rotation.x = 0;
    a.head.rotation.z = moving ? Math.sin(p) * 0.05 : Math.sin(now / 1500 + p) * 0.05;
    a.head.rotation.y = moving ? 0 : Math.sin(now / 2600 + p) * 0.22;
  }
  a.body.scale.setScalar(1 + Math.sin(now / 850 + p) * 0.012);
  a.hairFlow.rotation.z = moving ? Math.sin(p - 0.5) * 0.065 : Math.sin(now / 1200 + p) * 0.025;
  a.hairFlow.rotation.x = moving && a.gender === "female" ? Math.cos(p) * 0.035 : 0;
  if (a.skirt) a.skirt.rotation.z = moving ? Math.sin(p - 0.8) * 0.065 : Math.sin(now / 1500 + p) * 0.014;

  let spinExtra = 0;
  if (now > a.nextBlink && a.blinkUntil === 0) { a.blinkUntil = now + 130; a.nextBlink = now + 2200 + Math.random() * 4200; }
  a.eyes.scale.y = now < a.blinkUntil ? 0.12 : 1;
  if (now > a.blinkUntil && a.blinkUntil !== 0) a.blinkUntil = 0;

  if (a.emote && !isSitting) {
    const t = (now - a.emoteStart) / (EMOTE_MS[a.emote] || 1500);
    if (t >= 1) a.emote = "";
    else if (a.emote === "wave") { a.armR.rotation.z = -2.5; a.armR.rotation.x = Math.sin(t * Math.PI * 7) * 0.6; a.head.rotation.z = Math.sin(t * Math.PI * 4) * 0.12; }
    else if (a.emote === "dance") { a.body.position.y += Math.abs(Math.sin(t * Math.PI * 7)) * 0.18; a.body.rotation.z = Math.sin(t * Math.PI * 7) * 0.2; a.armL.rotation.z = 2.3 + Math.sin(t * Math.PI * 7) * 0.55; a.armR.rotation.z = -2.3 - Math.cos(t * Math.PI * 7) * 0.55; a.head.rotation.z = Math.cos(t * Math.PI * 7) * 0.18; spinExtra = t * Math.PI * 4; }
    else if (a.emote === "spin") { spinExtra = t * Math.PI * 2; a.armL.rotation.z = 1.9; a.armR.rotation.z = -1.9; }
    else if (a.emote === "bow") { a.body.rotation.x = Math.sin(Math.min(t * 1.4, 1) * Math.PI) * 0.6; a.armL.rotation.x = -0.6; a.armR.rotation.x = -0.6; }
  }

  if (!isSitting && a.emote === "jump" && a.vy <= 0 && a.y <= groundY + 0.02 && now - a.emoteStart < 120) {
    a.vy = JUMP_VELOCITY;
  }

  if (a.vy > 0 || a.y > groundY + 0.02) {
    a.vy -= GRAVITY * dt;
    a.y += a.vy * dt;
  }

  if (a.y <= groundY) {
    a.y = groundY;
    if (a.vy < 0) a.vy = 0;
  } else if (a.vy <= 0 && a.y - groundY <= STEP_DOWN_GLUE) {
    a.y = groundY;
    a.vy = 0;
  }

  const airborne = a.y > groundY + 0.06;
  if (airborne) { a.armL.rotation.z = 2.5; a.armR.rotation.z = -2.5; }

  const lift = THREE.MathUtils.clamp((a.y - groundY) / 1.2, 0, 1);
  a.blob.scale.setScalar(1 - lift * 0.35);
  (a.blob.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - lift * 0.65);

  const bm = a.bubble.material as THREE.SpriteMaterial;
  if (now < a.bubbleUntil) {
    bm.opacity = Math.min(1, (a.bubbleUntil - now) / 700);
    a.bubble.scale.setScalar(0.62);
    a.bubble.position.y = 2.84 + Math.sin(now / 260) * 0.04;
  } else if (bm.opacity > 0) {
    bm.opacity = Math.max(0, bm.opacity - dt * 3);
  }

  if (moving && spawnPuff && now > a.nextPuff) {
    a.nextPuff = now + 300;
    spawnPuff(a.group.position.x + (Math.random() - 0.5) * 0.3, groundY + 0.06, a.group.position.z + (Math.random() - 0.5) * 0.3);
  }

  a.group.position.y = a.y;
  return spinExtra;
}

const DOOR_X = 12;

type Rect = { x0: number; x1: number; z0: number; z1: number };
const PLAYER_R = 0.42;

const WALKABLE: Rect[] = [
  { x0: -16.9, x1: 16.9, z0: -10.95, z1: 10.95 },
  { x0: DOOR_X - 1.55, x1: DOOR_X + 1.55, z0: -16.05, z1: -10.85 },
  { x0: DOOR_X - 11.5, x1: DOOR_X + 11.5, z0: -40.5, z1: -16.0 },
];

const OBSTACLES: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [
  { minX: -8.4, maxX: -3.6, minZ: -0.45, maxZ: 0.45 },
  { minX: 4.6, maxX: 9.4, minZ: -0.45, maxZ: 0.45 },
  { minX: -0.9, maxX: 1.9, minZ: -5.6, maxZ: -3.4 },
  { minX: -1.9, maxX: 1.9, minZ: 4.6, maxZ: 6.0 },
  { minX: -13.4, maxX: -10.6, minZ: -5.4, maxZ: -4.4 },
  { minX: 11.6, maxX: 14.4, minZ: 4.4, maxZ: 5.4 },
  { minX: -15.1, maxX: -13.9, minZ: -9.6, maxZ: -8.4 },
  { minX: 13.9, maxX: 15.1, minZ: -9.6, maxZ: -8.4 },
  { minX: -15.1, maxX: -13.9, minZ: 8.4, maxZ: 9.6 },
  { minX: 13.9, maxX: 15.1, minZ: 8.4, maxZ: 9.6 },
];

function collide(pos: THREE.Vector3) {
  let bx = pos.x, bz = pos.z, bestD = Infinity;
  for (const r of WALKABLE) {
    const cx = THREE.MathUtils.clamp(pos.x, r.x0, r.x1);
    const cz = THREE.MathUtils.clamp(pos.z, r.z0, r.z1);
    const dx = pos.x - cx, dz = pos.z - cz;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; bx = cx; bz = cz; if (d === 0) break; }
  }
  pos.x = bx; pos.z = bz;

  for (const o of OBSTACLES) {
    const cx = THREE.MathUtils.clamp(pos.x, o.minX, o.maxX);
    const cz = THREE.MathUtils.clamp(pos.z, o.minZ, o.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < PLAYER_R * PLAYER_R) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * PLAYER_R;
        pos.z = cz + (dz / d) * PLAYER_R;
      } else {
        const toMaxZ = o.maxZ - pos.z + PLAYER_R;
        const toMinZ = pos.z - o.minZ + PLAYER_R;
        const toMaxX = o.maxX - pos.x + PLAYER_R;
        const toMinX = pos.x - o.minX + PLAYER_R;
        const m = Math.min(toMaxZ, toMinZ, toMaxX, toMinX);
        if (m === toMaxZ) pos.z = o.maxZ + PLAYER_R;
        else if (m === toMinZ) pos.z = o.minZ - PLAYER_R;
        else if (m === toMaxX) pos.x = o.maxX + PLAYER_R;
        else pos.x = o.minX - PLAYER_R;
      }
    }
  }

  let ok = false;
  for (const r of WALKABLE) {
    if (pos.x >= r.x0 && pos.x <= r.x1 && pos.z >= r.z0 && pos.z <= r.z1) { ok = true; break; }
  }
  if (!ok) {
    let nx = pos.x, nz = pos.z, nd = Infinity;
    for (const r of WALKABLE) {
      const cx = THREE.MathUtils.clamp(pos.x, r.x0, r.x1);
      const cz = THREE.MathUtils.clamp(pos.z, r.z0, r.z1);
      const d = (pos.x - cx) ** 2 + (pos.z - cz) ** 2;
      if (d < nd) { nd = d; nx = cx; nz = cz; }
    }
    pos.x = nx; pos.z = nz;
  }
}

export default function Gallery3D(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const exhibitsRef = useRef<ExhibitDTO[]>(props.exhibits || []);
  const identityRef = useRef<Identity>(props.identity);
  const qualityRef = useRef<Quality>(props.quality);

  const apiRef = useRef<{
    rebuild: (ex: ExhibitDTO[]) => void;
    setIdentity: (id: Identity) => void;
    setQuality: (q: Quality) => void;
  } | null>(null);

  const onNearRef = useRef(props.onNearExhibit);
  const onFrameClickRef = useRef(props.onFrameClick);
  const remoteRef = props.remoteRef;
  const positionRef = props.positionRef;
  const teleportRef = props.teleportRef;
  const emoteRef = props.emoteRef;
  const joystickRef = props.joystickRef;

  useEffect(() => { onNearRef.current = props.onNearExhibit; }, [props.onNearExhibit]);
  useEffect(() => { onFrameClickRef.current = props.onFrameClick; }, [props.onFrameClick]);
  useEffect(() => {
    exhibitsRef.current = props.exhibits || [];
    apiRef.current?.rebuild(exhibitsRef.current);
  }, [props.exhibits]);
  useEffect(() => {
    identityRef.current = props.identity;
    apiRef.current?.setIdentity(props.identity);
  }, [props.identity]);
  useEffect(() => {
    qualityRef.current = props.quality;
    apiRef.current?.setQuality(props.quality);
  }, [props.quality]);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;
    const mount: HTMLDivElement = mountEl;
    const cinematic = qualityRef.current === "cinematic";

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, cinematic ? 2 : 1.4));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block"; renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef1f5); scene.fog = new THREE.Fog(0xeef1f5, 44, 96);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
    const baseFov = 55;

    const BRASS = new THREE.MeshStandardMaterial({ color: 0xcca65f, metalness: 1.0, roughness: 0.15 });
    const DARK_WOOD = new THREE.MeshStandardMaterial({ color: 0x1f150e, roughness: 0.6, metalness: 0.05 });
    const INK = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.2 });
    const EMISSIVE_WARM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffcf5, emissiveIntensity: 2.8, roughness: 0.35 });
    const SOFA_VELVET = new THREE.MeshPhysicalMaterial({ map: velvet("#1a1a1c"), roughness: 0.8, sheen: 1.0, sheenColor: new THREE.Color(0x333333), envMapIntensity: 0.2 });

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    if ("environmentIntensity" in scene) (scene as any).environmentIntensity = 0.55;

    scene.add(new THREE.HemisphereLight(0xfcfdff, 0xe0ddd3, 0.55));
    const sun = new THREE.DirectionalLight(0xfff5e6, 0.95);
    sun.position.set(9, 18, 7); sun.castShadow = true;
    sun.shadow.mapSize.set(cinematic ? 2048 : 1024, cinematic ? 2048 : 1024);
    sun.shadow.camera.left = -22; sun.shadow.camera.right = 22; sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
    sun.shadow.camera.far = 46; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(new THREE.PointLight(0xffffff, 5, 24, 2).translateY(4.6).translateX(-12).translateZ(7));
    scene.add(new THREE.PointLight(0xffffff, 5, 24, 2).translateY(4.6).translateX(12).translateZ(-7));

    const sculptureSpot = new THREE.SpotLight(0xffffff, 20, 14, 0.42, 0.8, 1.6);
    sculptureSpot.position.set(0.5, 5.6, -1.4); sculptureSpot.target.position.set(0.5, 1.6, -4.5);
    sculptureSpot.castShadow = cinematic; scene.add(sculptureSpot, sculptureSpot.target);

    const skySpot = new THREE.SpotLight(0xf2f7ff, 25, 22, 0.78, 0.95, 1.3);
    skySpot.position.set(0, HALL.h - 0.2, 0); skySpot.target.position.set(0, 0, 1.6); scene.add(skySpot, skySpot.target);

    const seatMeshes: THREE.Mesh[] = [];
    const floorMeshes: THREE.Mesh[] = [];

    const wood = woodFloor(); const wallTex = plaster("#f4f3f0"); const marbleTex = marble();
    const floorMat = new THREE.MeshPhysicalMaterial({ map: wood.map, normalMap: wood.normal, roughnessMap: wood.rough, normalScale: new THREE.Vector2(0.34, 0.34), roughness: 0.65, metalness: 0.0, clearcoat: 0.4, clearcoatRoughness: 0.25, envMapIntensity: 0.8 });
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex.map, normalMap: wallTex.normal, normalScale: new THREE.Vector2(0.15, 0.15), roughness: 0.95, envMapIntensity: 0.6 });
    const marbleMat = new THREE.MeshPhysicalMaterial({ map: marbleTex.map, normalMap: marbleTex.normal, roughness: 0.2, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 1.0 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.d), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor); floorMeshes.push(floor);

    const inlay = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.4), marbleMat);
    inlay.rotation.x = -Math.PI / 2; inlay.position.set(0, 0.006, 10); inlay.receiveShadow = true; scene.add(inlay);

    const inlayRing = new THREE.Mesh(new THREE.RingGeometry(2.18, 2.26, 64), BRASS);
    inlayRing.rotation.x = -Math.PI / 2; inlayRing.position.set(0, 0.01, 10); scene.add(inlayRing);

    const mkWall = (w: number, x: number, z: number, rotY: number, isDoorWall: boolean = false) => {
      const g = new THREE.Group();
      if (isDoorWall) {
        const w1Width = (w / 2) + (DOOR_X - 2);
        const w1Center = -w / 2 + (w1Width / 2);
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(w1Width, HALL.h, 0.3), wallMat);
        w1.position.set(w1Center, HALL.h / 2, 0); w1.receiveShadow = true; g.add(w1);

        const w2Width = (w / 2) - (DOOR_X + 2);
        const w2Center = (DOOR_X + 2) + (w2Width / 2);
        const w2 = new THREE.Mesh(new THREE.BoxGeometry(w2Width, HALL.h, 0.3), wallMat);
        w2.position.set(w2Center, HALL.h / 2, 0); w2.receiveShadow = true; g.add(w2);

        const top = new THREE.Mesh(new THREE.BoxGeometry(4, HALL.h - 4, 0.3), wallMat);
        top.position.set(DOOR_X, 4 + (HALL.h - 4) / 2, 0); g.add(top);
      } else {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, HALL.h, 0.3), wallMat);
        wall.position.y = HALL.h / 2; wall.receiveShadow = true; g.add(wall);
        const reveal = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.1), INK); reveal.position.set(0, 0.1, 0.16); g.add(reveal);
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.33), DARK_WOOD); skirt.position.y = 0.05; skirt.receiveShadow = true; g.add(skirt);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, 0.34), BRASS); rail.position.y = HALL.h - 0.55; g.add(rail);
      }
      g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
    };

    mkWall(HALL.w, 0, -HALL.d / 2 - 0.15, 0, true);
    mkWall(HALL.w, 0, HALL.d / 2 + 0.15, 0);
    mkWall(HALL.d, -HALL.w / 2 - 0.15, 0, Math.PI / 2);
    mkWall(HALL.d, HALL.w / 2 + 0.15, 0, Math.PI / 2);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.d), new THREE.MeshStandardMaterial({ color: 0xfdfdfc, roughness: 1, envMapIntensity: 0.4 }));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.y = HALL.h; scene.add(ceiling);

    const SKY_W = 20, SKY_D = 9;
    const skyGlass = new THREE.Mesh(new THREE.PlaneGeometry(SKY_W, SKY_D), new THREE.MeshStandardMaterial({ map: skylightTexture(), emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 1 }));
    skyGlass.rotation.x = Math.PI / 2; skyGlass.position.set(0, HALL.h - 0.03, 0); scene.add(skyGlass);

    const mullion = new THREE.MeshStandardMaterial({ color: 0xe8e9ea, roughness: 0.6, metalness: 0.1 });
    for (let i = 1; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, SKY_D), mullion);
      bar.position.set(-SKY_W / 2 + (i * SKY_W) / 6, HALL.h - 0.1, 0); scene.add(bar);
    }
    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(SKY_W, 0.16, 0.1), mullion);
    crossBar.position.set(0, HALL.h - 0.1, 0); scene.add(crossBar);

    const colMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.7, envMapIntensity: 0.6 });
    for (const [cx, cz] of [[-14.5, -9], [14.5, -9], [-14.5, 9], [14.5, 9]] as const) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.78, HALL.h, 0.78), colMat);
      pier.position.set(cx, HALL.h / 2, cz); pier.castShadow = pier.receiveShadow = true; scene.add(pier);
      const gap = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 0.84), INK); gap.position.set(cx, 0.1, cz); scene.add(gap);
    }

    const tEntranceZ = -HALL.d / 2 - 0.14;
    const archMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.8 });
    const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.4), archMat); leftJamb.position.set(DOOR_X - 2.1, 2, tEntranceZ); scene.add(leftJamb);
    const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.4), archMat); rightJamb.position.set(DOOR_X + 2.1, 2, tEntranceZ); scene.add(rightJamb);
    const topJamb = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.2, 0.4), archMat); topJamb.position.set(DOOR_X, 4.1, tEntranceZ); scene.add(topJamb);

    const tSign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.8), new THREE.MeshStandardMaterial({ map: signTexture("THEATER", "immersive screening room"), transparent: true, roughness: 0.9 }));
    tSign.position.set(DOOR_X, 4.6, tEntranceZ + 0.16); scene.add(tSign);

    const curMat = new THREE.MeshPhysicalMaterial({ map: velvet("#3a0a0a"), roughness: 0.9, sheen: 1.0, sheenColor: new THREE.Color(0xcc2222) });
    const curL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4, 16), curMat); curL.position.set(DOOR_X - 1.9, 2, tEntranceZ + 0.1); curL.scale.set(1, 1, 0.4); scene.add(curL);
    const curR = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4, 16), curMat); curR.position.set(DOOR_X + 1.9, 2, tEntranceZ + 0.1); curR.scale.set(1, 1, 0.4); scene.add(curR);

    // Theater
    const theater = buildTheater(scene, seatMeshes, floorMeshes, DOOR_X);

    const underlay = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 34),
      new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 })
    );
    underlay.rotation.x = -Math.PI / 2;
    underlay.position.set(DOOR_X, -2.6, -28);
    scene.add(underlay);

    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });
    const mkSkirt = (w: number, h: number, x: number, z: number, rotY = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), skirtMat);
      m.position.set(x, -1.8 - h / 2, z); m.rotation.y = rotY; scene.add(m);
    };
    mkSkirt(24, 2.6, DOOR_X, -15.9);
    mkSkirt(34, 2.6, DOOR_X - 12, -28, Math.PI / 2);
    mkSkirt(34, 2.6, DOOR_X + 12, -28, Math.PI / 2);
    mkSkirt(24, 2.6, DOOR_X, -42.1);

    let isTheaterDark = false;
    let cinemaVideo: HTMLVideoElement | null = null;

    const mkSofa = (x: number, z: number, rotY = 0) => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.9), DARK_WOOD); base.position.y = 0.2; g.add(base);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.25, 0.85), SOFA_VELVET);
      seat.position.y = 0.38;
      seat.userData = { isSeat: true, sitPose: { x: x + Math.sin(rotY) * 0.1, z: z + Math.cos(rotY) * 0.1, rotY } };
      g.add(seat); seatMeshes.push(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.7, 0.25), SOFA_VELVET); back.position.set(0, 0.75, -0.3); g.add(back);
      for (const sx of [-1.55, 1.55]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.85), SOFA_VELVET); arm.position.set(sx, 0.65, 0); g.add(arm); }
      g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
    };

    const mkTable = (x: number, z: number, rotY = 0) => {
      const g = new THREE.Group();
      const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.95, opacity: 1, metalness: 0.1, roughness: 0.05, ior: 1.5, thickness: 0.5 });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.02, 0.9), glassMat); glass.position.y = 0.35; glass.castShadow = true; g.add(glass);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.33, 0.04), INK); frame.position.set(0, 0.175, -0.35); g.add(frame);
      const frame2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.33, 0.04), INK); frame2.position.set(0, 0.175, 0.35); g.add(frame2);
      g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
    };

    mkSofa(0, 5.4, 0); mkTable(0, 4.0, 0);
    mkSofa(-10.5, -4.9, Math.PI / 2); mkTable(-9.1, -4.9, Math.PI / 2);
    mkSofa(10.5, 4.9, -Math.PI / 2); mkTable(9.1, 4.9, -Math.PI / 2);

    const potMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.4 });
    const leafMat = new THREE.MeshPhysicalMaterial({ color: 0x2e5c1f, roughness: 0.4, sheen: 0.9, sheenColor: new THREE.Color(0x8fd16b), clearcoat: 0.5, side: THREE.DoubleSide });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a6121, roughness: 0.7 });

    const mkPremiumPlant = (x: number, z: number, scale = 1) => {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.8, 24), potMat);
      pot.position.y = 0.4; pot.castShadow = pot.receiveShadow = true; g.add(pot);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 16, 24), BRASS); rim.rotation.x = Math.PI / 2; rim.position.y = 0.8; g.add(rim);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2; const stemH = 0.7 + Math.random() * 1.0;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, stemH, 8), stemMat);
        stem.position.set(Math.cos(a) * 0.1, 0.8 + stemH / 2, Math.sin(a) * 0.1); stem.rotation.z = Math.cos(a) * 0.35; stem.rotation.x = -Math.sin(a) * 0.35;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.15, 16, 12), leafMat);
        leaf.scale.set(1.6, 0.15, 1.0); leaf.position.set(Math.cos(a) * (0.25 + stemH * 0.28), 0.8 + stemH, Math.sin(a) * (0.25 + stemH * 0.28));
        leaf.rotation.set(Math.random() * 0.8, a, Math.random() * 0.5 - 0.25); leaf.castShadow = true; g.add(stem, leaf);
      }
      g.position.set(x, 0, z); g.scale.setScalar(scale); scene.add(g);
    };

    mkPremiumPlant(-16.0, -10.0, 1.15); mkPremiumPlant(16.0, -10.0, 1.15);
    mkPremiumPlant(-16.0, 10.0, 1.0); mkPremiumPlant(16.0, 10.0, 1.0);
    mkPremiumPlant(-4.0, 10.6, 0.9); mkPremiumPlant(4.0, 10.6, 0.9);

    const panelMat = new THREE.MeshStandardMaterial({ color: 0xf7f7f8, roughness: 0.93, envMapIntensity: 0.5 });
    for (const px of [-6, 7]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(4.8, 4.4, 0.3), panelMat);
      panel.position.set(px, 2.22, 0); panel.castShadow = panel.receiveShadow = true;
      const gap = new THREE.Mesh(new THREE.BoxGeometry(4.86, 0.06, 0.36), INK); gap.position.set(px, 0.03, 0);
      scene.add(panel, gap);
    }

    const rug = new THREE.Mesh(new THREE.CircleGeometry(4.6, 56), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1, envMapIntensity: 0.15 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0.5, 0.012, 1.6); rug.receiveShadow = true; scene.add(rug);

    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.05, 1.6), marbleMat); pedestal.position.set(0.5, 0.525, -4.5); pedestal.castShadow = pedestal.receiveShadow = true;
    const pedTop = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.16, 1.85), marbleMat); pedTop.position.set(0.5, 1.13, -4.5); pedTop.castShadow = true;
    scene.add(pedestal, pedTop);

    const marker = new THREE.Mesh(new THREE.RingGeometry(2.24, 2.3, 64), new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 0.7 }));
    marker.rotation.x = -Math.PI / 2; marker.position.set(0.5, 0.013, -4.5); scene.add(marker);

    const sculpture = new THREE.Mesh(new THREE.TorusKnotGeometry(0.58, 0.2, cinematic ? 220 : 120, 32), new THREE.MeshPhysicalMaterial({ color: 0xf0f1f3, metalness: 1, roughness: 0.08, clearcoat: 1, envMapIntensity: 2.2 }));
    sculpture.position.set(0.5, 2.2, -4.5); sculpture.castShadow = true; scene.add(sculpture);

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10.0, 2.5), new THREE.MeshStandardMaterial({ map: signTexture("SUNFLWR", "contemporary collection · live visitors"), transparent: true, roughness: 0.9 }));
    sign.position.set(0, 4.35, -HALL.d / 2 + 0.07); scene.add(sign);

    const westText = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 2.0), new THREE.MeshStandardMaterial({ map: wallTextTexture("Permanent Collection", "pictures · video clips · live visitors"), transparent: true, roughness: 0.9 }));
    westText.position.set(-HALL.w / 2 + 0.07, 4.35, 0); westText.rotation.y = Math.PI / 2; scene.add(westText);

    const eastText = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 2.0), new THREE.MeshStandardMaterial({ map: wallTextTexture("Moving Image Wall", "video clips play live on canvas"), transparent: true, roughness: 0.9 }));
    eastText.position.set(HALL.w / 2 - 0.07, 4.35, 0); eastText.rotation.y = -Math.PI / 2; scene.add(eastText);

    const trackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.8 });
    for (const tz of [-8.4, 0, 8.4]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(HALL.w - 5, 0.07, 0.07), trackMat); rail.position.set(0, HALL.h - 0.3, tz); scene.add(rail);
      for (let i = 0; i < 7; i++) {
        const hx = -13.5 + i * 4.5;
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 14), headMat); head.position.set(hx, HALL.h - 0.5, tz); head.rotation.z = 0.22 * (tz > 0 ? -1 : tz < 0 ? 1 : 0);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.094, 16), EMISSIVE_WARM); lens.position.set(hx, HALL.h - 0.655, tz); lens.rotation.x = -Math.PI / 2;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.17, 8), trackMat); stem.position.set(hx, HALL.h - 0.37, tz);
        scene.add(head, lens, stem);
      }
    }

    const moteCount = cinematic ? 620 : 180;
    const moteGeo = new THREE.BufferGeometry();
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * (HALL.w - 2);
      motePos[i * 3 + 1] = Math.random() * (HALL.h - 0.6) + 0.3;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * (HALL.d - 2);
    }
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({ size: 0.05, map: softDot(), transparent: true, opacity: cinematic ? 0.34 : 0.2, depthWrite: false, blending: THREE.NormalBlending });
    const motes = new THREE.Points(moteGeo, moteMat); scene.add(motes);

    const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture(), transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const sx of [-6.6, 0, 6.6]) {
      const shaft = new THREE.Mesh(new THREE.ConeGeometry(3.4, HALL.h, 22, 1, true), shaftMat);
      shaft.position.set(sx, HALL.h / 2, 0.2); shaft.rotation.x = Math.PI; scene.add(shaft);
    }

    const puffTex = softDot("rgba(240,225,200,0.85)", "rgba(220,200,170,0)");
    const puffs: Puff[] = [];
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false }));
      sp.scale.setScalar(0.2); sp.visible = false; scene.add(sp); puffs.push({ sprite: sp, life: 0 });
    }
    let puffIdx = 0;
    const spawnPuff = (x: number, y: number, z: number) => {
      const p = puffs[puffIdx++ % puffs.length];
      p.sprite.position.set(x, y, z); p.sprite.visible = true; p.life = 1;
      (p.sprite.material as THREE.SpriteMaterial).opacity = 0.4; p.sprite.scale.setScalar(0.16);
    };

    /* ---------------- exhibits (Slots 0-29 & Slot 100) ---------------- */
    const framesGroup = new THREE.Group(); scene.add(framesGroup);
    const videoEls: HTMLVideoElement[] = [];
    const disposables: Array<{ dispose: () => void }> = [];
    const loader = new THREE.TextureLoader();
    const artMeshes: THREE.Mesh[] = [];
    type FrameUnit = { group: THREE.Group; glow: THREE.Mesh; hover: number };
    const frameUnits: FrameUnit[] = [];

    const frameMats = [
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: 0xcca65f, roughness: 0.2, metalness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5, metalness: 0.0 }),
    ];
    const glowMat = new THREE.MeshBasicMaterial({ map: softDot("rgba(120,170,255,0.75)", "rgba(120,170,255,0)"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

    function applyDynamicSizing(
      frame: THREE.Mesh,
      matBoard: THREE.Mesh,
      art: THREE.Mesh,
      glass: THREE.Mesh,
      dropShadow: THREE.Mesh,
      glow: THREE.Mesh,
      plaque: THREE.Mesh,
      mediaW: number,
      mediaH: number,
      slotW: number,
      slotH: number,
    ) {
      const fw = Math.max(0.55, slotW);
      const fh = Math.max(0.55, slotH);

      if (frame.geometry) frame.geometry.dispose();
      frame.geometry = new THREE.BoxGeometry(fw, fh, 0.08);

      const matPad = 0.07;
      const mw = Math.max(0.2, fw - matPad * 2);
      const mh = Math.max(0.2, fh - matPad * 2);
      matBoard.scale.set(mw, mh, 1);
      glass.scale.set(mw, mh, 1);

      const artPad = 0.09;
      const maxAw = Math.max(0.12, mw - artPad * 2);
      const maxAh = Math.max(0.12, mh - artPad * 2);
      const ar = Math.max(0.05, mediaW) / Math.max(0.05, mediaH);
      let aw = maxAw;
      let ah = aw / ar;
      if (ah > maxAh) {
        ah = maxAh;
        aw = ah * ar;
      }
      art.scale.set(aw, ah, 1);

      dropShadow.scale.set(fw + 0.42, fh + 0.40, 1);
      glow.scale.set(fw + 1.5, fh + 1.35, 1);
      plaque.position.set(
        THREE.MathUtils.clamp(-fw / 2 + 0.48, -fw / 2 + 0.15, fw / 2 - 0.15),
        -fh / 2 - 0.42,
        0.04,
      );
    }

    function rebuild(exList: ExhibitDTO[]) {
      framesGroup.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
      framesGroup.clear();
      artMeshes.length = 0;
      frameUnits.length = 0;
      cinemaVideo = null;
      videoEls.forEach((v) => {
        v.pause();
        v.removeAttribute("src");
        v.load();
      });
      videoEls.length = 0;
      disposables.forEach((d) => d.dispose());
      disposables.length = 0;

      for (let i = 0; i < 30; i++) {
        const ex = exList.find((e) => e.slot === i);
        const isEmpty = !ex || !ex.id;

        const pose = getSlotPose(i);
        const { x, y, z, rotY } = pose;
        const slotW = typeof pose.width === "number" ? pose.width : 2.0;
        const slotH = typeof pose.height === "number" ? pose.height : 1.6;

        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.y = rotY;

        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(slotW, slotH, 0.08),
          frameMats[i % 3],
        );
        frame.castShadow = frame.receiveShadow = true;
        g.add(frame);

        const matBoard = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshStandardMaterial({ color: 0xfbfbfa }),
        );
        matBoard.position.z = 0.038;
        g.add(matBoard);

        const artMat = new THREE.MeshBasicMaterial({ color: 0xe8e6e1 });
        const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), artMat);
        art.position.z = 0.046;
        art.userData = { slotIdx: i, exhibitId: ex?.id };
        g.add(art);
        artMeshes.push(art);
        disposables.push(artMat);

        const glass = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.04,
            transparent: true,
            opacity: 0.05,
            depthWrite: false,
          }),
        );
        glass.position.z = 0.05;
        g.add(glass);

        const dropShadow = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map: softDot("rgba(40,44,54,0.42)", "rgba(40,44,54,0)"),
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          }),
        );
        dropShadow.position.set(0.04, -0.06, -0.012);
        g.add(dropShadow);

        const glowClone = glowMat.clone();
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowClone);
        glow.position.z = -0.02;
        g.add(glow);
        disposables.push(glowClone);

        const ptex = plaqueTexture(
          isEmpty ? "Empty Canvas" : ex.title,
          isEmpty ? "Click to add artwork" : ex.artist,
        );
        disposables.push(ptex);
        const plaqueMat = new THREE.MeshStandardMaterial({
          map: ptex,
          roughness: 0.8,
          metalness: 0.05,
        });
        const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), plaqueMat);
        g.add(plaque);
        disposables.push(plaqueMat);

        applyDynamicSizing(
          frame, matBoard, art, glass, dropShadow, glow, plaque,
          slotW, slotH, slotW, slotH,
        );

        if (isEmpty) {
          artMat.map = plaqueTexture("+", "");
          artMat.needsUpdate = true;
        } else if (ex.mediaType === "video") {
          const video = document.createElement("video");
          video.crossOrigin = "anonymous";
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.autoplay = true;
          video.src = ex.url;
          videoEls.push(video);
          const vtex = new THREE.VideoTexture(video);
          vtex.colorSpace = THREE.SRGBColorSpace;
          vtex.minFilter = THREE.LinearFilter;
          vtex.magFilter = THREE.LinearFilter;
          vtex.generateMipmaps = false;
          disposables.push(vtex);
          video.addEventListener("loadeddata", () => {
            artMat.map = vtex;
            artMat.color.set(0xffffff);
            artMat.needsUpdate = true;
            applyDynamicSizing(
              frame, matBoard, art, glass, dropShadow, glow, plaque,
              video.videoWidth || slotW,
              video.videoHeight || slotH,
              slotW,
              slotH,
            );
            video.play().catch(() => {});
          });
        } else {
          loader.load(ex.url, (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            disposables.push(t);
            artMat.map = t;
            artMat.color.set(0xffffff);
            artMat.needsUpdate = true;
            const iw = (t.image as HTMLImageElement)?.width || slotW;
            const ih = (t.image as HTMLImageElement)?.height || slotH;
            applyDynamicSizing(
              frame, matBoard, art, glass, dropShadow, glow, plaque,
              iw, ih, slotW, slotH,
            );
          });
        }

        framesGroup.add(g);
        frameUnits.push({ group: g, glow, hover: 0 });
      }

      const cinemaEx = exList.find((e) => e.slot === 100);
      const cEmpty = !cinemaEx || !cinemaEx.id;
      const cGroup = new THREE.Group(); cGroup.position.set(DOOR_X, 3.8, -41.4);

      const cFrame = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 0.2), new THREE.MeshStandardMaterial({ color: 0x050505 }));
      cGroup.add(cFrame);

      const cArtMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const cArt = new THREE.Mesh(new THREE.PlaneGeometry(15.8, 8.8), cArtMat);
      cArt.position.z = 0.11; cArt.userData = { slotIdx: 100, exhibitId: cinemaEx?.id };
      cGroup.add(cArt); artMeshes.push(cArt); disposables.push(cArtMat);

      if (cEmpty) {
        cArtMat.map = signTexture("SUNFLWR CINEMA", "Upload a video via the Control Desk");
      } else if (cinemaEx.mediaType === "video") {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous"; video.muted = true; video.loop = true; video.playsInline = true; video.autoplay = true;
        video.src = cinemaEx.url; videoEls.push(video); cinemaVideo = video;
        const vtex = new THREE.VideoTexture(video);
        vtex.colorSpace = THREE.SRGBColorSpace;
        vtex.minFilter = THREE.LinearFilter;
        vtex.magFilter = THREE.LinearFilter;
        vtex.generateMipmaps = false;
        disposables.push(vtex);
        video.addEventListener("loadeddata", () => {
          cArtMat.map = vtex; cArtMat.color.set(0xffffff); cArtMat.needsUpdate = true;
          video.play().catch(() => {});
        });
      } else {
        loader.load(cinemaEx.url, (t) => {
          t.colorSpace = THREE.SRGBColorSpace; disposables.push(t);
          cArtMat.map = t; cArtMat.color.set(0xffffff); cArtMat.needsUpdate = true;
        });
      }
      framesGroup.add(cGroup);
    }

    const id0 = identityRef.current;
    let local = makeAvatar(id0.gender, id0.color, id0.hat, id0.name, true);
    scene.add(local.group);

    const playerPos = new THREE.Vector3(0, 0, 6.3);
    let playerRot = Math.PI;
    local.group.position.copy(playerPos);
    local.group.rotation.y = playerRot;

    function setIdentity(id: Identity) {
      const pos = local.group.position.clone();
      const rot = local.group.rotation.y;
      scene.remove(local.group);
      local = makeAvatar(id.gender, id.color, id.hat, id.name, true);
      local.group.position.copy(pos);
      local.group.rotation.y = rot;
      scene.add(local.group);
    }

    let composer: EffectComposer | null = null;
    let bloom: UnrealBloomPass | null = null;
    function buildComposer(w: number, h: number) {
      composer?.dispose(); composer = null; bloom = null;
      if (qualityRef.current !== "cinematic") return;
      const renderTarget = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace });
      const c = new EffectComposer(renderer, renderTarget);
      c.setPixelRatio(Math.min(window.devicePixelRatio, 2)); c.setSize(w, h);
      c.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.15, 0.4, 1.45); c.addPass(bloom);
      c.addPass(new OutputPass()); c.addPass(new SMAAPass());
      composer = c;
    }
    function setQuality(q: Quality) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === "cinematic" ? 2 : 1.4));
      renderer.shadowMap.enabled = true;
      const w = mount.clientWidth || 800; const h = mount.clientHeight || 500;
      buildComposer(w, h); renderer.shadowMap.needsUpdate = true;
    }

    apiRef.current = { rebuild, setIdentity, setQuality };
    rebuild(exhibitsRef.current);

    const keys = new Set<string>();
    let walkTarget: THREE.Vector3 | null = null;
    let camYaw = 0; let camPitch = 0.34; let camDist = 4.9;
    let dragging = false; let dragMoved = 0;
    let lastPX = 0; let lastPY = 0; let downAt = 0; let downX = 0; let downY = 0;
    let hoveredSlot = -1;
    let isSitting = false;
    const sitTarget = new THREE.Vector3();
    let sitRotY = 0;
    let lastGroundY = 0;

    const isTyping = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return;
      const k = e.key.toLowerCase();
      keys.add(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      if (k === " " && !isSitting) triggerEmote(local, "jump", performance.now());
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const DOWN = new THREE.Vector3(0, -1, 0);
    const rayFloor = new THREE.Raycaster();
    rayFloor.far = 80;
    let hoverCheckAt = 0;

    const setNdc = (cx: number, cy: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - r.left) / r.width) * 2 - 1;
      ndc.y = -((cy - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true; dragMoved = 0;
      lastPX = downX = e.clientX; lastPY = downY = e.clientY; downAt = performance.now();
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - lastPX; const dy = e.clientY - lastPY;
        lastPX = e.clientX; lastPY = e.clientY;
        dragMoved += Math.abs(dx) + Math.abs(dy);
        if (dragMoved > 4) {
          camYaw -= dx * 0.005;
          camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.004, 0.06, 1.3);
        }
        return;
      }
      const now = performance.now();
      if (now < hoverCheckAt) return;
      hoverCheckAt = now + 70;
      setNdc(e.clientX, e.clientY);

      if (artMeshes.length) {
        const hit = raycaster.intersectObjects(artMeshes, false)[0];
        const sId = hit ? (hit.object.userData.slotIdx as number) : -1;
        hoveredSlot = sId;
        if (sId !== -1) { renderer.domElement.style.cursor = "pointer"; return; }
      }
      if (theater.controlBtns && raycaster.intersectObjects(theater.controlBtns, false)[0]) { renderer.domElement.style.cursor = "pointer"; return; }
      if (seatMeshes.length && raycaster.intersectObjects(seatMeshes, false)[0]) { renderer.domElement.style.cursor = "pointer"; return; }

      renderer.domElement.style.cursor = "grab";
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {}
      if (performance.now() - downAt >= 350 || Math.hypot(e.clientX - downX, e.clientY - downY) >= 7) return;

      setNdc(e.clientX, e.clientY);

      const btnHit = raycaster.intersectObjects(theater.controlBtns, false)[0];
      if (btnHit) {
        const action = btnHit.object.userData.isControlBtn;
        if (action === "upload") {
          const ex = exhibitsRef.current.find((x) => x.slot === 100);
          onFrameClickRef.current(100, ex);
        } else if (action === "play") {
          if (cinemaVideo) { if (cinemaVideo.paused) cinemaVideo.play().catch(() => {}); else cinemaVideo.pause(); }
        } else if (action === "mute") {
          if (cinemaVideo) cinemaVideo.muted = !cinemaVideo.muted;
        } else if (action === "lights") {
          isTheaterDark = !isTheaterDark;
        }
        return;
      }

      const artHit = raycaster.intersectObjects(artMeshes, false)[0];
      if (artHit) {
        const slotIdx = artHit.object.userData.slotIdx as number;
        const exId = artHit.object.userData.exhibitId as number | undefined;
        const ex = exhibitsRef.current.find((x) => x.id === exId);

        if (slotIdx === 100) {
          if (cinemaVideo && exId) {
            if (cinemaVideo.paused) cinemaVideo.play().catch(() => {}); else cinemaVideo.pause();
            return;
          }
          if (playerPos.z < -24) { onFrameClickRef.current(100, ex); return; }
          if (isSitting) isSitting = false;
          walkTarget = new THREE.Vector3(DOOR_X, 0, -32);
          collide(walkTarget);
          return;
        }

        const pose = getSlotPose(slotIdx);
        const d = Math.hypot(playerPos.x - pose.viewX, playerPos.z - pose.viewZ);
        if (d < 3.8) {
          onFrameClickRef.current(slotIdx, ex);
        } else {
          if (isSitting) isSitting = false;
          walkTarget = new THREE.Vector3(pose.viewX, 0, pose.viewZ);
          collide(walkTarget);
        }
        return;
      }

      const seatHit = raycaster.intersectObjects(seatMeshes, false)[0];
      if (seatHit) {
        const sp = seatHit.object.userData.sitPose;
        isSitting = true;
        sitTarget.set(sp.x, sp.y ?? 0, sp.z);
        sitRotY = sp.rotY;
        walkTarget = null;
        return;
      }

      const floorHit = raycaster.intersectObjects(floorMeshes, true)[0];
      if (floorHit) {
        if (isSitting) {
          isSitting = false;
          playerPos.x += Math.sin(playerRot) * 0.8;
          playerPos.z += Math.cos(playerRot) * 0.8;
        }
        walkTarget = floorHit.point.clone();
        walkTarget.y = 0;
        collide(walkTarget);
      }
    };

    const forcePlayVideos = () => { videoEls.forEach((v) => { if (v.paused) v.play().catch(() => {}); }); };
    const onPointerCancel = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => { camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.011, 2.4, 12); };

    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerup", forcePlayVideos);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, { passive: true });
    canvas.style.cursor = "grab";

    const resize = () => {
      const w = Math.max(1, mount.clientWidth || 800);
      const h = Math.max(1, mount.clientHeight || 500);
      renderer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      if (composer) { composer.setSize(w, h); bloom?.setSize(w, h); } else { buildComposer(w, h); }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* ---------------- loop ---------------- */
    const clock = new THREE.Clock();
    let raf = 0;
    let lastTeleportNonce = 0;
    let lastEmoteNonce = 0;
    let bob = 0;

    const angleLerp = (a: number, b: number, t: number) => {
      let d = (b - a) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return a + d * t;
    };

    const camTarget = new THREE.Vector3();
    const camOffset = new THREE.Vector3();
    const camDesired = new THREE.Vector3();
    const probeOrigin = new THREE.Vector3();

    /* ---------------- REMOTE PLAYERS ---------------- */
    type RemoteAvatar = AvatarParts & {
      lastX: number;
      lastZ: number;
      lastEmoteNonce?: number;
    };
    const remoteAvatars = new Map<string, RemoteAvatar>();

    const getRemoteId = (p: PlayerDTO): string => {
      return String(
        (p as any).id ??
        (p as any).clientId ??
        (p as any).socketId ??
        (p as any).sessionId ??
        (p as any).playerId ??
        (p as any).name ??
        ""
      );
    };

    const clampCamera = (p: THREE.Vector3) => {
      const t = playerPos;
      if (t.z > -11.35 && t.z < 11.35 && Math.abs(t.x) < 17.35) {
        p.x = THREE.MathUtils.clamp(p.x, -17.05, 17.05);
        p.z = THREE.MathUtils.clamp(p.z, -11.05, 11.05);
        p.y = Math.min(p.y, HALL.h - 0.35);
      } else if (t.z < -15.9) {
        p.x = THREE.MathUtils.clamp(p.x, DOOR_X - 11.7, DOOR_X + 11.7);
        p.z = THREE.MathUtils.clamp(p.z, -41.2, -16.15);
      } else {
        p.x = THREE.MathUtils.clamp(p.x, DOOR_X - 1.75, DOOR_X + 1.75);
        p.z = THREE.MathUtils.clamp(p.z, -16.4, -10.6);
      }
      return p;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();

      const tp = teleportRef.current;
      if (tp && tp.nonce !== lastTeleportNonce) {
        lastTeleportNonce = tp.nonce;
        playerPos.set(tp.x, 0, tp.z);
        playerRot = tp.rotY;
        camYaw = tp.rotY + Math.PI;
        walkTarget = null; isSitting = false; local.vy = 0;
      }

      const em = emoteRef.current;
      if (em && em.nonce !== lastEmoteNonce) {
        lastEmoteNonce = em.nonce;
        triggerEmote(local, em.emote, now);
      }

      let ix = 0; let iz = 0;
      if (!isTyping()) {
        if (keys.has("w") || keys.has("arrowup")) iz += 1;
        if (keys.has("s") || keys.has("arrowdown")) iz -= 1;
        if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
        if (keys.has("d") || keys.has("arrowright")) ix += 1;
      }
      const joy = joystickRef.current;
      if (Math.abs(joy.x) > 0.12 || Math.abs(joy.y) > 0.12) { ix += joy.x; iz += -joy.y; }

      if ((ix !== 0 || iz !== 0) && isSitting) {
        isSitting = false;
        playerPos.x += Math.sin(playerRot) * 0.8;
        playerPos.z += Math.cos(playerRot) * 0.8;
      }

      const speed = keys.has("shift") ? 6.6 : 3.7;
      let moveSpeed = 0;

      if (isSitting) {
        playerPos.x += (sitTarget.x - playerPos.x) * Math.min(1, dt * 10);
        playerPos.z += (sitTarget.z - playerPos.z) * Math.min(1, dt * 10);
        playerRot = angleLerp(playerRot, sitRotY, Math.min(1, dt * 10));
        collide(playerPos);
      } else if (ix !== 0 || iz !== 0) {
        walkTarget = null;
        const len = Math.hypot(ix, iz) || 1;
        ix /= len; iz /= len;
        const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const dir = fwd.multiplyScalar(iz).add(right.multiplyScalar(ix));
        if (dir.lengthSq() > 1e-6) dir.normalize();
        playerPos.addScaledVector(dir, speed * dt);
        collide(playerPos);
        playerRot = angleLerp(playerRot, Math.atan2(dir.x, dir.z), Math.min(1, dt * 13));
        moveSpeed = speed;
      } else if (walkTarget) {
        const dx = walkTarget.x - playerPos.x;
        const dz = walkTarget.z - playerPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.25) {
          walkTarget = null;
        } else {
          const dir = new THREE.Vector3(dx / dist, 0, dz / dist);
          playerPos.addScaledVector(dir, Math.min(speed * dt, dist));
          collide(playerPos);
          playerRot = angleLerp(playerRot, Math.atan2(dir.x, dir.z), Math.min(1, dt * 13));
          moveSpeed = speed;
        }
      }

      probeOrigin.set(playerPos.x, (local.y || 0) + STEP_UP_REACH, playerPos.z);
      rayFloor.set(probeOrigin, DOWN);
      const gHits = rayFloor.intersectObjects(floorMeshes, true);
      let groundY = lastGroundY;
      if (gHits.length) {
        groundY = gHits[0].point.y;
        lastGroundY = groundY;
      }

      const spin = animateAvatar(local, moveSpeed, dt, now, undefined, isSitting, groundY);
      local.group.position.set(playerPos.x, local.y, playerPos.z);
      local.group.rotation.y = playerRot + spin;
      positionRef.current = { x: playerPos.x, z: playerPos.z, rotY: playerRot };

      /* ---------------- REMOTE PLAYER SYNC ---------------- */
      const activeIds = new Set<string>();
      const remotes = remoteRef.current || [];

      for (const p of remotes) {
        const id = getRemoteId(p);
        if (!id) continue;
        activeIds.add(id);

        let ra = remoteAvatars.get(id);

        if (!ra) {
          const base = makeAvatar(
            p.gender || "female",
            p.color || "#ff6b6b",
            p.hat || "none",
            p.name || "Guest",
            false,
          );
          ra = Object.assign(base, {
            lastX: p.x,
            lastZ: p.z,
            lastEmoteNonce: 0,
          }) as RemoteAvatar;
          ra.group.position.set(p.x, 0, p.z);
          ra.group.rotation.y = p.rotY || 0;
          scene.add(ra.group);
          remoteAvatars.set(id, ra);
        }

        const prevX = ra.group.position.x;
        const prevZ = ra.group.position.z;
        const dxTarget = p.x - prevX;
        const dzTarget = p.z - prevZ;
        const distToTarget = Math.hypot(dxTarget, dzTarget);

        if (distToTarget > 4) {
          ra.group.position.x = p.x;
          ra.group.position.z = p.z;
        } else {
          const t = Math.min(1, dt * 10);
          ra.group.position.x = prevX + dxTarget * t;
          ra.group.position.z = prevZ + dzTarget * t;
        }

        ra.group.rotation.y = angleLerp(ra.group.rotation.y, p.rotY || 0, Math.min(1, dt * 12));

        const remoteEmote = (p as any).emote;
        const remoteEmoteNonce = (p as any).emoteNonce;
        if (remoteEmote && remoteEmoteNonce !== undefined && remoteEmoteNonce !== ra.lastEmoteNonce) {
          ra.lastEmoteNonce = remoteEmoteNonce;
          triggerEmote(ra, remoteEmote, now);
        }

        const movedDist = Math.hypot(
          ra.group.position.x - ra.lastX,
          ra.group.position.z - ra.lastZ,
        );
        const remoteSpeed = dt > 0 ? Math.min(movedDist / dt, 8) : 0;
        ra.lastX = ra.group.position.x;
        ra.lastZ = ra.group.position.z;

        probeOrigin.set(ra.group.position.x, (ra.y || 0) + STEP_UP_REACH, ra.group.position.z);
        rayFloor.set(probeOrigin, DOWN);
        const rHits = rayFloor.intersectObjects(floorMeshes, true);
        const rGround = rHits.length ? rHits[0].point.y : 0;

        animateAvatar(ra, remoteSpeed, dt, now, undefined, false, rGround);
      }

      for (const [id, ra] of remoteAvatars.entries()) {
        if (!activeIds.has(id)) {
          scene.remove(ra.group);
          remoteAvatars.delete(id);
        }
      }

      for (let i = 0; i < frameUnits.length; i++) {
        const fu = frameUnits[i];
        const want = i === hoveredSlot ? 1 : 0;
        fu.hover += (want - fu.hover) * Math.min(1, dt * 9);
        fu.group.scale.setScalar(1 + fu.hover * 0.035);
        (fu.glow.material as THREE.MeshBasicMaterial).opacity = fu.hover * 0.75;
      }

      const isPlaying = !!cinemaVideo && !cinemaVideo.paused;

      const targetIntensity = isTheaterDark ? 0.02 : 3.5;
      theater.theaterLights[0].intensity += (targetIntensity - theater.theaterLights[0].intensity) * dt * 3;
      theater.theaterLights[1].intensity += ((isTheaterDark ? 0.05 : 2.5) - theater.theaterLights[1].intensity) * dt * 3;
      theater.theaterLights[2].intensity += ((isTheaterDark ? 0.05 : 2.5) - theater.theaterLights[2].intensity) * dt * 3;

      const targetGlow = isTheaterDark && isPlaying ? 2.5 + Math.random() * 0.5 : 0;
      theater.screenGlow.intensity += (targetGlow - theater.screenGlow.intensity) * dt * 5;

      const targetBeamOpacity = isTheaterDark && isPlaying ? 0.12 + Math.random() * 0.02 : 0;
      theater.beamMat.opacity += (targetBeamOpacity - theater.beamMat.opacity) * dt * 4;

      bob += dt * (moveSpeed > 0.1 ? 9 + moveSpeed : 1.4);

      camTarget.set(
        playerPos.x,
        (isSitting ? 1.0 : 1.4) + (moveSpeed > 0.1 ? Math.sin(bob) * 0.035 : Math.sin(now / 2600) * 0.012) + local.y,
        playerPos.z,
      );

      camOffset
        .set(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch))
        .multiplyScalar(camDist);

      camDesired.copy(camTarget).add(camOffset);
      clampCamera(camDesired);
      camDesired.y = THREE.MathUtils.clamp(camDesired.y, local.y + 0.75, HALL.h + 2.6);

      camera.position.lerp(camDesired, Math.min(1, dt * 7.5));
      camera.lookAt(camTarget);

      const targetFov = baseFov + (keys.has("shift") && moveSpeed > 0.1 ? 7 : 0);
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
        camera.updateProjectionMatrix();
      }

      if (composer) composer.render(dt); else renderer.render(scene, camera);
    };

    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerup", forcePlayVideos);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("wheel", onWheel);
      videoEls.forEach((v) => { v.pause(); v.removeAttribute("src"); v.load(); });
      disposables.forEach((d) => d.dispose());
      for (const [, ra] of remoteAvatars.entries()) {
        scene.remove(ra.group);
      }
      remoteAvatars.clear();
      composer?.dispose();
      envRT.texture.dispose();
      pmrem.dispose();
      scene.clear();
      renderer.dispose();
      if (canvas.parentNode === mount) mount.removeChild(canvas);
      apiRef.current = null;
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0" aria-label="3D gallery" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(80,90,110,0.22)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_95%_at_50%_0%,rgba(255,255,255,0.14),transparent_58%)]" />
    </div>
  );
}