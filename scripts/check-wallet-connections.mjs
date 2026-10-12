// Run locally with node --env-file=.env.local scripts/check-wallet-connections.mjs
// Read-only checks: no invoices, database writes, signing, transfers or key output.
const pause = () => new Promise(resolve => setTimeout(resolve, 150));
async function read(url, body, headers = {}, text = false) {
  if (!url || new URL(url).protocol !== "https:") throw new Error("HTTPS endpoint missing or invalid");
  await pause();
  const response = await fetch(url, {method:body === undefined ? "GET" : "POST",headers:{"Content-Type":"application/json",...headers},body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:"error"});
  if (!response.ok) throw new Error(`service returned HTTP ${response.status}`);
  return text ? (await response.text()).trim() : response.json();
}
async function rpc(url, method, params) {const result=await read(url,{jsonrpc:"2.0",id:1,method,params});if(result.error||!("result" in result))throw new Error("RPC rejected the method; check network, access and plan limits");return result.result;}
let failed=0;
async function check(name, run){try{await run();console.log(`PASS: ${name}`);}catch(error){failed++;console.log(`FAIL: ${name} — ${error instanceof Error && !String(error.message).includes("http") ? error.message : "connection failed; check the local setting"}`);}}
const address="0x7a71cfbdc7d37d9520445bff3634cbda889f904d";
const evm=[
 ["Ethereum","ERC20",1,[["0xdac17f958d2ee523a2206206994597c13d831ec7",6],["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",6]]],
 ["BNB Smart Chain","BEP20",56,[["0x55d398326f99059ff775485246999027b3197955",18]]],
 ["Arbitrum One","ARBITRUM",42161,[["0xaf88d065e77c8cc2239327c5edb3a432268e5831",6]]],
 ["Base","BASE",8453,[["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",6]]]
];
console.log("Checking connections only. Crypto enable setting is not changed. No keys are printed.");
for(const [name,env,id,tokens] of evm)await check(name,async()=>{
 const url=process.env[`WALLET_RPC_${env}`];
 if(Number(BigInt(await rpc(url,"eth_chainId",[])))!==id)throw new Error("endpoint is on the wrong network");
 const finalized=await rpc(url,"eth_getBlockByNumber",["finalized",false]);if(!finalized?.number)throw new Error("finalized blocks are unavailable");
 for(const [token,decimals] of tokens)if(Number(BigInt(await rpc(url,"eth_call",[{to:token,data:"0x313ce567"},"latest"])))!==decimals)throw new Error("token decimals mismatch");
 const head=BigInt(await rpc(url,"eth_blockNumber",[]));
 await rpc(url,"eth_getLogs",[{fromBlock:"0x"+(head>9n?head-9n:0n).toString(16),toBlock:"0x"+head.toString(16),address:tokens[0][0],topics:["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",null,"0x"+address.slice(2).padStart(64,"0")]}]);
});
await check("Tron / USDT",async()=>{
 const base=(process.env.WALLET_RPC_TRC20||"").replace(/\/$/,"");const key=process.env.TRONGRID_API_KEY;if(!key)throw new Error("TRONGRID_API_KEY is missing");const headers={"TRON-PRO-API-KEY":key};
 const genesis=await read(base+"/wallet/getblockbynum",{num:0},headers);if(genesis.blockID!=="00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc")throw new Error("endpoint is not Tron mainnet");
 const decimals=await read(base+"/wallet/triggerconstantcontract",{owner_address:"TQmrKedVwf3yfvmLUcsPbnWsWHFkSFVZnq",contract_address:"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",function_selector:"decimals()",visible:true},headers);
 if(!decimals.result?.result||Number(BigInt("0x"+(decimals.constant_result?.[0]||"")))!==6)throw new Error("USDT contract check failed");
 const solid=await read(base+"/walletsolidity/getnowblock",{},headers);if(!Number.isSafeInteger(solid.block_header?.raw_data?.number))throw new Error("solidity endpoint unavailable");
 const history=await read(base+"/v1/accounts/TQmrKedVwf3yfvmLUcsPbnWsWHFkSFVZnq/transactions/trc20?limit=1",undefined,headers);if(!Array.isArray(history.data))throw new Error("TronGrid token history unavailable");
});
await check("Bitcoin / two mainnet data sources",async()=>{
 const sources=[process.env.WALLET_RPC_BITCOIN,process.env.WALLET_BTC_SECONDARY_URL];if(sources.some(s=>!s)||new URL(sources[0]).host===new URL(sources[1]).host)throw new Error("two independent Bitcoin endpoints are required");
 for(const source of sources){const base=source.replace(/\/$/,"");if(await read(base+"/block-height/0",undefined,{},true)!=="000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f")throw new Error("Bitcoin endpoint is not mainnet");if(!/^\d+$/.test(await read(base+"/blocks/tip/height",undefined,{},true)))throw new Error("Bitcoin tip check failed");}
});
await check("Tatum / fresh BTC-USD price",async()=>{
 const key=process.env.TATUM_API_KEY;if(!key)throw new Error("TATUM_API_KEY is missing");
 const rate=await read("https://api.tatum.io/v4/data/rate/symbol?symbol=BTC&basePair=USD",undefined,{"x-api-key":key});
 if(!(Number(rate.value)>0)||rate.basePair!=="USD"||rate.symbol!=="BTC"||!Number.isFinite(Number(rate.timestamp))||Math.abs(Date.now()-Number(rate.timestamp))>600000)throw new Error("fresh BTC/USD quote not available");
});
await check("Monitor secret",async()=>{if((process.env.CRYPTO_MONITOR_SECRET||"").length<32)throw new Error("monitor secret must contain at least 32 characters");});
console.log(failed?`${failed} check(s) failed. Keep WALLET_CRYPTO_ENABLED=false.`:"All connection checks passed. This does not test invoice matching, payment confirmation, email or a running monitor.");
process.exitCode=failed?1:0;
