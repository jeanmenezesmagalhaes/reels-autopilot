// Whose data a request may touch. Pages, server actions and route handlers call
// requireWorkspace(); the Mac pipeline calls pipelineWorkspace(). Every query on a
// creator's tables filters by the id these return.
import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, getSetting, schema, setSetting } from "@/db";
import { hasBearer } from "./auth";
import { readSession, SESSION_COOKIE } from "./session";

const { members, users, workspaces } = schema;

// The workspace the Mac pipeline (PIPELINE_SECRET) and the password sign-in act on:
// the first one ever created, i.e. the original single-user dashboard. Set once and
// never moved: if that workspace is deleted, the pipeline is refused (fails closed)
// instead of landing in someone else's dashboard.
const HOME_KEY = "pipeline_workspace";

// The app has been set up once its home workspace exists or existed.
export async function isSetUp() {
  return (await getSetting(HOME_KEY)) !== undefined;
}

export type WorkspaceContext = { userId: number; email: string; workspaceId: number };

async function homeWorkspaceId() {
  const id = Number(await getSetting(HOME_KEY));
  if (!id) return undefined;
  const [row] = await db().select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, id));
  return row?.id;
}

// Gives a member their workspace, creating it on first access. Idempotent.
export async function ensureWorkspace(user: { id: number; name: string | null; email: string }) {
  const [existing] = await db()
    .select({ workspaceId: members.workspaceId })
    .from(members)
    .where(eq(members.userId, user.id))
    .orderBy(asc(members.workspaceId))
    .limit(1);
  if (existing) return existing.workspaceId;
  const [ws] = await db()
    .insert(workspaces)
    .values({ name: user.name ?? user.email })
    .returning({ id: workspaces.id });
  await db().insert(members).values({ workspaceId: ws.id, userId: user.id });
  if (!(await isSetUp())) await setSetting(HOME_KEY, String(ws.id));
  return ws.id;
}

// Password sign-in (before Google is configured) is single-user: the home workspace.
async function passwordWorkspace() {
  const home = await homeWorkspaceId();
  if (home) return home;
  const [ws] = await db().insert(workspaces).values({ name: "Reels Autopilot" }).returning({ id: workspaces.id });
  await setSetting(HOME_KEY, String(ws.id));
  return ws.id;
}

// Checked against the database on every request, so access ends the moment it is
// taken away, whatever the 30-day cookie says.
export const currentWorkspace = cache(async (): Promise<WorkspaceContext | undefined> => {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session?.role !== "member") return undefined;
  if (session.uid === 0) return { userId: 0, email: session.email, workspaceId: await passwordWorkspace() };
  const [row] = await db()
    .select({ workspaceId: members.workspaceId })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.userId, session.uid), eq(users.role, "member")))
    .orderBy(asc(members.workspaceId))
    .limit(1);
  return row ? { userId: session.uid, email: session.email, workspaceId: row.workspaceId } : undefined;
});

// Without access, the refresh route sorts it out: sign-in page, waitlist, or a fresh
// cookie when the database and the cookie disagree.
export async function requireWorkspace() {
  const ws = await currentWorkspace();
  if (!ws) redirect("/api/auth/refresh");
  return ws;
}

// The Mac pipeline's shared secret maps to the home workspace until each Mac gets
// its own token (docs/PLANO-MULTIUSUARIO.md, phase 2).
export async function pipelineWorkspace(req: Request) {
  if (!hasBearer(req, process.env.PIPELINE_SECRET)) return undefined;
  return homeWorkspaceId();
}

// Admins let people in from the waitlist: anyone in ADMIN_EMAILS, or, with no list,
// whoever owns the home workspace (the person who set the app up).
export async function isAdmin(ws: WorkspaceContext) {
  const list = adminEmails();
  if (list.length) return list.includes(ws.email.toLowerCase());
  return ws.workspaceId === (await homeWorkspaceId());
}

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
