import { db } from "@/db";
import { sql } from "drizzle-orm";

let ensured: Promise<void> | null = null;

/** Creates tables on first API hit so the app works even before `drizzle-kit push`. */
export function ensureDb(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS exhibits (
          id SERIAL PRIMARY KEY,
          gallery_code TEXT NOT NULL DEFAULT 'grand-hall',
          title TEXT NOT NULL,
          artist TEXT NOT NULL DEFAULT 'Unknown artist',
          description TEXT NOT NULL DEFAULT '',
          media_type TEXT NOT NULL DEFAULT 'image',
          url TEXT NOT NULL,
          poster_url TEXT,
          year INTEGER,
          slot INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS presence (
          session_id TEXT PRIMARY KEY,
          gallery_code TEXT NOT NULL DEFAULT 'grand-hall',
          name TEXT NOT NULL DEFAULT 'Guest',
          color TEXT NOT NULL DEFAULT '#c2410c',
          hat TEXT NOT NULL DEFAULT 'headband',
          gender TEXT NOT NULL DEFAULT 'female',
          x REAL NOT NULL DEFAULT 0,
          z REAL NOT NULL DEFAULT 6,
          rot_y REAL NOT NULL DEFAULT 0,
          emote TEXT NOT NULL DEFAULT '',
          emote_at TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`ALTER TABLE presence ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'female'`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          gallery_code TEXT NOT NULL DEFAULT 'grand-hall',
          session_id TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT 'Guest',
          color TEXT NOT NULL DEFAULT '#c2410c',
          text TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
