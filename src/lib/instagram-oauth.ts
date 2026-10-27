export const IG_STATE_COOKIE = "ig_oauth";
// Where to land after connecting: Ajustes by default, or back into the first-run flow.
export const IG_RETURN_COOKIE = "ig_return";

export function igReturnPath(from: string | undefined, result: "ok" | "erro" | "em-uso") {
  return from === "comecar" ? `/comecar?passo=instagram&ig=${result}` : `/ajustes?ig=${result}`;
}

export function igRedirectUri(req: Request) {
  return new URL("/api/instagram/callback", process.env.AUTH_URL ?? new URL(req.url).origin).toString();
}
