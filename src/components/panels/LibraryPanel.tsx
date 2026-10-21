"use client";

import { Images, Navigation, Play, Search, Trash2 } from "lucide-react";
import { TOTAL_SLOTS, getSlotPose, type ExhibitDTO } from "@/lib/gallery";
import { Button, Chip, EmptyState, cx } from "../ui";

type Props = {
  exhibits: ExhibitDTO[];
  filtered: ExhibitDTO[];
  search: string;
  filter: "all" | "image" | "video";
  onSearch: (v: string) => void;
  onFilter: (v: "all" | "image" | "video") => void;
  onOpen: (ex: ExhibitDTO) => void;
  onVisit: (ex: ExhibitDTO) => void;
  onDelete: (ex: ExhibitDTO) => void;
  onAdd: () => void;
};

export default function LibraryPanel({
  exhibits, filtered, search, filter, onSearch, onFilter, onOpen, onVisit, onDelete, onAdd,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="shrink-0 space-y-3 border-b border-ink-200/70 px-5 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by title or artist…"
            className="field !pl-10"
            aria-label="Search the collection"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {(["all", "image", "video"] as const).map((f) => (
              <Chip key={f} active={filter === f} onClick={() => onFilter(f)}>
                {f === "all" ? "All" : f === "image" ? "Pictures" : "Videos"}
              </Chip>
            ))}
          </div>
          <span className="tabular shrink-0 text-[11.5px] text-ink-400">
            {filtered.length} of {exhibits.length}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="no-scrollbar flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((ex) => {
            const idx = exhibits.findIndex((e) => e.id === ex.id);
            const pose = idx >= 0 && idx < TOTAL_SLOTS ? getSlotPose(idx) : null;
            const poster = ex.posterUrl || (ex.mediaType === "image" ? ex.url : "");
            return (
              <article key={ex.id} className="tile group flex flex-col">
                <button
                  onClick={() => onOpen(ex)}
                  className="relative block aspect-4/3 w-full overflow-hidden bg-ink-100"
                  aria-label={`View ${ex.title}`}
                >
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={poster}
                      alt={ex.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-ink-300">
                      <Play className="h-5 w-5" />
                    </span>
                  )}
                  {ex.mediaType === "video" && (
                    <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-accent-500 text-white">
                      <Play className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>

                <div className="flex flex-1 flex-col p-2.5">
                  <p className="truncate text-[12.5px] font-semibold leading-tight text-ink-900">{ex.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-400">{ex.artist}</p>
                  <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-ink-300">
                    {pose ? pose.wall : "In storage"}
                  </p>

                  <div className="mt-2.5 flex items-center gap-1">
                    <button
                      onClick={() => onVisit(ex)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-full bg-ink-900 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-ink-700"
                    >
                      <Navigation className="h-3 w-3" />
                      Visit
                    </button>
                    <button
                      onClick={() => onDelete(ex)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-300 transition hover:bg-accent-500/10 hover:text-accent-600"
                      title="Remove"
                      aria-label={`Remove ${ex.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className={cx("pt-4", exhibits.length === 0 && "pt-10")}>
            <EmptyState
              icon={<Images className="h-7 w-7" />}
              title={exhibits.length ? "Nothing matches" : "The walls are bare"}
              body={
                exhibits.length
                  ? "Try a different search term or filter."
                  : "Upload your first picture or video clip to start the exhibition."
              }
              action={
                !exhibits.length ? (
                  <Button variant="primary" onClick={onAdd}>
                    Add artwork
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
