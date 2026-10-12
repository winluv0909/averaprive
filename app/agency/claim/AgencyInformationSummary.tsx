function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function display(value: unknown): string {
  if (Array.isArray(value)) return value.map(display).filter(Boolean).join(", ") || "Not yet confirmed";
  return typeof value === "string" && value.trim() ? value : typeof value === "number" ? String(value) : "Not yet confirmed";
}
function safeSource(value: unknown): value is string {
  try { return typeof value === "string" && new URL(value).protocol === "https:"; } catch { return false; }
}
export default function AgencyInformationSummary({ profile }: { profile: Record<string, unknown> }) {
  const details = record(profile.directory_information);
  const fields: [string, unknown][] = [
    ["Agency name", profile.name], ["Official website", profile.website_url], ["About", profile.about],
    ["Tagline", profile.tagline], ["Positioning", profile.positioning_statement], ["Category", profile.category],
    ["Location", [profile.city, profile.country].filter(Boolean)], ["Services", profile.services],
    ["Legal entity", details.legal_name], ["Company registration", details.registration_number],
    ["Registered address", details.registered_address], ["Public contact email", details.public_email],
    ["Public phone", details.public_phone], ["Year established", profile.founded_year ?? details.founded_year],
    ["Team size", profile.employee_count_range ?? details.team_size], ["Languages", Array.isArray(profile.languages) && profile.languages.length ? profile.languages : details.languages], ["Markets served", Array.isArray(profile.regions_served) && profile.regions_served.length ? profile.regions_served : details.markets_served],
    ["Creator niches", profile.creator_niches], ["Ideal client", profile.ideal_client], ["Minimum requirements", profile.minimum_requirements],
    ["Social profiles", Object.entries(record(profile.social_links)).map(([label, target]) => `${label}: ${display(target)}`)],
    ["Contact purpose", details.email_purpose], ["Other official contact", details.contact_channel],
    ["Operating locations", details.operating_locations], ["Research notes", details.note], ["Last researched", details.checked_on],
  ];
  const sources = [...new Set([...(Array.isArray(details.sources) ? details.sources : []), details.owner_reviewed_source].filter(safeSource))];
  return <>
    <dl>{fields.map(([label,value]) => <div key={label}><dt>{label}</dt><dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{display(value)}</dd></div>)}</dl>
    <p>Information from public sources; ownership and business credentials require separate review.</p>
    {!!sources.length && <ul>{sources.map((source) => <li key={source}><a href={source} target="_blank" rel="noopener noreferrer">Official source: {new URL(source).hostname}</a></li>)}</ul>}
  </>;
}
