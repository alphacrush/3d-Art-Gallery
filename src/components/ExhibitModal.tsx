"use client";

import { Check, Image as ImageIcon, Navigation, Pencil, Play, Trash2, X } from "lucide-react";
import { TOTAL_SLOTS, getSlotPose, type ExhibitDTO } from "@/lib/gallery";
import { Button, Modal } from "./ui";

type Props = {
  exhibit: ExhibitDTO | null;
  exhibits: ExhibitDTO[];
  editing: boolean;
  onClose: () => void;
  onEditToggle: () => void;
  onChange: (patch: Partial<ExhibitDTO>) => void;
  onSave: () => void;
  onVisit: () => void;
  onDelete: () => void;
};

export default function ExhibitModal({
  exhibit,
  exhibits,
  editing,
  onClose,
  onEditToggle,
  onChange,
  onSave,
  onVisit,
  onDelete,
}: Props) {
  if (!exhibit) return null;
  const idx = exhibits.findIndex((e) => e.id === exhibit.id);
  const pose = idx >= 0 && idx < TOTAL_SLOTS ? getSlotPose(idx) : null;

  return (
    <Modal open={!!exhibit} onClose={onClose} width="max-w-3xl" labelledBy="exhibit-title">
      {/* Media */}
      <div className="relative bg-ink-950">
        {exhibit.mediaType === "video" ? (
          <video
            src={exhibit.url}
            poster={exhibit.posterUrl || undefined}
            className="max-h-[54vh] w-full object-contain"
            controls
            autoPlay
            loop
            playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={exhibit.url} alt={exhibit.title} className="max-h-[54vh] w-full object-contain" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink-950/60 to-transparent" />

        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink-700 backdrop-blur transition hover:bg-white hover:text-ink-950"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="absolute left-3.5 top-3.5 flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-ink-800 backdrop-blur">
          {exhibit.mediaType === "video" ? <Play className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
          {exhibit.mediaType === "video" ? "Video clip — loops on the wall" : "Picture"}
        </span>

        {pose && (
          <span className="absolute bottom-3.5 left-3.5 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-medium text-ink-700 backdrop-blur">
            {pose.wall} · slot {idx + 1} of {TOTAL_SLOTS}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="px-7 py-6">
        {editing ? (
          <div className="space-y-3">
            <input
              value={exhibit.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="field !py-2.5 !text-[18px] !font-semibold"
              aria-label="Title"
            />
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <input
                value={exhibit.artist}
                onChange={(e) => onChange({ artist: e.target.value })}
                className="field"
                aria-label="Artist"
              />
              <input
                value={exhibit.year ?? ""}
                onChange={(e) =>
                  onChange({ year: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, "")) : null })
                }
                placeholder="Year"
                className="field"
                aria-label="Year"
              />
            </div>
            <textarea
              value={exhibit.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
              className="field resize-none leading-relaxed"
              aria-label="Wall label"
            />
          </div>
        ) : (
          <>
            <h3 id="exhibit-title" className="display text-[28px] leading-tight text-ink-950">
              {exhibit.title}
            </h3>
            <p className="mt-2 text-[13.5px] text-ink-400">
              {exhibit.artist}
              {exhibit.year ? ` · ${exhibit.year}` : ""}
            </p>
            <div className="my-4 h-px w-14 bg-ink-900" />
            <p className="text-[14px] leading-relaxed text-ink-600">
              {exhibit.description || "No wall label has been written for this piece yet."}
            </p>
          </>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onVisit} className="!py-2.5">
            <Navigation className="h-4 w-4" />
            Stand in front of it
          </Button>
          {editing ? (
            <Button variant="accent" onClick={onSave}>
              <Check className="h-4 w-4" />
              Save label
            </Button>
          ) : (
            <Button onClick={onEditToggle} className="!py-2.5">
              <Pencil className="h-4 w-4" />
              Edit label
            </Button>
          )}
          <Button
            onClick={onDelete}
            className="!py-2.5 !text-accent-600 hover:!bg-accent-500/10"
            title="Remove from the collection"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>
    </Modal>
  );
}