export type MediaType = "image" | "video";
export type Gender = "female" | "male";

export type ExhibitDTO = {
  id: number;
  galleryCode: string;
  title: string;
  artist: string;
  description: string;
  mediaType: MediaType;
  url: string;
  posterUrl: string | null;
  year: number | null;
  slot: number;
};

export type PlayerDTO = {
  sessionId: string;
  name: string;
  gender: Gender;
  color: string;
  hat: string;
  x: number;
  z: number;
  rotY: number;
  emote: string;
  emoteAt: string | null;
  isBot?: boolean;
};

export type ChatDTO = {
  id: number;
  sessionId: string;
  name: string;
  color: string;
  text: string;
  createdAt: string;
};

/* Hall dimensions (metres in 3D units) */
export const HALL = { w: 38, d: 26, h: 6 }; // x: -19..19, z: -13..13

export type SlotPose = {
  x: number;
  y: number;
  z: number;
  rotY: number; // facing into the room
  viewX: number; // where the avatar stands to view it
  viewZ: number;
  wall: string;
};

/** Ordered hanging slots around the room + two free-standing panels. */
export function getSlotPose(index: number): SlotPose {
  const y = 2.15;
  const slots: SlotPose[] = [];
  const northZ = -HALL.d / 2 + 0.12;
  const southZ = HALL.d / 2 - 0.12;
  const westX = -HALL.w / 2 + 0.12;
  const eastX = HALL.w / 2 - 0.12;

  // North wall (faces +z) — 8 slots
  for (let i = 0; i < 8; i++) {
    const x = -14 + i * 4;
    slots.push({ x, y, z: northZ, rotY: 0, viewX: x, viewZ: northZ + 2.6, wall: "North wall" });
  }
  // East wall (faces -x) — 5 slots
  for (let i = 0; i < 5; i++) {
    const z = -8.8 + i * 4.4;
    slots.push({ x: eastX, y, z, rotY: -Math.PI / 2, viewX: eastX - 2.6, viewZ: z, wall: "East wall" });
  }
  // South wall (faces -z) — 8 slots (skip centre entrance visually by offset)
  for (let i = 0; i < 8; i++) {
    const x = 14 - i * 4;
    slots.push({ x, y, z: southZ, rotY: Math.PI, viewX: x, viewZ: southZ - 2.6, wall: "South wall" });
  }
  // West wall (faces +x) — 5 slots
  for (let i = 0; i < 5; i++) {
    const z = 8.8 - i * 4.4;
    slots.push({ x: westX, y, z, rotY: Math.PI / 2, viewX: westX + 2.6, viewZ: z, wall: "West wall" });
  }
  // Free-standing panel A (double sided) at x=-6, z=0
  slots.push({ x: -6, y, z: -0.16, rotY: Math.PI, viewX: -6, viewZ: -2.8, wall: "Panel A" });
  slots.push({ x: -6, y, z: 0.16, rotY: 0, viewX: -6, viewZ: 2.8, wall: "Panel A" });
  // Free-standing panel B at x=7, z=0
  slots.push({ x: 7, y, z: -0.16, rotY: Math.PI, viewX: 7, viewZ: -2.8, wall: "Panel B" });
  slots.push({ x: 7, y, z: 0.16, rotY: 0, viewX: 7, viewZ: 2.8, wall: "Panel B" });

  return slots[index % slots.length];
}

export const TOTAL_SLOTS = 30;

export const AVATAR_COLORS = [
  { name: "Terracotta", value: "#c2410c" },
  { name: "Teal", value: "#0f766e" },
  { name: "Mustard", value: "#ca8a04" },
  { name: "Plum", value: "#86198f" },
  { name: "Forest", value: "#166534" },
  { name: "Rose", value: "#be123c" },
  { name: "Indigo", value: "#4338ca" },
  { name: "Charcoal", value: "#292524" },
];

export const HATS = [
  { id: "headband", label: "Cream headband" },
  { id: "cap", label: "Cap" },
  { id: "crown", label: "Crown" },
  { id: "beret", label: "Artist beret" },
  { id: "leaf", label: "Leaf sprout" },
  { id: "none", label: "No accessory" },
];

