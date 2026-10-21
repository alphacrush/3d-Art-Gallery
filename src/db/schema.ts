import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";

export const exhibits = pgTable("exhibits", {
  id: serial("id").primaryKey(),
  galleryCode: text("gallery_code").notNull().default("grand-hall"),
  title: text("title").notNull(),
  artist: text("artist").notNull().default("Unknown artist"),
  description: text("description").notNull().default(""),
  mediaType: text("media_type").notNull().default("image"), // image | video
  url: text("url").notNull(),
  posterUrl: text("poster_url"),
  year: integer("year"),
  slot: integer("slot").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const presence = pgTable("presence", {
  sessionId: text("session_id").primaryKey(),
  galleryCode: text("gallery_code").notNull().default("grand-hall"),
  name: text("name").notNull().default("Guest"),
  color: text("color").notNull().default("#c2410c"),
  hat: text("hat").notNull().default("headband"),
  gender: text("gender").notNull().default("female"),
  x: real("x").notNull().default(0),
  z: real("z").notNull().default(6),
  rotY: real("rot_y").notNull().default(0),
  emote: text("emote").notNull().default(""),
  emoteAt: timestamp("emote_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  galleryCode: text("gallery_code").notNull().default("grand-hall"),
  sessionId: text("session_id").notNull(),
  name: text("name").notNull().default("Guest"),
  color: text("color").notNull().default("#c2410c"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Exhibit = typeof exhibits.$inferSelect;
export type PresenceRow = typeof presence.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
