/* Client-side JWT utilities: base64url codec, decode, HMAC/ECDSA/RSA verification via WebCrypto. */

export function b64urlEncode(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(input: string): string {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function b64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----[A-Z- ]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return bytes.buffer;
}

/* ---------------- decode ---------------- */

export interface DecodedJwt {
  ok: boolean;
  error?: string;
  segments: [string, string, string] | null;
  header?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  signature?: string;
  signingInput?: string;
  alg?: string;
  typ?: string;
}

export function decodeJwt(raw: string): DecodedJwt {
  const token = raw.trim();
  if (!token) {
    return {
      ok: false,
      error: "Empty input — paste a Bearer JWT to begin inspection.",
      segments: null,
    };
  }
  const clean = token.replace(/^bearer\s+/i, "");
  const parts = clean.split(".");
  if (parts.length !== 3) {
    return {
      ok: false,
      error: `Malformed token — expected 3 dot-separated segments, found ${parts.length}.`,
      segments: null,
    };
  }
  try {
    const header = JSON.parse(b64urlDecode(parts[0])) as Record<string, unknown>;
    const payload = JSON.parse(b64urlDecode(parts[1])) as Record<string, unknown>;
    return {
      ok: true,
      segments: [parts[0], parts[1], parts[2]],
      header,
      payload,
      signature: parts[2],
      signingInput: `${parts[0]}.${parts[1]}`,
      alg: String(header.alg ?? "unknown"),
      typ: String(header.typ ?? "JWT"),
    };
  } catch {
    return {
      ok: false,
      error: "Segment is not valid base64url JSON — token is corrupted or truncated.",
      segments: null,
    };
  }
}

/* ---------------- sign ---------------- */

const HS_HASH: Record<string, string> = {
  HS256: "SHA-256",
  HS384: "SHA-384",
  HS512: "SHA-512",
};

export function webCrypto(): Crypto | null {
  const c = globalThis.crypto as Crypto | undefined;
  return c && c.subtle ? c : null;
}

export async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  secret: string,
  alg: keyof typeof HS_HASH = "HS256",
): Promise<string> {
  const c = webCrypto();
  if (!c) throw new Error("WebCrypto unavailable in this context");
  const key = await c.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: HS_HASH[alg] },
    false,
    ["sign"],
  );
  const signingInput = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(payload))}`;
  const sig = await c.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64urlEncode(sig)}`;
}

export async function sha256B64url(input: string): Promise<string | null> {
  const c = webCrypto();
  if (!c) return null;
  const hash = await c.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return b64urlEncode(hash);
}

/* ---------------- verify ---------------- */

export type VerifyState = "verified" | "mismatch" | "unsigned" | "unsupported" | "no-key" | "error";

export interface VerifyResult {
  state: VerifyState;
  detail: string;
}

const RS_HASH: Record<string, string> = { RS256: "SHA-256", RS384: "SHA-384", RS512: "SHA-512" };
const ES_CURVE: Record<string, string> = { ES256: "P-256", ES384: "P-384" };

export async function verifySignature(d: DecodedJwt, keyMaterial: string): Promise<VerifyResult> {
  const c = webCrypto();
  if (!c || !d.ok || !d.signature) {
    return { state: "error", detail: "Nothing to verify — token not decoded yet." };
  }
  const alg = d.alg!;
  const sigBytes = b64urlToBytes(d.signature);
  const input = new TextEncoder().encode(d.signingInput!);

  try {
    if (alg === "none") {
      return {
        state: "unsigned",
        detail: 'alg "none" — token carries no signature. Any client can mint claims. Reject in production.',
      };
    }

    if (HS_HASH[alg]) {
      if (!keyMaterial) {
        return { state: "no-key", detail: `${alg} is symmetric — provide the HMAC secret key to verify.` };
      }
      const key = await c.subtle.importKey(
        "raw",
        new TextEncoder().encode(keyMaterial),
        { name: "HMAC", hash: HS_HASH[alg] },
        false,
        ["verify"],
      );
      const ok = await c.subtle.verify("HMAC", key, input, sigBytes);
      return ok
        ? { state: "verified", detail: `HMAC ${HS_HASH[alg]} digest over signing input matches the signature segment.` }
        : { state: "mismatch", detail: "Computed digest ≠ signature. Wrong secret — or the token was tampered with." };
    }

    if (RS_HASH[alg] || ES_CURVE[alg]) {
      if (!keyMaterial.trim().includes("-----BEGIN")) {
        return { state: "no-key", detail: `${alg} is asymmetric — paste the PEM-encoded public key (SPKI).` };
      }
      const der = pemToDer(keyMaterial.trim());
      if (RS_HASH[alg]) {
        const key = await c.subtle.importKey(
          "spki",
          der,
          { name: "RSA-SHA256", hash: RS_HASH[alg] },
          false,
          ["verify"],
        );
        const ok = await c.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, input, sigBytes);
        return ok
          ? { state: "verified", detail: `${alg} signature verified against the supplied SPKI public key.` }
          : { state: "mismatch", detail: "Signature did not verify against this public key." };
      }
      const key = await c.subtle.importKey("spki", der, { name: "ECDSA", namedCurve: ES_CURVE[alg] }, false, [
        "verify",
      ]);
      const ok = await c.subtle.verify(
        { name: "ECDSA", hash: ES_CURVE[alg] === "P-256" ? "SHA-256" : "SHA-384" },
        key,
        input,
        sigBytes,
      );
      return ok
        ? { state: "verified", detail: `${alg} ECDSA signature verified against the supplied public key.` }
        : { state: "mismatch", detail: "ECDSA signature did not verify against this key." };
    }

    return { state: "unsupported", detail: `${alg} cannot be verified in-browser — export to a server-side verifier.` };
  } catch (e) {
    return { state: "error", detail: `Verification failed: ${e instanceof Error ? e.message : "unknown key format"}.` };
  }
}

