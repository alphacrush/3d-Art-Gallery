"use client";

import { AVATAR_COLORS, HATS, type Gender } from "@/lib/gallery";
import { DoorOpen } from "lucide-react";
import AvatarPreview from "./AvatarPreview";
import { Button, Modal, cx } from "./ui";

type Props = {
  open: boolean;
  room: string;
  name: string;
  gender: Gender;
  color: string;
  hat: string;
  canKeep: boolean;
  onName: (v: string) => void;
  onGender: (v: Gender) => void;
  onColor: (v: string) => void;
  onHat: (v: string) => void;
  onSubmit: () => void;
  onKeep: () => void;
};

const STYLES: Array<{ gender: Gender; label: string; detail: string }> = [
  { gender: "female", label: "Female style", detail: "Long hair · flowing dress" },
  { gender: "male", label: "Male style", detail: "Swept hair · tailored jacket" },
];

export default function CharacterCreator({
  open,
  room,
  name,
  gender,
  color,
  hat,
  canKeep,
  onName,
  onGender,
  onColor,
  onHat,
  onSubmit,
  onKeep,
}: Props) {
  return (
    <Modal open={open} onClose={onKeep} labelledBy="creator-title">
      {/* Header */}
      <div className="border-b border-ink-200/70 px-7 py-6 text-center">
        <p className="eyebrow">Welcome</p>
        <h2 id="creator-title" className="display mt-2 text-[27px] leading-tight text-ink-950">
          Create your character
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-400">
          Choose a style and colour. Other visitors see you exactly like this.
        </p>
      </div>

      <div className="max-h-[66vh] overflow-y-auto px-7 py-6">
        {/* Preview + name */}
        <div className="flex items-center gap-5">
          <div className="shrink-0 overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-b from-ink-50 to-white px-3 py-2">
            <AvatarPreview gender={gender} color={color} hat={hat} size="xl" />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="visitor-name" className="eyebrow mb-1.5 block">
              Visitor name
            </label>
            <input
              id="visitor-name"
              value={name}
              onChange={(e) => onName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
              placeholder="e.g. Priya, Alex, ArtLover…"
              autoFocus
              maxLength={24}
              className="field !py-2.5 !text-[14px]"
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-400">
              Shown on the nameplate above your character.
            </p>
          </div>
        </div>

        {/* Style */}
        <p className="eyebrow mb-2.5 mt-6">Character style</p>
        <div className="grid grid-cols-2 gap-2.5">
          {STYLES.map((s) => {
            const active = gender === s.gender;
            return (
              <button
                key={s.gender}
                type="button"
                aria-pressed={active}
                onClick={() => onGender(s.gender)}
                className={cx(
                  "flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition",
                  active
                    ? "border-ink-900 bg-ink-900/[0.04] shadow-[0_0_0_3px_rgba(16,18,24,0.06)]"
                    : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50",
                )}
              >
                <AvatarPreview gender={s.gender} color={color} hat={hat} size="sm" />
                <span className="min-w-0">
                  <span className={cx("block text-[12.5px] font-semibold", active ? "text-ink-950" : "text-ink-700")}>
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] leading-tight text-ink-400">{s.detail}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Colour */}
        <p className="eyebrow mb-2.5 mt-6">Outfit colour</p>
        <div className="flex flex-wrap gap-2.5">
          {AVATAR_COLORS.map((c) => {
            const active = color === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onColor(c.value)}
                title={c.name}
                aria-label={c.name}
                aria-pressed={active}
                className={cx(
                  "h-9 w-9 rounded-full transition",
                  active
                    ? "scale-110 ring-2 ring-ink-900 ring-offset-2 ring-offset-white"
                    : "ring-1 ring-ink-200 hover:scale-105 hover:ring-ink-400",
                )}
                style={{ background: c.value }}
              />
            );
          })}
        </div>

        {/* Headwear */}
        <p className="eyebrow mb-2.5 mt-6">Headwear</p>
        <div className="flex flex-wrap gap-2">
          {HATS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onHat(h.id)}
              aria-pressed={hat === h.id}
              className={cx(
                "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition",
                hat === h.id
                  ? "bg-ink-900 font-semibold text-white"
                  : "bg-ink-100 text-ink-500 hover:bg-ink-200 hover:text-ink-900",
              )}
            >
              {h.label}
            </button>
          ))}
        </div>

        {/* Room note */}
        <p className="mt-6 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-[12.5px] leading-relaxed text-ink-500">
          You are entering room <b className="font-semibold text-ink-900">{room}</b>. Anyone who opens
          the same link joins you live — try a second tab to see two characters together.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" onClick={onSubmit} className="flex-1 !py-3.5 !text-[14px]">
            <DoorOpen className="h-4 w-4" />
            Enter the gallery
          </Button>
          {canKeep && (
            <Button onClick={onKeep} className="sm:w-auto">
              Keep current
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}