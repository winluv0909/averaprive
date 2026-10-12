# Reviewed research pack
1. Read source-audit.md. All 50 are candidates; no business has been independently certified. TOAgency is held; import includes 49.
2. Back up the database and apply project migrations 018 (if not already applied) and 019.
3. Review each official source, then optionally run add-50-agencies.sql to add the 49 unclaimed candidates. This explicitly publishes listings; review before running.
4. Run enrich-researched-profiles.sql for researched metadata. It only fills empty metadata on exact slug/website matches with no active owner. It does not overwrite owner-reviewed information. Re-running is safe.
5. Use the owner directory to correct or complete details with sources before accepting claims.

No live database changes were made. Contact email publication does not prove reachability. Social links, fees, minimum requirements and niches are not filled from guesses. Missing details require direct confirmation.
