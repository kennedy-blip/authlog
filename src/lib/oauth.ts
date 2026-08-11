import { sha256B64url, signJwt } from "./jwt";
import { DEMO_ISS, randB64url, randHex } from "./samples";

export type Actor = "ua" | "auth" | "rs";
export type FlowId = "pkce" | "client" | "implicit";

export interface StepLine {
  k: string;
  v: string;
  strong?: boolean;
}

export interface FlowStep {
  id: string;
  from: Actor;
  to: Actor;
  title: string;
  method: string; // GET · POST · 302 · 200 · SELF
  lines: StepLine[];
  note?: string;
  tone?: "ok" | "warn" | "bad" | "info";
}

export interface FlowDef {
  id: FlowId;
  name: string;
  tag: string;
  desc: string;
  risk: { label: string; tone: "ok" | "warn" | "bad" };
  specs: string[];
  steps: (r: RunTokens) => FlowStep[];
}

export interface RunTokens {
  runId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  state: string;
  verifier: string;
  challenge: string;
  code: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
  secret: string;
  scope: string;
  expiresAt: number;
}

export const ACTORS: Record<Actor, { label: string; sub: string }> = {
  ua: { label: "User Agent", sub: "browser · web-console" },
  auth: { label: "Auth Server", sub: "auth.authpulse.dev" },
  rs: { label: "Resource Server", sub: "api.authpulse.dev" },
};

