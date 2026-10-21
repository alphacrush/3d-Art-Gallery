import { NextResponse } from "next/server";
import { db } from "@/db";
import { exhibits } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureDb } from "@/lib/ensureDb";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureDb();
    const { id } = await ctx.params;
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string") patch.title = body.title.slice(0, 140);
    if (typeof body.artist === "string") patch.artist = body.artist.slice(0, 100);
    if (typeof body.description === "string") patch.description = body.description.slice(0, 1000);
    if (typeof body.slot === "number") patch.slot = body.slot;
    if (body.year !== undefined) patch.year = body.year ? Number(body.year) : null;
    const [updated] = await db.update(exhibits).set(patch).where(eq(exhibits.id, Number(id))).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ exhibit: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureDb();
    const { id } = await ctx.params;
    await db.delete(exhibits).where(eq(exhibits.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
