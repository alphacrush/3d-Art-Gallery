import { NextResponse } from "next/server";
import { db } from "@/db";
import { presence } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { ensureDb } from "@/lib/ensureDb";

export const dynamic = "force-dynamic";

/** Visitors considered live if they sent a heartbeat within this window. */
const LIVE_WINDOW_SECONDS = 9;

export async function GET(req: Request) {
  try {
    await ensureDb();
    const url = new URL(req.url);
    const room = (url.searchParams.get("room") || "grand-hall").slice(0, 48);
    const cutoff = new Date(Date.now() - LIVE_WINDOW_SECONDS * 1000);
    const rows = await db
      .select()
      .from(presence)
      .where(and(eq(presence.galleryCode, room), gt(presence.updatedAt, cutoff)));
    return NextResponse.json({
      players: rows.map((r) => ({
        sessionId: r.sessionId,
        name: r.name,
        gender: r.gender === "male" ? "male" : "female",
        color: r.color,
        hat: r.hat,
        x: r.x,
        z: r.z,
        rotY: r.rotY,
        emote: r.emote,
        emoteAt: r.emoteAt ? new Date(r.emoteAt).toISOString() : null,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ players: [] });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDb();
    const body = await req.json();
    const sessionId = String(body.sessionId || "").slice(0, 80);
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    const emote = typeof body.emote === "string" ? body.emote.slice(0, 20) : "";
    const values = {
      sessionId,
      galleryCode: String(body.galleryCode || "grand-hall").slice(0, 48),
      name: String(body.name || "Guest").slice(0, 30),
      gender: body.gender === "male" ? "male" : "female",
      color: String(body.color || "#c2410c").slice(0, 20),
      hat: String(body.hat || "headband").slice(0, 20),
      x: Number(body.x) || 0,
      z: Number(body.z) || 0,
      rotY: Number(body.rotY) || 0,
      emote,
      emoteAt: emote ? new Date() : null,
      updatedAt: new Date(),
    };
    await db
      .insert(presence)
      .values(values)
      .onConflictDoUpdate({
        target: presence.sessionId,
        set: {
          galleryCode: values.galleryCode,
          name: values.name,
          gender: values.gender,
          color: values.color,
          hat: values.hat,
          x: values.x,
          z: values.z,
          rotY: values.rotY,
          ...(emote ? { emote, emoteAt: values.emoteAt } : {}),
          updatedAt: values.updatedAt,
        },
      });
    if (Math.random() < 0.05) {
      await db.execute(sql`DELETE FROM presence WHERE updated_at < NOW() - INTERVAL '5 minutes'`);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "presence failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureDb();
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.sessionId || "");
    if (sessionId) await db.delete(presence).where(eq(presence.sessionId, sessionId));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}