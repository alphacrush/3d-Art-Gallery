"use client";

import {
  ArrowBigUp, Check, Expand, Hand, Images, Maximize2, MessageCircle, Music2, Plus,
  RotateCw, Share2, Sparkles, Sparkle, Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ExhibitDTO, PlayerDTO } from "@/lib/gallery";
import Minimap from "./Minimap";
import type { Quality } from "./Gallery3D";
import { IconButton, LiveDot, cx } from "./ui";

type FeatureTab = "collection" | "add" | "visitors" | "chat";

type Props = {
  exhibits: ExhibitDTO[];
  near: ExhibitDTO | null;
  cinema: boolean;
  quality: Quality;
  positionRef: React.MutableRefObject<{ x: number; z: number; rotY: number }>;
  remoteRef: React.MutableRefObject<PlayerDTO[]>;
  joystickRef: React.MutableRefObject<{ x: number; y: number }>;
  room: string;
  liveCount: number;
  unread: number;
  myName: string;
  myColor: string;
  loading: boolean;
  copied: boolean;
  onOpenExhibit: (ex: ExhibitDTO) => void;
  onEmote: (emote: string) => void;
  onToggleQuality: () => void;
  onToggleCinema: () => void;
  onFullscreen: () => void;
  onTeleport: (x: number, z: number) => void;
  onOpenFeature: (tab: FeatureTab) => void;
  onInvite: () => void;
  onOpenProfile: () => void;
  children?: React.ReactNode;
};

const EMOTES = [
  { id: "wave", label: "Wave", icon: Hand },
  { id: "dance", label: "Dance", icon: Music2 },
  { id: "jump", label: "Jump", icon: ArrowBigUp },
  { id: "spin", label: "Spin", icon: RotateCw },
  { id: "bow", label: "Bow", icon: Sparkle },
];

const NAV = [
  { id: "collection" as const, label: "Collection", icon: Images },
  { id: "add" as const, label: "Add", icon: Plus },
  { id: "visitors" as const, label: "Visitors", icon: Users },
  { id: "chat" as const, label: "Chat", icon: MessageCircle },
];

