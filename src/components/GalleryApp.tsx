"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Gallery3D, { type Identity, type Quality } from "./Gallery3D";
import Stage from "./Stage";
import CharacterCreator from "./CharacterCreator";
import FeatureSheet, { type FeatureTab } from "./FeatureSheet";
import ExhibitModal from "./ExhibitModal";
import { Toast } from "./ui";
import {
  AVATAR_COLORS, TOTAL_SLOTS, getSlotPose,
  type ChatDTO, type ExhibitDTO, type Gender, type PlayerDTO,
} from "@/lib/gallery";

const SAMPLES = [
  { title: "Neon Pigment Study", artist: "Paul Blenkhorn", mediaType: "image" as const, url: "https://images.pexels.com/photos/11768961/pexels-photo-11768961.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800" },
  { title: "Modern Colour Field", artist: "Steve A Johnson", mediaType: "image" as const, url: "https://images.pexels.com/photos/15267746/pexels-photo-15267746.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800" },
  { title: "Paint Splatter No. 3", artist: "Steve A Johnson", mediaType: "image" as const, url: "https://images.pexels.com/photos/30486228/pexels-photo-30486228.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800" },
  { title: "North Sea Cliffs (film)", artist: "Mike Art", mediaType: "video" as const, url: "https://videos.pexels.com/video-files/36505810/15479717_3840_2160_60fps.mp4" },
];

const GUIDES: Array<{ name: string; gender: Gender; color: string; hat: string }> = [
  { name: "Maya", gender: "female", color: "#0f766e", hat: "headband" },
  { name: "Leo", gender: "male", color: "#ca8a04", hat: "headband" },
  { name: "Curator Ana", gender: "female", color: "#be123c", hat: "beret" },
];

