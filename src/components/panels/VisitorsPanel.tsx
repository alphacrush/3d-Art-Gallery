"use client";

import { Copy, Hand, LogIn, Navigation, Users } from "lucide-react";
import type { PlayerDTO } from "@/lib/gallery";
import AvatarPreview from "../AvatarPreview";
import { Button, EmptyState, LiveDot, SectionTitle, cx } from "../ui";

type Props = {
  entered: boolean;
  room: string;
  me: { name: string; gender: "female" | "male"; color: string; hat: string };
  players: PlayerDTO[];
  bots: PlayerDTO[];
  botsOn: boolean;
  joinCode: string;
  onJoinCode: (v: string) => void;
  onJoinRoom: () => void;
  onGoGrandHall: () => void;
  onTeleport: (x: number, z: number, rotY?: number) => void;
  onWave: () => void;
  onInvite: () => void;
  onToggleBots: () => void;
};

function Row({
  player,
  subtitle,
  tone = "default",
  onJoin,
  onWave,
}: {
  player: { name: string; gender: "female" | "male"; color: string; hat: string };
  subtitle: string;
  tone?: "default" | "me";
  onJoin?: () => void;
  onWave?: () => void;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-xl p-2 transition",
        tone === "me" ? "bg-ink-900/[0.04] ring-1 ring-ink-900/8" : "hover:bg-ink-900/[0.035]",
      )}
    >
      <AvatarPreview gender={player.gender} color={player.color} hat={player.hat} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink-900">
          {player.name}
          {tone === "me" && <span className="ml-1.5 text-[11px] font-normal text-ink-400">you</span>}
        </p>
        <p className="truncate text-[11.5px] text-ink-400">{subtitle}</p>
      </div>
      {onJoin && (
        <button
          onClick={onJoin}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500 transition hover:bg-ink-900 hover:text-white"
          title="Walk to them"
          aria-label={`Walk to ${player.name}`}
        >
          <Navigation className="h-3.5 w-3.5" />
        </button>
      )}
      {onWave && (
        <button
          onClick={onWave}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500 transition hover:bg-ink-900 hover:text-white"
          title="Wave"
          aria-label="Wave"
        >
          <Hand className="h-3.5 w-3.5" />
        </button>
      )}
      {tone === "me" && <LiveDot />}
    </div>
  );
}

export default function VisitorsPanel({
  entered, room, me, players, bots, botsOn, joinCode,
  onJoinCode, onJoinRoom, onGoGrandHall, onTeleport, onWave, onInvite, onToggleBots,
}: Props) {
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <p className="text-[12.5px] leading-relaxed text-ink-500">
        Anyone who opens your invite link appears here and in the hall within a second — walking,
        turning and reacting live.
      </p>

      {entered && (
        <div className="mt-4">
          <Row player={me} subtitle={`Exploring ${room}`} tone="me" />
        </div>
      )}

      <div className="mt-5">
        <SectionTitle
          hint={
            players.length ? (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <LiveDot />
                {players.length} online
              </span>
            ) : undefined
          }
        >
          Live visitors
        </SectionTitle>

        <div className="space-y-0.5">
          {players.map((p) => (
            <Row
              key={p.sessionId}
              player={p}
              subtitle="Walking the hall"
              onJoin={() => onTeleport(p.x + 1.3, p.z + 1.3, Math.atan2(-1.3, -1.3))}
              onWave={onWave}
            />
          ))}
        </div>

        {players.length === 0 && (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No one else here yet"
            body="Open the invite link in another tab or on your phone and a second character joins you."
            action={
              <Button variant="primary" onClick={onInvite}>
                <Copy className="h-3.5 w-3.5" />
                Copy invite link
              </Button>
            }
          />
        )}
      </div>

      {/* Guides */}
      <div className="mt-6">
        <SectionTitle
          hint={
            <button
              onClick={onToggleBots}
              className={cx(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                botsOn ? "bg-emerald-50 text-emerald-700" : "bg-ink-100 text-ink-400 hover:bg-ink-200",
              )}
            >
              {botsOn ? "On" : "Off"}
            </button>
          }
        >
          Gallery guides
        </SectionTitle>
        {botsOn && (
          <div className="space-y-0.5">
            {bots.map((b) => (
              <Row
                key={b.sessionId}
                player={b}
                subtitle="Wandering the collection"
                onJoin={() => onTeleport(b.x + 1.3, b.z + 1.3)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rooms */}
      <div className="mt-6 rounded-xl border border-ink-200 bg-ink-50 p-4">
        <p className="text-[12.5px] font-semibold text-ink-900">Join another room</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
          Each room is a separate gallery with its own artwork and visitors.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => onJoinCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onJoinRoom();
            }}
            placeholder="Room code"
            className="field"
            aria-label="Room code"
          />
          <Button variant="primary" onClick={onJoinRoom} className="shrink-0">
            <LogIn className="h-3.5 w-3.5" />
            Join
          </Button>
        </div>
        <button
          onClick={onGoGrandHall}
          className="mt-2.5 text-[11.5px] font-medium text-ink-500 underline-offset-2 transition hover:text-ink-900 hover:underline"
        >
          Back to the Grand Hall
        </button>
      </div>
    </div>
  );
}
