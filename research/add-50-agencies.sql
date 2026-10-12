-- 50 researched candidates; TOAgency withheld pending direct confirmation.
-- Reviewed import contains 49 candidates. Review source-audit.md before publishing.
-- Run in your Supabase SQL editor AFTER reviewing agency-list.md.
-- Requires your existing curated-directory migrations.
-- Adds public, unclaimed profiles. No memberships, verification badges, ratings or reviews.
-- Existing records are preserved. Countries omitted where not independently established.
BEGIN;
WITH researched(name,slug,website_url,country,about) AS (
 VALUES
  ('Creators Inc', 'creators-inc', 'https://www.creatorsinc.com/', NULL, 'Creators Inc describes its services as account management, content planning, fan relationships and creator brand development.'),
  ('FansHub', 'fanshub', 'https://www.usefanshub.com/', NULL, 'FansHub describes its services as account management, fan messaging, marketing, content strategy and content protection.'),
  ('Sakura Management', 'sakura-management', 'https://www.sakura.agency/', NULL, 'Sakura Management describes its services as creator account management, social media marketing, fan messaging and leak protection.'),
  ('TEASY Agency', 'teasy-agency', 'https://teasyagency.com/', NULL, 'TEASY Agency describes its services as onlyFans management and marketing services for creator accounts.'),
  ('Bunny Agency', 'bunny-agency', 'https://bunny-agency.com/', NULL, 'Bunny Agency describes its services as creator account management, fan communication and marketing across subscription platforms.'),
  ('Louna''s Models', 'louna-s-models', 'https://lounasmodels.com/', NULL, 'Louna''s Models describes its services as onlyFans management, social media traffic, content planning and subscriber retention.'),
  ('MANGO', 'mango', 'https://www.mangova.agency/', NULL, 'MANGO describes its services as onlyFans management focused on developing an existing creator account.'),
  ('FantasyRise', 'fantasyrise', 'https://fantasyrise.com/', NULL, 'FantasyRise describes its services as account management, fan messaging, pricing, content planning, marketing and reporting.'),
  ('OnModelStudios', 'onmodelstudios', 'https://onmodelstudios.com/', NULL, 'OnModelStudios describes its services as account management, fan messaging, creator marketing and performance reporting.'),
  ('Perlage Studios', 'perlage-studios', 'https://perlagestudios.com/', NULL, 'Perlage Studios describes its services as boutique OnlyFans management with content planning, messaging, marketing and reporting.'),
  ('Lumina Connect', 'lumina-connect', 'https://lumina-connect.com/', NULL, 'Lumina Connect describes its services as account management, fan messaging, content planning, marketing and leak removal.'),
  ('Foxy Studios', 'foxy-studios', 'https://foxy-studios.com/', NULL, 'Foxy Studios describes its services as creator management, social media strategy, content planning and fan engagement.'),
  ('Aruna Talent', 'aruna-talent', 'https://arunatalent.com/', NULL, 'Aruna Talent describes its services as creator management with fan messaging, marketing, content strategy and privacy support.'),
  ('Hush Talent Inc.', 'hush-talent-inc', 'https://hushtalentinc.com/', NULL, 'Hush Talent Inc. describes its services as creator management across OnlyFans and other subscription and social platforms.'),
  ('SirenCY', 'sirency', 'https://www.sirency.com/', NULL, 'SirenCY describes its services as content planning, fan messaging workflows, monetization strategy and account operations.'),
  ('TopStar MGMT', 'topstar-mgmt', 'https://www.topstarmgmt.com/', NULL, 'TopStar MGMT describes its services as account management, content strategy, fan messaging, brand development and social media.'),
  ('AROA Agency', 'aroa-agency', 'https://aroaagency.com/', NULL, 'AROA Agency describes its services as onlyFans management, fan messaging, content calendars, branding and audience growth.'),
  ('AT Agency', 'at-agency', 'https://at-agency.co/', NULL, 'AT Agency describes its services as creator account operations, content planning, fan engagement and audience development.'),
  ('XCreatorMgmt', 'xcreatormgmt', 'https://www.xcreatormgmt.com/', NULL, 'XCreatorMgmt describes its services as account management, social media marketing, content ideas and subscriber communication.'),
  ('Vanguard Star Management', 'vanguard-star-management', 'https://vsmagency.com/', NULL, 'Vanguard Star Management describes its services as onlyFans management, marketing, fan messaging, content strategy and brand protection.'),
  ('Model Starz', 'model-starz', 'https://www.modelstarzmgmt.com/', NULL, 'Model Starz describes its services as onlyFans and Fansly creator management, content strategy and audience promotion.'),
  ('Vantage Agency', 'vantage-agency', 'https://thevantage.agency/', NULL, 'Vantage Agency describes its services as creator brand management across subscription platforms, social media and fan communities.'),
  ('Lush Management', 'lush-management', 'https://www.lushmgt.com/', NULL, 'Lush Management describes its services as onlyFans account management, content posting, subscriber messaging and social media support.'),
  ('Rize Agency', 'rize-agency', 'https://rizeagency.co/', NULL, 'Rize Agency describes its services as creator growth management with social media promotion and subscriber conversion.'),
  ('Hussar OFM', 'hussar-ofm', 'https://www.hussarofm.com/', NULL, 'Hussar OFM describes its services as onlyFans account management, fan messaging, content planning, growth and administration.'),
  ('Lookstars Agency', 'lookstars-agency', 'https://www.lookstarsagency.com/en', NULL, 'Lookstars Agency describes its services as boutique OnlyFans management with fan engagement and social media marketing.'),
  ('EROS Agency', 'eros-agency', 'https://www.agency-eros.com/', NULL, 'EROS Agency describes its services as onlyFans account management, fan monetization, audience growth and creator brand strategy.'),
  ('SVJ Talent', 'svj-talent', 'https://svjtalent.com/', NULL, 'SVJ Talent describes its services as chatting-focused creator management with fan messaging and account communication support.'),
  ('OnlyFans Management (Australia)', 'onlyfans-management-australia', 'https://onlyfansmanagement.com.au/', NULL, 'OnlyFans Management (Australia) describes its services as creator management with account strategy, marketing and ongoing account support.'),
  ('FEM Management', 'fem-management', 'https://www.fem-management.com/', NULL, 'FEM Management describes its services as onlyFans management with fan messaging, content ideas, promotion and leak protection.'),
  ('Aura Management', 'aura-management', 'https://www.auramgmt.com.au/', NULL, 'Aura Management describes its services as australian creator talent management and OnlyFans account support.'),
  ('Nest Talent', 'nest-talent', 'https://www.nesttalent.com/', NULL, 'Nest Talent describes its services as creator account strategy, social media growth, audience engagement and operational support.'),
  ('Blue Rose Talent', 'blue-rose-talent', 'https://bluerosetalent.com/', NULL, 'Blue Rose Talent describes its services as creator career management and support for OnlyFans and other creator platforms.'),
  ('The Scandilo Agency', 'the-scandilo-agency', 'https://scandiloagency.com/', NULL, 'The Scandilo Agency describes its services as onlyFans management with promotion, fan messaging and a personal account manager.'),
  ('ALLURE', 'allure', 'https://www.allureagencyparis.com/en', NULL, 'ALLURE describes its services as creator management with account operations, social media traffic and growth strategy.'),
  ('Unfiltered Management', 'unfiltered-management', 'https://www.unfiltered-management.com/', NULL, 'Unfiltered Management describes its services as onlyFans creator management, account strategy and support for switching agency teams.'),
  ('Xentra Group', 'xentra-group', 'https://xentragroup.co.uk/onlyfans-agency-uk', NULL, 'Xentra Group describes its services as onlyFans creator management with fan messaging, account strategy and audience growth.'),
  ('Elvision Studios', 'elvision-studios', 'https://elvision-studios.com/en/europe/united-kingdom', NULL, 'Elvision Studios describes its services as remote OnlyFans management for creators, including support for UK-based accounts.'),
  ('Shevo Studio', 'shevo-studio', 'https://www.shevostudio.com/', NULL, 'Shevo Studio describes its services as onlyFans and Fansly account management with fan retention and social media marketing.'),
  ('Norvo Management', 'norvo-management', 'https://norvomanagement.com/', NULL, 'Norvo Management describes its services as onlyFans management with fan messaging, content strategy and creator growth planning.'),
  ('Creator House', 'creator-house', 'https://creatorhouse.agency/', NULL, 'Creator House describes its services as creator management with social media strategy, fan messaging and privacy support.'),
  ('20MG', '20mg', 'https://20mg.co/', NULL, '20MG describes its services as onlyFans creator management and growth services for international creator accounts.'),
  ('TOAgency', 'toagency', 'https://theonlyfans.agency/', NULL, 'TOAgency describes its services as creator account management with strategic content planning and ongoing fan engagement.'),
  ('Lambert Agency', 'lambert-agency', 'https://agencylambert.com/', NULL, 'Lambert Agency describes its services as onlyFans management with content planning, fan messaging and audience acquisition.'),
  ('Empire of Agency', 'empire-of-agency', 'https://www.empireofagency.com/', NULL, 'Empire of Agency describes its services as creator management covering strategy, distribution, fan operations and reporting.'),
  ('Elev Agency', 'elev-agency', 'https://elev.agency/', NULL, 'Elev Agency describes its services as creator management, social media planning and fan engagement services.'),
  ('OFAgency.co', 'ofagency-co', 'https://www.ofagency.co/', NULL, 'OFAgency.co describes its services as onlyFans account management, traffic acquisition, fan messaging and content strategy.'),
  ('TDM Business', 'tdm-business', 'https://tdmbusiness.com/', NULL, 'TDM Business describes its services as onlyFans management and support services for creators and agency businesses.'),
  ('OFM Models Agency', 'ofm-models-agency', 'https://www.onlyfansmanagement.info/', NULL, 'OFM Models Agency describes its services as OnlyFans account management, fan messaging, profile growth and mentoring.'),
  ('BeaconOFM', 'beaconofm', 'https://beaconofm.com/', NULL, 'BeaconOFM describes its services as creator management with fan messaging, traffic strategy and an AI content production offering.')
)
INSERT INTO public.ap_agencies
 (name,slug,website_url,country,about,status,published,publication_status,approved_at,published_at,demo_profile,accepting_inquiries)
SELECT r.name,r.slug,r.website_url,r.country,r.about,'approved',true,'published',now(),now(),false,false
FROM researched r
WHERE r.slug <> 'toagency' AND NOT EXISTS (
 SELECT 1 FROM public.ap_agencies a
 WHERE a.slug=r.slug OR lower(trim(a.name))=lower(trim(r.name))
 OR regexp_replace(lower(a.website_url),'^https?://(www[.])?|/+$','','g')
    =regexp_replace(lower(r.website_url),'^https?://(www[.])?|/+$','','g')
)
ON CONFLICT (slug) DO NOTHING;
COMMIT;

