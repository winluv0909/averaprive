import {
  blockchainNetworks,
  BlockchainMonitoringError,
  cryptoAssets,
  cryptoPaymentStatuses,
  type BlockchainNetwork,
  type CryptoAsset,
  type CryptoMonitoringDatabaseRow,
  type CryptoMonitoringOrder,
  type CryptoPaymentStatus,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DECIMAL_PATTERN =
  /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const EVM_TRANSACTION_HASH_PATTERN =
  /^0x[0-9a-f]{64}$/i;

const HEX_TRANSACTION_HASH_PATTERN =
  /^[0-9a-f]{64}$/i;

const SOLANA_SIGNATURE_PATTERN =
  /^[1-9A-HJ-NP-Za-km-z]{80,100}$/;

export function isCryptoAsset(
  value: unknown,
): value is CryptoAsset {
  return (
    typeof value === "string" &&
    cryptoAssets.includes(
      value as CryptoAsset,
    )
  );
}

export function isBlockchainNetwork(
  value: unknown,
): value is BlockchainNetwork {
  return (
    typeof value === "string" &&
    blockchainNetworks.includes(
      value as BlockchainNetwork,
    )
  );
}

export function isCryptoPaymentStatus(
  value: unknown,
): value is CryptoPaymentStatus {
  return (
    typeof value === "string" &&
    cryptoPaymentStatuses.includes(
      value as CryptoPaymentStatus,
    )
  );
}

export function normalizeCryptoAsset(
  value: unknown,
): CryptoAsset {
  const normalizedValue =
    String(value ?? "")
      .trim()
      .toLowerCase();

  const alias =
    normalizedValue === "btc"
      ? "bitcoin"
      : normalizedValue;

  if (!isCryptoAsset(alias)) {
    throw new BlockchainMonitoringError(
      `Unsupported cryptocurrency asset: ${normalizedValue || "empty"}.`,
      {
        retryable: false,
        details: {
          suppliedAsset: value,
        },
      },
    );
  }

  return alias;
}

export function normalizeBlockchainNetwork(
  value: unknown,
): BlockchainNetwork {
  const normalizedValue =
    String(value ?? "")
      .trim()
      .toLowerCase();

  const alias =
    normalizedValue === "sol"
      ? "solana"
      : normalizedValue;

  if (!isBlockchainNetwork(alias)) {
    throw new BlockchainMonitoringError(
      `Unsupported blockchain network: ${normalizedValue || "empty"}.`,
      {
        retryable: false,
        details: {
          suppliedNetwork: value,
        },
      },
    );
  }

  return alias;
}

export function normalizeTransactionHash(
  value: unknown,
  network: BlockchainNetwork,
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalizedValue =
    String(value).trim();

  if (!normalizedValue) {
    return null;
  }

  const isValid =
    network === "bep20" ||
    network === "erc20"
      ? EVM_TRANSACTION_HASH_PATTERN.test(
          normalizedValue,
        )
      : network === "trc20" ||
          network === "btc"
        ? HEX_TRANSACTION_HASH_PATTERN.test(
            normalizedValue,
          )
        : SOLANA_SIGNATURE_PATTERN.test(
            normalizedValue,
          );

  if (!isValid) {
    throw new BlockchainMonitoringError(
      `Invalid ${network.toUpperCase()} transaction hash format.`,
      {
        network,
        retryable: false,
        details: {
          transactionHash:
            normalizedValue,
        },
      },
    );
  }

  /*
   * Solana signatures are case-sensitive.
   * Hexadecimal transaction hashes are normalized to lowercase.
   */
  return network === "solana"
    ? normalizedValue
    : normalizedValue.toLowerCase();
}

export function normalizePositiveDecimal(
  value: unknown,
  fieldName: string,
): string {
  const normalizedValue =
    String(value ?? "").trim();

  if (
    !DECIMAL_PATTERN.test(
      normalizedValue,
    )
  ) {
    throw new BlockchainMonitoringError(
      `${fieldName} must be a valid positive decimal amount.`,
      {
        retryable: false,
        details: {
          fieldName,
          suppliedValue: value,
        },
      },
    );
  }

  if (Number(normalizedValue) <= 0) {
    throw new BlockchainMonitoringError(
      `${fieldName} must be greater than zero.`,
      {
        retryable: false,
        details: {
          fieldName,
          suppliedValue: value,
        },
      },
    );
  }

  return normalizedValue;
}

export function normalizeNonNegativeInteger(
  value: unknown,
  fieldName: string,
): number {
  const numericValue =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isSafeInteger(numericValue) ||
    numericValue < 0
  ) {
    throw new BlockchainMonitoringError(
      `${fieldName} must be a non-negative integer.`,
      {
        retryable: false,
        details: {
          fieldName,
          suppliedValue: value,
        },
      },
    );
  }

  return numericValue;
}

export function normalizePositiveInteger(
  value: unknown,
  fieldName: string,
): number {
  const numericValue =
    normalizeNonNegativeInteger(
      value,
      fieldName,
    );

  if (numericValue < 1) {
    throw new BlockchainMonitoringError(
      `${fieldName} must be at least 1.`,
      {
        retryable: false,
        details: {
          fieldName,
          suppliedValue: value,
        },
      },
    );
  }

  return numericValue;
}

export function normalizeRequiredText(
  value: unknown,
  fieldName: string,
): string {
  const normalizedValue =
    String(value ?? "").trim();

  if (!normalizedValue) {
    throw new BlockchainMonitoringError(
      `${fieldName} is required.`,
      {
        retryable: false,
        details: {
          fieldName,
        },
      },
    );
  }

  return normalizedValue;
}

