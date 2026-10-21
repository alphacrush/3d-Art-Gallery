import { NextResponse } from "next/server";
import { db } from "@/db";
import { exhibits } from "@/db/schema";
import { asc, count, eq } from "drizzle-orm";
import { ensureDb } from "@/lib/ensureDb";
import { SEED_EXHIBITS } from "@/lib/gallery";

export const dynamic = "force-dynamic";

function roomOf(req: Request) {
  const url = new URL(req.url);
  return (url.searchParams.get("room") || "grand-hall").slice(0, 48);
}

async function seedIfEmpty(room: string) {
  const [row] = await db.select({ n: count() }).from(exhibits).where(eq(exhibits.galleryCode, room));
  if ((row?.n ?? 0) === 0) {
    await db.insert(exhibits).values(
      SEED_EXHIBITS.map((s, i) => ({
        galleryCode: room,
        title: s.title,
        artist: s.artist,
        description: s.description,
        mediaType: s.mediaType,
        url: s.url,
        posterUrl: s.posterUrl,
        year: s.year,
        slot: i,
      })),
    );
  }
}

export async function GET(req: Request) {
  try {
    await ensureDb();
    const room = roomOf(req);
    await seedIfEmpty(room);
    const rows = await db
      .select()
      .from(exhibits)
      .where(eq(exhibits.galleryCode, room))
      .orderBy(asc(exhibits.slot), asc(exhibits.id));
    return NextResponse.json({ exhibits: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load exhibits" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDb();
    const body = await req.json();
    const room = String(body.galleryCode || "grand-hall").slice(0, 48);
    const title = String(body.title || "").trim();
    const url = String(body.url || "").trim();
    if (!title || !url) {
      return NextResponse.json({ error: "Title and media URL are required" }, { status: 400 });
    }
    const [cnt] = await db.select({ n: count() }).from(exhibits).where(eq(exhibits.galleryCode, room));
    const [created] = await db
      .insert(exhibits)
      .values({
        galleryCode: room,
        title: title.slice(0, 140),
        artist: String(body.artist || "Unknown artist").slice(0, 100),
        description: String(body.description || "").slice(0, 1000),
        mediaType: body.mediaType === "video" ? "video" : "image",
        url: url.slice(0, 2000),
        posterUrl: body.posterUrl ? String(body.posterUrl).slice(0, 2000) : null,
        year: body.year ? Number(body.year) : null,
        slot: cnt?.n ?? 0,
      })
      .returning();
    return NextResponse.json({ exhibit: created }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add exhibit" }, { status: 500 });
  }
}