const trunc = (s: string, n = 18) => (s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-6)}` : s);

export async function generateRun(): Promise<RunTokens> {
  const now = Math.floor(Date.now() / 1000);
  const secret = `as-run-${randHex(8)}`;
  const verifier = randB64url(64);
  const challenge = (await sha256B64url(verifier)) ?? randB64url(43);
  const clientId = "web-console-88f2";
  const fallbackJwt = (n: number) => `eyJhbGciOiJIUzI1NiJ9.${randB64url(n)}.${randB64url(24)}`;

  let accessToken = fallbackJwt(46);
  let idToken = fallbackJwt(42);
  try {
    accessToken = await signJwt(
      { alg: "HS256", typ: "JWT" },
      {
        iss: DEMO_ISS,
        sub: `client_${clientId}`,
        aud: "api.authpulse.dev",
        scope: "profile email orders:read",
        iat: now,
        exp: now + 3600,
        jti: randHex(12),
      },
      secret,
    );
    idToken = await signJwt(
      { alg: "HS256", typ: "JWT" },
      {
        iss: DEMO_ISS,
        sub: "usr_77ab10cd",
        azp: clientId,
        aud: clientId,
        nonce: randHex(16),
        auth_time: now,
        iat: now,
        exp: now + 3600,
      },
      secret,
    );
  } catch {
    /* keep fallbacks */
  }

  return {
    runId: `run_${randHex(6)}`,
    clientId,
    clientSecret: randB64url(28),
    redirectUri: "https://app.authpulse.dev/callback",
    state: randHex(16),
    verifier,
    challenge,
    code: `SplxlOBeQ${randB64url(22)}`,
    accessToken,
    idToken,
    refreshToken: `rt_${randHex(20)}`,
    secret,
    scope: "profile email orders:read",
    expiresAt: now + 3600,
  };
}

export const FLOWS: Record<FlowId, FlowDef> = {
  pkce: {
    id: "pkce",
    name: "Authorization Code + PKCE",
    tag: "Recommended",
    desc: "Public-client safe: the code is worthless without the one-time verifier, so even a leaked redirect cannot be exchanged for tokens.",
    risk: { label: "Low risk", tone: "ok" },
    specs: ["RFC 6749 §4.1", "RFC 7636 (S256)", "OIDC 1.0"],
    steps: (r) => [
      {
        id: "a1",
        from: "ua",
        to: "auth",
        title: "Authorize request + PKCE challenge",
        method: "GET",
        lines: [
          { k: "path", v: "/oauth2/authorize" },
          { k: "response_type", v: "code" },
          { k: "client_id", v: r.clientId },
          { k: "redirect_uri", v: r.redirectUri },
          { k: "code_challenge", v: trunc(r.challenge), strong: true },
          { k: "code_challenge_method", v: "S256" },
          { k: "state", v: trunc(r.state) },
          { k: "scope", v: r.scope },
        ],
      },
      {
        id: "a2",
        from: "auth",
        to: "ua",
        title: "Login + consent screen",
        method: "302",
        lines: [
          { k: "prompt", v: "consent" },
          { k: "user", v: "ada@authpulse.dev" },
          { k: "mfa", v: "passkey ✓ verified" },
          { k: "decision", v: "user approved 3 scopes", strong: true },
        ],
        tone: "ok",
      },
      {
        id: "a3",
        from: "ua",
        to: "auth",
        title: "Redirect back with auth code",
        method: "GET",
        lines: [
          { k: "path", v: "/callback" },
          { k: "code", v: trunc(r.code), strong: true },
          { k: "state", v: `${trunc(r.state)} (matches ✓)` },
        ],
        note: "Authorization code is single-use with a 60s TTL. It grants nothing by itself.",
      },
      {
        id: "a4",
        from: "ua",
        to: "auth",
        title: "Token request (confidential channel)",
        method: "POST",
        lines: [
          { k: "path", v: "/oauth2/token" },
          { k: "grant_type", v: "authorization_code" },
          { k: "code", v: trunc(r.code) },
          { k: "code_verifier", v: trunc(r.verifier), strong: true },
          { k: "redirect_uri", v: r.redirectUri },
        ],
        note: "This leg goes app → auth over direct TLS, never through the browser.",
      },
      {
        id: "a5",
        from: "auth",
        to: "auth",
        title: "PKCE + code validation",
        method: "SELF",
        lines: [
          { k: "S256(verifier)", v: trunc(r.challenge), strong: true },
          { k: "challenge match", v: "✓ identical" },
          { k: "code status", v: "✓ unused · within TTL" },
          { k: "verdict", v: "REDEEM", strong: true },
        ],
        tone: "ok",
      },
      {
        id: "a6",
        from: "auth",
        to: "ua",
        title: "Token response",
        method: "200",
        lines: [
          { k: "access_token", v: trunc(r.accessToken), strong: true },
          { k: "id_token", v: trunc(r.idToken) },
          { k: "refresh_token", v: trunc(r.refreshToken) },
          { k: "token_type", v: "Bearer" },
          { k: "expires_in", v: "3600" },
        ],
      },
      {
        id: "a7",
        from: "ua",
        to: "rs",
        title: "Authenticated API call",
        method: "GET",
        lines: [
          { k: "path", v: "/api/v1/orders" },
          { k: "Authorization", v: `Bearer ${trunc(r.accessToken)}`, strong: true },
        ],
      },
      {
        id: "a8",
        from: "rs",
        to: "rs",
        title: "JWT validation → response",
        method: "SELF",
        lines: [
          { k: "signature", v: "✓ verified (JWKS / RS256)" },
          { k: "iss · aud", v: `✓ ${DEMO_ISS}` },
          { k: "exp · nbf", v: "✓ within window" },
          { k: "response", v: "200 application/json", strong: true },
        ],
        tone: "ok",
      },
    ],
  },
  client: {
    id: "client",
    name: "Client Credentials",
    tag: "M2M",
    desc: "Machine-to-machine: the client authenticates directly with its own identity. No user context, no refresh token — just a short-lived machine JWT.",
    risk: { label: "Low risk", tone: "ok" },
    specs: ["RFC 6749 §4.4", "M2M best practice"],
    steps: (r) => [
      {
        id: "c1",
        from: "ua",
        to: "auth",
        title: "Token request (client identity)",
        method: "POST",
        lines: [
          { k: "path", v: "/oauth2/token" },
          { k: "grant_type", v: "client_credentials", strong: true },
          { k: "scope", v: "metrics:read" },
          { k: "Authorization", v: `Basic ${trunc(randB64url(24))} (client_id:secret)` },
        ],
        note: "client_secret lives in server-side env / secret manager — never in a browser.",
      },
      {
        id: "c2",
        from: "auth",
        to: "auth",
        title: "Client authentication",
        method: "SELF",
        lines: [
          { k: "client_id", v: `${r.clientId} ✓` },
          { k: "secret hash", v: "✓ matches vault entry" },
          { k: "scope policy", v: "metrics:read ⊂ allowed", strong: true },
        ],
        tone: "ok",
      },
      {
        id: "c3",
        from: "auth",
        to: "ua",
        title: "Machine token issued",
        method: "200",
        lines: [
          { k: "access_token", v: trunc(r.accessToken), strong: true },
          { k: "sub", v: "client_… (no user)" },
          { k: "expires_in", v: "3600" },
          { k: "refresh_token", v: "— not issued", },
        ],
      },
      {
        id: "c4",
        from: "ua",
        to: "rs",
        title: "Service-to-service call",
        method: "GET",
        lines: [
          { k: "path", v: "/api/v1/metrics" },
          { k: "Authorization", v: `Bearer ${trunc(r.accessToken)}`, strong: true },
        ],
      },
      {
        id: "c5",
        from: "rs",
        to: "rs",
        title: "Validate → respond",
        method: "SELF",
        lines: [
          { k: "signature", v: "✓ verified" },
          { k: "client allowed", v: "✓ policy: svc → metrics:read" },
          { k: "response", v: "200 application/json", strong: true },
        ],
        tone: "ok",
      },
    ],
  },
  implicit: {
    id: "implicit",
    name: "Implicit Flow",
    tag: "Legacy",
    desc: "Tokens jump straight to the browser via a URL fragment. No authorization code, no server-to-server leg — and no refresh token to recover from a stale page.",
    risk: { label: "High risk", tone: "bad" },
    specs: ["RFC 6749 §4.2", "DEPRECATED by OAuth 2.1"],
    steps: (r) => [
      {
        id: "i1",
        from: "ua",
        to: "auth",
        title: "Authorize request",
        method: "GET",
        lines: [
          { k: "path", v: "/oauth2/authorize" },
          { k: "response_type", v: "token", strong: true },
          { k: "client_id", v: r.clientId },
          { k: "redirect_uri", v: r.redirectUri },
          { k: "state", v: trunc(r.state) },
          { k: "scope", v: r.scope },
        ],
      },
      {
        id: "i2",
        from: "auth",
        to: "ua",
        title: "302 with token in #fragment",
        method: "302",
        lines: [
          { k: "Location", v: `${r.redirectUri}#access_token=${trunc(r.accessToken)}&…` },
          { k: "token_type", v: "Bearer" },
          { k: "expires_in", v: "900" },
          { k: "state", v: trunc(r.state) },
        ],
        note: "The fragment never reaches server logs — but the full URL sits in browser history and any tab-jacking vector.",
        tone: "warn",
      },
      {
        id: "i3",
        from: "ua",
        to: "ua",
        title: "Parse + purge fragment",
        method: "SELF",
        lines: [
          { k: "location.hash", v: "parsed in memory" },
          { k: "history", v: "replaceState() — URL cleaned", strong: true },
          { k: "storage", v: "memory only (no localStorage)" },
        ],
        tone: "warn",
      },
      {
        id: "i4",
        from: "ua",
        to: "rs",
        title: "Authenticated API call",
        method: "GET",
        lines: [
          { k: "path", v: "/api/v1/orders" },
          { k: "Authorization", v: `Bearer ${trunc(r.accessToken)}`, strong: true },
        ],
      },
      {
        id: "i5",
        from: "rs",
        to: "rs",
        title: "Validate → respond",
        method: "SELF",
        lines: [
          { k: "signature", v: "✓ verified" },
          { k: "exp", v: "✓ (note: only 900s — no refresh)" },
          { k: "response", v: "200 application/json", strong: true },
        ],
        tone: "warn",
      },
    ],
  },
};