export function normalizeUuid(
  value: unknown,
  fieldName: string,
): string {
  const normalizedValue =
    normalizeRequiredText(
      value,
      fieldName,
    );

  if (
    !UUID_PATTERN.test(normalizedValue)
  ) {
    throw new BlockchainMonitoringError(
      `${fieldName} must be a valid UUID.`,
      {
        retryable: false,
        details: {
          fieldName,
          suppliedValue: value,
        },
      },
    );
  }

  return normalizedValue.toLowerCase();
}

export function normalizeIsoDate(
  value: unknown,
  fieldName: string,
): string {
  const normalizedValue =
    normalizeRequiredText(
      value,
      fieldName,
    );

  const date = new Date(normalizedValue);

  if (
    Number.isNaN(date.getTime())
  ) {
    throw new BlockchainMonitoringError(
      `${fieldName} must be a valid date.`,
      {
        retryable: false,
        details: {
          fieldName,
          suppliedValue: value,
        },
      },
    );
  }

  return date.toISOString();
}

export function normalizeCryptoPaymentStatus(
  value: unknown,
): CryptoPaymentStatus {
  const normalizedValue =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    !isCryptoPaymentStatus(
      normalizedValue,
    )
  ) {
    throw new BlockchainMonitoringError(
      `Unsupported crypto payment status: ${normalizedValue || "empty"}.`,
      {
        retryable: false,
        details: {
          suppliedStatus: value,
        },
      },
    );
  }

  return normalizedValue;
}

export function normalizeWalletAddress(
  value: unknown,
  network: BlockchainNetwork,
): string {
  const normalizedValue =
    normalizeRequiredText(
      value,
      "Receiving address",
    );

  /*
   * These are conservative syntax checks only.
   * Actual ownership and transaction destination are independently
   * checked against the blockchain response.
   */
  if (
    network === "bep20" ||
    network === "erc20"
  ) {
    if (
      !/^0x[0-9a-fA-F]{40}$/.test(
        normalizedValue,
      )
    ) {
      throw new BlockchainMonitoringError(
        `Invalid ${network.toUpperCase()} receiving address.`,
        {
          network,
          retryable: false,
          details: {
            receivingAddress:
              normalizedValue,
          },
        },
      );
    }

    return normalizedValue.toLowerCase();
  }

  if (network === "trc20") {
    if (
      !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(
        normalizedValue,
      )
    ) {
      throw new BlockchainMonitoringError(
        "Invalid TRC20 receiving address.",
        {
          network,
          retryable: false,
          details: {
            receivingAddress:
              normalizedValue,
          },
        },
      );
    }

    return normalizedValue;
  }

  if (network === "solana") {
    if (
      !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
        normalizedValue,
      )
    ) {
      throw new BlockchainMonitoringError(
        "Invalid Solana receiving address.",
        {
          network,
          retryable: false,
          details: {
            receivingAddress:
              normalizedValue,
          },
        },
      );
    }

    return normalizedValue;
  }

  /*
   * Native Bitcoin is currently supported by the type system,
   * but your supplied wallet list does not yet include a native
   * BTC address. This validation will be used only after one is
   * configured.
   */
  if (
    !/^(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/.test(
      normalizedValue,
    )
  ) {
    throw new BlockchainMonitoringError(
      "Invalid native Bitcoin receiving address.",
      {
        network,
        retryable: false,
        details: {
          receivingAddress:
            normalizedValue,
        },
      },
    );
  }

  return normalizedValue;
}

export function normalizeCryptoMonitoringOrder(
  row: CryptoMonitoringDatabaseRow,
): CryptoMonitoringOrder {
  const network =
    normalizeBlockchainNetwork(
      row.crypto_network,
    );

  const asset =
    normalizeCryptoAsset(
      row.crypto_asset,
    );

  const paymentStatus =
    normalizeCryptoPaymentStatus(
      row.current_crypto_status,
    );

  const currentConfirmations =
    normalizeNonNegativeInteger(
      row.current_confirmations ?? 0,
      "Current confirmations",
    );

  const requiredConfirmations =
    normalizePositiveInteger(
      row.required_confirmations ?? 1,
      "Required confirmations",
    );

  return {
    orderId: normalizeUuid(
      row.order_id,
      "Order ID",
    ),

    agencyId: normalizeUuid(
      row.agency_id,
      "Agency ID",
    ),

    asset,
    network,

    receivingAddress:
      normalizeWalletAddress(
        row.receiving_address,
        network,
      ),

    expectedAmount:
      normalizePositiveDecimal(
        row.expected_crypto_amount,
        "Expected cryptocurrency amount",
      ),

    paymentExpiresAt:
      normalizeIsoDate(
        row.payment_expires_at,
        "Payment expiry",
      ),

    submittedTransactionHash:
      normalizeTransactionHash(
        row.submitted_transaction_hash,
        network,
      ),

    verifiedTransactionHash:
      normalizeTransactionHash(
        row.verified_transaction_hash,
        network,
      ),

    paymentStatus,

    currentConfirmations,
    requiredConfirmations,

    workerId: normalizeRequiredText(
      row.worker_id,
      "Monitoring worker ID",
    ),
  };
}

export function normalizeCryptoMonitoringRows(
  rows: CryptoMonitoringDatabaseRow[],
): CryptoMonitoringOrder[] {
  return rows.map(
    normalizeCryptoMonitoringOrder,
  );
}