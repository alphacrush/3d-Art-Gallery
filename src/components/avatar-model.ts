import * as THREE from "three";
import type { Gender } from "@/lib/gallery";
import { nameplateTexture, emoteBubbleTexture, softDot } from "@/lib/textures";

export type AvatarParts = {
  group: THREE.Group;
  body: THREE.Group;
  head: THREE.Mesh;
  hairFlow: THREE.Group;
  skirt: THREE.Mesh | null;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  eyes: THREE.Group;
  blob: THREE.Mesh;
  bubble: THREE.Sprite;
  gender: Gender;

  // state
  walkPhase: number;
  y: number;
  vy: number;

  // blinking
  nextBlink: number;
  blinkUntil: number;

  // emote
  emote: string;
  emoteStart: number;
  bubbleUntil: number;

  // footstep timing
  nextPuff: number;
};

/* ---------- helpers ---------- */

function skinTone(): THREE.Color {
  // soft neutral skin
  return new THREE.Color(0xf1c9a5);
}

function makeNameplate(name: string, color: string): THREE.Sprite {
  const tex = nameplateTexture(name, color);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(1.4, 0.35, 1);
  sp.position.set(0, 2.35, 0);
  sp.renderOrder = 999;
  return sp;
}

function makeBubble(): THREE.Sprite {
  const tex = emoteBubbleTexture("💬");
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.setScalar(0.62);
  sp.position.set(0, 2.84, 0);
  sp.renderOrder = 1000;
  return sp;
}

function makeBlob(): THREE.Mesh {
  const geo = new THREE.CircleGeometry(0.42, 24);
  const mat = new THREE.MeshBasicMaterial({
    map: softDot("rgba(0,0,0,0.55)", "rgba(0,0,0,0)"),
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  return m;
}

function makeLimb(color: number, length: number, thickness: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.CapsuleGeometry(thickness, length - thickness * 2, 4, 8);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.y = -length / 2;
  g.add(mesh);
  return g;
}

/* ---------- main factory ---------- */

export function makeAvatar(
  gender: Gender,
  colorHex: string,
  hat: string,
  name: string,
  isLocal: boolean,
  isBot = false,
): AvatarParts {
  const group = new THREE.Group();
  const color = new THREE.Color(colorHex || "#5aa9ff").getHex();
  const skin = skinTone();

  // ----- body -----
  const body = new THREE.Group();
  body.position.y = 1.05;
  group.add(body);

  const torsoGeo = new THREE.CapsuleGeometry(0.28, 0.5, 6, 12);
  const torsoMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.castShadow = true;
  body.add(torso);

  // skirt (female only)
  let skirt: THREE.Mesh | null = null;
  if (gender === "female") {
    const sGeo = new THREE.ConeGeometry(0.42, 0.5, 16, 1, true);
    const sMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).offsetHSL(0, 0, -0.12).getHex(),
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    skirt = new THREE.Mesh(sGeo, sMat);
    skirt.position.y = -0.38;
    skirt.castShadow = true;
    body.add(skirt);
  }

  // ----- head -----
  const headGeo = new THREE.SphereGeometry(0.26, 20, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.55;
  head.castShadow = true;
  body.add(head);

  // hair
  const hairFlow = new THREE.Group();
  const hairColor = 0x3a2a1e;
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.6 });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.272, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.9), hairMat);
  cap.castShadow = true;
  hairFlow.add(cap);

  if (gender === "female") {
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 8), hairMat);
    back.position.set(0, -0.1, -0.14);
    back.castShadow = true;
    hairFlow.add(back);
  }
  head.add(hairFlow);

  // hat
  if (hat && hat !== "none") {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.5 });
    if (hat === "cap") {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
      crown.position.y = 0.08;
      head.add(crown);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 16), hatMat);
      brim.position.set(0, 0.08, 0.2);
      brim.rotation.x = 0.25;
      head.add(brim);
    } else if (hat === "beanie") {
      const beanie = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6),
        new THREE.MeshStandardMaterial({ color: 0xaa3344, roughness: 0.9 }),
      );
      beanie.position.y = 0.06;
      head.add(beanie);
    } else if (hat === "tophat") {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20), hatMat);
      base.position.y = 0.18;
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.3, 20), hatMat);
      stack.position.y = 0.34;
      head.add(base, stack);
    }
  }

  // eyes
  const eyes = new THREE.Group();
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a22 });
  const eyeGeo = new THREE.SphereGeometry(0.028, 10, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08, 0.02, 0.235);
  eyeR.position.set(0.08, 0.02, 0.235);
  eyes.add(eyeL, eyeR);
  head.add(eyes);

  // arms
  const armL = makeLimb(skin.getHex(), 0.55, 0.07);
  const armR = makeLimb(skin.getHex(), 0.55, 0.07);
  armL.position.set(-0.32, 0.22, 0);
  armR.position.set(0.32, 0.22, 0);
  body.add(armL, armR);

  // legs
  const legL = makeLimb(0x2a2a30, 0.6, 0.085);
  const legR = makeLimb(0x2a2a30, 0.6, 0.085);
  legL.position.set(-0.13, -0.28, 0);
  legR.position.set(0.13, -0.28, 0);
  body.add(legL, legR);

  // contact shadow
  const blob = makeBlob();
  group.add(blob);

  // nameplate
  const plate = makeNameplate(name + (isBot ? " 🤖" : ""), colorHex);
  group.add(plate);

  // emote bubble
  const bubble = makeBubble();
  group.add(bubble);

  // local-only ring highlight
  if (isLocal) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x5aa9ff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.52, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    ring.name = "localRing";
    group.add(ring);
  }

  return {
    group,
    body,
    head,
    hairFlow,
    skirt,
    armL,
    armR,
    legL,
    legR,
    eyes,
    blob,
    bubble,
    gender,

    walkPhase: Math.random() * Math.PI * 2,
    y: 0,
    vy: 0,

    nextBlink: performance.now() + 2000 + Math.random() * 3000,
    blinkUntil: 0,

    emote: "",
    emoteStart: 0,
    bubbleUntil: 0,

    nextPuff: 0,
  };
}

/* ---------- emote trigger ---------- */

const EMOTE_EMOJI: Record<string, string> = {
  wave: "👋",
  dance: "💃",
  jump: "🤸",
  spin: "🌀",
  bow: "🙇",
};

export function triggerEmote(a: AvatarParts, emote: string, now: number) {
  a.emote = emote;
  a.emoteStart = now;
  a.bubbleUntil = now + 1500;

  if (emote === "jump" && a.y <= 0.001) {
    a.vy = 6.2;
  }

  // swap bubble icon
  const emoji = EMOTE_EMOJI[emote] || "✨";
  const tex = emoteBubbleTexture(emoji);
  const mat = a.bubble.material as THREE.SpriteMaterial;
  if (mat.map) mat.map.dispose();
  mat.map = tex;
  mat.opacity = 1;
  mat.needsUpdate = true;
}