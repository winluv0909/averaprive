import "server-only";
import {createHmac} from "node:crypto";
import type {PairConfig} from "./config";
import {canonical,decimalUnits,type Observation,type PaymentOrder} from "./domain";
export const binanceNetworks: Record<string,string>={BEP20:"BSC",ERC20:"ETH",TRC20:"TRX",SOL:"SOL"} as const;
interface CoinNetwork {network:string;depositEnable:boolean;contractAddress?:string;depositDust?:string;minConfirm?:number;unLockConfirm?:number;resetAddressStatus?:boolean;denomination?:number;}
interface CoinInfo {coin:string;networkList:CoinNetwork[];}
interface DepositAddress {coin:string;address:string;tag?:string;}
export interface BinanceDeposit {id:string;coin:string;network:string;address:string;addressTag?:string;txId:string;amount:string;status:number;transferType:number;confirmTimes?:string;completeTime?:number;travelRuleStatus?:number;}
const allowed=new Set(["/sapi/v1/capital/config/getall","/sapi/v1/capital/deposit/address/list","/sapi/v1/capital/deposit/hisrec"]);
export async function binanceRead<T>(path:string,fields:Record<string,string>={}):Promise<T> {
  if(!allowed.has(path)) throw new Error("Only read-only deposit endpoints are supported");
  const key=process.env.BINANCE_READ_API_KEY,secret=process.env.BINANCE_READ_API_SECRET;
  if(!key || !secret) throw new Error("Configure the server-side Binance read-only API credentials");
  const params=new URLSearchParams({...fields,recvWindow:"5000",timestamp:String(Date.now())});
  params.set("signature",createHmac("sha256",secret).update(params.toString()).digest("hex"));
  const response=await fetch(`https://api.binance.com${path}?${params}`,{method:"GET",headers:{"X-MBX-APIKEY":key},cache:"no-store",signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error("Binance deposit verification unavailable; check credentials, account access and regional availability");
  const data=await response.json();
  if(data && typeof data==="object" && "code" in data && Number(data.code)<0) throw new Error("Binance refused the read-only deposit request");
  return data as T;
}
export async function validateBinanceCheckout(config:PairConfig,amount:string):Promise<PairConfig> {
  const network=binanceNetworks[config.network];
  const coins=await binanceRead<CoinInfo[]>("/sapi/v1/capital/config/getall");
  const details=coins.find(c=>c.coin===config.asset)?.networkList.find(n=>n.network===network);
  if(!details?.depositEnable || details.resetAddressStatus) throw new Error("Binance deposits are unavailable for this token/network");
  if(!details.contractAddress || canonical(details.contractAddress,config.network)!==canonical(config.token,config.network)) throw new Error("Token contract does not match Binance's supported deposit token");
  if(details.denomination && details.denomination!==1) throw new Error("Scaled Binance token denominations need manual review");
  if(details.depositDust && decimalUnits(amount,config.decimals)<decimalUnits(details.depositDust,config.decimals)) throw new Error("Invoice amount is below Binance's minimum deposit");
  const addresses=await binanceRead<DepositAddress[]>("/sapi/v1/capital/deposit/address/list",{coin:config.asset,network});
  const verified=config.addresses.filter(address=>addresses.some(d=>d.coin===config.asset && !d.tag && canonical(d.address,config.network)===canonical(address,config.network)));
  if(!verified.length) throw new Error("Configured receiving addresses were not verified in this Binance account");
  const confirmations=config.network==="SOL"?32:Math.max(config.confirmations,Number(details.minConfirm||0),Number(details.unLockConfirm||0));
  if(!Number.isSafeInteger(confirmations)) throw new Error("Invalid Binance confirmation requirement");
  return {...config,addresses:verified,confirmations};
}
function sameTx(a:string,b:string,network:PaymentOrder["crypto_network"]) {
  return network==="SOL"?a===b:a.replace(/^0x/i,"").toLowerCase()===b.replace(/^0x/i,"").toLowerCase();
}
export function matchesBinanceCredit(order:PaymentOrder,observation:Observation,deposit:BinanceDeposit):boolean {
  const [confirmed,required]=(deposit.confirmTimes||"").split("/").map(Number);
  return Boolean(deposit.id) && deposit.coin===order.crypto_asset && deposit.network===binanceNetworks[order.crypto_network]
    && canonical(deposit.address,order.crypto_network)===canonical(order.receiving_address,order.crypto_network)
    && !deposit.addressTag && sameTx(deposit.txId,observation.txid,order.crypto_network)
    && deposit.status===1 && deposit.transferType===0 && Boolean(deposit.completeTime)
    && (deposit.travelRuleStatus===undefined || deposit.travelRuleStatus===0)
    && Number.isFinite(confirmed) && Number.isFinite(required) && confirmed>=required && required>=0
    && decimalUnits(deposit.amount,order.token_decimals)===decimalUnits(observation.amount,order.token_decimals);
}
export async function verifyBinanceCredit(order:PaymentOrder,observation:Observation) {
  const deposits=await binanceRead<BinanceDeposit[]>("/sapi/v1/capital/deposit/hisrec",{coin:order.crypto_asset,txId:observation.txid,limit:"1000"});
  if(!Array.isArray(deposits) || deposits.length===1000) throw new Error("Binance deposit history is incomplete");
  const match=deposits.find(d=>matchesBinanceCredit(order,observation,d));
  return {custodian_credit:Boolean(match),custodian_deposit_id:match?.id||null};
}
