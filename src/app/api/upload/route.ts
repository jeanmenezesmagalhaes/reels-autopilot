import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/owner";

export const dynamic = "force-dynamic";

// Issues a short-lived token so the browser uploads the raw video straight to Blob.
// Owner only, videos only, under uploads/, with a random suffix in the name.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  if (body.type === "blob.generate-client-token" && !(await isOwnerRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("uploads/")) throw new Error("bad path");
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
