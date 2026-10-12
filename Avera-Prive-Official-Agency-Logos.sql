-- Logo assets researched on 2026-10-10. Run only after installing the image files.
-- Only empty logos on matching, unclaimed agency records are filled.
-- Existing agency logos, ownership, reviews and verification are preserved.
BEGIN;
WITH researched(slug, website_host, logo_url) AS (
VALUES
  ('creators-inc', 'creatorsinc.com', '/assets/images/agencies/creators-inc.svg'),
  ('fanshub', 'usefanshub.com', '/assets/images/agencies/fanshub.png'),
  ('sakura-management', 'sakura.agency', '/assets/images/agencies/sakura-management.png'),
  ('teasy-agency', 'teasyagency.com', '/assets/images/agencies/teasy-agency.png'),
  ('bunny-agency', 'bunny-agency.com', '/assets/images/agencies/bunny-agency.png'),
  ('louna-s-models', 'lounasmodels.com', '/assets/images/agencies/louna-s-models.png'),
  ('mango', 'mangova.agency', '/assets/images/agencies/mango.png'),
  ('fantasyrise', 'fantasyrise.com', '/assets/images/agencies/fantasyrise.svg'),
  ('onmodelstudios', 'onmodelstudios.com', '/assets/images/agencies/onmodelstudios.png'),
  ('perlage-studios', 'perlagestudios.com', '/assets/images/agencies/perlage-studios.png'),
  ('lumina-connect', 'lumina-connect.com', '/assets/images/agencies/lumina-connect.png'),
  ('foxy-studios', 'foxy-studios.com', '/assets/images/agencies/foxy-studios.png'),
  ('aruna-talent', 'arunatalent.com', '/assets/images/agencies/aruna-talent.png'),
  ('hush-talent-inc', 'hushtalentinc.com', '/assets/images/agencies/hush-talent-inc.svg'),
  ('sirency', 'sirency.com', '/assets/images/agencies/sirency.svg'),
  ('topstar-mgmt', 'topstarmgmt.com', '/assets/images/agencies/topstar-mgmt.png'),
  ('aroa-agency', 'aroaagency.com', '/assets/images/agencies/aroa-agency.png'),
  ('at-agency', 'at-agency.co', '/assets/images/agencies/at-agency.png'),
  ('xcreatormgmt', 'xcreatormgmt.com', '/assets/images/agencies/xcreatormgmt.svg'),
  ('vanguard-star-management', 'vsmagency.com', '/assets/images/agencies/vanguard-star-management.svg'),
  ('model-starz', 'modelstarzmgmt.com', '/assets/images/agencies/model-starz.png'),
  ('vantage-agency', 'thevantage.agency', '/assets/images/agencies/vantage-agency.svg'),
  ('lush-management', 'lushmgt.com', '/assets/images/agencies/lush-management.png'),
  ('hussar-ofm', 'hussarofm.com', '/assets/images/agencies/hussar-ofm.png'),
  ('lookstars-agency', 'lookstarsagency.com', '/assets/images/agencies/lookstars-agency.svg'),
  ('eros-agency', 'agency-eros.com', '/assets/images/agencies/eros-agency.png'),
  ('fem-management', 'fem-management.com', '/assets/images/agencies/fem-management.svg'),
  ('aura-management', 'auramgmt.com.au', '/assets/images/agencies/aura-management.png'),
  ('nest-talent', 'nesttalent.com', '/assets/images/agencies/nest-talent.png'),
  ('blue-rose-talent', 'bluerosetalent.com', '/assets/images/agencies/blue-rose-talent.svg'),
  ('the-scandilo-agency', 'scandiloagency.com', '/assets/images/agencies/the-scandilo-agency.png'),
  ('allure', 'allureagencyparis.com', '/assets/images/agencies/allure.png'),
  ('unfiltered-management', 'unfiltered-management.com', '/assets/images/agencies/unfiltered-management.png'),
  ('xentra-group', 'xentragroup.co.uk', '/assets/images/agencies/xentra-group.png'),
  ('elvision-studios', 'elvision-studios.com', '/assets/images/agencies/elvision-studios.png'),
  ('shevo-studio', 'shevostudio.com', '/assets/images/agencies/shevo-studio.png'),
  ('norvo-management', 'norvomanagement.com', '/assets/images/agencies/norvo-management.png'),
  ('20mg', '20mg.co', '/assets/images/agencies/20mg.png'),
  ('lambert-agency', 'agencylambert.com', '/assets/images/agencies/lambert-agency.png'),
  ('empire-of-agency', 'empireofagency.com', '/assets/images/agencies/empire-of-agency.png'),
  ('elev-agency', 'elev.agency', '/assets/images/agencies/elev-agency.png'),
  ('ofagency-co', 'ofagency.co', '/assets/images/agencies/ofagency-co.png'),
  ('tdm-business', 'tdmbusiness.com', '/assets/images/agencies/tdm-business.png'),
  ('ofm-models-agency', 'onlyfansmanagement.info', '/assets/images/agencies/ofm-models-agency.svg'),
  ('beaconofm', 'beaconofm.com', '/assets/images/agencies/beaconofm.png')
), changed AS (
  UPDATE public.ap_agencies a
  SET logo_url = r.logo_url, updated_at = now()
  FROM researched r
  WHERE a.slug = r.slug
    AND lower(split_part(regexp_replace(a.website_url, '^https?://(www\.)?', '', 'i'), '/', 1)) = r.website_host
    AND nullif(trim(a.logo_url), '') IS NULL
    AND a.demo_profile = false
    AND NOT EXISTS (
      SELECT 1 FROM public.ap_agency_memberships m
      WHERE m.agency_id = a.id AND m.status = 'active'
    )
  RETURNING a.name, a.slug, a.logo_url
)
SELECT * FROM changed ORDER BY name;
COMMIT;
