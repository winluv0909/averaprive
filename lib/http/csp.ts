/** Observation only. Review collected directives before introducing enforcement. */
export const reportOnlyCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.sandbox.paypal.com https://www.paypalobjects.com https://cdnjs.cloudflare.com https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.paypal.com https://www.sandbox.paypal.com https://www.paypalobjects.com",
  "frame-src https://www.paypal.com https://www.sandbox.paypal.com https://vercel.live",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  "report-uri /api/csp-report", "report-to csp"
].join("; ");
