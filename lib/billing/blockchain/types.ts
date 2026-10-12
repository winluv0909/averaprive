/**
 * Avera Privé
 * Shared blockchain-payment types
 *
 * These types are server-side contracts for the secured payment monitor.
 * Customer-submitted TXIDs are matching hints only and never constitute
 * proof of payment.
 */

export const cryptoAssets = [
  "usdt",
  "usdc",
  "bitcoin",
] as const;

export type CryptoAsset =
  (typeof cryptoAssets)[number];

export const blockchainNetworks = [
  "bep20",
  "erc20",
  "trc20",
  "solana",
  "btc",
] as const;

export type BlockchainNetwork =
  (typeof blockchainNetworks)[number];

export const blockchainTransactionStatuses = [
  "pending",
  "confirmed",
  "success",
  "failed",
  "reverted",
  "dropped",
] as const;

export type BlockchainTransactionStatus =
  (typeof blockchainTransactionStatuses)[number];

export const cryptoPaymentStatuses = [
  "awaiting_payment",
  "submitted",
  "detected",
  "confirming",
  "confirmed",
  "underpaid",
  "overpaid",
  "wrong_network",
  "wrong_token",
  "wrong_destination",
  "duplicate_txid",
  "expired",
  "late_payment",
  "failed_on_chain",
  "failed",
  "manual_review",
] as const;

export type CryptoPaymentStatus =
  (typeof cryptoPaymentStatuses)[number];

export const paymentExceptionCodes = [
  "underpaid",
  "overpaid",
  "wrong_network",
  "wrong_token",
  "wrong_destination",
  "duplicate_txid",
  "expired",
  "late_payment",
  "failed_on_chain",
] as const;

export type PaymentExceptionCode =
  (typeof paymentExceptionCodes)[number];

export type BlockchainFinalityStatus =
  | "unconfirmed"
  | "confirming"
  | "finalized"
  | "failed"
  | "exception";

export type BlockchainMatchStatus =
  | "pending"
  | "matched"
  | "underpaid"
  | "overpaid"
  | "wrong_network"
  | "wrong_token"
  | "wrong_destination"
  | "duplicate_txid"
  | "late_payment"
  | "failed_on_chain";

export interface CryptoMonitoringOrder {
  orderId: string;
  agencyId: string;

  asset: CryptoAsset;
  network: BlockchainNetwork;

  receivingAddress: string;
  expectedAmount: string;
  paymentExpiresAt: string;

  submittedTransactionHash: string | null;
  verifiedTransactionHash: string | null;

  paymentStatus: CryptoPaymentStatus;
  currentConfirmations: number;
  requiredConfirmations: number;

  workerId: string;
}

export interface CryptoMonitoringDatabaseRow {
  order_id: string;
  agency_id: string;

  crypto_asset: string;
  crypto_network: string;

  receiving_address: string;
  expected_crypto_amount:
    | string
    | number;

  payment_expires_at: string;

  submitted_transaction_hash:
    | string
    | null;

  verified_transaction_hash:
    | string
    | null;

  current_crypto_status: string;

  current_confirmations:
    | string
    | number
    | null;

  required_confirmations:
    | string
    | number
    | null;

  worker_id: string;
}

export interface BlockchainTransfer {
  transactionHash: string;
  transferIndex: number;

  asset: CryptoAsset;
  network: BlockchainNetwork;

  amount: string;

  senderAddress: string | null;
  destinationAddress: string;

  tokenSymbol: string | null;
  tokenContract: string | null;

  blockNumber: string | null;
  transactionAt: string | null;

  confirmations: number;
  requiredConfirmations: number;

  blockchainStatus:
    BlockchainTransactionStatus;

  rawPayload: Record<string, unknown>;
}

export interface BlockchainTransactionLookup {
  transactionHash: string;
  network: BlockchainNetwork;

  found: boolean;

  blockchainStatus:
    BlockchainTransactionStatus;

  confirmations: number;
  blockNumber: string | null;
  transactionAt: string | null;

  transfers: BlockchainTransfer[];

  rawPayload: Record<string, unknown>;
}

export interface BlockchainObservationInput {
  orderId: string;

  transactionHash: string;
  transferIndex: number;

  asset: CryptoAsset;
  network: BlockchainNetwork;

  amount: string;
  destinationAddress: string;

  confirmations: number;

  blockchainStatus:
    BlockchainTransactionStatus;

  blockNumber: string | null;
  transactionAt: string | null;

  senderAddress: string | null;
  tokenContract: string | null;
  tokenSymbol: string | null;

  rawPayload: Record<string, unknown>;
}

export interface BlockchainObservationResult {
  success: boolean;
  orderId: string;
  observationId: string | null;

  paymentStatus: CryptoPaymentStatus;

  exceptionCode:
    | PaymentExceptionCode
    | null;

  transactionHash: string;

  confirmations: number;
  requiredConfirmations: number;

  readyToConfirm: boolean;

  nextAction:
    | "call_ap_confirm_crypto_payment"
    | "continue_monitoring"
    | "manual_review";
}

export interface BlockchainConfirmationInput {
  orderId: string;
  transactionHash: string;

  asset: CryptoAsset;
  network: BlockchainNetwork;

  destinationAddress: string;
  amount: string;

  confirmations: number;
  requiredConfirmations: number;

  blockchainStatus:
    BlockchainTransactionStatus;

  blockNumber: string | null;
  transactionAt: string | null;

  rawPayload: Record<string, unknown>;
}

export interface BlockchainConfirmationResult {
  success: boolean;
  idempotent?: boolean;

  orderId: string;
  agencyId?: string;

  paymentStatus: string;
  subscriptionId?: string | null;

  message?: string;
}

export interface BlockchainAdapter {
  readonly network: BlockchainNetwork;

  findTransfersToAddress(
    address: string,
    options?: {
      transactionHash?: string | null;
      fromDate?: string | null;
      limit?: number;
    },
  ): Promise<BlockchainTransfer[]>;

  getTransaction(
    transactionHash: string,
  ): Promise<BlockchainTransactionLookup>;
}

export interface CryptoMonitorOrderResult {
  orderId: string;

  success: boolean;

  transactionFound: boolean;
  transactionHash: string | null;

  paymentStatus:
    | CryptoPaymentStatus
    | null;

  exceptionCode:
    | PaymentExceptionCode
    | null;

  confirmations: number;
  requiredConfirmations: number;

  subscriptionActivated: boolean;

  message: string;
}

export interface CryptoMonitorBatchResult {
  workerId: string;

  startedAt: string;
  completedAt: string;

  claimedOrders: number;
  processedOrders: number;

  confirmedPayments: number;
  activatedSubscriptions: number;

  pendingPayments: number;
  exceptionPayments: number;
  failedChecks: number;

  orders: CryptoMonitorOrderResult[];
}

export class BlockchainMonitoringError
  extends Error {
  readonly network:
    | BlockchainNetwork
    | null;

  readonly retryable: boolean;
  readonly details:
    Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      network?:
        | BlockchainNetwork
        | null;
      retryable?: boolean;
      details?:
        Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name =
      "BlockchainMonitoringError";

    this.network =
      options?.network ?? null;

    this.retryable =
      options?.retryable ?? true;

    this.details =
      options?.details ?? {};
  }
}