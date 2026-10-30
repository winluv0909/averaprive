import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPublicProfile } from "@/lib/agencies/public-profile";
import { renderProfileHtml } from "@/lib/agencies/profile-html";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, {params}: {params:Promise<{slug:string}>}) {
  const {slug} = await params;
  try {
    const agency = await getPublicProfile(slug);
    if (!agency) return new Response('<!doctype html><html lang="en"><meta name="robots" content="noindex"><title>Profile not found | Avera Privé</title><body style="background:#f8f6f0;color:#243222;font-family:Georgia;padding:10vw"><p>Avera Privé</p><h1>This profile is not available.</h1><a href="/agencies.html">Browse agencies</a></body></html>', {status:404,headers:{"Content-Type":"text/html; charset=utf-8"}});
    const template = await readFile(path.join(process.cwd(), "public/agency-profile.html"), "utf8");
    return new Response(renderProfileHtml(template, agency), {headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, s-maxage=60, stale-while-revalidate=300"}});
  } catch {
    return new Response('<!doctype html><html lang="en"><meta name="robots" content="noindex"><title>Temporarily unavailable | Avera Privé</title><body style="background:#f8f6f0;color:#243222;font-family:Georgia;padding:10vw"><p>Avera Privé</p><h1>We couldn’t load this profile.</h1><p>Please try again shortly.</p><a href="/agencies.html">Return to the directory</a></body></html>', {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
  }
}
