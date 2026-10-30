import {readFileSync} from 'node:fs';
import {beforeEach, describe, expect, it, vi} from 'vitest';
const db=vi.hoisted(()=>({from:vi.fn(),select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>db}));
import {renderProfileHtml} from '@/lib/agencies/profile-html';
import {GET} from '@/app/agencies/[slug]/route';
const template=readFileSync('public/agency-profile.html','utf8');
const agency={name:'Profile $& </script><script>alert(1)</script>',slug:'fixture',about:'Company overview & services',city:'Manila',country:'Philippines',demo_profile:false};
beforeEach(()=>{db.from.mockReturnValue(db);db.select.mockReturnValue(db);db.eq.mockReturnValue(db);db.maybeSingle.mockResolvedValue({data:agency,error:null});});
describe('server profile route',()=>{
 it('serves escaped content, metadata and full original interactions before JS',()=>{const html=renderProfileHtml(template,agency);expect(html).toContain('id="profilePublished">');expect(html).toContain('id="agencyDescription">Company overview &amp; services</p>');expect(html).toContain('id="agencyName">Profile $&amp; &lt;/script&gt;');expect(html).not.toContain('<script>alert(1)</script>');expect(html).toContain('href="/css/agency-profile.css"');expect(html).toContain('src="/js/agency-profile.js"');expect(html).toContain('id="agencyContactForm"');expect(html).toContain('/agencies/fixture');const schema=html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];expect(JSON.parse(schema!).name).toBe(agency.name);});
 it('loads only the public view and excludes demo content',async()=>{const r=await GET(new Request('http://localhost'),{params:Promise.resolve({slug:'fixture'})});expect(r.status).toBe(200);expect(db.from).toHaveBeenCalledWith('ap_public_agencies');expect(db.eq).toHaveBeenCalledWith('demo_profile',false);expect(await r.text()).toContain('Company overview');});
 it('returns noindex 404 for missing or invalid profiles',async()=>{db.maybeSingle.mockResolvedValue({data:null,error:null});for(const slug of ['missing','invalid/slash']){const r=await GET(new Request('http://localhost'),{params:Promise.resolve({slug})});expect(r.status).toBe(404);expect(await r.text()).toContain('noindex');}});
 it('returns generic uncached 503 for database failures',async()=>{db.maybeSingle.mockResolvedValue({data:null,error:{message:'secret'}});const r=await GET(new Request('http://localhost'),{params:Promise.resolve({slug:'fixture'})});expect(r.status).toBe(503);expect(r.headers.get('cache-control')).toBe('no-store');expect(await r.text()).not.toContain('secret');});
});
