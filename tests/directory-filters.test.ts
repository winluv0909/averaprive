import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

type Agency = Record<string, unknown>;
type Filters = {
  normalize(value: unknown): string;
  options(records: Agency[], field: string): { value: string; label: string }[];
  matches(agency: Agency, field: string, selected: string): boolean;
  newestFirst(a: Agency, b: Agency): number;
};
const context = {} as { AveraDirectoryFilters: Filters };
runInNewContext(readFileSync(new URL("../public/js/directory-filters.js", import.meta.url), "utf8"), context);
const filters = context.AveraDirectoryFilters;

describe("published-agency directory filters", () => {
  it.each(["1–5", "6–15", "16–50", "51–100", "101+"])("includes signup size %s and matches its record", size => {
    const rows = [{ size }];
    const choice = filters.options(rows, "size")[0];
    expect(choice.label).toBe(size);
    expect(filters.matches(rows[0], "size", choice.value)).toBe(true);
  });
  it("preserves historical size ranges without guessing overlapping headcounts", () => {
    const rows = [{ size: "Boutique" }, { size: "2–10" }, { size: "11–50" }, { size: "51+" }, { size: "1–5" }];
    expect(filters.options(rows, "size").map(x => x.label)).toEqual(["1–5", "2–10", "11–50", "51+", "Boutique"]);
    expect(filters.matches(rows[0], "size", "1–5")).toBe(false);
    expect(filters.matches(rows[1], "size", "1–5")).toBe(false);
  });
  it("deduplicates harmless case, whitespace and dash variants", () => {
    const options = filters.options([{ size: "2-10" }, { size: "2–10" }, { size: " 2–10 " }], "size");
    expect(options).toHaveLength(1);
    expect(filters.matches({ size: "2–10" }, "size", options[0].value)).toBe(true);
    expect(filters.matches({ services: [" Chatting   & Sales "] }, "services", "chatting & sales")).toBe(true);
  });
  it("exposes signup and custom services without conflating distinct services", () => {
    const rows = [
      { services: ["Full-Service OFM", "Chatting & Sales", "Content Strategy"] },
      { services: ["Creator Management", "Custom creator coaching"] },
    ];
    const options = filters.options(rows, "services");
    expect(options.map(x => x.label)).toContain("Custom creator coaching");
    for (const row of rows) for (const service of row.services) {
      const option = options.find(x => x.value === filters.normalize(service));
      expect(option).toBeDefined();
      expect(filters.matches(row, "services", option!.value)).toBe(true);
    }
    expect(filters.matches(rows[0], "services", "Creator Management")).toBe(false);
  });
  it("matches Adult and historical Adult creators while retaining other niches", () => {
    const rows = [{ niches: ["Adult"] }, { niches: ["Adult creators", "Cosplay", "Couples"] }];
    expect(filters.options(rows, "niches").filter(x => x.value === "adult")).toHaveLength(1);
    expect(filters.matches(rows[0], "niches", "Adult creators")).toBe(true);
    expect(filters.matches(rows[1], "niches", "Adult")).toBe(true);
    expect(filters.matches(rows[0], "niches", "Cosplay")).toBe(false);
  });
  it("includes countries beyond the old hard-coded list and matches either country or region", () => {
    const rows = [{ country: "Japan", city: "Tokyo", region: "Asia" }, { country: "Brazil" }];
    expect(filters.options(rows, "location").map(x => x.label)).toEqual(["Asia", "Brazil", "Japan"]);
    expect(filters.matches(rows[0], "location", "japan")).toBe(true);
    expect(filters.matches(rows[0], "location", "asia")).toBe(true);
    expect(filters.matches(rows[0], "location", "brazil")).toBe(false);
  });
  it("sorts by publication date, placing missing and invalid dates last with name ties", () => {
    const rows = [
      { name: "A old", published_at: "2025-01-01T00:00:00Z" },
      { name: "Z new", published_at: "2026-10-25T00:00:00Z" },
      { name: "C missing" }, { name: "B invalid", published_at: "not a date" },
    ];
    expect(rows.sort(filters.newestFirst).map(x => x.name)).toEqual(["Z new", "A old", "B invalid", "C missing"]);
  });
  it("handles empty and malformed fields without offering invented filter choices", () => {
    expect(filters.options([], "size")).toHaveLength(0);
    expect(filters.options([{ services: [null, {}, 4, "", "Management"] }], "services").map(x => x.label)).toEqual(["Management"]);
    expect(filters.matches({}, "size", "")).toBe(true);
    expect(filters.matches({}, "size", "1–5")).toBe(false);
  });
  it("does not mutate published agency records", () => {
    const rows = [{ name: "Fixture", size: "2-10", niches: ["Adult creators"], services: ["Management"] }];
    const before = JSON.stringify(rows);
    filters.options(rows, "size"); filters.options(rows, "niches");
    filters.matches(rows[0], "niches", "Adult"); rows.slice().sort(filters.newestFirst);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it("loads the helper before its consumer and supplies the dynamic size container", () => {
    const html = readFileSync(new URL("../public/agencies.html", import.meta.url), "utf8");
    expect(html.indexOf('src="js/directory-filters.js')).toBeGreaterThan(-1);
    expect(html.indexOf('src="js/directory-filters.js')).toBeLessThan(html.indexOf('src="js/agencies.js'));
    expect(html).toContain('id="agencySizeChoices"');
    expect(html).toContain('value="newest">Recently published');
  });
});
