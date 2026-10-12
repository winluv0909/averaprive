import "server-only";
import type { PairConfig } from "./config";
import { pairConfig, tronAddress } from "./config";
import { canonical, decimalUnits, transferTopic, unitsDecimal, type Observation, type PaymentOrder } from "./domain";
interface Log { address:string; topics:string[]; data:string; logIndex:string; transactionHash:string; blockNumber:string; removed?:boolean; }
interface EvmReceipt { status:string; blockHash:string; blockNumber:string; transactionHash:string; logs:Log[]; }
interface EvmBlock { hash:string; timestamp:string; number:string; }
interface SolBalance { accountIndex:number; mint:string; owner?:string; uiTokenAmount:{amount:string;decimals:number}; }
interface SolTransaction { slot:number; blockTime:number|null; meta:{err:unknown;preTokenBalances:SolBalance[];postTokenBalances:SolBalance[]}|null; }
interface SolAccount { pubkey:string; account:{data:{parsed:{info:{mint?:string;tokenAmount?:{decimals:number};decimals?:number}}}}; }
interface TronReceipt { id?:string;blockNumber?:number;blockTimeStamp?:number;result?:string;receipt?:{result?:string};log?:Array<{address:string;topics:string[];data:string}>; }
async function jsonRequest<T>(url:string, body?:unknown, extra?:Record<string,string>):Promise<T> {
  const response=await fetch(url,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...extra},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error(`Blockchain service returned ${response.status}; payment remains unconfirmed`);
  return response.json();
}
export async function rpc<T>(config:PairConfig,method:string,params:unknown[]):Promise<T> {
  const data=await jsonRequest<{result:T;error?:unknown}>(config.rpcUrl,{jsonrpc:"2.0",id:1,method,params});
  if(data.error || !("result" in data)) throw new Error("Blockchain RPC could not verify payment"); return data.result;
}
export async function tron<T>(config:PairConfig,path:string,body:unknown):Promise<T> {
  return jsonRequest<T>(`${config.rpcUrl.replace(/\/$/,"")}/${path}`,body,process.env.TRONGRID_API_KEY?{"TRON-PRO-API-KEY":process.env.TRONGRID_API_KEY}:undefined);
}
export async function snapshotChain(config:PairConfig):Promise<string> {
  if(config.network==="BEP20" || config.network==="ERC20") {
    const chain=Number(BigInt(await rpc<string>(config,"eth_chainId",[])));
    if(chain!==(config.network==="BEP20"?56:1)) throw new Error("RPC endpoint is connected to the wrong network");
    const decimals=Number(BigInt(await rpc<string>(config,"eth_call",[{to:config.token,data:"0x313ce567"},"latest"])));
    if(decimals!==config.decimals) throw new Error("Configured token decimals do not match its contract");
    const finalBlock=await rpc<EvmBlock|null>(config,"eth_getBlockByNumber",["finalized",false]);
    if(!finalBlock?.number) throw new Error("RPC must support finalized blocks");
    return BigInt(await rpc<string>(config,"eth_blockNumber",[])).toString();
  }
  if(config.network==="SOL") {
    const expected=process.env.CRYPTO_GENESIS_SOL;
    if(!expected || await rpc<string>(config,"getGenesisHash",[])!==expected) throw new Error("Verify the Solana RPC genesis configuration");
    const mint=await rpc<{value:{data:{parsed:{info:{decimals:number}}}}|null}>(config,"getAccountInfo",[config.token,{encoding:"jsonParsed",commitment:"finalized"}]);
    if(mint.value?.data?.parsed?.info?.decimals!==config.decimals) throw new Error("Configured mint decimals do not match");
    return String(await rpc<number>(config,"getSlot",[{commitment:"confirmed"}]));
  }
  const expected=process.env.CRYPTO_GENESIS_TRC20;
  const genesis=await tron<{blockID:string}>(config,"wallet/getblockbynum",{num:0});
  if(!expected || genesis.blockID!==expected) throw new Error("Verify the TRON RPC genesis configuration");
  const decimalResult=await tron<{constant_result?:string[];result?:{result:boolean}}>(config,"wallet/triggerconstantcontract",{owner_address:config.addresses[0],contract_address:config.token,function_selector:"decimals()",visible:true});
  if(!decimalResult.result?.result || Number(BigInt("0x"+(decimalResult.constant_result?.[0]||"")))!==config.decimals) throw new Error("Configured TRON token decimals do not match");
  const head=await tron<{block_header:{raw_data:{number:number}}}>(config,"wallet/getnowblock",{});
  return String(head.block_header.raw_data.number);
}
export async function verifyEvm(config:PairConfig,txid:string):Promise<Observation[]> {
  const receipt=await rpc<EvmReceipt|null>(config,"eth_getTransactionReceipt",[txid]); if(!receipt) return [];
  if(receipt.transactionHash.toLowerCase()!==txid.toLowerCase()) throw new Error("Mismatched RPC transaction receipt");
  const block=await rpc<EvmBlock|null>(config,"eth_getBlockByNumber",[receipt.blockNumber,false]);
  if(!block || block.hash.toLowerCase()!==receipt.blockHash.toLowerCase()) return []; // Reorg: no activation.
  const head=BigInt(await rpc<string>(config,"eth_blockNumber",[]));
  const confirmations=Number(head-BigInt(receipt.blockNumber)+BigInt(1));
  const finalBlock=await rpc<EvmBlock|null>(config,"eth_getBlockByNumber",["finalized",false]);
  const finalized=Boolean(finalBlock && BigInt(finalBlock.number)>=BigInt(receipt.blockNumber));
  const observedAt=new Date(Number(BigInt(block.timestamp))*1000).toISOString();
  return Promise.all(receipt.logs.filter(log=>!log.removed && log.topics.length===3 && log.topics[0].toLowerCase()===transferTopic).map(async log=>{
    const decimals=log.address.toLowerCase()===config.token.toLowerCase()?config.decimals:Number(BigInt(await rpc<string>(config,"eth_call",[{to:log.address,data:"0x313ce567"},receipt.blockNumber])));
    if(!Number.isInteger(decimals) || decimals<0 || decimals>30) throw new Error("Unknown token precision; review required");
    return {txid:receipt.transactionHash.toLowerCase(),network:config.network,token:log.address.toLowerCase(),destination:"0x"+log.topics[2].slice(-40).toLowerCase(),amount:unitsDecimal(BigInt(log.data),decimals),amount_decimals:decimals,amount_raw:BigInt(log.data).toString(),confirmations:Math.max(0,confirmations),finalized,successful:receipt.status==="0x1",block_hash:receipt.blockHash,block_number:BigInt(receipt.blockNumber).toString(),transaction_at:observedAt,transfer_index:Number(BigInt(log.logIndex))};
  }));
}
export async function verifySolana(config:PairConfig,txid:string):Promise<Observation[]> {
  const statuses=await rpc<{value:Array<{confirmationStatus:string;confirmations:number|null;err:unknown}|null>}>(config,"getSignatureStatuses",[[txid],{searchTransactionHistory:true}]);
  const status=statuses.value[0]; if(!status) return [];
  const transaction=await rpc<SolTransaction|null>(config,"getTransaction",[txid,{encoding:"jsonParsed",commitment:status.confirmationStatus==="finalized"?"finalized":"confirmed",maxSupportedTransactionVersion:0}]);
  if(!transaction?.meta || transaction.blockTime===null) return [];
  const finalized=status.confirmationStatus==="finalized" && !status.err && !transaction.meta.err;
  const confirmations=finalized?config.confirmations:Math.max(0,status.confirmations||0);
  // Net received balance is authoritative; instructions alone are never payment proof.
  return transaction.meta.postTokenBalances.flatMap(balance=>{
    const pre=transaction.meta!.preTokenBalances.find(v=>v.accountIndex===balance.accountIndex && v.mint===balance.mint);
    const received=BigInt(balance.uiTokenAmount.amount)-BigInt(pre?.uiTokenAmount.amount||"0");
    if(received<=BigInt(0) || !balance.owner) return [];
    return [{txid,network:config.network,token:balance.mint,destination:balance.owner,amount:unitsDecimal(received,balance.uiTokenAmount.decimals),amount_decimals:balance.uiTokenAmount.decimals,amount_raw:received.toString(),confirmations,finalized,successful:!transaction.meta!.err && !status.err,block_hash:`slot:${transaction.slot}`,block_number:String(transaction.slot),transaction_at:new Date(transaction.blockTime!*1000).toISOString(),transfer_index:balance.accountIndex}];
  });
}
export async function verifyTron(config:PairConfig,txid:string):Promise<Observation[]> {
  const receipt=await tron<TronReceipt>(config,"wallet/gettransactioninfobyid",{value:txid});
  if(!receipt.id || receipt.id.toLowerCase()!==txid.toLowerCase() || !receipt.blockTimeStamp || receipt.blockNumber===undefined) return [];
  const solid=await tron<TronReceipt>(config,"walletsolidity/gettransactioninfobyid",{value:txid});
  const head=await tron<{block_header:{raw_data:{number:number}}}>(config,"wallet/getnowblock",{});
  const confirmations=Math.max(0,head.block_header.raw_data.number-receipt.blockNumber+1);
  const finalized=solid.id===receipt.id && solid.blockNumber===receipt.blockNumber && solid.result!=="FAILED" && solid.receipt?.result==="SUCCESS";
  const transfers=(receipt.log||[]).map((log,index)=>({log,index})).filter(({log})=>log.topics.length===3 && "0x"+log.topics[0].toLowerCase()===transferTopic);
  return Promise.all(transfers.map(async ({log,index})=>{
    const token=tronAddress(log.address);
    let decimals=config.decimals;
    if(token!==config.token) {
      const result=await tron<{constant_result?:string[];result?:{result:boolean}}>(config,"wallet/triggerconstantcontract",{owner_address:config.addresses[0],contract_address:token,function_selector:"decimals()",visible:true});
      if(!result.result?.result || !result.constant_result?.[0]) throw new Error("Unknown TRON token precision; review required");
      decimals=Number(BigInt("0x"+result.constant_result[0]));
      if(!Number.isInteger(decimals) || decimals<0 || decimals>30) throw new Error("Invalid TRON token precision");
    }
    return {txid:receipt.id!.toLowerCase(),network:config.network,token,destination:tronAddress(log.topics[2]),amount:unitsDecimal(BigInt("0x"+log.data),decimals),amount_decimals:decimals,amount_raw:BigInt("0x"+log.data).toString(),confirmations,finalized,successful:receipt.result!=="FAILED" && receipt.receipt?.result==="SUCCESS",block_hash:`tron:${receipt.blockNumber}`,block_number:String(receipt.blockNumber),transaction_at:new Date(receipt.blockTimeStamp!).toISOString(),transfer_index:index};
  }));
}
export async function verifyTransaction(order:PaymentOrder,txid:string):Promise<Observation[]> {
  const config=pairConfig(order.crypto_asset,order.crypto_network);
  if(canonical(config.token,config.network)!==canonical(order.token_contract,config.network) || config.decimals!==order.token_decimals) throw new Error("Invoice token configuration changed; review is required");
  const observations=await (config.network==="SOL"?verifySolana(config,txid):config.network==="TRC20"?verifyTron(config,txid):verifyEvm(config,txid));
  const grouped=new Map<string,Observation>();
  for(const observation of observations) {
    const key=canonical(observation.token,config.network)+":"+canonical(observation.destination,config.network);
    const existing=grouped.get(key);
    if(existing) {
      const decimals=existing.amount_decimals??config.decimals;
      existing.amount=unitsDecimal(decimalUnits(existing.amount,decimals)+decimalUnits(observation.amount,decimals),decimals);
      existing.amount_raw=decimalUnits(existing.amount,decimals).toString();
      existing.transfer_index=-1;
    } else grouped.set(key,{...observation});
  }
  return [...grouped.values()];
}
export async function discover(order:PaymentOrder):Promise<{txids:string[];cursor:string|null}> {
  const config=pairConfig(order.crypto_asset,order.crypto_network);
  if(config.network==="BEP20" || config.network==="ERC20") {
    const head=BigInt(await rpc<string>(config,"eth_blockNumber",[]));
    const saved=BigInt(order.scan_cursor||"0");
    const from=saved>BigInt(config.confirmations+2)?saved-BigInt(config.confirmations+2):BigInt(0); if(from>head) return {txids:[],cursor:order.scan_cursor};
    const to=from+BigInt(1999)<head?from+BigInt(1999):head;
    // All token contracts: unknown deposits to a shared address enter the matching queue.
    const logs=await rpc<Log[]>(config,"eth_getLogs",[{fromBlock:"0x"+from.toString(16),toBlock:"0x"+to.toString(16),topics:[transferTopic,null,"0x"+order.receiving_address.slice(2).padStart(64,"0")]}]);
    return {txids:[...new Set(logs.filter(l=>!l.removed).map(l=>l.transactionHash))],cursor:(to>saved?to:saved).toString()};
  }
  if(config.network==="SOL") {
    const accounts=await rpc<{value:SolAccount[]}>(config,"getTokenAccountsByOwner",[order.receiving_address,{programId:"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},{encoding:"jsonParsed",commitment:"confirmed"}]);
    const txids=new Set<string>();
    for(const account of [order.receiving_address,...accounts.value.map(v=>v.pubkey)]) {
      let before:string|undefined; let exhausted=false;
      for(let page=0;page<10;page++) {
        const list=await rpc<Array<{signature:string;slot:number;blockTime:number|null}>>(config,"getSignaturesForAddress",[account,{limit:100,before,commitment:"confirmed"}]);
        for(const tx of list) if(tx.slot>Number(order.scan_cursor||0)) txids.add(tx.signature);
        if(list.length<100 || list.some(tx=>tx.slot<=Number(order.scan_cursor||0))) { exhausted=true; break; }
        before=list[list.length-1].signature;
      }
      if(!exhausted) throw new Error("Solana history limit reached; rescan/review required");
    }
    return {txids:[...txids],cursor:order.scan_cursor};
  }
  const txids=new Set<string>(); let fingerprint:string|undefined;
  for(let page=0;page<10;page++) {
    const url=new URL(`${config.rpcUrl.replace(/\/$/,"")}/v1/accounts/${encodeURIComponent(order.receiving_address)}/transactions/trc20`);
    url.searchParams.set("limit","200"); url.searchParams.set("min_timestamp",String(Date.parse(order.created_at))); if(fingerprint) url.searchParams.set("fingerprint",fingerprint);
    const result=await jsonRequest<{data:Array<{transaction_id:string;to:string}>;meta?:{fingerprint?:string;links?:{next?:string}}}>(url.toString(),undefined,process.env.TRONGRID_API_KEY?{"TRON-PRO-API-KEY":process.env.TRONGRID_API_KEY}:undefined);
    for(const tx of result.data) if(tx.to===order.receiving_address) txids.add(tx.transaction_id);
    if(!result.meta?.links?.next) return {txids:[...txids],cursor:order.scan_cursor}; fingerprint=result.meta.fingerprint;
    if(!fingerprint) throw new Error("TRON history pagination incomplete");
  }
  throw new Error("TRON history limit reached; rescan/review required");
}
