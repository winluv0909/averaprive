# Avera Privé — Step 02: directory filters

This update builds directory filter choices from the approved, published agency records returned by the existing public API. It fixes size/service/niche mismatches without rewriting stored agency information. New signup values and custom services appear automatically when those agencies are published and the directory reloads.

## What changed

- Agency size choices reflect the sizes actually recorded. Older ranges such as 2–10 remain separate from newer ranges such as 1–5; the website does not guess a headcount.
- Service, niche, country/region and category options come from the visible agency records, rather than an incomplete fixed list.
- Matching tolerates case, whitespace and common dash variants. Historical “Adult creators” matches “Adult.” Distinct service descriptions are kept separate.
- “Recently approved” is replaced by “Recently published,” using the existing publication timestamp. Records without a usable date sort afterward, with agency name resolving ties.
- Search links select their filters after the API choices load. Clear returns to All sizes and the other unfiltered choices.
- Demo profiles are excluded from this directory in addition to the API's exclusion.

Only values with published records are offered. If no published agency has size information, the size area shows All sizes. Missing information is not invented.

## Install — one step at a time

1. Download and extract Avera-Prive-Step-02.zip.
2. Copy the extracted contents into your existing Avera Privé project root, merging the supplied folders and replacing matching files. The root is the folder containing package.json and app. This is a five-file update, not a full project.

| File | Where it belongs |
|---|---|
| public/agencies.html | Replace the existing file under public/ |
| public/js/agencies.js | Replace the existing file under public/js/ |
| public/js/directory-filters.js | New file under public/js/; required by the updated page |
| tests/directory-filters.test.ts | New file under tests/ |
| STEP-02-READ-ME.md | Project root |

3. Open the VS Code terminal in the project root and run:

```bash
npm run verify
```

No npm install is needed: this update adds no dependencies. No SQL, migration, environment change or Supabase dashboard action is needed.

Prepared against the supplied project plus Step 01: 262 tests across 27 files passed, typecheck passed, lint had zero errors and the same four pre-existing warnings, and the production build passed. The new filter suite contains 14 tests. Browser appearance and live record behavior still need the checks below.

## Check the page

Run `npm run dev` and open http://localhost:3000/agencies.html. Keep your existing environment configuration.

1. Confirm agencies load and the filter menus populate.
2. Select an agency size and check the displayed cards show that exact recorded range.
3. Select a service, then a niche. Only agencies matching both should remain.
4. Click Clear and confirm the full directory returns.
5. Select Recently published and inspect the ordering. Agencies published at the same time use name order.
6. Try the mobile filter panel, Clear and pagination.

Published counts should be compared with the existing live directory at the same point in time. This update does not add, remove or publish database records. It does not change signup forms or payment behavior.

## Commit and deploy after verification

Stage only these files:

```bash
git add public/agencies.html public/js/agencies.js public/js/directory-filters.js tests/directory-filters.test.ts STEP-02-READ-ME.md
git diff --cached --stat
```

Review the five-file list, then:

```bash
git commit -m "Fix directory filters and publication date sorting"
git push
```

Wait for the matching Vercel deployment to show Ready, then repeat the page checks on the live website. Refresh once with Ctrl+Shift+R if the old page remains cached. The updated helper and directory scripts include a version query in the page.
