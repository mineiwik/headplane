import { stripJsonCommentsAndTrailingCommas } from "~/utils/node-info";

// A parsed policy is kept as an untyped record so unknown top-level keys
// survive a builder round-trip. The builder only reads/writes the keys it
// understands; everything else is preserved verbatim on serialize.
export type PolicyObject = Record<string, unknown>;

export type AclRule = { action: string; src: string[]; dst: string[]; proto?: string };
export type SshRule = { action: string; src: string[]; dst: string[]; users: string[] };
export type AutoApprovers = { routes: Record<string, string[]>; exitNode: string[] };

export function parsePolicy(text: string): { data: PolicyObject } | { error: string } {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { data: {} };
  }

  try {
    const parsed = JSON.parse(stripJsonCommentsAndTrailingCommas(trimmed)) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "The policy must be a JSON object." };
    }
    return { data: parsed as PolicyObject };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid JSON." };
  }
}

export function serializePolicy(policy: PolicyObject): string {
  return `${JSON.stringify(policy, null, 2)}\n`;
}

// Sets key to value, deleting it when value is empty so the builder never
// injects empty sections into a policy that did not already have them.
export function setPolicyKey(policy: PolicyObject, key: string, value: unknown): PolicyObject {
  const next = { ...policy };
  if (isEmpty(value)) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

function isEmpty(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (value !== null && typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return value === undefined || value === "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function readStringMap(policy: PolicyObject, key: string): [string, string][] {
  const value = policy[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).flatMap(([k, v]) =>
    typeof v === "string" ? [[k, v] as [string, string]] : [],
  );
}

export function readStringArrayMap(policy: PolicyObject, key: string): [string, string[]][] {
  const value = policy[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).map(([k, v]) => [k, asStringArray(v)] as [string, string[]]);
}

export function readAcls(policy: PolicyObject): AclRule[] {
  const value = policy.acls;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((rule) => {
    const r = (rule ?? {}) as Record<string, unknown>;
    return {
      action: typeof r.action === "string" ? r.action : "accept",
      src: asStringArray(r.src),
      dst: asStringArray(r.dst),
      proto: typeof r.proto === "string" ? r.proto : undefined,
    };
  });
}

export function readSsh(policy: PolicyObject): SshRule[] {
  const value = policy.ssh;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((rule) => {
    const r = (rule ?? {}) as Record<string, unknown>;
    return {
      action: typeof r.action === "string" ? r.action : "accept",
      src: asStringArray(r.src),
      dst: asStringArray(r.dst),
      users: asStringArray(r.users),
    };
  });
}

export function readAutoApprovers(policy: PolicyObject): AutoApprovers {
  const value = policy.autoApprovers;
  const obj = value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const routes = obj.routes;
  return {
    routes:
      routes !== null && typeof routes === "object" && !Array.isArray(routes)
        ? Object.fromEntries(Object.entries(routes).map(([k, v]) => [k, asStringArray(v)]))
        : {},
    exitNode: asStringArray(obj.exitNode),
  };
}

// Grants are kept as raw objects rather than a fixed shape: a grant may carry
// `app` capabilities (arbitrary JSON) that the builder does not model, so edits
// spread over the original object to preserve those fields.
export function readGrants(policy: PolicyObject): Record<string, unknown>[] {
  const value = policy.grants;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (g): g is Record<string, unknown> => g !== null && typeof g === "object" && !Array.isArray(g),
  );
}

export function grantStrings(grant: Record<string, unknown>, key: string): string[] {
  return asStringArray(grant[key]);
}

// Serializes an acl rule, dropping proto when unset to keep output minimal.
export function aclToJson(rule: AclRule): Record<string, unknown> {
  const json: Record<string, unknown> = { action: rule.action, src: rule.src, dst: rule.dst };
  if (rule.proto) {
    json.proto = rule.proto;
  }
  return json;
}
