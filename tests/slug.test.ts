import { describe, expect, it } from "vitest";
import { createSlug } from "../lib/agencies/slug";

describe("createSlug", () => {
  it("creates a stable URL-safe agency slug", () => {
    expect(createSlug("  Avera Privé & Partners  ")).toBe("avera-prive-partners");
  });

  it("collapses punctuation and repeated separators", () => {
    expect(createSlug("Alpha---Beta / Creator Management")).toBe("alpha-beta-creator-management");
  });
});
