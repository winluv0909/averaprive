import "server-only";

import {
  BlockchainMonitoringError,
  type BlockchainNetwork,
} from "./types";

const TATUM_API_BASE_URL =
  "https://api.tatum.io";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_ERROR_BODY_LENGTH = 1_000;

type TatumHttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";

interface TatumRequestOptions {
  method?: TatumHttpMethod;

  network?:
    | BlockchainNetwork
    | null;

  query?: Record<
    string,
    string | number | boolean | null | undefined
  >;

  body?: unknown;

  headers?: Record<string, string>;

  timeoutMs?: number;
  maxAttempts?: number;
}

interface TatumErrorPayload {
  errorCode?: string;
  message?: string;
  statusCode?: number;
  data?: unknown;
}

function requireTatumApiKey(): string {
  const apiKey =
    process.env.TATUM_API_KEY?.trim();

  if (!apiKey) {
    throw new BlockchainMonitoringError(
      "TATUM_API_KEY is missing from the server environment.",
      {
        retryable: false,
      },
    );
  }

  return apiKey;
}

function buildTatumUrl(
  path: string,
  query?: TatumRequestOptions["query"],
): URL {
  const normalizedPath =
    path.startsWith("/")
      ? path
      : `/${path}`;

  const url = new URL(
    normalizedPath,
    TATUM_API_BASE_URL,
  );

  if (!query) {
    return url;
  }

  for (
    const [key, value]
    of Object.entries(query)
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }

    url.searchParams.set(
      key,
      String(value),
    );
  }

  return url;
}

function getRetryDelay(
  attempt: number,
  response?: Response,
): number {
  const retryAfter =
    response?.headers.get(
      "retry-after",
    );

  if (retryAfter) {
    const numericRetryAfter =
      Number(retryAfter);

    if (
      Number.isFinite(
        numericRetryAfter,
      ) &&
      numericRetryAfter >= 0
    ) {
      return Math.min(
        numericRetryAfter * 1_000,
        30_000,
      );
    }

    const retryDate =
      new Date(retryAfter);

    if (
      !Number.isNaN(
        retryDate.getTime(),
      )
    ) {
      return Math.min(
        Math.max(
          retryDate.getTime() -
            Date.now(),
          0,
        ),
        30_000,
      );
    }
  }

  /*
   * Exponential retry:
   * attempt 1 = 500 ms
   * attempt 2 = 1,000 ms
   * attempt 3 = 2,000 ms
   */
  return Math.min(
    500 * 2 ** (attempt - 1),
    5_000,
  );
}

function wait(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function shouldRetryStatus(
  status: number,
): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function isAbortError(
  error: unknown,
): boolean {
  return (
    error instanceof Error &&
    error.name === "AbortError"
  );
}

function safeErrorMessage(
  payload: unknown,
  fallback: string,
): string {
  if (
    payload &&
    typeof payload === "object"
  ) {
    const tatumError =
      payload as TatumErrorPayload;

    if (
      typeof tatumError.message ===
        "string" &&
      tatumError.message.trim()
    ) {
      return tatumError.message.trim();
    }

    if (
      typeof tatumError.errorCode ===
        "string" &&
      tatumError.errorCode.trim()
    ) {
      return tatumError.errorCode.trim();
    }
  }

  if (
    typeof payload === "string" &&
    payload.trim()
  ) {
    return payload
      .trim()
      .slice(
        0,
        MAX_ERROR_BODY_LENGTH,
      );
  }

  return fallback;
}

async function readResponseBody(
  response: Response,
): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "";

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return (
      await response.text()
    ).slice(
      0,
      MAX_ERROR_BODY_LENGTH,
    );
  } catch {
    return null;
  }
}

export async function tatumRequest<T>(
  path: string,
  options: TatumRequestOptions = {},
): Promise<T> {
  const apiKey =
    requireTatumApiKey();

  const method =
    options.method ?? "GET";

  const timeoutMs =
    Math.min(
      Math.max(
        options.timeoutMs ??
          DEFAULT_TIMEOUT_MS,
        1_000,
      ),
      60_000,
    );

  const maxAttempts =
    Math.min(
      Math.max(
        options.maxAttempts ??
          DEFAULT_MAX_ATTEMPTS,
        1,
      ),
      5,
    );

  const url =
    buildTatumUrl(
      path,
      options.query,
    );

  let finalError:
    | BlockchainMonitoringError
    | null = null;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {
    const abortController =
      new AbortController();

    const timeout = setTimeout(
      () => {
        abortController.abort();
      },
      timeoutMs,
    );

    try {
      const response = await fetch(
        url,
        {
          method,

          headers: {
            Accept:
              "application/json",

            "x-api-key":
              apiKey,

            ...(options.body !==
              undefined
              ? {
                  "Content-Type":
                    "application/json",
                }
              : {}),

            ...options.headers,
          },

          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(
                  options.body,
                ),

          signal:
            abortController.signal,

          cache: "no-store",
        },
      );

      const responseBody =
        await readResponseBody(
          response,
        );

      if (response.ok) {
        return responseBody as T;
      }

      const retryable =
        shouldRetryStatus(
          response.status,
        );

      finalError =
        new BlockchainMonitoringError(
          safeErrorMessage(
            responseBody,
            `Tatum request failed with HTTP ${response.status}.`,
          ),
          {
            network:
              options.network ??
              null,

            retryable,

            details: {
              path:
                url.pathname,

              method,

              status:
                response.status,

              attempt,

              maxAttempts,

              /*
               * Never include the API key in errors.
               */
              response:
                responseBody,
            },
          },
        );

      if (
        !retryable ||
        attempt === maxAttempts
      ) {
        throw finalError;
      }

      await wait(
        getRetryDelay(
          attempt,
          response,
        ),
      );
    } catch (error) {
      if (
        error instanceof
        BlockchainMonitoringError
      ) {
        finalError = error;

        if (
          !error.retryable ||
          attempt === maxAttempts
        ) {
          throw error;
        }
      } else {
        const timedOut =
          isAbortError(error);

        finalError =
          new BlockchainMonitoringError(
            timedOut
              ? `Tatum request timed out after ${timeoutMs} milliseconds.`
              : "Tatum could not be reached.",
            {
              network:
                options.network ??
                null,

              retryable: true,

              details: {
                path:
                  url.pathname,

                method,

                attempt,

                maxAttempts,

                timedOut,
              },

              cause: error,
            },
          );

        if (
          attempt === maxAttempts
        ) {
          throw finalError;
        }
      }

      await wait(
        getRetryDelay(attempt),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw (
    finalError ??
    new BlockchainMonitoringError(
      "Tatum request failed without a response.",
      {
        network:
          options.network ??
          null,
      },
    )
  );
}

export async function tatumGet<T>(
  path: string,
  options: Omit<
    TatumRequestOptions,
    "method" | "body"
  > = {},
): Promise<T> {
  return tatumRequest<T>(
    path,
    {
      ...options,
      method: "GET",
    },
  );
}

export async function tatumPost<
  TResponse,
  TBody = unknown,
>(
  path: string,
  body: TBody,
  options: Omit<
    TatumRequestOptions,
    "method" | "body"
  > = {},
): Promise<TResponse> {
  return tatumRequest<TResponse>(
    path,
    {
      ...options,
      method: "POST",
      body,
    },
  );
}