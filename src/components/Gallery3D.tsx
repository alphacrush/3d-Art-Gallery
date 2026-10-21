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
import {
  emoteBubbleTexture, marble, nameplateTexture, plaqueTexture, plaster,
  rugTexture, shaftTexture, signTexture, skylightTexture, softDot, velvet, wallTextTexture, woodFloor,
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
  onSelectExhibit: (ex: ExhibitDTO) => void;
};

/* ------------------------------------------------------------------ helpers */

/* Contemporary white-cube palette: soft steel, warm oak, matte ink. */
const BRASS = new THREE.MeshStandardMaterial({ color: 0xaeb2b8, metalness: 0.8, roughness: 0.38 });
const DARK_WOOD = new THREE.MeshStandardMaterial({ color: 0xc5ab86, roughness: 0.62, metalness: 0.02 });
const INK = new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.52, metalness: 0.1 });
const EMISSIVE_WARM = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xf4f7ff,
  emissiveIntensity: 2.6,
  roughness: 0.35,
});

/* ------------------------------------------------------------------ avatar */

type Puff = { sprite: THREE.Sprite; life: number };

const EMOTE_MS: Record<string, number> = { wave: 1800, dance: 2600, jump: 700, spin: 900, bow: 1600 };

function animateAvatar(a: AvatarParts, speed: number, dt: number, now: number, spawnPuff?: (x: number, y: number, z: number) => void) {
  const moving = speed > 0.15;
  if (moving) a.walkPhase += dt * (4.4 + speed * 2.4);
  const p = a.walkPhase;
  const swing = moving ? Math.sin(p) * 0.8 : 0;
  a.legL.rotation.x = swing;
  a.legR.rotation.x = -swing;
  a.armL.rotation.x = -swing * 0.85;
  a.armR.rotation.x = swing * 0.85;
  a.armL.rotation.z = 0.14;
  a.armR.rotation.z = -0.14;
  a.body.position.y = moving ? Math.abs(Math.cos(p)) * 0.075 : Math.sin(now / 850 + p) * 0.018;
  a.body.rotation.z = moving ? Math.sin(p) * 0.035 : 0;
  a.body.rotation.x = 0;
  a.body.scale.setScalar(1 + Math.sin(now / 850 + p) * 0.012);
  a.head.rotation.z = moving ? Math.sin(p) * 0.05 : Math.sin(now / 1500 + p) * 0.05;
  a.head.rotation.y = moving ? 0 : Math.sin(now / 2600 + p) * 0.22;
  a.hairFlow.rotation.z = moving ? Math.sin(p - 0.5) * 0.065 : Math.sin(now / 1200 + p) * 0.025;
  a.hairFlow.rotation.x = moving && a.gender === "female" ? Math.cos(p) * 0.035 : 0;
  if (a.skirt) a.skirt.rotation.z = moving ? Math.sin(p - 0.8) * 0.065 : Math.sin(now / 1500 + p) * 0.014;
  let spinExtra = 0;

  // blinking
  if (now > a.nextBlink && a.blinkUntil === 0) {
    a.blinkUntil = now + 130;
    a.nextBlink = now + 2200 + Math.random() * 4200;
  }
  const blinking = now < a.blinkUntil;
  a.eyes.scale.y = blinking ? 0.12 : 1;
  if (now > a.blinkUntil && a.blinkUntil !== 0) a.blinkUntil = 0;

  // jump physics
  if (a.y > 0 || a.vy > 0) {
    a.y += a.vy * dt;
    a.vy -= 15 * dt;
    if (a.y <= 0) {
      a.y = 0;
      a.vy = 0;
    }
    a.armL.rotation.z = 2.5;
    a.armR.rotation.z = -2.5;
  }

  if (a.emote) {
    const t = (now - a.emoteStart) / (EMOTE_MS[a.emote] || 1500);
    if (t >= 1) a.emote = "";
    else if (a.emote === "wave") {
      a.armR.rotation.z = -2.5;
      a.armR.rotation.x = Math.sin(t * Math.PI * 7) * 0.6;
      a.head.rotation.z = Math.sin(t * Math.PI * 4) * 0.12;
    } else if (a.emote === "dance") {
      a.body.position.y += Math.abs(Math.sin(t * Math.PI * 7)) * 0.18;
      a.body.rotation.z = Math.sin(t * Math.PI * 7) * 0.2;
      a.armL.rotation.z = 2.3 + Math.sin(t * Math.PI * 7) * 0.55;
      a.armR.rotation.z = -2.3 - Math.cos(t * Math.PI * 7) * 0.55;
      a.head.rotation.z = Math.cos(t * Math.PI * 7) * 0.18;
      spinExtra = t * Math.PI * 4;
    } else if (a.emote === "spin") {
      spinExtra = t * Math.PI * 2;
      a.armL.rotation.z = 1.9;
      a.armR.rotation.z = -1.9;
    } else if (a.emote === "bow") {
      a.body.rotation.x = Math.sin(Math.min(t * 1.4, 1) * Math.PI) * 0.6;
      a.armL.rotation.x = -0.6;
      a.armR.rotation.x = -0.6;
    }
  }

  // contact shadow responds to height
  const lift = Math.min(a.y / 1.2, 1);
  a.blob.scale.setScalar(1 - lift * 0.35);
  (a.blob.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - lift * 0.65);

  // emote bubble fade
  const bm = a.bubble.material as THREE.SpriteMaterial;
  if (now < a.bubbleUntil) {
    const remain = (a.bubbleUntil - now) / 700;
    bm.opacity = Math.min(1, remain);
    const pop = 1 + Math.max(0, 1 - (a.bubbleUntil - now) / 220) * 0.0;
    a.bubble.scale.setScalar(0.62 * pop);
    a.bubble.position.y = 2.84 + Math.sin(now / 260) * 0.04;
  } else if (bm.opacity > 0) {
    bm.opacity = Math.max(0, bm.opacity - dt * 3);
  }

  // footstep dust
  if (moving && spawnPuff && now > a.nextPuff) {
    a.nextPuff = now + 300;
    const wp = a.group.position;
    spawnPuff(wp.x + (Math.random() - 0.5) * 0.3, 0.06, wp.z + (Math.random() - 0.5) * 0.3);
  }

  a.group.position.y = a.y;
  return spinExtra;
}

