# Avera Privé SEO architecture

## Honest scope

This foundation makes clean public routes possible on Vercel and generates a sitemap from approved public records. It does not make a single client-rendered HTML template equivalent to a crawlable dynamic website. Unique agency and article pages must be rendered as HTML at build time or on the server before the production SEO implementation is complete.

No one can guarantee search rankings or indexing. “Complete” here means every approved public page has a crawlable response, unique metadata, one self-referencing canonical, correct structured data, internal links and sitemap inclusion. Empty, private, pending, rejected, suspended and unpublished records stay out of the sitemap.

## Canonical route model

| Public route | Source and rendering rule | Canonical/indexing rule |
|---|---|---|
| `/agencies` | Approved public agency directory | Self-canonical; index |
| `/agencies/[agency-slug]` | One approved, published agency | Unique server/build HTML; self-canonical; `ProfilePage` plus `Organization` |
| `/agencies/country/[country]` | Approved agencies for one normalized country slug | Render only with useful unique copy and at least one approved result; otherwise `noindex` or 404 |
| `/agencies/service/[service]` | Approved agencies offering one normalized service | Same quality gate as country |
| `/agencies/category/[category]` | Approved agencies in one normalized category | Same quality gate as country |
| `/compare/...` | User-selected comparison | Canonical to `/compare`; selection URLs should generally be `noindex,follow` to avoid combinations creating duplicates |
| `/rankings/...` | Published ranking/methodology pages | Index only when content is substantive; paid placements excluded from objective ranking schema |
| `/reviews/...` | Review and trust methodology; later agency review summaries | Index moderated public content only; never expose evidence or reviewer identity without consent |
| `/insights/...` | The Privé Edit category and article pages | Articles require unique HTML, author, dates, headline, visible body and `Article`/`BlogPosting` JSON-LD |

## Metadata rules

Every indexable page needs a unique `<title>`, meta description, absolute canonical URL, Open Graph title/description/url/type/image, and Twitter card fields. One page has one canonical. Canonicals must use the final HTTPS production domain, lowercase normalized slugs, and no tracking query parameters.

Do not generate metadata from unreviewed text. Keep titles concise and descriptions factual. Pagination, filters and sort query parameters canonicalize to the appropriate collection unless they represent a deliberately curated landing page.

## Structured data rules

- Homepage: `Organization` and `WebSite` using the real public logo and contact details only.
- Directory and curated facet pages: `CollectionPage`, `BreadcrumbList`, and an `ItemList` containing only agencies visibly present on the page.
- Agency page: `ProfilePage` whose `mainEntity` is an `Organization` or appropriate subtype. Add address, area served, services, social links and aggregate ratings only when those exact facts are visible and approved. Never mark Featured/Sponsored as a rating or verification.
- Rankings: `CollectionPage`/`ItemList`; list positions must match the visible objective order. Do not include paid placements inside the ranked `ItemList`.
- Reviews: use review markup only for moderated reviews shown on the page and eligible under search engine policies. Do not add star markup to Avera Privé itself from reviews of listed agencies.
- The Privé Edit: `Article` or `BlogPosting`, `Person`/`Organization` author, `datePublished`, `dateModified`, image and breadcrumbs. Sponsored work must remain visibly disclosed.

Structured data must describe visible page content. It is not a substitute for rendering the content itself.

## Files in this package

- `vercel.json`: clean URL behavior, route rewrites and `noindex` headers for private/authentication pages.
- `robots.txt`: crawler access and sitemap location. Change the domain when a custom domain launches.
- `seo.config.json`: one canonical origin. Change it once, then regenerate.
- `scripts/generate-sitemap.mjs`: creates `sitemap.xml` from public approved agencies and published articles.
- `data/published-articles.json`: intentionally empty source until real articles are published.
- `sitemap.xml`: current zero-agency, zero-article sitemap.

The generator expects `data/approved-agencies.json`. An agency is added only when `status` is `approved`, `published` is `true`, and its slug is valid. Country, category and service sitemap routes require normalized objects such as `{ "name": "United States", "slug": "united-states" }`. This is stricter than the current temporary string fields and should be adopted in the final public API.

## Required production build

Before calling the SEO implementation complete, migrate public pages to a framework or generator that renders unique HTML for every approved agency, facet and article. Next.js on Vercel is a suitable path for the intended scale. Use route segments matching this document, fetch approved public records on the server, return a real 404 for unknown/unpublished slugs, generate metadata and JSON-LD on the server, and regenerate/revalidate pages after moderation decisions.

After deployment, verify representative URLs with `curl`, Google Rich Results Test and Search Console URL Inspection. Confirm that page source—not only the browser DOM—contains the unique title, canonical, visible content and JSON-LD. Submit the sitemap only after the production domain is final.
