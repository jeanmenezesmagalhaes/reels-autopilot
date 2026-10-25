import { integer, pgEnum, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const variantStatus = pgEnum("variant_status", [
  "queued", // waiting for its turn
  "processing", // IG container created, waiting for FINISHED
  "published",
  "failed",
  "skipped",
]);

// Connected accounts: Instagram profiles (to post) and AI providers (to edit/analyse).
// Secrets are AES-GCM encrypted (lib/secrets). `ownerId` is null for the personal
// workspace; business workspaces will scope rows per brand/creator.
export const connections = pgTable(
  "connections",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // "instagram" | "llm"
    provider: text("provider").notNull(), // instagram | anthropic | openai | google | openrouter
    method: text("method").notNull(), // "oauth" | "api_key"
    label: text("label").notNull(), // "@username" or "…a1b2"
    externalId: text("external_id").notNull(), // Instagram user id, or the provider name for AI keys
    secret: text("secret").notNull(),
    priority: integer("priority").notNull().default(0), // 0 = principal / first to try
    status: text("status").notNull().default("ok"), // "ok" | "error"
    statusDetail: text("status_detail"),
    ownerId: integer("owner_id"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("connections_provider_external").on(t.provider, t.externalId)],
);

// People who signed in with Google. "owner" opens the dashboard; everyone else is on
// the early-access waitlist until the multi-user version ships.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("waitlist"), // "owner" | "waitlist"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).defaultNow().notNull(),
});

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
export type User = typeof users.$inferSelect;
export type Connection = typeof connections.$inferSelect;
