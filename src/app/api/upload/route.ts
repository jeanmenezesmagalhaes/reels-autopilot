import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { rawUploadPrefix } from "@/lib/blob-host";
import { currentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Issues a short-lived token so the browser uploads the raw video straight to Blob.
// Members only, videos only, under their own uploads/<workspace>/, with a random suffix.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  const ws = body.type === "blob.generate-client-token" ? await currentWorkspace() : undefined;
  if (body.type === "blob.generate-client-token" && !ws) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const name = ws && pathname.startsWith(rawUploadPrefix(ws.workspaceId)) && pathname.slice(rawUploadPrefix(ws.workspaceId).length);
        if (!name || !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(name) || name.includes("..")) throw new Error("bad path");
        return {
          allowedContentTypes: ["video/*"],
          maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
