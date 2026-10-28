/** Canonical origin for generated discovery files. Never publish localhost URLs. */
export function siteOrigin(value = process.env.NEXT_PUBLIC_SITE_URL): string {
  try {
    const url = new URL(value || 'https://averaprive.vercel.app');
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid canonical origin');
    return url.origin;
  } catch { return 'https://averaprive.vercel.app'; }
}
export const accountPrefixes = ['/agency','/owners','/dashboard','/admin','/login','/register','/owner','/forbidden','/auth','/api','/forgot-password','/reset-password'];
// Use path boundaries so /agency does not block public /agency-profile.html.
export function privateCrawlPaths() {
  return accountPrefixes.flatMap(path => [path + '$', path + '/']);
}
export function previewDeployment() { return process.env.VERCEL_ENV === 'preview'; }
export function privateIndexHeaders() {
  return accountPrefixes.map(path => ({source:`${path}/:path*`,headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}));
}
