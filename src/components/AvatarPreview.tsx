"use client";

import type { Gender } from "@/lib/gallery";
import { cx } from "./ui";

type Props = {
  gender: Gender;
  color: string;
  hat: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZES = {
  sm: "h-[42px] w-[34px]",
  md: "h-[58px] w-[46px]",
  lg: "h-[86px] w-[68px]",
  xl: "h-[124px] w-[98px]",
} as const;

/**
 * Flat illustrated portrait matching the in-scene 3D avatars, so the character
 * creator and visitor list read the same as the characters inside the hall.
 */
export default function AvatarPreview({ gender, color, hat, size = "md", className }: Props) {
  const female = gender === "female";
  return (
    <div className={cx("relative shrink-0 overflow-hidden", SIZES[size], className)} aria-hidden>
      {/* soft studio backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-900/[0.04] to-transparent" />

      {/* back hair */}
      <div
        className={cx(
          "absolute left-1/2 -translate-x-1/2 bg-ink-900 shadow-[inset_2px_0_0_rgba(255,255,255,0.14)]",
          female ? "top-[6%] h-[70%] w-[64%] rounded-[46%_46%_26%_26%]" : "top-[7%] h-[28%] w-[62%] rounded-[46%_46%_20%_20%]",
        )}
      />

      {/* legs + boots */}
      <div className={cx("absolute bottom-[3%] left-[35%] h-[26%] w-[13%] rounded-full", female ? "bg-ink-850" : "bg-ink-800")} />
      <div className={cx("absolute bottom-[3%] right-[35%] h-[26%] w-[13%] rounded-full", female ? "bg-ink-850" : "bg-ink-800")} />
      {female ? (
        <>
          <div className="absolute bottom-0 left-[28%] h-[13%] w-[21%] rounded-b-md rounded-t-sm bg-[#e9dfcb]" />
          <div className="absolute bottom-0 right-[28%] h-[13%] w-[21%] rounded-b-md rounded-t-sm bg-[#e9dfcb]" />
        </>
      ) : (
        <>
          <div className="absolute bottom-0 left-[26%] h-[8%] w-[26%] rounded-full bg-ink-800" />
          <div className="absolute bottom-0 right-[26%] h-[8%] w-[26%] rounded-full bg-ink-800" />
        </>
      )}

      {/* outfit */}
      {female ? (
        <div
          className="absolute bottom-[22%] left-1/2 h-[44%] w-[76%] -translate-x-1/2 shadow-[inset_-2px_0_0_rgba(0,0,0,0.14)]"
          style={{ backgroundColor: color, clipPath: "polygon(18% 0,82% 0,100% 100%,0 100%)" }}
        />
      ) : (
        <div
          className="absolute bottom-[25%] left-1/2 h-[36%] w-[64%] -translate-x-1/2 rounded-t-[38%] rounded-b-lg shadow-[inset_-2px_0_0_rgba(0,0,0,0.16)]"
          style={{ backgroundColor: color }}
        />
      )}

      {/* arms */}
      <div
        className="absolute left-[15%] top-[47%] h-[30%] w-[17%] -rotate-[16deg] rounded-full shadow-[inset_-1px_0_0_rgba(0,0,0,0.16)]"
        style={{ backgroundColor: color }}
      />
      <div
        className="absolute right-[15%] top-[47%] h-[30%] w-[17%] rotate-[16deg] rounded-full shadow-[inset_-1px_0_0_rgba(0,0,0,0.16)]"
        style={{ backgroundColor: color }}
      />

      {/* face */}
      <div className="absolute left-1/2 top-[11%] z-10 h-[38%] w-[55%] -translate-x-1/2 rounded-[48%_48%_44%_44%] bg-[#f4cdbb] shadow-[inset_1px_0_0_rgba(255,255,255,0.55)]">
        <span
          className={cx(
            "absolute left-[19%] top-[43%] h-[19%] w-[23%] rounded-full ring-1",
            female ? "bg-[#a43a52] ring-[#602838]" : "bg-[#347caa] ring-[#17344c]",
          )}
        />
        <span
          className={cx(
            "absolute right-[19%] top-[43%] h-[19%] w-[23%] rounded-full ring-1",
            female ? "bg-[#a43a52] ring-[#602838]" : "bg-[#347caa] ring-[#17344c]",
          )}
        />
        <span className="absolute left-[25%] top-[45%] h-[6%] w-[8%] rounded-full bg-white/90" />
        <span className="absolute right-[25%] top-[45%] h-[6%] w-[8%] rounded-full bg-white/90" />
        <span className="absolute left-[40%] top-[70%] h-[7%] w-[20%] rounded-b-full border-b border-[#a1616a]" />
      </div>

      {/* front locks */}
      {female && (
        <>
          <div className="absolute left-[21%] top-[23%] z-20 h-[46%] w-[14%] rounded-b-[58%] rounded-t-full bg-ink-900" />
          <div className="absolute right-[21%] top-[23%] z-20 h-[46%] w-[14%] rounded-b-[58%] rounded-t-full bg-ink-900" />
        </>
      )}

      {/* headwear */}
      {hat === "headband" && (
        <div className="absolute left-1/2 top-[8%] z-30 h-[9%] w-[58%] -translate-x-1/2 rounded-t-full border-t-[3px] border-[#f1e8d6]" />
      )}
      {hat === "cap" && <div className="absolute left-1/2 top-[4%] z-30 h-[16%] w-[62%] -translate-x-1/2 rounded-t-full bg-ink-800" />}
      {hat === "crown" && (
        <div className="absolute left-1/2 top-0 z-30 h-[13%] w-[46%] -translate-x-1/2 rounded-sm bg-amber-400 ring-1 ring-amber-600" />
      )}
      {hat === "beret" && (
        <div className="absolute left-[53%] top-[4%] z-30 h-[14%] w-[56%] -translate-x-1/2 -rotate-6 rounded-full bg-[#7f1d2d]" />
      )}
      {hat === "leaf" && (
        <div className="absolute left-1/2 top-0 z-30 h-[14%] w-[28%] -translate-x-1/2 rounded-full bg-lime-500" />
      )}

      {/* floor line */}
      <div className="absolute inset-x-2 bottom-0.5 h-px bg-ink-900/10" />
    </div>
  );
}