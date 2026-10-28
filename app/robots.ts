import type {MetadataRoute} from 'next';
import {privateCrawlPaths,previewDeployment,siteOrigin} from '@/lib/seo/settings';
export default function robots():MetadataRoute.Robots {
  if(previewDeployment()) return {rules:{userAgent:'*',disallow:'/'}};
  return {rules:{userAgent:'*',allow:'/',disallow:privateCrawlPaths()},sitemap:`${siteOrigin()}/sitemap.xml`};
}
