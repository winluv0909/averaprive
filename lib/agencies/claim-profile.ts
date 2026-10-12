export const claimProfileColumns = "id,name,slug,demo_profile,website_url,about,country,city,services,social_links,directory_information,tagline,positioning_statement,category,founded_year,employee_count_range,languages,regions_served,creator_niches,ideal_client,minimum_requirements";

export function claimProfileSnapshot(agency: Record<string, unknown>) {
  return Object.fromEntries(
    ["name", "website_url", "about", "country", "city", "services", "social_links", "directory_information", "tagline", "positioning_statement", "category", "founded_year", "employee_count_range", "languages", "regions_served", "creator_niches", "ideal_client", "minimum_requirements"]
      .map((key) => [key, agency[key] ?? null]),
  );
}

export function readProfileSnapshot(value: FormDataEntryValue | null) {
  try {
    const parsed: unknown = JSON.parse(String(value ?? ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
