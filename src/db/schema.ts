import { integer, pgEnum, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";

export const variantStatus = pgEnum("variant_status", [
  "queued", // waiting for its turn
  "processing", // IG container created, waiting for FINISHED
  "published",
  "failed",
  "skipped",
]);

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  sourceFile: text("source_file"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  blobUrl: text("blob_url").notNull(),
  caption: text("caption").notNull().default(""),
  durationS: real("duration_s"),
  status: variantStatus("status").notNull().default("queued"),
  containerId: text("container_id"),
  mediaId: text("media_id"),
  permalink: text("permalink"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

// Key/value store: ig_access_token, ig_token_refreshed_at, paused
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Video = typeof videos.$inferSelect;
export type Variant = typeof variants.$inferSelect;
