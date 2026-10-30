import { boundedJson, RequestBodyError } from "@/lib/http/bounded-json";
export const runtime = "nodejs";
// Best-effort process-local log cap; the platform's request controls remain necessary.
let windowStart = 0;
let reports = 0;
export async function POST(request: Request) {
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!["application/csp-report", "application/reports+json", "application/json"].includes(type || "")) return new Response(null, {status:415});
  const now = Date.now();
  if (now - windowStart >= 60_000) { windowStart = now; reports = 0; }
  if (++reports > 20) return new Response(null, {status:429});
  try {
    const parsed = await boundedJson(request, 16_384);
    const entries = Array.isArray(parsed) ? parsed.slice(0, 10) : [parsed];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const body = entry["csp-report"] || entry.body;
      if (!body || typeof body !== "object") continue;
      const directive = body["effective-directive"] || body.effectiveDirective;
      if (typeof directive !== "string" || !/^[a-z-]{1,80}$/.test(directive)) continue;
      // Never log document URLs, query strings, script samples, cookies or raw payloads.
      console.info("csp_report", {directive, disposition:"report"});
    }
    return new Response(null, {status:204, headers:{"Cache-Control":"no-store"}});
  } catch (error) { return new Response(null, {status:error instanceof RequestBodyError ? error.status : 400}); }
}