/* ---------------- expiry ---------------- */

export type ExpState = "valid" | "expiring" | "expired" | "unknown";

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!d) parts.push(`${String(s).padStart(2, "0")}s`);
  return parts.slice(0, 3).join(" ") || "0s";
}

export function getExpStatus(
  payload: Record<string, unknown> | undefined,
  nowMs: number,
): { state: ExpState; ms: number | null; label: string; date: string | null } {
  const exp = payload?.exp;
  if (typeof exp !== "number") {
    return { state: "unknown", ms: null, label: "No exp claim — this token never expires", date: null };
  }
  const ms = exp * 1000 - nowMs;
  const date = new Date(exp * 1000).toLocaleString([], {
    hour12: false,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  if (ms <= 0) return { state: "expired", ms, label: `EXPIRED — ${formatDuration(-ms)} ago`, date };
  if (ms < 15 * 60 * 1000) return { state: "expiring", ms, label: `Expires in ${formatDuration(ms)}`, date };
  return { state: "valid", ms, label: `Expires in ${formatDuration(ms)}`, date };
}

/* ---------------- claim sanity checks ---------------- */

export interface ClaimCheck {
  id: string;
  label: string;
  pass: boolean;
  note: string;
  tone: "ok" | "warn" | "bad";
}

export function runClaimChecks(d: DecodedJwt, nowMs: number): ClaimCheck[] {
  if (!d.ok) return [];
  const p = d.payload!;
  const checks: ClaimCheck[] = [];
  const has = (k: string) => typeof p[k] !== "undefined";

  checks.push({
    id: "alg",
    label: "Algorithm",
    pass: d.alg !== "none",
    note: d.alg === "none" ? `"none" — unsigned tokens are forgeable` : `${d.alg} — signing algorithm in use`,
    tone: d.alg === "none" ? "bad" : d.alg === "HS256" ? "warn" : "ok",
  });
  checks.push({
    id: "exp",
    label: "exp present",
    pass: has("exp"),
    note: has("exp") ? "bounded lifetime" : "no expiry — token is immortal",
    tone: has("exp") ? "ok" : "bad",
  });
  checks.push({
    id: "not-expired",
    label: "Not expired",
    pass: typeof p.exp === "number" ? p.exp * 1000 > nowMs : true,
    note: typeof p.exp === "number" ? "checked against local clock" : "n/a — no exp claim",
    tone: typeof p.exp === "number" && p.exp * 1000 <= nowMs ? "bad" : "ok",
  });
  checks.push({
    id: "iss",
    label: "iss present",
    pass: has("iss"),
    note: has("iss") ? "issuer pinned" : "missing issuer — unverifiable origin",
    tone: has("iss") ? "ok" : "warn",
  });
  checks.push({
    id: "aud",
    label: "aud present",
    pass: has("aud"),
    note: has("aud") ? "audience restricted" : "no audience — replayable anywhere",
    tone: has("aud") ? "ok" : "warn",
  });
  checks.push({
    id: "jti",
    label: "jti present",
    pass: has("jti"),
    note: has("jti") ? "revocable / replay-trackable" : "no unique id — hard to revoke",
    tone: has("jti") ? "ok" : "warn",
  });
  return checks;
}
