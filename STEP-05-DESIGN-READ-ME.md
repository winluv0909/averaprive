# Password recovery — design revision

Copy this package's contents into your existing project root, merge folders and replace matching files. Keep this guide in the root. This is a design patch for Step 05, which must already be installed.

Updated files:
- app/forgot-password/RecoveryShell.tsx (new shared layout)
- app/forgot-password/page.tsx
- app/forgot-password/recovery.css
- app/reset-password/page.tsx

Run npm run verify, then npm run dev. Open http://localhost:3000/forgot-password. Check the desktop layout and narrow/mobile layout. Do not submit the recovery form until deployment and Supabase configuration are complete.

No SQL, environment-variable or dependency changes are required for this design patch. Recovery actions and callback are unchanged. Supabase redirect and email-template setup from STEP-05-READ-ME.md is still required after deployment.

TypeScript and targeted lint checks passed. Automated visual capture was unavailable because the browser executable is not installed in the verification environment; browser appearance needs checking locally.