export default function Stage({
  exhibits, near, cinema, quality, positionRef, remoteRef, joystickRef, room, liveCount,
  unread, myName, myColor, loading, copied, onOpenExhibit, onEmote, onToggleQuality,
  onToggleCinema, onFullscreen, onTeleport, onOpenFeature, onInvite, onOpenProfile, children,
}: Props) {
  const [hint, setHint] = useState(true);
  const joyBase = useRef<HTMLDivElement>(null);
  const [joy, setJoy] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 10000);
    return () => window.clearTimeout(t);
  }, []);

  const joyMove = (e: React.PointerEvent) => {
    const base = joyBase.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    joystickRef.current = { x: dx, y: dy };
    setJoy({ x: dx * 22, y: dy * 22 });
  };
  const joyEnd = () => {
    joystickRef.current = { x: 0, y: 0 };
    setJoy({ x: 0, y: 0 });
  };

  const hidden = cinema ? "pointer-events-none opacity-0" : "opacity-100";

  return (
    <div className="stage">
      <div className="absolute inset-0">{children}</div>

      {/* Cinema letterbox */}
      {cinema && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[7%] bg-ink-950" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[7%] bg-ink-950" />
          <button
            onClick={onToggleCinema}
            className="absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-full bg-white/85 px-4 py-1.5 text-[12px] font-medium text-ink-800 shadow-lg backdrop-blur transition hover:bg-white"
          >
            Exit cinema
          </button>
        </>
      )}

      {/* ---------- Top bar ---------- */}
      <div className={cx("absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2 sm:gap-3 sm:p-4 transition-opacity duration-300", hidden)}>
        {/* Identity — SUNFLWR + visible room code */}
        <div className="glass flex items-center gap-2 py-1.5 pl-2 pr-3 sm:gap-3 sm:py-2 sm:pl-2.5 sm:pr-4">
          <span className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg bg-ink-900 text-white">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth={1.7}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18M9 9v11" />
            </svg>
          </span>
          <span className="leading-none">
            <span className="block text-[12px] sm:text-[13px] font-semibold tracking-[0.14em] text-ink-900">SUNFLWR</span>
            <span className="mt-0.5 sm:mt-1 block text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400">
              ROOM: <span className="font-bold tracking-wider text-ink-800">{room}</span>
            </span>
          </span>
          <span className="ml-0.5 flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 sm:ml-1 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11.5px]">
            <LiveDot />
            <span className="tabular">{liveCount}</span>
          </span>
        </div>

        {/* View controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={onInvite}
            className="btn btn-chrome !px-2.5 !py-1.5 !text-[11px] sm:!px-3.5 sm:!py-2 sm:!text-[12.5px] !font-semibold"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Invite"}</span>
          </button>
          <IconButton label="Cinematic graphics" active={quality === "cinematic"} onClick={onToggleQuality} className="hidden xs:grid sm:grid">
            <Sparkles className="h-4 w-4" />
          </IconButton>
          <IconButton label="Cinema mode" onClick={onToggleCinema} className="hidden sm:grid">
            <Expand className="h-4 w-4" />
          </IconButton>
          <IconButton label="Fullscreen" onClick={onFullscreen} className="hidden sm:grid">
            <Maximize2 className="h-4 w-4" />
          </IconButton>
          <button
            onClick={onOpenProfile}
            title="Edit your character"
            aria-label="Edit your character"
            className="flex items-center gap-2 rounded-full border border-white/85 bg-white/70 py-1 pl-1 pr-2 sm:pr-3 shadow-[0_2px_8px_-2px_rgba(16,18,24,0.18)] backdrop-blur transition hover:bg-white"
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white ring-2 ring-white"
              style={{ background: myColor }}
            >
              {myName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[80px] truncate text-[12.5px] font-medium text-ink-700 md:block">{myName}</span>
          </button>
        </div>
      </div>

      {/* ---------- Minimap — hidden on mobile to reduce clutter ---------- */}
      <div className={cx("absolute right-4 top-[72px] z-10 hidden md:block transition-opacity duration-300", hidden)}>
        <div className="glass overflow-hidden p-1.5">
          <Minimap exhibits={exhibits} positionRef={positionRef} remoteRef={remoteRef} myColor={myColor} onTeleport={onTeleport} />
        </div>
      </div>

      {/* ---------- Hint ---------- */}
      {!cinema && hint && (
        <div className="anim-up absolute bottom-28 left-4 z-10 hidden max-w-[260px] md:block">
          <div className="glass px-4 py-3">
            <p className="eyebrow">Controls</p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
              <b className="font-semibold text-ink-800">WASD</b> walk · <b className="font-semibold text-ink-800">Shift</b> run ·{" "}
              <b className="font-semibold text-ink-800">Space</b> jump · <b className="font-semibold text-ink-800">click</b> to
              stroll · <b className="font-semibold text-ink-800">drag</b> to look · <b className="font-semibold text-ink-800">E</b>{" "}
              view art
            </p>
          </div>
        </div>
      )}

      {/* ---------- Near artwork ---------- */}
      {near && !cinema && (
        <div className="anim-pop absolute bottom-[88px] md:bottom-[104px] left-1/2 z-10 w-[min(92%,420px)] -translate-x-1/2">
          <button
            onClick={() => onOpenExhibit(near)}
            className="glass group flex w-full items-center gap-3 p-2 sm:p-2.5 text-left transition hover:bg-white/90"
          >
            {near.posterUrl || near.mediaType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={near.posterUrl || near.url} alt="" className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="grid h-10 w-10 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-400">
                <Images className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] sm:text-[13.5px] font-semibold text-ink-900">{near.title}</span>
              <span className="block truncate text-[11px] sm:text-[11.5px] text-ink-400">
                {near.artist}
                {near.year ? ` · ${near.year}` : ""}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-ink-900 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-[11.5px] font-semibold text-white">
              View <kbd className="ml-0.5 hidden font-sans opacity-60 sm:inline">E</kbd>
            </span>
          </button>
        </div>
      )}

      {/* ---------- Bottom dock — scaled down on mobile ---------- */}
      <div
        className={cx(
          "absolute bottom-2 md:bottom-0 left-0 right-0 z-10 flex justify-center p-2 md:p-4 origin-bottom scale-[0.82] md:scale-100 transition-all duration-300",
          hidden,
        )}
      >
        <div className="glass flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 max-w-[100vw]">
          {/* Reactions — compact on mobile */}
          <div className="flex items-center gap-0">
            {EMOTES.map((e) => (
              <button
                key={e.id}
                onClick={() => onEmote(e.id)}
                title={e.label}
                aria-label={e.label}
                className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full text-ink-500 transition hover:bg-ink-900 hover:text-white"
              >
                <e.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            ))}
          </div>

          <span className="mx-0.5 sm:mx-1 h-5 sm:h-6 w-px bg-ink-200" />

          {/* Navigation */}
          <div className="flex items-center gap-0">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => onOpenFeature(n.id)}
                title={n.label}
                className="relative flex h-8 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 text-[11px] sm:text-[12.5px] font-medium text-ink-600 transition hover:bg-ink-900 hover:text-white"
              >
                <n.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden md:inline">{n.label}</span>
                {n.id === "chat" && unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Touch joystick ---------- */}
      {!cinema && (
        <div
          ref={joyBase}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            joyMove(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons) joyMove(e);
          }}
          onPointerUp={joyEnd}
          onPointerCancel={joyEnd}
          className="absolute bottom-20 left-3 z-10 h-[72px] w-[72px] sm:bottom-24 sm:left-4 sm:h-[88px] sm:w-[88px] touch-none select-none rounded-full border border-white/80 bg-white/45 backdrop-blur [@media(pointer:fine)]:hidden"
          aria-label="Movement joystick"
        >
          <div
            className="absolute left-1/2 top-1/2 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-ink-900 shadow-lg"
            style={{ transform: `translate(calc(-50% + ${joy.x}px), calc(-50% + ${joy.y}px))` }}
          />
        </div>
      )}

      {/* ---------- Loading ---------- */}
      {loading && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#eef1f5]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
            <p className="text-[12.5px] font-medium text-ink-500">Preparing the gallery…</p>
          </div>
        </div>
      )}
    </div>
  );
}