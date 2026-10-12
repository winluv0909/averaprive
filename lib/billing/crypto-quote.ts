import "server-only";

export type SupportedCryptoAsset = "usdt" | "usdc" | "bitcoin";

export type CryptoQuote = {
  asset: SupportedCryptoAsset;
  displaySymbol: "USDT" | "USDC" | "BTC";
  usdAmount: number;
  cryptoAmount: string;
  usdRate: string;
  quotedAt: string;
  expiresAt: string;
  rateSource: string;
};

type TatumRateResponse = {
  value?: string;
  basePair?: string;
  timestamp?: number;
  source?: string;
  symbol?: string;
};

const QUOTE_EXPIRY_MINUTES = 30;
const TATUM_RATE_URL =
  "https://api.tatum.io/v4/data/rate/symbol";

function requireTatumApiKey(): string {
  const apiKey = process.env.TATUM_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "TATUM_API_KEY is missing from the server environment.",
    );
  }

  return apiKey;
}

function validateUsdAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("The payment amount must be greater than zero.");
  }

  if (amount > 1_000_000) {
    throw new Error("The payment amount exceeds the supported limit.");
  }

  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function formatStablecoinAmount(amount: number): string {
  return amount.toFixed(2);
}

function formatBitcoinAmount(amount: number): string {
  /*
   * Round upward to eight decimal places.
   * This prevents a converted BTC amount from becoming slightly
   * lower than the required USD order total because of rounding.
   */
  const roundedUp = Math.ceil(amount * 100_000_000) / 100_000_000;

  return roundedUp.toFixed(8);
}

async function getBitcoinUsdRate(): Promise<{
  rate: number;
  timestamp: number;
  source: string;
}> {
  const apiKey = requireTatumApiKey();

  const url = new URL(TATUM_RATE_URL);
  url.searchParams.set("symbol", "BTC");
  url.searchParams.set("basePair", "USD");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-key": apiKey,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as
      | TatumRateResponse
      | null;

    if (!response.ok) {
      throw new Error(
        `Tatum BTC quote failed with status ${response.status}.`,
      );
    }

    const rate = Number(payload?.value);
    const timestamp = Number(payload?.timestamp);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Tatum returned an invalid BTC/USD rate.");
    }

    if (
      payload?.basePair &&
      payload.basePair.toUpperCase() !== "USD"
    ) {
      throw new Error("Tatum returned an unexpected base currency.");
    }

    if (
      payload?.symbol &&
      payload.symbol.toUpperCase() !== "BTC"
    ) {
      throw new Error("Tatum returned an unexpected asset symbol.");
    }

    /*
     * Do not create a new payment quote from excessively stale
     * pricing information.
     */
    const maximumRateAge = 10 * 60 * 1000;

    if (!Number.isFinite(timestamp) || Date.now() - timestamp > maximumRateAge || timestamp > Date.now() + 60000) {
      throw new Error(
        "The BTC/USD rate is too old. Please try checkout again.",
      );
    }

    return {
      rate,
      timestamp,
      source: payload?.source?.trim() || "Tatum",
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "The BTC pricing service timed out. Please try again.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createCryptoQuote(
  asset: SupportedCryptoAsset,
  totalUsd: number,
): Promise<CryptoQuote> {
  const usdAmount = validateUsdAmount(totalUsd);
  const quotedAt = new Date();
  const expiresAt = new Date(
    quotedAt.getTime() + QUOTE_EXPIRY_MINUTES * 60 * 1000,
  );

  if (asset === "usdt" || asset === "usdc") {
    return {
      asset,
      displaySymbol: asset === "usdt" ? "USDT" : "USDC",
      usdAmount,
      cryptoAmount: formatStablecoinAmount(usdAmount),
      usdRate: "1.00000000",
      quotedAt: quotedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      rateSource: "USD stablecoin reference",
    };
  }

  if (asset === "bitcoin") {
    const bitcoinRate = await getBitcoinUsdRate();
    const bitcoinAmount = usdAmount / bitcoinRate.rate;

    return {
      asset: "bitcoin",
      displaySymbol: "BTC",
      usdAmount,
      cryptoAmount: formatBitcoinAmount(bitcoinAmount),
      usdRate: bitcoinRate.rate.toFixed(8),
      quotedAt: new Date(bitcoinRate.timestamp).toISOString(),
      expiresAt: expiresAt.toISOString(),
      rateSource: bitcoinRate.source,
    };
  }

  throw new Error("The selected cryptocurrency is unsupported.");
}