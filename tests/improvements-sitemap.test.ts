import {expect,it,vi} from 'vitest';
const db=vi.hoisted(()=>({from:vi.fn(),select:vi.fn(),eq:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>db}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:()=>({select:()=>({eq:async()=>({data:[]})})})})}));
import sitemap from '@/app/sitemap';
it('includes published public-view profiles and skips invalid slugs',async()=>{
 db.from.mockReturnValue(db);db.select.mockReturnValue(db);db.eq.mockResolvedValue({data:[{slug:'published-agency',published_at:'2026-10-01T00:00:00Z'},{slug:'bad/path'}],error:null});
 const items=await sitemap();expect(items.map(x=>x.url)).toContain('https://averaprive.vercel.app/agencies/published-agency');expect(items.some(x=>x.url.includes('bad/path'))).toBe(false);expect(db.eq).toHaveBeenCalledWith('demo_profile',false);
});
it('does not silently publish an incomplete sitemap on database error',async()=>{
 db.eq.mockResolvedValue({data:null,error:{message:'unavailable'}});await expect(sitemap()).rejects.toThrow('complete agency sitemap');
});
