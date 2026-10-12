import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ local: {} as Record<string, unknown>, calls: [] as Array<{ name: string; input: Record<string, unknown> }> }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: () => { const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: mocks.local, error: null }) }; return chain; },
  rpc: async (name: string, input: Record<string, unknown>) => { mocks.calls.push({ name, input }); return { error: null, data: "test_completed" }; },
}) }));
import { reconcilePayPalOrder } from "../lib/billing/paypal/service";
import { verifyPayPalWebhook } from "../lib/billing/paypal/client";
import { paypalConfig } from "../lib/billing/paypal/config";
function order(status = "COMPLETED", captureStatus = "COMPLETED", overrides: Record<string, unknown> = {}) {
  return { id: "REMOTE123", status, purchase_units: [{ reference_id: "local", custom_id: "local", invoice_id: "local", payee: { merchant_id: "MERCHANT" }, amount: { currency_code: "USD", value: "49.00" }, payments: status === "COMPLETED" ? { captures: [{ id: "CAPTURE123", status: captureStatus }] } : undefined, ...overrides }] };
}
function apiResponses(remote = order(), captureStatus = "COMPLETED", signature = "SUCCESS") {
  const fn = vi.fn(async (url: string) => {
    let data: unknown;
    if (url.endsWith("/v1/oauth2/token")) data = { access_token: "PRIVATE-TOKEN" };
    else if (url.endsWith("/verify-webhook-signature")) data = { verification_status: signature };
    else if (url.includes("/v2/payments/captures/")) data = { id: "CAPTURE123", status: captureStatus, final_capture: true, amount: { currency_code: "USD", value: "49.00" }, supplementary_data: { related_ids: { order_id: "REMOTE123" } } };
    else data = remote;
    return { ok: true, status: 200, json: async () => data };
  });
  vi.stubGlobal("fetch", fn); return fn;
}
beforeEach(() => {
  mocks.calls = []; mocks.local = { id: "local", agency_id: "agency", provider: "paypal", status: "pending", provider_reference: "REMOTE123", paypal_merchant_id: "MERCHANT", paypal_environment: "sandbox", currency: "USD", total_amount: 49, paypal_state: "created" };
  vi.stubEnv("PAYPAL_ENV", "sandbox"); vi.stubEnv("PAYPAL_CLIENT_ID", "CLIENT"); vi.stubEnv("PAYPAL_CLIENT_SECRET", "PRIVATE-SECRET"); vi.stubEnv("PAYPAL_MERCHANT_ID", ""); vi.stubEnv("PAYPAL_WEBHOOK_ID", "WEBHOOK");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("PayPal API verification and recovery", () => {
  it("independently reads the capture before recording payment", async () => {
    const fetch = apiResponses(); expect(await reconcilePayPalOrder("local")).toBe("test_completed");
    expect(fetch.mock.calls.some(([url]) => url.includes("/v2/payments/captures/CAPTURE123"))).toBe(true);
    expect(mocks.calls[0].name).toBe("ap_record_paypal_capture");
  });
  it("does not activate an approved order or capture it during read-only verification", async () => {
    const fetch = apiResponses(order("APPROVED")); expect(await reconcilePayPalOrder("local")).toBe("approved");
    expect(mocks.calls).toHaveLength(0); expect(fetch.mock.calls.some(([url]) => url.endsWith("/capture"))).toBe(false);
  });
  it("recovers a lost capture response with a stable idempotency key", async () => {
    let reads = 0;
    const fetch = vi.fn(async (url: string, options: { headers?: Record<string, string> } = {}) => {
      if (url.endsWith("/capture")) {
        expect(options.headers?.["PayPal-Request-Id"]).toBe("plocal");
        throw new Error("Response lost after capture");
      }
      const data = url.endsWith("/v1/oauth2/token") ? { access_token: "TOKEN" } :
        url.includes("/v2/payments/captures/") ? { id: "CAPTURE123", status: "COMPLETED", final_capture: true, amount: { currency_code: "USD", value: "49.00" }, supplementary_data: { related_ids: { order_id: "REMOTE123" } } } :
        ++reads === 1 ? order("APPROVED") : order();
      return { ok: true, status: 200, json: async () => data };
    });
    vi.stubGlobal("fetch", fetch);
    expect(await reconcilePayPalOrder("local", true)).toBe("test_completed");
    expect(mocks.calls).toHaveLength(1);
  });
  it("records pending without activation", async () => {
    apiResponses(order("COMPLETED", "PENDING"), "PENDING"); expect(await reconcilePayPalOrder("local")).toBe("pending");
    expect(mocks.calls[0]).toMatchObject({ name: "ap_paypal_exception", input: { new_state: "pending" } });
  });
  it("keeps a transport failure unpaid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Network timeout"); }));
    await expect(reconcilePayPalOrder("local", true)).rejects.toThrow(); expect(mocks.calls).toHaveLength(0);
  });
  it("rejects another merchant before recording a capture", async () => {
    apiResponses(order("COMPLETED", "COMPLETED", { payee: { merchant_id: "OTHER" } }));
    await expect(reconcilePayPalOrder("local")).rejects.toThrow(); expect(mocks.calls).toHaveLength(0);
  });
  it("never activates while a signed refund event is ahead of the capture read", async () => {
    apiResponses(); await expect(reconcilePayPalOrder("local", false, true)).rejects.toThrow("Refund status"); expect(mocks.calls).toHaveLength(0);
  });
  it("fails closed when the environment does not match", async () => {
    mocks.local.paypal_environment = "live"; const fetch = apiResponses(); await expect(reconcilePayPalOrder("local")).rejects.toThrow("environment"); expect(fetch).not.toHaveBeenCalled();
  });
  it("requires explicit live setup", () => {
    vi.stubEnv("PAYPAL_ENV", "live"); vi.stubEnv("PAYPAL_LIVE_ENABLED", "false"); expect(() => paypalConfig()).toThrow("not enabled");
  });
  it("does not trust webhook JSON without all signature headers", async () => {
    const fetch = apiResponses(); expect(await verifyPayPalWebhook(new Headers(), { id: "event" })).toBe(false); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a PayPal signature verification failure", async () => {
    apiResponses(order(), "COMPLETED", "FAILURE");
    const headers = new Headers(Object.fromEntries(["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"].map(name => [name, "test"])));
    expect(await verifyPayPalWebhook(headers, { id: "event" })).toBe(false); expect(mocks.calls).toHaveLength(0);
  });
});
