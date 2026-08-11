export interface RoleDef {
  id: string;
  label: string;
  desc: string;
  tone: "violet" | "emerald" | "cyan" | "amber";
}

export const ROLES: RoleDef[] = [
  { id: "admin", label: "admin", desc: "Full platform control — users, config, audit trail.", tone: "violet" },
  { id: "moderator", label: "moderator", desc: "Content oversight — posts, flags, removals.", tone: "emerald" },
  { id: "guest", label: "guest", desc: "Public read access — catalog endpoints only.", tone: "cyan" },
  { id: "service_account", label: "service_account", desc: "Machine identity — metrics, webhooks, config.", tone: "amber" },
];

export interface EndpointDef {
  id: string;
  method: string;
  path: string;
  desc: string;
}

export const ENDPOINTS: EndpointDef[] = [
  { id: "users.list", method: "GET", path: "/api/v1/users", desc: "List users (paged)" },
  { id: "users.get", method: "GET", path: "/api/v1/users/:id", desc: "Fetch single user" },
  { id: "users.create", method: "POST", path: "/api/v1/users", desc: "Provision a user" },
  { id: "users.update", method: "PATCH", path: "/api/v1/users/:id", desc: "Update profile / roles" },
  { id: "users.delete", method: "DELETE", path: "/api/v1/users/:id", desc: "Suspend / delete user" },
  { id: "posts.list", method: "GET", path: "/api/v1/posts", desc: "List public posts" },
  { id: "posts.create", method: "POST", path: "/api/v1/posts", desc: "Publish a post" },
  { id: "posts.delete", method: "DELETE", path: "/api/v1/posts/:id", desc: "Remove a post" },
  { id: "metrics.read", method: "GET", path: "/api/v1/metrics", desc: "System metrics feed" },
  { id: "webhooks.write", method: "POST", path: "/api/v1/webhooks", desc: "Register webhook" },
  { id: "audit.read", method: "GET", path: "/api/v1/audit-log", desc: "Audit trail (read-only)" },
  { id: "config.read", method: "GET", path: "/api/v1/config", desc: "Read runtime config" },
];

export type Matrix = Record<string, Record<string, boolean>>;

export const DEFAULT_MATRIX: Matrix = {
  "users.list": { admin: true, moderator: true, guest: false, service_account: false },
  "users.get": { admin: true, moderator: true, guest: false, service_account: true },
  "users.create": { admin: true, moderator: false, guest: false, service_account: false },
  "users.update": { admin: true, moderator: false, guest: false, service_account: false },
  "users.delete": { admin: true, moderator: false, guest: false, service_account: false },
  "posts.list": { admin: true, moderator: true, guest: true, service_account: false },
  "posts.create": { admin: true, moderator: true, guest: false, service_account: false },
  "posts.delete": { admin: true, moderator: true, guest: false, service_account: false },
  "metrics.read": { admin: true, moderator: false, guest: false, service_account: true },
  "webhooks.write": { admin: true, moderator: false, guest: false, service_account: true },
  "audit.read": { admin: true, moderator: false, guest: false, service_account: false },
  "config.read": { admin: true, moderator: false, guest: false, service_account: true },
};

export interface CheckResult {
  status: "allow" | "deny" | "not_found";
  endpoint?: EndpointDef;
  trace: { text: string; tone: "ok" | "warn" | "bad" | "info" }[];
  rolesWithAccess: string[];
}

export function normalizeRequest(method: string, rawPath: string): { method: string; path: string } {
  const path = rawPath.trim().split("?")[0].replace(/\/+$/, "") || "/";
  return { method: method.toUpperCase(), path };
}

export function matchEndpoint(method: string, rawPath: string): EndpointDef | null {
  const { method: m, path: p } = normalizeRequest(method, rawPath);
  return (
    ENDPOINTS.find((ep) => {
      if (ep.method !== m) return false;
      const a = ep.path.split("/");
      const b = p.split("/");
      if (a.length !== b.length) return false;
      return a.every((seg, i) => seg.startsWith(":") ? b[i].length > 0 : seg === b[i]);
    }) ?? null
  );
}

export function checkAccess(matrix: Matrix, role: string, method: string, rawPath: string): CheckResult {
  const { method: m, path: p } = normalizeRequest(method, rawPath);
  const trace: CheckResult["trace"] = [];
  trace.push({ text: `$ normalize    ${m} ${rawPath.trim() || "/"}  →  ${m} ${p}`, tone: "info" });

  const ep = matchEndpoint(method, rawPath);
  if (!ep) {
    trace.push({ text: `$ route match  ${p}  →  no registered route`, tone: "bad" });
    trace.push({ text: `$ verdict      NOT_FOUND · 404 — route does not exist in policy table`, tone: "bad" });
    return { status: "not_found", trace, rolesWithAccess: [] };
  }

  trace.push({ text: `$ route match  ${p}  →  ✓ ${ep.id}`, tone: "ok" });
  const row = matrix[ep.id] ?? {};
  const rolesWithAccess = ROLES.filter((r) => row[r.id]).map((r) => r.id);
  const allowed = !!row[role];

  trace.push({
    text: `$ policy read  matrix["${ep.id}"]["${role}"]  →  ${allowed ? "true" : "false"}`,
    tone: allowed ? "ok" : "warn",
  });
  trace.push(
    allowed
      ? { text: `$ verdict      ALLOW · 200 OK — request proceeds`, tone: "ok" }
      : { text: `$ verdict      DENY · 403 Forbidden  (granted to: ${rolesWithAccess.join(", ") || "nobody"})`, tone: "bad" },
  );

  return { status: allowed ? "allow" : "deny", endpoint: ep, trace, rolesWithAccess };
}
