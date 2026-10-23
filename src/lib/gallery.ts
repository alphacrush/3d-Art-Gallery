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
  rotY: number;
  viewX: number;
  viewZ: number;
  wall: string;
  /** Outer frame width (metres) */
  width: number;
  /** Outer frame height (metres) */
  height: number;
};

function createSlot(
  x: number,
  y: number,
  z: number,
  rotY: number,
  width: number,
  height: number,
  wall: string,
): SlotPose {
  // Dynamic viewing distance: stand further back for huge paintings
  const viewDist = Math.max(2.2, Math.max(width, height) * 0.75 + 0.55);
  return {
    x, y, z, rotY,
    viewX: x + Math.sin(rotY) * viewDist,
    viewZ: z + Math.cos(rotY) * viewDist,
    wall, width, height,
  };
}

/**
 * 30 Salon-style slots spanning the FULL 38m room.
 * Mixing big heroes, portrait, landscape, and stacked clusters.
 */
export function getSlotPose(index: number): SlotPose {
  const N = -HALL.d / 2 + 0.12; // -12.88
  const S =  HALL.d / 2 - 0.12; //  12.88
  const W = -HALL.w / 2 + 0.12; // -18.88
  const E =  HALL.w / 2 - 0.12; //  18.88

  const slots: SlotPose[] = [
    // --- NORTH WALL (8 slots) | Has a gap between x=10 and x=14 for the door ---
    createSlot(-16.0, 2.40, N, 0, 1.8, 2.5, "North"),
    createSlot(-11.5, 3.30, N, 0, 2.0, 1.3, "North (Top)"),
    createSlot(-11.5, 1.60, N, 0, 2.0, 1.5, "North (Bottom)"),
    createSlot( -4.0, 2.60, N, 0, 4.8, 3.0, "North · Hero"), // Massive centerpiece
    createSlot(  3.0, 2.45, N, 0, 2.2, 2.2, "North"),
    createSlot(  7.5, 3.25, N, 0, 1.6, 1.2, "North (Top)"),
    createSlot(  7.5, 1.65, N, 0, 1.6, 1.4, "North (Bottom)"),
    createSlot( 16.0, 2.45, N, 0, 2.4, 1.8, "North"),

    // --- SOUTH WALL (9 slots) ---
    createSlot(-16.0, 2.35, S, Math.PI, 2.4, 1.6, "South"),
    createSlot(-11.0, 2.45, S, Math.PI, 2.0, 2.0, "South"),
    createSlot( -6.0, 3.20, S, Math.PI, 1.6, 1.3, "South (Top)"),
    createSlot( -6.0, 1.65, S, Math.PI, 1.6, 1.3, "South (Bottom)"),
    createSlot(  0.0, 2.55, S, Math.PI, 4.5, 2.8, "South · Hero"),
    createSlot(  6.0, 3.15, S, Math.PI, 1.8, 1.2, "South (Top)"),
    createSlot(  6.0, 1.55, S, Math.PI, 1.8, 1.4, "South (Bottom)"),
    createSlot( 11.0, 2.40, S, Math.PI, 1.6, 2.4, "South"),
    createSlot( 16.0, 2.45, S, Math.PI, 2.2, 2.2, "South"),

    // --- WEST WALL (5 slots) ---
    createSlot(W, 2.40, -8.0, Math.PI / 2, 2.2, 2.2, "West"),
    createSlot(W, 2.50, -3.0, Math.PI / 2, 1.8, 2.6, "West"),
    createSlot(W, 2.60,  3.0, Math.PI / 2, 3.8, 2.4, "West · Hero"),
    createSlot(W, 3.25,  9.0, Math.PI / 2, 1.8, 1.2, "West (Top)"),
    createSlot(W, 1.65,  9.0, Math.PI / 2, 1.8, 1.4, "West (Bottom)"),

    // --- EAST WALL (4 slots) ---
    createSlot(E, 2.45, -7.0, -Math.PI / 2, 2.4, 1.8, "East"),
    createSlot(E, 2.60,  0.0, -Math.PI / 2, 4.0, 2.6, "East · Hero"),
    createSlot(E, 3.20,  7.0, -Math.PI / 2, 2.0, 1.4, "East (Top)"),
    createSlot(E, 1.60,  7.0, -Math.PI / 2, 2.0, 1.4, "East (Bottom)"),

    // --- PANELS (4 slots) ---
    createSlot(-6, 2.40, -0.16, Math.PI, 2.8, 2.0, "Panel A"),
    createSlot(-6, 2.50,  0.16, 0,       2.2, 2.8, "Panel A"),
    createSlot( 7, 2.45, -0.16, Math.PI, 2.4, 2.4, "Panel B"),
    createSlot( 7, 2.35,  0.16, 0,       3.0, 1.8, "Panel B"),
  ];

  return slots[((index % 30) + 30) % 30];
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
