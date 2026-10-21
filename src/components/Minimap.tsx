"use client";

import { useEffect, useRef } from "react";
import { HALL, getSlotPose, type ExhibitDTO, type PlayerDTO } from "@/lib/gallery";

type Props = {
  exhibits: ExhibitDTO[];
  positionRef: React.MutableRefObject<{ x: number; z: number; rotY: number }>;
  remoteRef: React.MutableRefObject<PlayerDTO[]>;
  myColor: string;
  onTeleport: (x: number, z: number) => void;
};

export default function Minimap({ exhibits, positionRef, remoteRef, myColor, onTeleport }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const exhibitsRef = useRef(exhibits);
  const colorRef = useRef(myColor);

  useEffect(() => {
    exhibitsRef.current = exhibits;
  }, [exhibits]);
  useEffect(() => {
    colorRef.current = myColor;
  }, [myColor]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const pad = 10;
    const iw = W - pad * 2;
    const ih = H - pad * 2;

    const toMap = (x: number, z: number) => ({
      px: pad + ((x + HALL.w / 2) / HALL.w) * iw,
      py: pad + ((z + HALL.d / 2) / HALL.d) * ih,
    });

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);

      // Floor plan
      ctx.fillStyle = "#f6f6f7";
      ctx.strokeStyle = "#1b1b20";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(pad, pad, iw, ih, 4);
      ctx.fill();
      ctx.stroke();

      // Free-standing partitions
      ctx.fillStyle = "#c9c9cf";
      for (const px of [-6, 7]) {
        const a = toMap(px - 2.4, -0.2);
        const b = toMap(px + 2.4, 0.2);
        ctx.fillRect(a.px, a.py, b.px - a.px, Math.max(b.py - a.py, 2.5));
      }

      // Sculpture
      const sc = toMap(0.5, -4.5);
      ctx.fillStyle = "#9a9aa2";
      ctx.beginPath();
      ctx.arc(sc.px, sc.py, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Artworks
      ctx.fillStyle = "#26262c";
      exhibitsRef.current.slice(0, 30).forEach((_, i) => {
        const pose = getSlotPose(i);
        const { px, py } = toMap(pose.x, pose.z);
        ctx.fillRect(px - 2, py - 2, 4, 4);
      });

      // Other visitors
      for (const p of remoteRef.current) {
        const { px, py } = toMap(p.x, p.z);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // You — dot with a facing cone
      const me = positionRef.current;
      const { px, py } = toMap(me.x, me.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-me.rotY);
      ctx.fillStyle = "rgba(16,18,24,0.16)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 17, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = colorRef.current;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [positionRef, remoteRef]);

  return (
    <canvas
      ref={ref}
      width={232}
      height={168}
      className="h-[86px] w-[120px] cursor-crosshair rounded-lg sm:h-[104px] sm:w-[146px]"
      title="Click the plan to walk there"
      aria-label="Gallery floor plan"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pad = 10 / 232;
        const fx = (e.clientX - rect.left) / rect.width;
        const fy = (e.clientY - rect.top) / rect.height;
        const nx = Math.min(Math.max((fx - pad) / (1 - pad * 2), 0), 1);
        const ny = Math.min(Math.max((fy - pad) / (1 - pad * 2), 0), 1);
        onTeleport(nx * HALL.w - HALL.w / 2, ny * HALL.d - HALL.d / 2);
      }}
    />
  );
}