/* ------------------------------------------------------------------ collision */

const OBSTACLES = [
  { minX: -8.4, maxX: -3.6, minZ: -0.45, maxZ: 0.45 }, // panel A
  { minX: 4.6, maxX: 9.4, minZ: -0.45, maxZ: 0.45 }, // panel B
  { minX: -0.9, maxX: 1.9, minZ: -5.6, maxZ: -3.4 }, // sculpture pedestal
  { minX: -1.6, maxX: 1.6, minZ: 4.6, maxZ: 5.6 }, // bench south
  { minX: -13.4, maxX: -10.6, minZ: -5.4, maxZ: -4.4 },
  { minX: 11.6, maxX: 14.4, minZ: 4.4, maxZ: 5.4 },
  // columns
  { minX: -15.1, maxX: -13.9, minZ: -9.6, maxZ: -8.4 },
  { minX: 13.9, maxX: 15.1, minZ: -9.6, maxZ: -8.4 },
  { minX: -15.1, maxX: -13.9, minZ: 8.4, maxZ: 9.6 },
  { minX: 13.9, maxX: 15.1, minZ: 8.4, maxZ: 9.6 },
];

function collide(pos: THREE.Vector3) {
  pos.x = THREE.MathUtils.clamp(pos.x, -HALL.w / 2 + 0.85, HALL.w / 2 - 0.85);
  pos.z = THREE.MathUtils.clamp(pos.z, -HALL.d / 2 + 0.85, HALL.d / 2 - 0.85);
  const r = 0.42;
  for (const o of OBSTACLES) {
    const cx = THREE.MathUtils.clamp(pos.x, o.minX, o.maxX);
    const cz = THREE.MathUtils.clamp(pos.z, o.minZ, o.maxZ);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.z = cz + (dz / d) * r;
      } else {
        pos.z = o.maxZ + r;
      }
    }
  }
}

/* ------------------------------------------------------------------ component */

