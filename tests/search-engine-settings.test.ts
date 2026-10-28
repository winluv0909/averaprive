import {afterEach,expect,it,vi} from 'vitest';
import robots from '@/app/robots';
import {accountPrefixes,privateCrawlPaths,siteOrigin,privateIndexHeaders} from '@/lib/seo/settings';
afterEach(()=>vi.unstubAllEnvs());
it('normalizes a configured HTTPS domain to its origin',()=>{expect(siteOrigin('https://example.com/subpath/')).toBe('https://example.com');});
it.each(['http://localhost:3000','invalid','https://user:password@example.com'])('never emits an unsafe canonical origin: %s',value=>{expect(siteOrigin(value)).toBe('https://averaprive.vercel.app');});
it('allows public pages and advertises the generated sitemap',()=>{vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://averaprive.vercel.app/');expect(robots()).toEqual({rules:{userAgent:'*',allow:'/',disallow:privateCrawlPaths()},sitemap:'https://averaprive.vercel.app/sitemap.xml'});});
it('includes both recovery routes in crawl guidance and noindex headers',()=>{for(const route of ['/forgot-password','/reset-password','/owners','/agency']){expect(accountPrefixes).toContain(route);expect(privateIndexHeaders()).toContainEqual({source:`${route}/:path*`,headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]});}});
it('blocks preview crawling',()=>{vi.stubEnv('VERCEL_ENV','preview');expect(robots()).toEqual({rules:{userAgent:'*',disallow:'/'}});});

it("uses crawl boundaries that preserve public agency profile pages",()=>{expect(privateCrawlPaths()).toContain("/agency/");expect(privateCrawlPaths()).toContain("/agency$");expect(privateCrawlPaths()).not.toContain("/agency");});
