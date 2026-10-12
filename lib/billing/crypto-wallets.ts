import "server-only";

export type CryptoAsset = "USDT" | "USDC" | "BTC";

export type CryptoNetwork =
  | "BEP20"
  | "TRC20"
  | "ERC20"
  | "SOL";

export type CryptoWallet = {
  asset: CryptoAsset;
  network: CryptoNetwork;
  paymentLabel: string;
  networkLabel: string;
  address: string;
  requiredConfirmations: number;
};

type CryptoWalletDefinition = Omit<CryptoWallet, "address"> & {
  environmentVariable: string;
};

const cryptoWalletDefinitions: CryptoWalletDefinition[] = [
  {
    asset: "USDT",
    network: "BEP20",
    paymentLabel: "USDT",
    networkLabel: "BEP20 — BNB Smart Chain",
    environmentVariable: "USDT_BEP20",
    requiredConfirmations: 12,
  },
  {
    asset: "USDT",
    network: "TRC20",
    paymentLabel: "USDT",
    networkLabel: "TRC20 — TRON",
    environmentVariable: "USDT_TRC20",
    requiredConfirmations: 20,
  },
  {
    asset: "USDT",
    network: "ERC20",
    paymentLabel: "USDT",
    networkLabel: "ERC20 — Ethereum",
    environmentVariable: "USDT_ERC20",
    requiredConfirmations: 12,
  },
  {
    asset: "USDT",
    network: "SOL",
    paymentLabel: "USDT",
    networkLabel: "SOL — Solana",
    environmentVariable: "USDT_SOL",
    requiredConfirmations: 32,
  },
  {
    asset: "USDC",
    network: "BEP20",
    paymentLabel: "USDC",
    networkLabel: "BEP20 — BNB Smart Chain",
    environmentVariable: "USDC_BEP20",
    requiredConfirmations: 12,
  },
  {
    asset: "USDC",
    network: "ERC20",
    paymentLabel: "USDC",
    networkLabel: "ERC20 — Ethereum",
    environmentVariable: "USDC_ERC20",
    requiredConfirmations: 12,
  },
  {
    asset: "USDC",
    network: "SOL",
    paymentLabel: "USDC",
    networkLabel: "SOL — Solana",
    environmentVariable: "USDC_SOL",
    requiredConfirmations: 32,
  },
  {
  asset: "BTC",
  network: "BEP20",
  paymentLabel: "BTC",
  networkLabel: "BEP20 — BNB Smart Chain",
  environmentVariable: "BTC_BEP20",
  requiredConfirmations: 12,
},
{
  asset: "BTC",
  network: "ERC20",
  paymentLabel: "BTC",
  networkLabel: "ERC20 — Ethereum",
  environmentVariable: "BTC_ERC20",
  requiredConfirmations: 12,
},
];

export function getAvailableCryptoWallets(): CryptoWallet[] {
  return cryptoWalletDefinitions.flatMap((definition) => {
    const address =
      process.env[definition.environmentVariable]?.trim();

    if (!address) {
      return [];
    }

    return [
      {
        asset: definition.asset,
        network: definition.network,
        paymentLabel: definition.paymentLabel,
        networkLabel: definition.networkLabel,
        address,
        requiredConfirmations:
          definition.requiredConfirmations,
      },
    ];
  });
}

export function getCryptoWallet(
  asset: string,
  network: string,
): CryptoWallet | null {
  const normalizedAsset = asset.trim().toUpperCase();
  const normalizedNetwork = network.trim().toUpperCase();

  return (
    getAvailableCryptoWallets().find(
      (wallet) =>
        wallet.asset === normalizedAsset &&
        wallet.network === normalizedNetwork,
    ) ?? null
  );
}