type Guide = { data: PlayerDTO; tx: number; tz: number; pauseUntil: number };

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function GalleryApp() {
  /* ---------------- session ---------------- */
  const [room, setRoom] = useState("grand-hall");
  const [sessionId, setSessionId] = useState("");
  const [entered, setEntered] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [copied, setCopied] = useState(false);

  const [identity, setIdentity] = useState<Identity>({
    name: "Guest", gender: "female", color: "#c2410c", hat: "headband",
  });
  const [draft, setDraft] = useState({ name: "", gender: "female" as Gender, color: "#c2410c", hat: "headband" });
  const [joinCode, setJoinCode] = useState("");

  /* ---------------- data ---------------- */
  const [exhibits, setExhibits] = useState<ExhibitDTO[]>([]);
  const [loadingEx, setLoadingEx] = useState(true);
  const [players, setPlayers] = useState<PlayerDTO[]>([]);
  const [guides, setGuides] = useState<PlayerDTO[]>([]);
  const [guidesOn, setGuidesOn] = useState(true);
  const [messages, setMessages] = useState<ChatDTO[]>([]);
  const [sheet, setSheet] = useState<FeatureTab | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [chatInput, setChatInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState("");
  const [near, setNear] = useState<ExhibitDTO | null>(null);
  const [selected, setSelected] = useState<ExhibitDTO | null>(null);
  const [editing, setEditing] = useState(false);
  const [quality, setQuality] = useState<Quality>("cinematic");
  const [cinema, setCinema] = useState(false);

  const [form, setForm] = useState({
    title: "", artist: "", year: "", description: "", url: "",
    mediaType: "image" as "image" | "video", poster: "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ---------------- 3D refs ---------------- */
  const positionRef = useRef({ x: 0, z: 9.6, rotY: Math.PI });
  const remoteRef = useRef<PlayerDTO[]>([]);
  const realRef = useRef<PlayerDTO[]>([]);
  const guideRef = useRef<Guide[]>([]);
  const teleportRef = useRef<{ x: number; z: number; rotY: number; nonce: number } | null>(null);
  const emoteRef = useRef<{ emote: string; nonce: number } | null>(null);
  const joystickRef = useRef({ x: 0, y: 0 });
  const pendingEmote = useRef("");

  const identityRef = useRef(identity);
  const roomRef = useRef(room);
  const sessionRef = useRef(sessionId);
  const exhibitsRef = useRef(exhibits);
  const guidesOnRef = useRef(guidesOn);
  const lastMsgRef = useRef(0);

  useEffect(() => {
    identityRef.current = identity;
    roomRef.current = room;
    sessionRef.current = sessionId;
    exhibitsRef.current = exhibits;
    guidesOnRef.current = guidesOn;
  }, [identity, room, sessionId, exhibits, guidesOn]);

  /* ---------------- helpers ---------------- */
  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3600);
  }, []);

  const mergeRemotes = useCallback(() => {
    remoteRef.current = [...realRef.current, ...(guidesOnRef.current ? guideRef.current.map((g) => g.data) : [])];
  }, []);

  /* ---------------- boot ---------------- */
  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const small = window.innerWidth < 900 || window.innerHeight < 620;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
    if (small || cores <= 4 || mem <= 4) setQuality("balanced");

    const params = new URLSearchParams(window.location.search);
    const roomParam = (params.get("room") || "grand-hall").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 48) || "grand-hall";
    setRoom(roomParam);

    let sid = sessionStorage.getItem("atelier-session-id");
    if (!sid) {
      sid = uid();
      sessionStorage.setItem("atelier-session-id", sid);
    }
    setSessionId(sid);

    const saved = sessionStorage.getItem("atelier-identity");
    if (saved) {
      try {
        const raw = JSON.parse(saved) as Partial<Identity>;
        const legacy = raw.gender !== "male" && raw.gender !== "female";
        const id: Identity = {
          name: typeof raw.name === "string" ? raw.name : "Guest",
          gender: raw.gender === "male" ? "male" : "female",
          color: typeof raw.color === "string" ? raw.color : "#c2410c",
          hat: typeof raw.hat === "string" && !(legacy && raw.hat === "cap") ? raw.hat : "headband",
        };
        setIdentity(id);
        setDraft({ name: id.name, gender: id.gender, color: id.color, hat: id.hat });
        setEntered(true);
      } catch {
        setShowCreator(true);
      }
    } else {
      setDraft((d) => ({ ...d, color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)].value }));
      setShowCreator(true);
    }
  }, []);

  /* ---------------- exhibits ---------------- */
  const loadExhibits = useCallback(async (r: string) => {
    setLoadingEx(true);
    try {
      const res = await fetch(`/api/exhibits?room=${encodeURIComponent(r)}`);
      const data = await res.json();
      setExhibits(data.exhibits || []);
    } catch {
      setExhibits([]);
    } finally {
      setLoadingEx(false);
    }
  }, []);

  useEffect(() => {
    loadExhibits(room);
    setMessages([]);
    lastMsgRef.current = 0;
    realRef.current = [];
    setPlayers([]);
    guideRef.current = GUIDES.map((g, i) => ({
      data: {
        sessionId: `guide-${g.name}`, name: g.name, gender: g.gender, color: g.color, hat: g.hat,
        x: -6 + i * 5, z: 2 + i, rotY: 0, emote: "", emoteAt: null, isBot: true,
      },
      tx: -6 + i * 5, tz: 2 + i, pauseUntil: Date.now() + 2000 + i * 1500,
    }));
    mergeRemotes();
  }, [room, loadExhibits, mergeRemotes]);

  /* ---------------- presence ---------------- */
  useEffect(() => {
    if (!entered || !sessionId) return;
    let alive = true;

    const beat = async () => {
      const emote = pendingEmote.current;
      pendingEmote.current = "";
      try {
        await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionRef.current,
            galleryCode: roomRef.current,
            name: identityRef.current.name,
            gender: identityRef.current.gender,
            color: identityRef.current.color,
            hat: identityRef.current.hat,
            x: positionRef.current.x,
            z: positionRef.current.z,
            rotY: positionRef.current.rotY,
            emote,
          }),
        });
      } catch {
        /* offline */
      }
    };

    const poll = async () => {
      try {
        const res = await fetch(`/api/presence?room=${encodeURIComponent(roomRef.current)}`);
        const data = await res.json();
        if (!alive) return;
        const others = (data.players || []).filter((p: PlayerDTO) => p.sessionId !== sessionRef.current);
        realRef.current = others;
        setPlayers(others);
        mergeRemotes();
      } catch {
        /* keep last */
      }
    };

    beat();
    poll();
    const t1 = window.setInterval(beat, 350);
    const t2 = window.setInterval(poll, 700);

    const leave = () => {
      const payload = JSON.stringify({ sessionId: sessionRef.current });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/presence", payload);
    };
    window.addEventListener("beforeunload", leave);

    return () => {
      alive = false;
      window.clearInterval(t1);
      window.clearInterval(t2);
      window.removeEventListener("beforeunload", leave);
    };
  }, [entered, sessionId, room, mergeRemotes]);

  /* ---------------- chat ---------------- */
  useEffect(() => {
    if (!entered) return;
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/chat?room=${encodeURIComponent(roomRef.current)}`);
        const data = await res.json();
        if (!alive) return;
        const list: ChatDTO[] = data.messages || [];
        const maxId = list.length ? list[list.length - 1].id : 0;
        if (lastMsgRef.current !== 0 && maxId > lastMsgRef.current) {
          const fresh = list.filter((m) => m.id > lastMsgRef.current && m.sessionId !== sessionRef.current);
          if (fresh.length) setUnread((u) => u + fresh.length);
        }
        lastMsgRef.current = Math.max(lastMsgRef.current, maxId);
        setMessages(list);
      } catch {
        /* keep */
      }
    };
    poll();
    const t = window.setInterval(poll, 1600);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [entered, room]);

  useEffect(() => {
    if (sheet === "chat") setUnread(0);
  }, [sheet, messages]);

  /* ---------------- guides wander ---------------- */
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      for (const g of guideRef.current) {
        const d = g.data;
        const dx = g.tx - d.x;
        const dz = g.tz - d.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.3) {
          if (now > g.pauseUntil) {
            const list = exhibitsRef.current;
            if (list.length && Math.random() < 0.82) {
              const idx = Math.floor(Math.random() * Math.min(list.length, TOTAL_SLOTS));
              const pose = getSlotPose(idx);
              g.tx = pose.viewX + (Math.random() - 0.5);
              g.tz = pose.viewZ + (Math.random() - 0.5);
            } else {
              g.tx = (Math.random() - 0.5) * 26;
              g.tz = (Math.random() - 0.5) * 16;
            }
            g.pauseUntil = now + 5000 + Math.random() * 7000;
            if (Math.random() < 0.2) {
              d.emote = Math.random() < 0.5 ? "wave" : "dance";
              d.emoteAt = new Date().toISOString();
            }
          } else {
            d.rotY += (Math.sin(now / 2400 + d.x) * 0.4 - d.rotY) * 0.02;
          }
        } else {
          const step = 0.16;
          d.x += (dx / dist) * Math.min(step, dist);
          d.z += (dz / dist) * Math.min(step, dist);
          d.rotY = Math.atan2(dx, dz);
        }
      }
      mergeRemotes();
      setGuides(guideRef.current.map((g) => ({ ...g.data })));
    }, 120);
    return () => window.clearInterval(t);
  }, [mergeRemotes]);

  /* ---------------- actions ---------------- */
  const teleport = useCallback((x: number, z: number, rotY = Math.PI) => {
    teleportRef.current = { x, z, rotY, nonce: Date.now() + Math.random() };
  }, []);

  const visit = useCallback(
    (ex: ExhibitDTO) => {
      const idx = exhibitsRef.current.findIndex((e) => e.id === ex.id);
      if (idx < 0) return;
      if (idx >= TOTAL_SLOTS) {
        notify("This piece is in storage — the walls are full. Remove a piece to hang it.");
        setSelected(ex);
        return;
      }
      const pose = getSlotPose(idx);
      teleport(pose.viewX, pose.viewZ, Math.atan2(pose.x - pose.viewX, pose.z - pose.viewZ));
      setSelected(null);
      setEditing(false);
      setSheet(null);
    },
    [notify, teleport],
  );

  const emote = useCallback(
    (id: string) => {
      emoteRef.current = { emote: id, nonce: Date.now() + Math.random() };
      pendingEmote.current = id;
      if (!entered) setShowCreator(true);
    },
    [entered],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === "e" && near) setSelected(near);
      if (k === "1") emote("wave");
      if (k === "2") emote("dance");
      if (k === "3") emote("jump");
      if (k === "4") emote("spin");
      if (k === "5") emote("bow");
      if (k === "escape") {
        setSheet(null);
        setSelected(null);
        setEditing(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [near, emote]);

  const enterGallery = () => {
    const id: Identity = {
      name: (draft.name.trim() || "Guest").slice(0, 24),
      gender: draft.gender,
      color: draft.color,
      hat: draft.hat,
    };
    setIdentity(id);
    sessionStorage.setItem("atelier-identity", JSON.stringify(id));
    setEntered(true);
    setShowCreator(false);
    notify(`Welcome, ${id.name}. Friends who open your invite link will appear here live.`);
  };

  const switchRoom = (code: string) => {
    const clean = code.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 48);
    if (!clean) return;
    const url = new URL(window.location.href);
    url.searchParams.set("room", clean);
    window.history.replaceState({}, "", url.toString());
    setRoom(clean);
    teleport(0, 9.6, Math.PI);
    notify(`You entered room “${clean}”. Share the link to meet here.`);
  };

  const copyInvite = async () => {
    const url = `${window.location.origin}/?room=${room}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      notify("Invite link copied — anyone who opens it joins you live.");
    } catch {
      notify(url);
    }
  };

  const sendChat = async (text: string) => {
    const clean = text.trim();
    if (!clean) {
      if (!entered) setShowCreator(true);
      return;
    }
    setChatInput("");
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          galleryCode: room, sessionId, name: identity.name, color: identity.color, text: clean,
        }),
      });
      const res = await fetch(`/api/chat?room=${encodeURIComponent(room)}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      notify("That message could not be sent.");
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setForm((f) => ({
        ...f,
        url: data.url,
        mediaType: data.mediaType === "video" ? "video" : "image",
        title: f.title || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      }));
      notify("File uploaded. Add a title and hang it on the wall.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const addExhibit = async () => {
    if (!form.title.trim() || !form.url.trim()) {
      notify("Give the piece a title and a picture or video (upload or paste a link).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/exhibits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          galleryCode: room,
          title: form.title.trim(),
          artist: form.artist.trim() || identity.name,
          description: form.description.trim(),
          mediaType: form.mediaType,
          url: form.url.trim(),
          posterUrl: form.poster.trim() || null,
          year: form.year ? Number(form.year) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add");
      setExhibits((prev) => [...prev, data.exhibit]);
      setForm({ title: "", artist: "", year: "", description: "", url: "", mediaType: "image", poster: "" });
      setSheet(null);
      notify(`“${data.exhibit.title}” is now hanging in the gallery.`);
      window.setTimeout(() => visit(data.exhibit as ExhibitDTO), 400);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not add that piece");
    } finally {
      setSaving(false);
    }
  };

  const deleteExhibit = async (ex: ExhibitDTO) => {
    try {
      await fetch(`/api/exhibits/${ex.id}`, { method: "DELETE" });
      setExhibits((prev) => prev.filter((e) => e.id !== ex.id));
      setSelected(null);
      setEditing(false);
      notify(`Removed “${ex.title}” from the collection.`);
    } catch {
      notify("Could not remove that piece.");
    }
  };

  const saveLabel = async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/exhibits/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selected.title,
          artist: selected.artist,
          description: selected.description,
          year: selected.year,
        }),
      });
      const data = await res.json();
      setExhibits((prev) => prev.map((e) => (e.id === selected.id ? data.exhibit : e)));
      setSelected(data.exhibit);
      setEditing(false);
      notify("Wall label updated.");
    } catch {
      notify("Could not save the label.");
    }
  };

  /* ---------------- derived ---------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exhibits.filter((e) => {
      if (filter !== "all" && e.mediaType !== filter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.artist.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    });
  }, [exhibits, filter, search]);

  const liveCount = (entered ? 1 : 0) + players.length;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-ink-950">
      <Stage
        exhibits={exhibits}
        near={near && !selected ? near : null}
        cinema={cinema}
        quality={quality}
        positionRef={positionRef}
        remoteRef={remoteRef}
        joystickRef={joystickRef}
        room={room}
        liveCount={liveCount}
        unread={sheet === "chat" ? 0 : unread}
        myName={entered ? identity.name : "Guest"}
        myColor={identity.color}
        loading={loadingEx}
        copied={copied}
        onOpenExhibit={setSelected}
        onEmote={emote}
        onToggleQuality={() => setQuality((q) => (q === "cinematic" ? "balanced" : "cinematic"))}
        onToggleCinema={() => setCinema((c) => !c)}
        onFullscreen={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
        onTeleport={(x, z) => teleport(x, z)}
        onOpenFeature={(tab) => setSheet((s) => (s === tab ? null : tab))}
        onInvite={copyInvite}
        onOpenProfile={() => {
          setDraft({ name: identity.name, gender: identity.gender, color: identity.color, hat: identity.hat });
          setShowCreator(true);
        }}
      >
        <Gallery3D
          exhibits={exhibits}
          identity={identity}
          quality={quality}
          remoteRef={remoteRef}
          positionRef={positionRef}
          teleportRef={teleportRef}
          emoteRef={emoteRef}
          joystickRef={joystickRef}
          onNearExhibit={setNear}
          onSelectExhibit={setSelected}
        />
      </Stage>

      <CharacterCreator
        open={showCreator}
        room={room}
        name={draft.name}
        gender={draft.gender}
        color={draft.color}
        hat={draft.hat}
        canKeep={entered}
        onName={(v) => setDraft((d) => ({ ...d, name: v }))}
        onGender={(v) => setDraft((d) => ({ ...d, gender: v }))}
        onColor={(v) => setDraft((d) => ({ ...d, color: v }))}
        onHat={(v) => setDraft((d) => ({ ...d, hat: v }))}
        onSubmit={enterGallery}
        onKeep={() => setShowCreator(false)}
      />

      <FeatureSheet
        open={sheet}
        onClose={() => setSheet(null)}
        onOpenTab={(t) => setSheet((s) => (s === t ? null : t))}
        exhibits={exhibits}
        filtered={filtered}
        search={search}
        filter={filter}
        onSearch={setSearch}
        onFilter={setFilter}
        onOpenExhibit={setSelected}
        onVisit={visit}
        onDelete={deleteExhibit}
        entered={entered}
        room={room}
        me={{ name: identity.name, gender: identity.gender, color: identity.color, hat: identity.hat }}
        players={players}
        guides={guides}
        guidesOn={guidesOn}
        joinCode={joinCode}
        onJoinCode={setJoinCode}
        onJoinRoom={() => switchRoom(joinCode)}
        onGoGrandHall={() => switchRoom("grand-hall")}
        onTeleportTo={(x, z, rotY) => teleport(x, z, rotY)}
        onWave={() => emote("wave")}
        onInvite={() => {
          copyInvite();
          setSheet(null);
        }}
        onToggleGuides={() => {
          setGuidesOn((v) => !v);
          window.setTimeout(mergeRemotes, 60);
        }}
        messages={messages}
        mySession={sessionId}
        chatInput={chatInput}
        onChatInput={setChatInput}
        onSendChat={sendChat}
        unread={sheet === "chat" ? 0 : unread}
        artistFallback={identity.name}
        form={form}
        uploading={uploading}
        saving={saving}
        samples={SAMPLES}
        onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onUpload={upload}
        onSubmitArt={addExhibit}
        onPickSample={(s) => setForm((f) => ({ ...f, ...s }))}
      />

      <ExhibitModal
        exhibit={selected}
        exhibits={exhibits}
        editing={editing}
        onClose={() => {
          setSelected(null);
          setEditing(false);
        }}
        onEditToggle={() => setEditing(true)}
        onChange={(patch) => setSelected((s) => (s ? { ...s, ...patch } : s))}
        onSave={saveLabel}
        onVisit={() => selected && visit(selected)}
        onDelete={() => selected && deleteExhibit(selected)}
      />

      <Toast message={toast} />
    </div>
  );
}