// Server-only helpers for LiveKit access tokens (Web Crypto, Worker-safe).

function b64url(input: ArrayBuffer | string) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type LivekitGrant = {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name?: string;
  room: string;
  ttlSeconds?: number;
};

export async function createAccessToken({
  apiKey,
  apiSecret,
  identity,
  name,
  room,
  ttlSeconds = 60 * 60 * 4,
}: LivekitGrant): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: apiKey,
    sub: identity,
    jti: identity,
    nbf: now - 10,
    iat: now,
    exp: now + ttlSeconds,
    name: name || identity,
    video: {
      room,
      roomJoin: true,
      roomCreate: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${b64url(sig)}`;
}

export function normalizeWsUrl(raw: string) {
  const url = raw.trim().replace(/\/+$/, "");
  if (url.startsWith("https://")) return `wss://${url.slice("https://".length)}`;
  if (url.startsWith("http://")) return `ws://${url.slice("http://".length)}`;
  if (url.startsWith("ws://") || url.startsWith("wss://")) return url;
  return `wss://${url}`;
}
