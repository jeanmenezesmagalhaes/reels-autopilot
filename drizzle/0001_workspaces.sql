-- Multi-user, phase 1 (docs/PLANO-MULTIUSUARIO.md): every creator's row belongs to a
-- workspace. The existing single-user dashboard becomes workspace 1, so nothing
-- changes for its owner. Applied by scripts/migrate-workspaces.mts in one transaction.

CREATE TABLE "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "members" (
	"workspace_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
ALTER TABLE "members" ADD CONSTRAINT "members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "workspace_settings" (
	"workspace_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_settings_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

-- The single-user dashboard.
INSERT INTO "workspaces" ("id", "name") VALUES (1, 'Reels Autopilot');
SELECT setval('workspaces_id_seq', 1);
UPDATE "users" SET "role" = 'member' WHERE "role" = 'owner';
INSERT INTO "members" ("workspace_id", "user_id") SELECT 1, "id" FROM "users" WHERE "role" = 'member';
INSERT INTO "settings" ("key", "value") VALUES ('pipeline_workspace', '1')
	ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value", "updated_at" = now();

-- workspace_id on every creator table: add, fill with 1, then require it.
ALTER TABLE "ideas" ADD COLUMN "workspace_id" integer;
UPDATE "ideas" SET "workspace_id" = 1;
ALTER TABLE "ideas" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "videos" ADD COLUMN "workspace_id" integer;
UPDATE "videos" SET "workspace_id" = 1;
ALTER TABLE "videos" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "videos" ADD CONSTRAINT "videos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "videos" DROP CONSTRAINT "videos_slug_unique";
CREATE UNIQUE INDEX "videos_workspace_slug" ON "videos" USING btree ("workspace_id","slug");

ALTER TABLE "variants" ADD COLUMN "workspace_id" integer;
UPDATE "variants" SET "workspace_id" = "videos"."workspace_id" FROM "videos" WHERE "videos"."id" = "variants"."video_id";
ALTER TABLE "variants" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "variants" ADD CONSTRAINT "variants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "connections" ADD COLUMN "workspace_id" integer;
UPDATE "connections" SET "workspace_id" = 1;
ALTER TABLE "connections" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "connections" ADD CONSTRAINT "connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "connections" DROP COLUMN "owner_id";
DROP INDEX "connections_provider_external";
CREATE UNIQUE INDEX "connections_workspace_provider_external" ON "connections" USING btree ("workspace_id","provider","external_id");
CREATE UNIQUE INDEX "connections_instagram_once" ON "connections" USING btree ("external_id") WHERE "connections"."kind" = 'instagram';

-- Creator settings move to the workspace; the single tick lease becomes one per workspace.
INSERT INTO "workspace_settings" ("workspace_id", "key", "value", "updated_at")
	SELECT 1, "key", "value", "updated_at" FROM "settings"
	WHERE "key" IN ('paused', 'learnings', 'runner', 'analysis_at', 'demo_dismissed', 'onboarding_hidden');
DELETE FROM "settings" WHERE "key" IN ('paused', 'learnings', 'runner', 'analysis_at', 'demo_dismissed', 'onboarding_hidden', 'tick_lock');
