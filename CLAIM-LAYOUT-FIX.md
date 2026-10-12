# Shared agency claim layout fix

Applies to every /agency/claim/[slug] page. The claim layout now loads its own scoped stylesheet instead of the split-screen login stylesheet.

To apply this update, copy these two files from the extracted ZIP into the same paths in your existing project:
- app/agency/claim/layout.tsx
- app/agency/claim/claim.css

Keep all other project files and your .env.local. No SQL migration, agency reimport or npm install is needed for this styling fix.
Stop the development server with Ctrl+C, run npm run dev again, then refresh the claim page with Ctrl+Shift+R.

Changes: readable headings; centered content with normal page scrolling; two-column information list on desktop and one column on mobile; full-width, resizable textareas; normal-size checkboxes aligned with their labels; consistent input and button spacing. Every existing field and claim action is preserved.

Validation: TypeScript, changed-file ESLint and production build passed. Browser visual verification was unavailable because the Chromium download failed in this environment. After applying, check both signed-out authentication and signed-in claim forms on desktop and mobile, including a long agency name and the submit button at the bottom.