export default function Gallery3D(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const exhibitsRef = useRef<ExhibitDTO[]>(props.exhibits);
  const identityRef = useRef<Identity>(props.identity);
  const qualityRef = useRef<Quality>(props.quality);
  const apiRef = useRef<{ rebuild: (ex: ExhibitDTO[]) => void; setIdentity: (id: Identity) => void; setQuality: (q: Quality) => void } | null>(null);
  const nearIdRef = useRef<number | null>(null);

  useEffect(() => { exhibitsRef.current = props.exhibits; }, [props.exhibits]);
  useEffect(() => { identityRef.current = props.identity; }, [props.identity]);
  useEffect(() => { qualityRef.current = props.quality; }, [props.quality]);

  useEffect(() => { apiRef.current?.rebuild(props.exhibits); }, [props.exhibits]);
  useEffect(() => { apiRef.current?.setIdentity(props.identity); }, [props.identity]);
  useEffect(() => { apiRef.current?.setQuality(props.quality); }, [props.quality]);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;
    const mount: HTMLDivElement = mountEl;

    const cinematic = qualityRef.current === "cinematic";

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, cinematic ? 2 : 1.4));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef1f5);
    scene.fog = new THREE.Fog(0xeef1f5, 44, 96);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
    let baseFov = 55;

    /* image-based lighting for real reflections */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.85;

    /* ---------------- lights ---------------- */
    scene.add(new THREE.HemisphereLight(0xf2f7ff, 0xd8d2c6, 1.25));

    const sun = new THREE.DirectionalLight(0xfff6e8, 2.1);
    sun.position.set(9, 18, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(cinematic ? 2048 : 1024, cinematic ? 2048 : 1024);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.camera.far = 46;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    // Cool bounce from the skylight keeps shadows open and airy.
    const bounce = new THREE.DirectionalLight(0xdfe9f7, 0.55);
    bounce.position.set(-8, 6, -10);
    scene.add(bounce);

    const fillA = new THREE.PointLight(0xffffff, 16, 24, 2);
    fillA.position.set(-12, 4.6, 7);
    const fillB = new THREE.PointLight(0xffffff, 16, 24, 2);
    fillB.position.set(12, 4.6, -7);
    scene.add(fillA, fillB);

    const sculptureSpot = new THREE.SpotLight(0xffffff, 70, 14, 0.42, 0.8, 1.6);
    sculptureSpot.position.set(0.5, 5.6, -1.4);
    sculptureSpot.target.position.set(0.5, 1.6, -4.5);
    sculptureSpot.castShadow = cinematic;
    if (sculptureSpot.shadow) {
      sculptureSpot.shadow.mapSize.set(1024, 1024);
      sculptureSpot.shadow.bias = -0.001;
    }
    scene.add(sculptureSpot, sculptureSpot.target);

    const skySpot = new THREE.SpotLight(0xeaf3ff, 85, 22, 0.78, 0.95, 1.3);
    skySpot.position.set(0, HALL.h - 0.2, 0);
    skySpot.target.position.set(0, 0, 1.6);
    scene.add(skySpot, skySpot.target);

    /* ---------------- materials ---------------- */
    const wood = woodFloor();
    const wallTex = plaster("#f7f6f3");
    const marbleTex = marble();

    const floorMat = new THREE.MeshPhysicalMaterial({
      map: wood.map,
      normalMap: wood.normal,
      roughnessMap: wood.rough,
      normalScale: new THREE.Vector2(0.34, 0.34),
      roughness: 0.74,
      metalness: 0.0,
      clearcoat: 0.22,
      clearcoatRoughness: 0.6,
      envMapIntensity: 0.5,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex.map,
      normalMap: wallTex.normal,
      normalScale: new THREE.Vector2(0.18, 0.18),
      roughness: 0.97,
      envMapIntensity: 0.55,
    });
    const marbleMat = new THREE.MeshPhysicalMaterial({
      map: marbleTex.map,
      normalMap: marbleTex.normal,
      roughness: 0.3,
      metalness: 0.0,
      clearcoat: 0.45,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.8,
    });
    // Upholstery linen in warm greige / soft sage.
    const velvetRed = new THREE.MeshPhysicalMaterial({ map: velvet("#cfc6b6"), roughness: 0.96, sheen: 0.5, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.4 });

    /* ---------------- room shell ---------------- */
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = "floor";
    scene.add(floor);

    // marble entrance inlay
    const inlay = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.4), marbleMat);
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.set(0, 0.006, 10);
    inlay.receiveShadow = true;
    scene.add(inlay);
    const inlayRing = new THREE.Mesh(new THREE.RingGeometry(2.18, 2.26, 64), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 }));
    inlayRing.rotation.x = -Math.PI / 2;
    inlayRing.position.set(0, 0.01, 10);
    scene.add(inlayRing);

    const mkWall = (w: number, x: number, z: number, rotY: number) => {
      const g = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, HALL.h, 0.3), wallMat);
      wall.position.y = HALL.h / 2;
      wall.receiveShadow = true;
      g.add(wall);

      // Recessed shadow gap at the base — the detail that reads as "gallery".
      const reveal = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.1), INK);
      reveal.position.set(0, 0.1, 0.16);
      g.add(reveal);

      // Minimal flush skirting in pale oak.
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.33), DARK_WOOD);
      skirt.position.y = 0.05;
      skirt.receiveShadow = true;
      g.add(skirt);

      // Picture rail: a single crisp line near the ceiling.
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, 0.34), BRASS);
      rail.position.y = HALL.h - 0.55;
      g.add(rail);

      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      scene.add(g);
    };
    mkWall(HALL.w, 0, -HALL.d / 2 - 0.15, 0);
    mkWall(HALL.w, 0, HALL.d / 2 + 0.15, 0);
    mkWall(HALL.d, -HALL.w / 2 - 0.15, 0, Math.PI / 2);
    mkWall(HALL.d, HALL.w / 2 + 0.15, 0, Math.PI / 2);

    /* ceiling with coffers + skylight */
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(HALL.w, HALL.d),
      new THREE.MeshStandardMaterial({ color: 0xfbfbfc, roughness: 1, envMapIntensity: 0.3 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = HALL.h;
    scene.add(ceiling);

    /* Large north-light skylight: the hall's main light source. */
    const SKY_W = 20;
    const SKY_D = 9;
    const skyGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(SKY_W, SKY_D),
      new THREE.MeshStandardMaterial({
        map: skylightTexture(),
        emissive: 0xffffff,
        emissiveIntensity: 1.35,
        roughness: 1,
      }),
    );
    skyGlass.rotation.x = Math.PI / 2;
    skyGlass.position.set(0, HALL.h - 0.03, 0);
    scene.add(skyGlass);

    // Slim white mullions across the glazing.
    const mullion = new THREE.MeshStandardMaterial({ color: 0xf2f3f5, roughness: 0.8 });
    for (let i = 1; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, SKY_D), mullion);
      bar.position.set(-SKY_W / 2 + (i * SKY_W) / 6, HALL.h - 0.1, 0);
      scene.add(bar);
    }
    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(SKY_W, 0.16, 0.1), mullion);
    crossBar.position.set(0, HALL.h - 0.1, 0);
    scene.add(crossBar);

    // Deep reveal around the opening so daylight feels architectural.
    const revealMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    for (const [w, d, x, z] of [
      [SKY_W + 1.1, 0.55, 0, -SKY_D / 2 - 0.27],
      [SKY_W + 1.1, 0.55, 0, SKY_D / 2 + 0.27],
    ] as const) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), revealMat);
      r.position.set(x, HALL.h - 0.26, z);
      r.receiveShadow = true;
      scene.add(r);
    }
    for (const sx of [-SKY_W / 2 - 0.27, SKY_W / 2 + 0.27]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, SKY_D + 1.1), revealMat);
      r.position.set(sx, HALL.h - 0.26, 0);
      r.receiveShadow = true;
      scene.add(r);
    }

    /* ---------------- columns: slim white piers ---------------- */
    const colMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f7, roughness: 0.85, envMapIntensity: 0.5 });
    for (const [cx, cz] of [[-14.5, -9], [14.5, -9], [-14.5, 9], [14.5, 9]] as const) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.78, HALL.h, 0.78), colMat);
      pier.position.set(cx, HALL.h / 2, cz);
      pier.castShadow = pier.receiveShadow = true;
      scene.add(pier);
      // shadow-gap base matching the walls
      const gap = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 0.84), INK);
      gap.position.set(cx, 0.1, cz);
      scene.add(gap);
    }

    /* ---------------- centre rug ---------------- */
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 56),
      new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1, envMapIntensity: 0.15 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.5, 0.012, 1.6);
    rug.receiveShadow = true;
    scene.add(rug);

    /* ---------------- sculpture ---------------- */
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.05, 1.6), marbleMat);
    pedestal.position.set(0.5, 0.525, -4.5);
    pedestal.castShadow = pedestal.receiveShadow = true;
    const pedTop = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.16, 1.85), marbleMat);
    pedTop.position.set(0.5, 1.13, -4.5);
    pedTop.castShadow = true;
    const pedBase = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.9), marbleMat);
    pedBase.position.set(0.5, 0.09, -4.5);
    scene.add(pedestal, pedTop, pedBase);

    const sculpture = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.58, 0.2, cinematic ? 220 : 120, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xf0f1f3,
        metalness: 1,
        roughness: 0.08,
        clearcoat: 1,
        envMapIntensity: 2.2,
      }),
    );
    sculpture.position.set(0.5, 2.2, -4.5);
    sculpture.castShadow = true;
    scene.add(sculpture);

    // A single discreet floor marker replaces the rope barrier.
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(2.24, 2.3, 64),
      new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 0.7 }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(0.5, 0.013, -4.5);
    scene.add(marker);

    /* ---------------- free-standing panels ---------------- */
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xf7f7f8, roughness: 0.93, envMapIntensity: 0.5 });
    for (const px of [-6, 7]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(4.8, 4.4, 0.3), panelMat);
      panel.position.set(px, 2.22, 0);
      panel.castShadow = panel.receiveShadow = true;
      // floating shadow gap instead of a plinth
      const gap = new THREE.Mesh(new THREE.BoxGeometry(4.86, 0.06, 0.36), INK);
      gap.position.set(px, 0.03, 0);
      scene.add(panel, gap);
    }

    /* ---------------- benches ---------------- */
    const mkBench = (x: number, z: number, rotY = 0) => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.14, 0.86), DARK_WOOD);
      seat.position.y = 0.44;
      seat.castShadow = seat.receiveShadow = true;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.1, 0.74), velvetRed);
      pad.position.y = 0.55;
      pad.castShadow = true;
      g.add(seat, pad);
      for (const s2 of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, 0.74), BRASS);
        leg.position.set(1.15 * s2, 0.22, 0);
        leg.castShadow = true;
        g.add(leg);
      }
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      scene.add(g);
    };
    mkBench(0, 5.1, 0);
    mkBench(-12, -4.9, Math.PI / 2);
    mkBench(13, 4.9, -Math.PI / 2);

    /* ---------------- plants ---------------- */
    const potMat = new THREE.MeshPhysicalMaterial({ color: 0xa85c34, roughness: 0.6, clearcoat: 0.4 });
    const leafMat = new THREE.MeshPhysicalMaterial({ color: 0x3f7a2e, roughness: 0.65, sheen: 0.7, sheenColor: new THREE.Color(0x9fd67a), clearcoat: 0.3, side: THREE.DoubleSide });
    const mkPlant = (x: number, z: number, scale = 1) => {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.26, 0.55, 16), potMat);
      pot.position.y = 0.275;
      pot.castShadow = pot.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 20), potMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.54;
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 1 }));
      soil.position.y = 0.55;
      g.add(pot, rim, soil);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const stemH = 0.5 + Math.random() * 0.7;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.024, stemH, 6), new THREE.MeshStandardMaterial({ color: 0x4a7a2c, roughness: 0.9 }));
        stem.position.set(Math.cos(a) * 0.09, 0.55 + stemH / 2, Math.sin(a) * 0.09);
        stem.rotation.z = Math.cos(a) * 0.28;
        stem.rotation.x = -Math.sin(a) * 0.28;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2 + Math.random() * 0.1, 12, 8), leafMat);
        leaf.scale.set(1.5, 0.22, 0.85);
        leaf.position.set(Math.cos(a) * (0.22 + stemH * 0.22), 0.55 + stemH, Math.sin(a) * (0.22 + stemH * 0.22));
        leaf.rotation.set(Math.random() * 0.6, a, Math.random() * 0.5 - 0.25);
        leaf.castShadow = true;
        g.add(stem, leaf);
      }
      g.position.set(x, 0, z);
      g.scale.setScalar(scale);
      scene.add(g);
    };
    mkPlant(-17.4, -11.2, 1.25);
    mkPlant(17.4, -11.2, 1.25);
    mkPlant(-17.4, 11.2, 1.1);
    mkPlant(17.4, 11.2, 1.1);
    mkPlant(-3.4, 11.6, 0.95);
    mkPlant(3.6, 11.6, 0.95);

    /* ---------------- entrance: glazed opening ---------------- */
    const doorZ = HALL.d / 2 - 0.16;
    // Bright daylight beyond the doorway.
    const doorLight = new THREE.Mesh(
      new THREE.PlaneGeometry(3.3, 3.8),
      new THREE.MeshBasicMaterial({ color: 0xf4f8ff, toneMapped: false }),
    );
    doorLight.position.set(0, 1.9, doorZ + 0.08);
    doorLight.rotation.y = Math.PI;
    scene.add(doorLight);

    // Slim dark reveal framing the opening.
    const jamb = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.55 });
    for (const sx of [-1.74, 1.74]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.0, 0.34), jamb);
      post.position.set(sx, 2.0, doorZ);
      scene.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.62, 0.14, 0.34), jamb);
    lintel.position.set(0, 3.93, doorZ);
    scene.add(lintel);

    const doorSpill = new THREE.PointLight(0xeaf2ff, 22, 12, 2);
    doorSpill.position.set(0, 2.2, doorZ - 1.4);
    scene.add(doorSpill);

    /* ---------------- wall vinyl text + signage ---------------- */
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 2.2),
      new THREE.MeshStandardMaterial({ map: signTexture("ATELIER", "contemporary collection · live visitors"), transparent: true, roughness: 0.9 }),
    );
    sign.position.set(0, 4.35, -HALL.d / 2 + 0.07);
    scene.add(sign);

    const westText = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 1.55),
      new THREE.MeshStandardMaterial({ map: wallTextTexture("Permanent Collection", "pictures · video clips · live visitors"), transparent: true, roughness: 0.9 }),
    );
    westText.position.set(-HALL.w / 2 + 0.07, 4.35, 0);
    westText.rotation.y = Math.PI / 2;
    scene.add(westText);

    const eastText = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 1.55),
      new THREE.MeshStandardMaterial({ map: wallTextTexture("Moving Image Wall", "video clips play live on canvas"), transparent: true, roughness: 0.9 }),
    );
    eastText.position.set(HALL.w / 2 - 0.07, 4.35, 0);
    eastText.rotation.y = -Math.PI / 2;
    scene.add(eastText);

    /* ---------------- chandeliers ---------------- */
    const chandelierLights: THREE.PointLight[] = [];

    /* Ceiling track lighting — slim rails with small cylindrical spots. */
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x2c2c32, roughness: 0.5, metalness: 0.3 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x35353c, roughness: 0.4, metalness: 0.5 });
    for (const tz of [-8.4, 0, 8.4]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(HALL.w - 5, 0.07, 0.07), trackMat);
      rail.position.set(0, HALL.h - 0.3, tz);
      scene.add(rail);

      for (let i = 0; i < 7; i++) {
        const hx = -13.5 + i * 4.5;
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 14), headMat);
        head.position.set(hx, HALL.h - 0.5, tz);
        head.rotation.z = 0.22 * (tz > 0 ? -1 : tz < 0 ? 1 : 0);
        head.castShadow = false;
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.094, 16), EMISSIVE_WARM);
        lens.position.set(hx, HALL.h - 0.655, tz);
        lens.rotation.x = -Math.PI / 2;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.17, 8), trackMat);
        stem.position.set(hx, HALL.h - 0.37, tz);
        scene.add(head, lens, stem);
      }
    }

    /* ---------------- dust motes ---------------- */
    const moteCount = cinematic ? 620 : 180;
    const moteGeo = new THREE.BufferGeometry();
    const motePos = new Float32Array(moteCount * 3);
    const moteSeed = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * (HALL.w - 2);
      motePos[i * 3 + 1] = Math.random() * (HALL.h - 0.6) + 0.3;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * (HALL.d - 2);
      moteSeed[i] = Math.random() * Math.PI * 2;
    }
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      size: 0.05,
      map: softDot(),
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
      color: 0xffffff,
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    scene.add(motes);

    /* ---------------- skylight shafts ---------------- */
    const shaftMat = new THREE.MeshBasicMaterial({
      map: shaftTexture(),
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shafts: THREE.Mesh[] = [];
    for (const sx of [-6.6, 0, 6.6]) {
      const shaft = new THREE.Mesh(new THREE.ConeGeometry(3.4, HALL.h, 22, 1, true), shaftMat);
      shaft.position.set(sx, HALL.h / 2, 0.2);
      shaft.rotation.x = Math.PI;
      scene.add(shaft);
      shafts.push(shaft);
    }

    /* ---------------- footstep dust pool ---------------- */
    const puffTex = softDot("rgba(240,225,200,0.85)", "rgba(220,200,170,0)");
    const puffs: Puff[] = [];
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending }));
      sp.scale.setScalar(0.2);
      sp.visible = false;
      scene.add(sp);
      puffs.push({ sprite: sp, life: 0 });
    }
    let puffIdx = 0;
    const spawnPuff = (x: number, y: number, z: number) => {
      const p = puffs[puffIdx++ % puffs.length];
      p.sprite.position.set(x, y, z);
      p.sprite.visible = true;
      p.life = 1;
      (p.sprite.material as THREE.SpriteMaterial).opacity = 0.4;
      p.sprite.scale.setScalar(0.16);
    };

    /* ---------------- exhibits ---------------- */
    const framesGroup = new THREE.Group();
    scene.add(framesGroup);
    const videoEls: HTMLVideoElement[] = [];
    const disposables: Array<{ dispose: () => void }> = [];
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const artMeshes: THREE.Mesh[] = [];
    type FrameUnit = { group: THREE.Group; glow: THREE.Mesh; hover: number; baseZ: number };
    const frameUnits: FrameUnit[] = [];

    // Gallery-standard frames: matte black, natural oak, and off-white.
    const frameMats = [
      new THREE.MeshStandardMaterial({ color: 0x25252b, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xcdb292, roughness: 0.68, metalness: 0.0, envMapIntensity: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0xf2f1ee, roughness: 0.7, metalness: 0.0, envMapIntensity: 0.5 }),
    ];
    const glowMat = new THREE.MeshBasicMaterial({
      map: softDot("rgba(120,170,255,0.75)", "rgba(120,170,255,0)"),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coneMat = new THREE.MeshBasicMaterial({
      map: shaftTexture(),
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    function fitPlane(mesh: THREE.Mesh, texW: number, texH: number) {
      const maxW = 2.28;
      const maxH = 1.64;
      const ar = texW / Math.max(texH, 1);
      let w = maxW;
      let h = w / ar;
      if (h > maxH) {
        h = maxH;
        w = h * ar;
      }
      mesh.scale.set(w, h, 1);
    }

    function rebuild(exList: ExhibitDTO[]) {
      // release GPU memory from the previous hang before rebuilding
      framesGroup.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
      framesGroup.clear();
      artMeshes.length = 0;
      frameUnits.length = 0;
      videoEls.forEach((v) => { v.pause(); v.removeAttribute("src"); v.load(); });
      videoEls.length = 0;
      disposables.forEach((d) => d.dispose());
      disposables.length = 0;

      exList.slice(0, 30).forEach((ex, i) => {
        const pose = getSlotPose(i);
        const g = new THREE.Group();
        g.position.set(pose.x, pose.y, pose.z);
        g.rotation.y = pose.rotY;

        // Slim gallery frame: thin profile, deep white mount, no ornament.
        const frame = new THREE.Mesh(new THREE.BoxGeometry(2.62, 1.98, 0.07), frameMats[i % 3]);
        frame.castShadow = true;
        frame.receiveShadow = true;
        g.add(frame);

        const matBoard = new THREE.Mesh(
          new THREE.PlaneGeometry(2.5, 1.86),
          new THREE.MeshStandardMaterial({ color: 0xfcfcfb, roughness: 0.95 }),
        );
        matBoard.position.z = 0.038;
        g.add(matBoard);

        const artMat = new THREE.MeshBasicMaterial({ color: 0xe8e6e1 });
        const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), artMat);
        art.position.z = 0.046;
        art.scale.set(2.28, 1.64, 1);
        art.userData.exhibitId = ex.id;
        g.add(art);
        artMeshes.push(art);
        disposables.push(artMat);

        // Museum glass: a whisper of reflection.
        const glass = new THREE.Mesh(
          new THREE.PlaneGeometry(2.5, 1.86),
          new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0,
            roughness: 0.04,
            transparent: true,
            opacity: 0.05,
            envMapIntensity: 1.6,
            depthWrite: false,
          }),
        );
        glass.position.z = 0.05;
        g.add(glass);

        // Soft contact shadow behind the frame grounds it on the wall.
        const dropShadow = new THREE.Mesh(
          new THREE.PlaneGeometry(3.0, 2.34),
          new THREE.MeshBasicMaterial({
            map: softDot("rgba(40,44,54,0.42)", "rgba(40,44,54,0)"),
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          }),
        );
        dropShadow.position.set(0.04, -0.06, -0.012);
        g.add(dropShadow);

        // Hover highlight.
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 3.2), glowMat.clone());
        glow.position.z = -0.02;
        g.add(glow);

        // Discreet ceiling-spot wash falling onto the piece.
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.7, 16, 1, true), coneMat.clone());
        cone.position.set(0, 0.5, 0.42);
        cone.rotation.x = Math.PI - 0.38;
        g.add(cone);

        if (ex.mediaType === "video") {
          const video = document.createElement("video");
          video.crossOrigin = "anonymous";
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.autoplay = true;
          video.preload = "auto";
          if (ex.posterUrl) video.poster = ex.posterUrl;
          video.src = ex.url;
          videoEls.push(video);
          const vtex = new THREE.VideoTexture(video);
          vtex.colorSpace = THREE.SRGBColorSpace;
          disposables.push(vtex);
          const applyPoster = () => {
            if (ex.posterUrl) {
              loader.load(ex.posterUrl, (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                artMat.map = t;
                artMat.color.set(0xffffff);
                artMat.needsUpdate = true;
                fitPlane(art, t.image.width, t.image.height);
              }, undefined, () => undefined);
            }
          };
          video.addEventListener("loadeddata", () => {
            artMat.map = vtex;
            artMat.color.set(0xffffff);
            artMat.needsUpdate = true;
            if (video.videoWidth) fitPlane(art, video.videoWidth, video.videoHeight);
            video.play().catch(() => applyPoster());
          });
          video.addEventListener("error", applyPoster);
          applyPoster();
          const badge = new THREE.Mesh(new THREE.CircleGeometry(0.062, 16), new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 1.5 }));
          badge.position.set(1.18, -0.86, 0.12);
          const playIcon = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
          playIcon.rotation.z = -Math.PI / 2;
          playIcon.position.set(1.02, -0.86, 0.13);
          g.add(badge, playIcon);
        } else {
          loader.load(ex.url, (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 8;
            disposables.push(t);
            artMat.map = t;
            artMat.color.set(0xffffff);
            artMat.needsUpdate = true;
            fitPlane(art, t.image.width, t.image.height);
          }, undefined, () => { artMat.color.set(0xcbbfa5); });
        }

        const ptex = plaqueTexture(ex.title, ex.artist);
        disposables.push(ptex);
        const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.8, metalness: 0.05 }));
        plaque.position.set(-0.82, -1.4, 0.035);
        g.add(plaque);

        framesGroup.add(g);
        frameUnits.push({ group: g, glow, hover: 0, baseZ: g.position.z });
      });
    }

    /* ---------------- avatars ---------------- */
    const id0 = identityRef.current;
    let local = makeAvatar(id0.gender, id0.color, id0.hat, id0.name, true);
    scene.add(local.group);
    const playerPos = new THREE.Vector3(0, 0, 9.6);
    let playerRot = Math.PI;
    local.group.position.copy(playerPos);

    type Remote = { parts: AvatarParts; target: THREE.Vector3; targetRot: number; lastEmoteAt: string | null; data: PlayerDTO };
    const remotes = new Map<string, Remote>();

    function setIdentity(id: Identity) {
      const pos = local.group.position.clone();
      const rot = local.group.rotation.y;
      scene.remove(local.group);
      local = makeAvatar(id.gender, id.color, id.hat, id.name, true);
      local.group.position.copy(pos);
      local.group.rotation.y = rot;
      scene.add(local.group);
    }

    /* ---------------- post-processing ---------------- */
    let composer: EffectComposer | null = null;
    let bloom: UnrealBloomPass | null = null;
    function buildComposer(w: number, h: number) {
      composer?.dispose();
      composer = null;
      if (qualityRef.current !== "cinematic") return;
      const c = new EffectComposer(renderer);
      c.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      c.setSize(w, h);
      c.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.26, 0.7, 0.92);
      c.addPass(bloom);
      c.addPass(new OutputPass());
      c.addPass(new SMAAPass());
      composer = c;
    }
    function setQuality(q: Quality) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === "cinematic" ? 2 : 1.4));
      renderer.shadowMap.enabled = true;
      sculptureSpot.castShadow = q === "cinematic";
      moteMat.opacity = q === "cinematic" ? 0.34 : 0.2;
      const w = mount.clientWidth || 800;
      const h = mount.clientHeight || 500;
      buildComposer(w, h);
      renderer.shadowMap.needsUpdate = true;
    }

    apiRef.current = { rebuild, setIdentity, setQuality };
    rebuild(exhibitsRef.current);

    /* ---------------- input ---------------- */
    const keys = new Set<string>();
    let walkTarget: THREE.Vector3 | null = null;
    let camYaw = 0;
    let camPitch = 0.38;
    let camDist = 5.7;
    let dragging = false;
    let dragMoved = 0;
    let lastPX = 0;
    let lastPY = 0;
    let downAt = 0;
    let downX = 0;
    let downY = 0;
    let hoveredIdx = -1;

    const isTyping = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return;
      keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key === " ") triggerEmote(local, "jump", performance.now());
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hoverCheckAt = 0;

    const setNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragMoved = 0;
      lastPX = downX = e.clientX;
      lastPY = downY = e.clientY;
      downAt = performance.now();
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - lastPX;
        const dy = e.clientY - lastPY;
        lastPX = e.clientX;
        lastPY = e.clientY;
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
      if (!artMeshes.length) return;
      setNdc(e.clientX, e.clientY);
      const hit = raycaster.intersectObjects(artMeshes, false)[0];
      const id = hit ? (hit.object.userData.exhibitId as number) : -1;
      hoveredIdx = id;
      renderer.domElement.style.cursor = id !== -1 ? "pointer" : "grab";
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      const quick = performance.now() - downAt < 350 && Math.hypot(e.clientX - downX, e.clientY - downY) < 7;
      if (!quick) return;
      setNdc(e.clientX, e.clientY);
      const artHit = raycaster.intersectObjects(artMeshes, false)[0];
      if (artHit) {
        const exId = artHit.object.userData.exhibitId as number;
        const idx = exhibitsRef.current.findIndex((x) => x.id === exId);
        const ex = exhibitsRef.current[idx];
        if (ex && idx >= 0) {
          const pose = getSlotPose(idx);
          const d = Math.hypot(playerPos.x - pose.viewX, playerPos.z - pose.viewZ);
          if (d < 3.4) props.onSelectExhibit(ex);
          else walkTarget = new THREE.Vector3(pose.viewX, 0, pose.viewZ);
        }
        return;
      }
      const floorHit = raycaster.intersectObject(floor, false)[0];
      if (floorHit) {
        walkTarget = floorHit.point.clone();
        walkTarget.y = 0;
        collide(walkTarget);
      }
    };
    const onWheel = (e: WheelEvent) => {
      camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.011, 2.4, 12);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
    renderer.domElement.style.cursor = "grab";

    /* resize */
    const resize = () => {
      const w = mount.clientWidth || 800;
      const h = mount.clientHeight || 500;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (composer) {
        composer.setSize(w, h);
        bloom?.setSize(w, h);
      } else {
        buildComposer(w, h);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* ---------------- loop ---------------- */
    const clock = new THREE.Clock();
    let raf = 0;
    let lastNearCheck = 0;
    let lastTeleportNonce = 0;
    let lastEmoteNonce = 0;
    let bob = 0;

    const angleLerp = (a: number, b: number, t: number) => {
      let d = (b - a) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return a + d * t;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();

      const tp = props.teleportRef.current;
      if (tp && tp.nonce !== lastTeleportNonce) {
        lastTeleportNonce = tp.nonce;
        playerPos.set(tp.x, 0, tp.z);
        playerRot = tp.rotY;
        camYaw = tp.rotY + Math.PI;
        walkTarget = null;
      }
      const em = props.emoteRef.current;
      if (em && em.nonce !== lastEmoteNonce) {
        lastEmoteNonce = em.nonce;
        triggerEmote(local, em.emote, now);
      }

      /* input */
      let ix = 0;
      let iz = 0;
      if (!isTyping()) {
        if (keys.has("w") || keys.has("arrowup")) iz += 1;
        if (keys.has("s") || keys.has("arrowdown")) iz -= 1;
        if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
        if (keys.has("d") || keys.has("arrowright")) ix += 1;
      }
      const joy = props.joystickRef.current;
      if (Math.abs(joy.x) > 0.12 || Math.abs(joy.y) > 0.12) {
        ix += joy.x;
        iz += -joy.y;
      }
      const running = keys.has("shift");
      const speed = running ? 6.6 : 3.7;
      let moveSpeed = 0;

      if (ix !== 0 || iz !== 0) {
        walkTarget = null;
        const len = Math.hypot(ix, iz) || 1;
        ix /= len;
        iz /= len;
        const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const dir = fwd.multiplyScalar(iz).add(right.multiplyScalar(ix)).normalize();
        playerPos.add(dir.multiplyScalar(speed * dt));
        collide(playerPos);
        playerRot = angleLerp(playerRot, Math.atan2(dir.x, dir.z), Math.min(1, dt * 13));
        moveSpeed = speed;
      } else if (walkTarget) {
        const to = walkTarget.clone().sub(playerPos);
        to.y = 0;
        const dist = to.length();
        if (dist < 0.25) walkTarget = null;
        else {
          const dir = to.normalize();
          playerPos.add(dir.multiplyScalar(Math.min(speed * dt, dist)));
          collide(playerPos);
          playerRot = angleLerp(playerRot, Math.atan2(dir.x, dir.z), Math.min(1, dt * 13));
          moveSpeed = speed;
        }
      }

      const spin = animateAvatar(local, moveSpeed, dt, now, spawnPuff);
      local.group.position.set(playerPos.x, local.y, playerPos.z);
      local.group.rotation.y = playerRot + spin;
      // local ring pulse
      const ring = local.group.getObjectByName("localRing") as THREE.Mesh | undefined;
      if (ring) {
        const pulse = 1 + Math.sin(now / 420) * 0.07;
        ring.scale.setScalar(pulse);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(now / 420) * 0.25;
      }
      props.positionRef.current = { x: playerPos.x, z: playerPos.z, rotY: playerRot };

      /* remote avatars */
      const remoteList = props.remoteRef.current;
      const seen = new Set<string>();
      for (const p of remoteList) {
        seen.add(p.sessionId);
        let r = remotes.get(p.sessionId);
        if (!r) {
          const parts = makeAvatar(p.gender, p.color, p.hat, p.name, false, p.isBot);
          parts.group.position.set(p.x, 0, p.z);
          scene.add(parts.group);
          r = { parts, target: new THREE.Vector3(p.x, 0, p.z), targetRot: p.rotY, lastEmoteAt: null, data: p };
          remotes.set(p.sessionId, r);
        }
        if (r.data.color !== p.color || r.data.hat !== p.hat || r.data.name !== p.name || r.data.gender !== p.gender) {
          const old = r.parts.group.position.clone();
          scene.remove(r.parts.group);
          r.parts = makeAvatar(p.gender, p.color, p.hat, p.name, false, p.isBot);
          r.parts.group.position.copy(old);
          scene.add(r.parts.group);
        }
        r.data = p;
        r.target.set(p.x, 0, p.z);
        r.targetRot = p.rotY;
        if (p.emote && p.emoteAt && p.emoteAt !== r.lastEmoteAt) {
          const age = Date.now() - new Date(p.emoteAt).getTime();
          if (age < 2600) triggerEmote(r.parts, p.emote, now);
          r.lastEmoteAt = p.emoteAt;
        }
        const gp = r.parts.group.position;
        const dx = r.target.x - gp.x;
        const dz = r.target.z - gp.z;
        const dist = Math.hypot(dx, dz);
        const t = Math.min(1, dt * 7.5);
        gp.x += dx * t;
        gp.z += dz * t;
        const rSpeed = dist > 0.06 ? Math.min(dist * 4.2, 5.2) : 0;
        const rSpin = animateAvatar(r.parts, rSpeed, dt, now, spawnPuff);
        gp.y = r.parts.y;
        r.parts.group.rotation.y = angleLerp(r.parts.group.rotation.y, r.targetRot, Math.min(1, dt * 9)) + rSpin;
      }
      for (const [id, r] of Array.from(remotes.entries())) {
        if (!seen.has(id)) {
          scene.remove(r.parts.group);
          remotes.delete(id);
        }
      }

      /* hover + near detection */
      frameUnits.forEach((fu, i) => {
        const ex = exhibitsRef.current[i];
        const want = ex && ex.id === hoveredIdx ? 1 : 0;
        fu.hover += (want - fu.hover) * Math.min(1, dt * 9);
        const g = fu.group;
        g.scale.setScalar(1 + fu.hover * 0.035);
        (fu.glow.material as THREE.MeshBasicMaterial).opacity = fu.hover * 0.75;
      });

      if (now - lastNearCheck > 200) {
        lastNearCheck = now;
        let best: ExhibitDTO | null = null;
        let bestD = 3.2;
        exhibitsRef.current.slice(0, 30).forEach((ex, i) => {
          const pose = getSlotPose(i);
          const d = Math.hypot(playerPos.x - pose.x, playerPos.z - pose.z);
          if (d < bestD) {
            bestD = d;
            best = ex;
          }
        });
        const bestId = best ? (best as ExhibitDTO).id : null;
        if (bestId !== nearIdRef.current) {
          nearIdRef.current = bestId;
          props.onNearExhibit(best);
        }
      }

      /* dust + shafts + chandeliers */
      const posAttr = moteGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < moteCount; i++) {
        let y = posAttr.getY(i) + dt * 0.12;
        if (y > HALL.h - 0.3) y = 0.25;
        const s = moteSeed[i];
        posAttr.setX(i, posAttr.getX(i) + Math.sin(now / 2600 + s) * dt * 0.16);
        posAttr.setY(i, y);
        posAttr.setZ(i, posAttr.getZ(i) + Math.cos(now / 3100 + s) * dt * 0.14);
      }
      posAttr.needsUpdate = true;
      shaftMat.opacity = 0.17 + Math.sin(now / 4200) * 0.03;
      chandelierLights.forEach((l, i) => {
        l.intensity = 32 + Math.sin(now / 380 + i * 1.7) * 3.5 + Math.sin(now / 97 + i) * 1.6;
      });

      /* footstep puffs */
      for (const p of puffs) {
        if (p.life <= 0) continue;
        p.life -= dt * 2.1;
        const m = p.sprite.material as THREE.SpriteMaterial;
        m.opacity = Math.max(0, p.life) * 0.38;
        p.sprite.scale.setScalar(0.16 + (1 - Math.max(0, p.life)) * 0.4);
        if (p.life <= 0) p.sprite.visible = false;
      }

      /* camera */
      bob += dt * (moveSpeed > 0.1 ? 9 + moveSpeed : 1.4);
      const bobY = moveSpeed > 0.1 ? Math.sin(bob) * 0.035 : Math.sin(now / 2600) * 0.012;
      const camTarget = new THREE.Vector3(playerPos.x, 1.4 + bobY, playerPos.z);
      const offset = new THREE.Vector3(
        Math.sin(camYaw) * Math.cos(camPitch),
        Math.sin(camPitch),
        Math.cos(camYaw) * Math.cos(camPitch),
      ).multiplyScalar(camDist);
      const desired = camTarget.clone().add(offset);
      desired.x = THREE.MathUtils.clamp(desired.x, -HALL.w / 2 - 3, HALL.w / 2 + 3);
      desired.z = THREE.MathUtils.clamp(desired.z, -HALL.d / 2 - 3, HALL.d / 2 + 3);
      desired.y = THREE.MathUtils.clamp(desired.y, 0.65, HALL.h + 2.6);
      camera.position.lerp(desired, Math.min(1, dt * 7.5));
      camera.lookAt(camTarget);
      const targetFov = baseFov + (running && moveSpeed > 0.1 ? 7 : 0);
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
        camera.updateProjectionMatrix();
      }

      sculpture.rotation.y += dt * 0.42;
      sculpture.rotation.x = Math.sin(now / 1700) * 0.22;
      sculpture.position.y = 2.2 + Math.sin(now / 1300) * 0.045;

      if (composer) composer.render(dt);
      else renderer.render(scene, camera);
    };

    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      videoEls.forEach((v) => v.pause());
      composer?.dispose();
      envRT.texture.dispose();
      pmrem.dispose();
      roomEnv.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0" aria-label="3D gallery" />
      {/* cinematic vignette + warm grade */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(80,90,110,0.22)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_95%_at_50%_0%,rgba(255,255,255,0.14),transparent_58%)]" />
    </div>
  );
}
