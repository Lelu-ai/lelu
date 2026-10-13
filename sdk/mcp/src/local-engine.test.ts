import { describe, it, expect } from "vitest";
import { findChecksum, sha256Hex, starterPolicy, resolvePreset, POLICY_PRESETS } from "./local-engine.js";

describe("sha256Hex", () => {
  it("matches a known SHA-256 digest", () => {
    // sha256("hello world") — verified against `sha256sum` output.
    expect(sha256Hex(Buffer.from("hello world"))).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    );
  });

  it("produces different digests for different content", () => {
    expect(sha256Hex(Buffer.from("a"))).not.toBe(sha256Hex(Buffer.from("b")));
  });
});

describe("findChecksum", () => {
  const sums = [
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  lelu-engine-linux-amd64",
    "b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c  lelu-engine-linux-arm64",
    "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d1efe1e3d5a04b3fd0da5a9c8  lelu-engine-darwin-amd64",
  ].join("\n");

  it("finds the digest for a listed asset", () => {
    expect(findChecksum(sums, "lelu-engine-linux-amd64")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("returns null for an asset not in the checksums file", () => {
    expect(findChecksum(sums, "lelu-engine-windows-amd64.exe")).toBeNull();
  });

  it("returns null for empty checksums text", () => {
    expect(findChecksum("", "lelu-engine-linux-amd64")).toBeNull();
  });

  it("is case-insensitive on the hex digest but exact on the filename", () => {
    const upper = "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855  lelu-engine-linux-amd64";
    expect(findChecksum(upper, "lelu-engine-linux-amd64")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(findChecksum(sums, "lelu-engine-linux-amd6")).toBeNull();
  });

  it("handles the sha256sum '*' binary-mode marker before the filename", () => {
    const withMarker = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 *lelu-engine-linux-amd64";
    expect(findChecksum(withMarker, "lelu-engine-linux-amd64")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("ignores blank lines", () => {
    const withBlanks = `\n${sums}\n\n`;
    expect(findChecksum(withBlanks, "lelu-engine-linux-arm64")).toBe(
      "b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c"
    );
  });
});

describe("starterPolicy", () => {
  // First match wins, so ordering is the security property: every deny and
  // review rule for risky names must come before the first allow prefix.
  const ruleIds = (yaml: string) => [...yaml.matchAll(/- id: (\S+)/g)].map((m) => m[1]!);

  for (const preset of POLICY_PRESETS) {
    it(`${preset}: secret, destructive and exec rules precede every allow rule`, () => {
      const ids = ruleIds(starterPolicy(preset, "~/.lelu/policy.yaml"));
      const firstAllow = ids.findIndex((id) => id.startsWith("allow-"));
      expect(firstAllow).toBeGreaterThan(0);
      for (const id of ["review-secret", "review-credential", "review-env-file", "deny-destroy", "deny-rm", "deny-remove", "deny-sql", "deny-command"]) {
        const idx = ids.indexOf(id);
        expect(idx, id).toBeGreaterThanOrEqual(0);
        expect(idx, id).toBeLessThan(firstAllow);
      }
      expect(ids.at(-1)).toBe("default-deny");
    });
  }

  it("coding-agent allows the edit/test loop and reviews installs and pushes", () => {
    const ids = ruleIds(starterPolicy("coding-agent", "x"));
    expect(ids).toEqual(expect.arrayContaining(["allow-edit", "allow-run-tests", "review-install", "review-push", "review-deploy"]));
    expect(ids.indexOf("review-push")).toBeLessThan(ids.indexOf("allow-edit"));
  });

  it("general does not allow edits or tests", () => {
    const ids = ruleIds(starterPolicy("general", "x"));
    expect(ids).not.toContain("allow-edit");
    expect(ids).not.toContain("allow-run-tests");
  });

  it("names the policy file in the default-deny reason", () => {
    expect(starterPolicy("general", "/custom/p.yaml")).toContain("Add one to /custom/p.yaml and restart.");
  });
});

describe("resolvePreset", () => {
  it("defaults to general and rejects unknown presets", () => {
    const prev = process.env["LELU_POLICY_PRESET"];
    delete process.env["LELU_POLICY_PRESET"];
    try {
      expect(resolvePreset()).toBe("general");
      expect(resolvePreset("coding-agent")).toBe("coding-agent");
      expect(() => resolvePreset("nope")).toThrow(/Unknown policy preset/);
    } finally {
      if (prev !== undefined) process.env["LELU_POLICY_PRESET"] = prev;
    }
  });
});
