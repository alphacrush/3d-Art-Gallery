"use client";

import { Image as ImageIcon, Link2, Loader2, Play, Upload } from "lucide-react";
import { useRef } from "react";
import { Button, Field, cx } from "../ui";

type Props = {
  room: string;
  artistFallback: string;
  title: string;
  artist: string;
  year: string;
  description: string;
  url: string;
  mediaType: "image" | "video";
  poster: string;
  uploading: boolean;
  saving: boolean;
  samples: Array<{ title: string; artist: string; mediaType: "image" | "video"; url: string }>;
  onChange: (patch: Partial<{ title: string; artist: string; year: string; description: string; url: string; mediaType: "image" | "video"; poster: string }>) => void;
  onUpload: (file: File) => void;
  onSubmit: () => void;
  onPickSample: (s: { title: string; artist: string; mediaType: "image" | "video"; url: string }) => void;
};

export default function AddArtworkPanel({
  room,
  artistFallback,
  title,
  artist,
  year,
  description,
  url,
  mediaType,
  poster,
  uploading,
  saving,
  samples,
  onChange,
  onUpload,
  onSubmit,
  onPickSample,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <p className="text-[12.5px] leading-relaxed text-ink-500">
        Upload a file or paste a link. It is saved to room <b className="font-semibold text-ink-800">{room}</b> and
        hung on the next free wall for every visitor.
      </p>

      {/* Upload */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-5 text-[13px] font-semibold text-ink-700 transition hover:border-ink-900 hover:bg-ink-100 disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Uploading…" : "Upload picture or video"}
      </button>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-200" />
        <span className="eyebrow">or paste a link</span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      {/* URL */}
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          value={url}
          onChange={(e) => {
            const v = e.target.value;
            const patch: Parameters<typeof onChange>[0] = { url: v };
            if (/\.(mp4|webm|mov)(\?|$)/i.test(v)) patch.mediaType = "video";
            else if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(v)) patch.mediaType = "image";
            onChange(patch);
          }}
          placeholder="https://…/photo.jpg"
          className="field !pl-10"
          aria-label="Media URL"
        />
      </div>

      {/* Type */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["image", "video"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ mediaType: t })}
            aria-pressed={mediaType === t}
            className={cx(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium transition",
              mediaType === t
                ? "bg-ink-900 text-white"
                : "bg-ink-100 text-ink-500 hover:bg-ink-200 hover:text-ink-900",
            )}
          >
            {t === "image" ? <ImageIcon className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {t === "image" ? "Picture" : "Video"}
          </button>
        ))}
      </div>

      {/* Preview */}
      {url && (
        <div className="mt-3 overflow-hidden rounded-xl border border-ink-200">
          {mediaType === "video" ? (
            <video src={url} className="h-32 w-full bg-ink-100 object-cover" muted loop autoPlay playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Preview" className="h-32 w-full bg-ink-100 object-cover" />
          )}
        </div>
      )}

      {/* Details */}
      <div className="mt-5 space-y-3.5">
        <Field label="Title *">
          <input value={title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Untitled" className="field" />
        </Field>
        <div className="grid grid-cols-[1fr_92px] gap-3">
          <Field label="Artist">
            <input
              value={artist}
              onChange={(e) => onChange({ artist: e.target.value })}
              placeholder={artistFallback}
              className="field"
            />
          </Field>
          <Field label="Year">
            <input
              value={year}
              onChange={(e) => onChange({ year: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
              placeholder="2024"
              className="field"
            />
          </Field>
        </div>
        <Field label="Wall label" hint="A sentence or two shown on the plaque beside the piece.">
          <textarea
            value={description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={3}
            maxLength={1000}
            placeholder="Tell visitors about this piece…"
            className="field resize-none"
          />
        </Field>
        {mediaType === "video" && (
          <Field label="Poster image URL" hint="Optional. Used as the video thumbnail in the library.">
            <input value={poster} onChange={(e) => onChange({ poster: e.target.value })} placeholder="https://…" className="field" />
          </Field>
        )}
      </div>

      <Button variant="primary" onClick={onSubmit} disabled={saving} className="mt-5 w-full !py-3">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Hang it in the gallery
      </Button>

      {/* Samples */}
      <div className="mt-6 border-t border-ink-200/70 pt-4">
        <p className="eyebrow">Or start from a sample</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {samples.map((s) => (
            <button
              key={s.title}
              onClick={() => onPickSample(s)}
              className="rounded-full bg-ink-100 px-3 py-1.5 text-[11.5px] font-medium text-ink-500 transition hover:bg-ink-900 hover:text-white"
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}