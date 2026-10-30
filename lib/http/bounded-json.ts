/** Enforce actual streamed bytes, including requests without Content-Length. */
export class RequestBodyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function boundedJson(request: Request, limit: number): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) {
    throw new RequestBodyError(413, "Request is too large.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400, "Invalid request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestBodyError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes)); }
  catch { throw new RequestBodyError(400, "Invalid JSON request."); }
}

/** Match the browser origin to the incoming Host, without trusting forwarded-host headers. */
export function requestHasSameOrigin(request: Request): boolean {
  try {
    const expected = new URL(request.url);
    const host = request.headers.get("host");
    if (host) expected.host = host;
    return request.headers.get("origin") === expected.origin;
  } catch { return false; }
}
