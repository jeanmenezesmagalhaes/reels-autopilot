// Public host of this project's own Blob store (token: vercel_blob_rw_<storeId>_<secret>).
export function ownBlobHost() {
  const storeId = process.env.BLOB_READ_WRITE_TOKEN?.split("_")[3];
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : undefined;
}

export function isOwnBlobUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.hostname === ownBlobHost();
  } catch {
    return false;
  }
}

// Raw videos uploaded from the dashboard live under one folder per workspace.
export const rawUploadPrefix = (workspaceId: number) => `uploads/${workspaceId}/`;
