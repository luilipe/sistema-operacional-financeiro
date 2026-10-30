export function authenticatedActorId(request: Request): string | null {
  const actorId = request.headers.get("oai-authenticated-user-id")?.trim();
  if (actorId) return actorId;

  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" ? "local-preview" : null;
}
