import "server-only";
// Public Binance deposit addresses supplied by the account owner.
// Shared checkout reuses these addresses; invoice matching is enforced independently.
const evm="0x6f485b8ea54a631a6c64bc59874e8d97d09fc617";
const sol="3MukfZCXgwcDQtmNNeUdpkUnywfdBcEuiL6Xp4jwxc4d";
export const suppliedBinanceReceivers:Record<string,string[]>={
  USDT_BEP20:[evm],USDT_TRC20:["TVC37hU5M9SoQ4EuJheTDoVvWYb1wNSBsz"],USDT_ERC20:[evm],USDT_SOL:[sol],
  USDC_BEP20:[evm],USDC_ERC20:[evm],USDC_SOL:[sol],BTC_BEP20:[evm],BTC_ERC20:[evm],
};
