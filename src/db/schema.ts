import { sql } from "drizzle-orm";
import { integer, pgEnum, pgTable, primaryKey, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const variantStatus = pgEnum("variant_status", [
  "queued", // waiting for its turn
  "processing", // IG container created, waiting for FINISHED
  "published",
  "failed",
  "skipped",
  "revision", // creator asked to redo this version; the Mac editor picks it up
]);

// Everything a creator owns hangs off one workspace: ideas, videos, versions,
// connected accounts and their settings. Each person gets one when they get access;
// the people never see the word. Business workspaces will add more members later.
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

const workspaceId = () =>
  integer("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

// People who signed in with Google. "member" opens their own dashboard; everyone
// else waits on the early-access list until an admin lets them in.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("waitlist"), // "member" | "waitlist"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).defaultNow().notNull(),
});

export const members = pgTable(
  "members",
  {
    workspaceId: workspaceId(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

// Connected accounts: Instagram profiles (to post) and AI providers (to edit/analyse).
// Secrets are AES-GCM encrypted (lib/secrets).
export const connections = pgTable(
  "connections",
  {
    id: serial("id").primaryKey(),
    workspaceId: workspaceId(),
    kind: text("kind").notNull(), // "instagram" | "llm"
    provider: text("provider").notNull(), // instagram | anthropic | openai | google
    method: text("method").notNull(), // "oauth" | "api_key"
    label: text("label").notNull(), // "@username" or "…a1b2"
    externalId: text("external_id").notNull(), // Instagram user id, or the provider name for AI keys
    secret: text("secret").notNull(),
    priority: integer("priority").notNull().default(0), // 0 = principal / first to try
    status: text("status").notNull().default("ok"), // "ok" | "error"
    statusDetail: text("status_detail"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("connections_workspace_provider_external").on(t.workspaceId, t.provider, t.externalId),
    // An Instagram account posts from one dashboard only.
    uniqueIndex("connections_instagram_once").on(t.externalId).where(sql`${t.kind} = 'instagram'`),
  ],
);

export const ideaStatus = pgEnum("idea_status", ["planned", "recorded", "dropped"]);

// Kanban "Planejado": recording ideas from the creator or suggested by the analysis routine.
export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  workspaceId: workspaceId(),
  title: text("title").notNull(),
  notes: text("notes"),
  source: text("source").notNull().default("jean"), // "jean" (the creator) | "analise"
  status: ideaStatus("status").notNull().default("planned"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A video with no variants yet is still being edited on the Mac.
export const videos = pgTable(
  "videos",
  {
    id: serial("id").primaryKey(),
    workspaceId: workspaceId(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    sourceFile: text("source_file"),
    // What the creator asked for before editing.
    brief: text("brief"),
    baseCaption: text("base_caption"),
    // Uploaded from the dashboard: waits here until the Mac editor downloads it.
    rawUrl: text("raw_url"),
    stage: text("stage").notNull().default("editing"), // "uploaded" | "editing"
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("videos_workspace_slug").on(t.workspaceId, t.slug)],
);

export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  // Same as the video's; kept here so the scheduler filters versions without a join.
  workspaceId: workspaceId(),
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
  revisionNote: text("revision_note"),
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

// One row per Instagram account per day (creator's timezone), written by the cron tick
// and by opening Perfil. The API only knows today's totals, so growth over a period
// comes from these rows. Keyed by the Instagram account, which belongs to one workspace.
export const profileSnapshots = pgTable(
  "profile_snapshots",
  {
    id: serial("id").primaryKey(),
    igUserId: text("ig_user_id").notNull(),
    day: text("day").notNull(), // YYYY-MM-DD
    followers: integer("followers").notNull(),
    follows: integer("follows").notNull(),
    media: integer("media").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("profile_snapshots_user_day").on(t.igUserId, t.day)],
);

// Per-workspace key/value: paused, learnings, runner, analysis_at, demo_dismissed,
// onboarding_hidden.
export const workspaceSettings = pgTable(
  "workspace_settings",
  {
    workspaceId: workspaceId(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);

// Server-wide key/value: login_failures, pipeline_workspace, tick leases.
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
