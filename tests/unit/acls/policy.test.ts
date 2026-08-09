import { describe, expect, test } from "vitest";

import {
  grantStrings,
  parsePolicy,
  readAcls,
  readAutoApprovers,
  readGrants,
  readStringArrayMap,
  readStringMap,
  serializePolicy,
  setPolicyKey,
} from "~/routes/acls/policy";

describe("parsePolicy", () => {
  test("empty string parses to an empty object", () => {
    expect(parsePolicy("   ")).toEqual({ data: {} });
  });

  test("parses HuJSON with comments and trailing commas", () => {
    const result = parsePolicy(`{
      // line comment
      "groups": { "group:dev": ["alice@"], },
      /* block */ "hosts": { "web": "10.0.0.1/32" },
    }`);
    expect(result).toEqual({
      data: { groups: { "group:dev": ["alice@"] }, hosts: { web: "10.0.0.1/32" } },
    });
  });

  test("does not treat // inside a string as a comment", () => {
    const result = parsePolicy(`{ "hosts": { "site": "https://example.com" } }`);
    expect(result).toEqual({ data: { hosts: { site: "https://example.com" } } });
  });

  test("returns an error for a top-level array", () => {
    const result = parsePolicy("[1, 2, 3]");
    expect("error" in result).toBe(true);
  });

  test("returns an error for malformed JSON", () => {
    const result = parsePolicy("{ not valid");
    expect("error" in result).toBe(true);
  });
});

describe("serializePolicy round-trip preserves unknown keys", () => {
  test("keeps a key the builder does not model", () => {
    const src = { acls: [{ action: "accept", src: ["*"], dst: ["*:*"] }], nodeAttrs: [{ a: 1 }] };
    const parsed = parsePolicy(serializePolicy(src));
    expect("data" in parsed && parsed.data.nodeAttrs).toEqual([{ a: 1 }]);
  });
});

describe("setPolicyKey", () => {
  test("deletes the key when the value is empty", () => {
    const next = setPolicyKey({ acls: [{}], groups: { "group:a": ["x"] } }, "acls", []);
    expect("acls" in next).toBe(false);
    expect(next.groups).toBeDefined();
  });

  test("sets the key when the value is non-empty", () => {
    const next = setPolicyKey({}, "hosts", { web: "10.0.0.1/32" });
    expect(next.hosts).toEqual({ web: "10.0.0.1/32" });
  });
});

describe("readers coerce unexpected shapes safely", () => {
  test("readStringMap drops non-string values", () => {
    expect(readStringMap({ hosts: { a: "1.1.1.1", b: 5 } }, "hosts")).toEqual([["a", "1.1.1.1"]]);
  });

  test("readStringArrayMap filters non-string members", () => {
    expect(readStringArrayMap({ groups: { "group:a": ["x", 2, "y"] } }, "groups")).toEqual([
      ["group:a", ["x", "y"]],
    ]);
  });

  test("readAcls defaults action and normalizes fields", () => {
    expect(readAcls({ acls: [{ src: ["*"], dst: ["*:*"], proto: "tcp" }] })).toEqual([
      { action: "accept", src: ["*"], dst: ["*:*"], proto: "tcp" },
    ]);
  });

  test("readAutoApprovers returns empty defaults when missing", () => {
    expect(readAutoApprovers({})).toEqual({ routes: {}, exitNode: [] });
  });

  test("readGrants keeps raw objects and grantStrings coerces fields", () => {
    const grants = readGrants({
      grants: [{ src: ["group:a"], dst: ["tag:b"], ip: ["*"], app: { "cap/x": [] } }, null, 5],
    });
    expect(grants).toHaveLength(1);
    expect(grantStrings(grants[0], "src")).toEqual(["group:a"]);
    expect(grants[0].app).toEqual({ "cap/x": [] });
  });

  test("editing a grant field preserves its app capability via round-trip", () => {
    const policy = { grants: [{ src: ["group:a"], dst: ["tag:b"], app: { "cap/x": [{ y: 1 }] } }] };
    const grants = readGrants(policy);
    const next = setPolicyKey(policy, "grants", [{ ...grants[0], dst: ["tag:c"] }]);
    const reparsed = parsePolicy(serializePolicy(next));
    if ("error" in reparsed) throw new Error(reparsed.error);
    const back = readGrants(reparsed.data);
    expect(back[0].dst).toEqual(["tag:c"]);
    expect(back[0].app).toEqual({ "cap/x": [{ y: 1 }] });
  });
});
