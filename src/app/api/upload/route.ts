import { NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAX_BYTES = 30 * 1024 * 1024;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "gallery-assets";

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    throw new Error("Supabase Storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  }
  return createClient(url, secretKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (
      typeof body?.name !== "string" ||
      typeof body?.type !== "string" ||
      typeof body?.size !== "number"
    ) {
      return NextResponse.json({ error: "File name, type, and size are required" }, { status: 400 });
    }
    if (body.size <= 0 || body.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 30 MB)" }, { status: 413 });
    }
    const isImage = body.type.startsWith("image/");
    const isVideo = body.type.startsWith("video/");
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "Only image or video files are supported" }, { status: 415 });
    }
    const ext = path.extname(body.name).replace(/[^a-zA-Z0-9.]/g, "") || (isVideo ? ".mp4" : ".jpg");
    const safeBase = path
      .basename(body.name, path.extname(body.name))
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 40);
    const filename = `uploads/${crypto.randomUUID()}-${safeBase}${ext.toLowerCase()}`;
    const { data, error } = await storageClient().storage.from(BUCKET).createSignedUploadUrl(filename);
    if (error) {
      console.error("Failed to create Supabase Storage upload URL:", error);
      return NextResponse.json({ error: "Could not prepare file upload" }, { status: 500 });
    }
    return NextResponse.json({
      bucket: BUCKET,
      path: data.path,
      token: data.token,
      mediaType: isVideo ? "video" : "image",
      name: body.name,
      contentType: body.type,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not prepare file upload" }, { status: 500 });
  }
}
