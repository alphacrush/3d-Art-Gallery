"use client";

import type { ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ buttons */

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "accent" | "ghost" | "quiet" | "chrome";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, variant = "ghost", className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        "btn",
        variant === "primary" && "btn-primary",
        variant === "accent" && "btn-accent",
        variant === "ghost" && "btn-ghost",
        variant === "quiet" && "btn-quiet",
        variant === "chrome" && "btn-chrome",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Compact circular control used in the floating chrome over the 3D scene. */
export function IconButton({
  children,
  label,
  active,
  className,
  ...rest
}: { children: ReactNode; label: string; active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        "grid h-9 w-9 place-items-center rounded-full border transition",
        active
          ? "border-transparent bg-ink-900 text-white shadow-[0_2px_8px_-2px_rgba(16,18,24,0.5)]"
          : "border-white/85 bg-white/70 text-ink-700 shadow-[0_2px_8px_-2px_rgba(16,18,24,0.18)] backdrop-blur hover:bg-white hover:text-ink-950",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ form */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11.5px] leading-relaxed text-ink-400">{hint}</span>}
    </label>
  );
}

export function Chip({
  active,
  children,
  ...rest
}: { active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" data-active={active ? "true" : "false"} className="chip" {...rest}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ display */

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "dark" | "live" | "video";
}) {
  const tones = {
    neutral: "bg-ink-100 text-ink-600",
    dark: "bg-ink-900 text-white",
    live: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15",
    video: "bg-accent-500 text-white",
  } as const;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function LiveDot({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", tone === "light" ? "bg-emerald-500" : "bg-emerald-400")} />
      <span className={cx("relative inline-flex h-1.5 w-1.5 rounded-full", tone === "light" ? "bg-emerald-500" : "bg-emerald-400")} />
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-300">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink-800">{title}</p>
      {body && <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-ink-400">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <span className="eyebrow">{children}</span>
      {hint}
    </div>
  );
}

/* ------------------------------------------------------------------ tabs */

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: Array<{ id: T; label: string; icon?: ReactNode; count?: number }>;
}) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-ink-200/70 px-2" role="tablist">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cx(
              "relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-[13px] font-medium transition",
              active ? "text-ink-950" : "text-ink-400 hover:text-ink-700",
            )}
          >
            {item.icon}
            {item.label}
            {item.count ? (
              <span
                className={cx(
                  "tabular rounded-full px-1.5 py-px text-[10px] font-bold",
                  active ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-500",
                )}
              >
                {item.count}
              </span>
            ) : null}
            {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-ink-900" />}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  children,
  width = "max-w-lg",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  labelledBy?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div className={cx("sheet anim-sheet relative w-full overflow-hidden", width)} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ toast */

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="anim-toast pointer-events-none fixed bottom-24 left-1/2 z-[70] w-[min(92%,460px)] -translate-x-1/2 md:bottom-28">
      <div className="rounded-full bg-ink-900/95 px-5 py-3 text-center text-[13px] font-medium text-white shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {message}
      </div>
    </div>
  );
}
