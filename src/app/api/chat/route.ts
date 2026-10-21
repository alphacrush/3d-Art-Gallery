import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { ensureDb } from "@/lib/ensureDb";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureDb();
    const url = new URL(req.url);
    const room = (url.searchParams.get("room") || "grand-hall").slice(0, 48);
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.galleryCode, room))
      .orderBy(desc(messages.id))
      .limit(60);
    return NextResponse.json({
      messages: rows.reverse().map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        name: m.name,
        color: m.color,
        text: m.text,
        createdAt: new Date(m.createdAt).toISOString(),
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDb();
    const body = await req.json();
    const text = String(body.text || "").trim().slice(0, 300);
    if (!text) return NextResponse.json({ error: "Empty message" }, { status: 400 });
    const [created] = await db
      .insert(messages)
      .values({
        galleryCode: String(body.galleryCode || "grand-hall").slice(0, 48),
        sessionId: String(body.sessionId || "").slice(0, 80),
        name: String(body.name || "Guest").slice(0, 30),
        color: String(body.color || "#c2410c").slice(0, 20),
        text,
      })
      .returning();
    return NextResponse.json({ message: created }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
