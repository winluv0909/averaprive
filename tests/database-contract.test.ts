import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const migrations = readdirSync(migrationDirectory).sort();
const sql = migrations.map((file) => readFileSync(join(migrationDirectory, file), "utf8")).join("\n");

describe("database contract", () => {
  it("runs the foundational schema before dependent workflows", () => {
    expect(migrations[0]).toBe("202609210000_core_marketplace.sql");
  });

  it.each([
    "ap_agencies",
    "ap_agency_memberships",
    "ap_agency_invitations",
    "ap_verifications",
    "ap_reviews",
    "ap_reports",
    "ap_disputes",
    "ap_support_tickets",
    "ap_support_messages",
    "ap_editorial_posts",
    "ap_subscriptions",
    "ap_security_audit",
  ])("defines %s", (table) => {
    expect(sql).toContain(`public.${table}`);
  });

  it("keeps paid placement independent from verification", () => {
    const sponsored = readFileSync(join(migrationDirectory, "202609280007_sponsored_placements.sql"), "utf8");
    expect(sponsored.toLowerCase()).not.toContain("update public.ap_verifications");
  });

  it("makes demonstration OFM profiles non-verifiable and non-contactable", () => {
    const demoMigration = readFileSync(join(migrationDirectory, "202610030015_ofm_demo_agencies.sql"), "utf8");
    expect(demoMigration).toContain("Demonstration profiles cannot request verification");
    expect(demoMigration).toContain("published and accepting_inquiries and not demo_profile");
    expect(demoMigration).toContain("published and not demo_profile");
  });

  it("does not attach Trustpilot identities to fictional agencies", () => {
    const demoMigrations = ["202610030015_ofm_demo_agencies.sql", "202610030016_demo_external_ratings.sql"]
      .map((file) => readFileSync(join(migrationDirectory, file), "utf8"))
      .join("\n");
    expect(demoMigrations.toLowerCase()).not.toContain("trustpilot.com/review/");
  });

  it("does not seed fictional agencies or ratings in production", () => {
  const demoMigrations = [
    "202610030015_ofm_demo_agencies.sql",
    "202610030016_demo_external_ratings.sql",
  ]
    .map((file) => readFileSync(join(migrationDirectory, file), "utf8"))
    .join("\n");

  expect(demoMigrations).not.toMatch(
    /d0000000-0000-4000-8000-0000000000\d\d/i,
  );
  expect(demoMigrations).not.toMatch(
    /insert\s+into\s+public\.(?:ap_agencies|ap_external_ratings)\b/i,
  );
});

  it("keeps simulated external ratings distinguishable from live ratings", () => {
    const ratings = readFileSync(join(migrationDirectory, "202610030016_demo_external_ratings.sql"), "utf8");
    expect(ratings).toContain("rating_status in ('active','unavailable','no_profile')");
    expect(ratings).toMatch(/check\s*\(not is_demo or profile_url is null\)/);
  });
});
