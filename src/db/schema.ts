import { integer, pgEnum, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const variantStatus = pgEnum("variant_status", [
  "queued", // waiting for its turn
  "processing", // IG container created, waiting for FINISHED
  "published",
  "failed",
  "skipped",
]);

export const ideaStatus = pgEnum("idea_status", ["planned", "recorded", "dropped"]);

// Kanban "Planejado": recording ideas from Jean or suggested by the analysis routine.
export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes"),
  source: text("source").notNull().default("jean"), // "jean" | "analise"
  status: ideaStatus("status").notNull().default("planned"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A video with no variants yet is still being edited on the Mac.
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
  // Instagram insights, refreshed by the cron tick for recent posts
  views: integer("views"),
  reach: integer("reach"),
  likes: integer("likes"),
  comments: integer("comments"),
  shares: integer("shares"),
  saves: integer("saves"),
  avgWatchMs: integer("avg_watch_ms"),
  metricsAt: timestamp("metrics_at", { withTimezone: true }),
},
  // Re-running an upload must never queue the same version twice.
  (t) => [uniqueIndex("variants_video_label").on(t.videoId, t.label)],
);

// Key/value store: ig_access_token, ig_token_refreshed_at, paused, learnings
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Video = typeof videos.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
