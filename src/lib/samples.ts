import { signJwt } from "./jwt";

export const DEMO_SECRET = "authpulse-demo-secret";
export const DEMO_ISS = "https://auth.authpulse.dev";

export interface SampleToken {
  id: string;
  label: string;
  hint: string;
  token: string;
}

/* Pre-signed with Node crypto so samples verify even without WebCrypto at runtime. */
export const FALLBACK_SAMPLES: SampleToken[] = [
  {
    id: "admin",
    label: "Fresh admin",
    hint: "valid · ~4h left",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2F1dGguYXV0aHB1bHNlLmRldiIsInN1YiI6InVzcl85ZjJjN2ExZSIsIm5hbWUiOiJBZGEgTmFrYW11cmEiLCJyb2xlcyI6WyJhZG1pbiIsImVkaXRvciJdLCJpYXQiOjE3OTM5MzcxMDAsImV4cCI6MTc5Mzk1MjIzNCwianRpIjoianRpXzgzaDJrOSIsImF6cCI6IndlYi1jb25zb2xlIn0.KiEJTQm1UMXqPSxvfCzIo_RkoQJL0neGLu_gD_QzT5A",
  },
  {
    id: "guest",
    label: "Guest session",
    hint: "expiring soon",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2F1dGguYXV0aHB1bHNlLmRldiIsInN1YiI6InVzcl80NGIwZDIxYyIsIm5hbWUiOiJLYWkgTW9yZWF1Iiwicm9sZXMiOlsiZ3Vlc3QiXSwiaWF0IjoxNzkzOTM1MzAwLCJleHAiOjE3OTM5Mzc5NjIsImp0aSI6Imp0aV83N3BxMngifQ.u5v2HOFTfD63jUBeYxXJoYUnwRzHrtAUUSumY6AiY0Y",
  },
  {
    id: "svc",
    label: "Service acct",
    hint: "expired",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2F1dGguYXV0aHB1bHNlLmRldiIsInN1YiI6InN2Y19tZXRyaWNzLWNvbGxlY3RvciIsIm5hbWUiOiJNZXRyaWNzIENvbGxlY3RvciIsInJvbGVzIjpbInNlcnZpY2VfYWNjb3VudCJdLCJhdWQiOiJhcGkuYXV0aHB1bHNlLmRldiIsImlhdCI6MTc5MzkxMzUwMCwiZXhwIjoxNzkzOTE3MTAwLCJqdGkiOiJqdGlfNTEzem00ciJ9.i7Vg2OjsssTpEuyEVP9xmjwzCQIETBk059D1PbctbWA",
  },
];

/** Build fresh samples signed at call-time (fallback to pre-baked tokens). */
export async function buildSamples(): Promise<SampleToken[]> {
  const now = Math.floor(Date.now() / 1000);
  const head = { alg: "HS256", typ: "JWT" };
  try {
    const [admin, guest, svc] = await Promise.all([
      signJwt(
        head,
        {
          iss: DEMO_ISS,
          sub: "usr_9f2c7a1e",
          name: "Ada Nakamura",
          roles: ["admin", "editor"],
          iat: now,
          exp: now + 4 * 3600 + 734,
          jti: "jti_83h2k9",
          azp: "web-console",
        },
        DEMO_SECRET,
      ),
      signJwt(
        head,
        {
          iss: DEMO_ISS,
          sub: "usr_44b0d21c",
          name: "Kai Moreau",
          roles: ["guest"],
          iat: now - 1800,
          exp: now + 14 * 60 + 22,
          jti: "jti_77pq2x",
        },
        DEMO_SECRET,
      ),
      signJwt(
        head,
        {
          iss: DEMO_ISS,
          sub: "svc_metrics-collector",
          name: "Metrics Collector",
          roles: ["service_account"],
          aud: "api.authpulse.dev",
          iat: now - 7200,
          exp: now - 3600,
          jti: "jti_51zm4r",
        },
        DEMO_SECRET,
      ),
    ]);
    return [
      { id: "admin", label: "Fresh admin", hint: "valid · ~4h left", token: admin },
      { id: "guest", label: "Guest session", hint: "expiring < 15m", token: guest },
      { id: "svc", label: "Service acct", hint: "expired · 1h ago", token: svc },
    ];
  } catch {
    return FALLBACK_SAMPLES;
  }
}

export function randHex(len: number): string {
  const c = globalThis.crypto;
  let out = "";
  while (out.length < len) {
    if (c?.getRandomValues) {
      const arr = c.getRandomValues(new Uint8Array(Math.ceil((len - out.length) / 2)));
      for (const b of arr) out += b.toString(16).padStart(2, "0");
    } else {
      out += Math.floor(Math.random() * 16).toString(16);
    }
  }
  return out.slice(0, len);
}

const B64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function randB64url(len: number): string {
  const c = globalThis.crypto;
  let out = "";
  while (out.length < len) {
    if (c?.getRandomValues) {
      const arr = c.getRandomValues(new Uint8Array(Math.ceil(len - out.length)));
      for (const b of arr) out += B64URL_ALPHABET[b % 64];
    } else {
      out += B64URL_ALPHABET[Math.floor(Math.random() * 64)];
    }
  }
  return out.slice(0, len);
}
