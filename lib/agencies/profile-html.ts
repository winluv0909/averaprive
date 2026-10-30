import { escapeHtml, profileDescription } from "./public-profile";
import { siteOrigin } from "@/lib/seo/settings";
type Agency = {name:string; slug:string; about?:string|null; tagline?:string|null; positioning_statement?:string|null; city?:string|null; country?:string|null};
/** Trusted local template; every database value is escaped before HTML insertion. */
export function renderProfileHtml(template: string, agency: Agency) {
  const canonical = `${siteOrigin()}/agencies/${encodeURIComponent(agency.slug)}`;
  let html = template.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(agency.name)} | Avera Privé</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*>/, () => `<meta name="description" content="${escapeHtml(profileDescription(agency))}">`)
    .replace(/(href|src)="(?![a-z]+:|\/|#)([^"]+)"/gi, '$1="/$2"')
    .replace('id="profileUnavailable"', 'id="profileUnavailable" hidden')
    .replace('id="profilePublished" hidden', 'id="profilePublished"');
  const text: Record<string,string> = {
    agencyName: agency.name, breadcrumbAgencyName: agency.name,
    agencyTagline: agency.positioning_statement || agency.tagline || "",
    agencyDescription: agency.about || agency.positioning_statement || "Agency information has not been provided.",
    agencyLocation: [agency.city, agency.country].filter(Boolean).join(", "),
  };
  for (const [id,value] of Object.entries(text)) {
    html = html.replace(new RegExp(`(<[^>]+id="${id}"[^>]*>)[^<]*(</[^>]+>)`), (_match, open: string, close: string) => open + escapeHtml(value) + close);
  }
  const schema = JSON.stringify({"@context":"https://schema.org","@type":"Organization", name:agency.name, description:profileDescription(agency),url:canonical}).replaceAll("<","\\u003c");
  return html.replace("</head>", () => `<link rel="canonical" href="${canonical}"><meta property="og:title" content="${escapeHtml(agency.name)} | Avera Privé"><meta property="og:description" content="${escapeHtml(profileDescription(agency))}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><script type="application/ld+json">${schema}</script></head>`);
}