export const SEED_EXHIBITS: Array<Omit<ExhibitDTO, "id" | "galleryCode" | "slot">> = [
  {
    title: "Chromatic Surge",
    artist: "Steve A Johnson",
    description: "A vivid abstract expressionist canvas — bold brushstrokes collide in warm reds, golds and teal. Best viewed up close: step near the frame and press E.",
    mediaType: "image",
    url: "https://images.pexels.com/photos/30843199/pexels-photo-30843199.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    posterUrl: null,
    year: 2024,
  },
  {
    title: "Atlantic From Above",
    artist: "Film Composite",
    description: "A short moving-image piece. Turquoise surf folds over dark volcanic sand, filmed from directly overhead. The clip loops on the gallery wall.",
    mediaType: "video",
    url: "https://videos.pexels.com/video-files/16755467/16755467-hd_1920_1080_24fps.mp4",
    posterUrl: "https://images.pexels.com/videos/16755467/4k-aerial-arctic-atlantic-ocean-16755467.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200",
    year: 2023,
  },
  {
    title: "Sensory Fields",
    artist: "Paul Blenkhorn",
    description: "Thick, tactile pigment built up in ridges. The surface catches the spotlight differently as you walk past — try viewing it from an angle.",
    mediaType: "image",
    url: "https://images.pexels.com/photos/3356358/pexels-photo-3356358.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    posterUrl: null,
    year: 2022,
  },
  {
    title: "The Gilded Room",
    artist: "ArtHouse Studio",
    description: "A photograph of a classical salon hang — seascape oils in ornate gold frames, the inspiration for this virtual hall's North wall.",
    mediaType: "image",
    url: "https://images.pexels.com/photos/4588842/pexels-photo-4588842.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    posterUrl: null,
    year: 2021,
  },
  {
    title: "Violet Movement",
    artist: "Steve A Johnson",
    description: "Purple hues dragged wet-into-wet. One of the most loved pieces in the collection — visitors often gather here to chat.",
    mediaType: "image",
    url: "https://images.pexels.com/photos/30580212/pexels-photo-30580212.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    posterUrl: null,
    year: 2024,
  },
  {
    title: "Slow Ocean",
    artist: "Mario Krimer",
    description: "Dramatic swell in slow motion. A meditative video loop for the East wall — stand on the rug, watch together, use an emote.",
    mediaType: "video",
    url: "https://videos.pexels.com/video-files/37259189/15784119_1920_1080_24fps.mp4",
    posterUrl: "https://images.pexels.com/videos/37259189/cinematic-crest-dark-deep-37259189.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200",
    year: 2024,
  },
  {
    title: "Quiet Contemplation",
    artist: "Una Laurencic",
    description: "A lone visitor before three portraits. A reminder that galleries are social spaces — invite a friend with the room link above.",
    mediaType: "image",
    url: "https://images.pexels.com/photos/20967/pexels-photo.jpg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    posterUrl: null,
    year: 2019,
  },
  {
    title: "Geometry in Pigment",
    artist: "Steve A Johnson",
    description: "Bold geometric shards interrupt gestural sweeps — order and chaos sharing one canvas.",
    mediaType: "image",
    url: "https://images.pexels.com/photos/15267299/pexels-photo-15267299.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    posterUrl: null,
    year: 2023,
  },
  {
    title: "Marble Study",
    artist: "René",
    description: "A classical bust photographed in a French museum. Our own golden sculpture stands at the centre of the hall in its honour.",
    mediaType: "image",
    url: "https://images.pexels.com/photos/9165593/pexels-photo-9165593.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    posterUrl: null,
    year: 2020,
  },
  {
    title: "Sea Foam Study",
    artist: "Mario Krimer",
    description: "An aerial video of lace-like foam patterns forming and dissolving — nature's own abstract painting, refreshed every second.",
    mediaType: "video",
    url: "https://videos.pexels.com/video-files/33261000/14170315_1920_1080_24fps.mp4",
    posterUrl: "https://images.pexels.com/videos/33261000/background-cinematic-foam-liquid-33261000.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200",
    year: 2024,
  },
  {
    title: "Expression No. 7",
    artist: "Steve A Johnson",
    description: "Dynamic colour fields with scraped-back layers revealing earlier decisions beneath — a painting with a memory.",
    mediaType: "image",
    url: "https://images.pexels.com/photos/30680067/pexels-photo-30680067.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    posterUrl: null,
    year: 2025,
  },
  {
    title: "The Salon Hang",
    artist: "ArtHouse Studio",
    description: "Floor-to-ceiling frames and antique chairs: how exhibitions looked a century ago, recreated here in miniature.",
    mediaType: "image",
    url: "https://images.pexels.com/photos/4588837/pexels-photo-4588837.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    posterUrl: null,
    year: 2021,
  },
];
