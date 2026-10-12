import {afterEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {verifyEvm,verifySolana,verifyTron,snapshotChain,verifyTransaction} from "../lib/billing/reliable/chain";
import {tronAddress,type PairConfig} from "../lib/billing/reliable/config";
import {transferTopic,type PaymentOrder} from "../lib/billing/reliable/domain";
const token="0x"+"a".repeat(40),address="0x"+"b".repeat(40),txid="0x"+"c".repeat(64);
const config:PairConfig={asset:"USDT",network:"ERC20",token,decimals:6,addresses:[address],confirmations:12,rpcUrl:"https://rpc.example.com"};
const log={address:token,topics:[transferTopic,"0x"+"0".repeat(64),"0x"+address.slice(2).padStart(64,"0")],data:"0x"+BigInt(49000000).toString(16),logIndex:"0x0",transactionHash:txid,blockNumber:"0x64"};
function mockRpc(results:Record<string,unknown>) {
  vi.stubGlobal("fetch",vi.fn(async(_url:unknown,options:{body:string})=>{
    const body=JSON.parse(options.body),key=body.method==="eth_getBlockByNumber" && body.params[0]==="finalized"?"finalized":body.method;
    return {ok:true,json:async()=>({result:results[key]})};
  }));
}
function evmOverrides(overrides:Record<string,unknown>={}) {
  return {eth_getTransactionReceipt:{transactionHash:txid,status:"0x1",blockHash:"canonical",blockNumber:"0x64",logs:[log]},eth_getBlockByNumber:{hash:"canonical",timestamp:"0x64",number:"0x64"},eth_blockNumber:"0x70",finalized:{hash:"final",number:"0x64"},eth_call:"0x6",...overrides};
}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("blockchain RPC evidence",()=>{
  it("verifies receipt destination, contract and exact received amount",async()=>{mockRpc(evmOverrides());const result=await verifyEvm(config,txid);expect(result[0]).toMatchObject({token,destination:address,amount:"49.000000",confirmations:13,finalized:true,successful:true});});
  it("never treats broadcast as a payment",async()=>{mockRpc(evmOverrides({eth_getTransactionReceipt:null}));expect(await verifyEvm(config,txid)).toEqual([]);});
  it("rejects reorged receipts",async()=>{mockRpc(evmOverrides({eth_getBlockByNumber:{hash:"different",timestamp:"0x64",number:"0x64"}}));expect(await verifyEvm(config,txid)).toEqual([]);});
  it("requires finalized block independently of confirmation count",async()=>{mockRpc(evmOverrides({finalized:{number:"0x63"}}));expect((await verifyEvm(config,txid))[0].finalized).toBe(false);});
  it("does not reinterpret wrong token as the selected token",async()=>{mockRpc(evmOverrides({eth_getTransactionReceipt:{transactionHash:txid,status:"0x1",blockHash:"canonical",blockNumber:"0x64",logs:[{...log,address:"0x"+"d".repeat(40)}]}}));expect((await verifyEvm(config,txid))[0].token).not.toBe(token);});
  it("rejects mismatched receipt TXID",async()=>{mockRpc(evmOverrides({eth_getTransactionReceipt:{transactionHash:"other"}}));await expect(verifyEvm(config,txid)).rejects.toThrow("Mismatched");});
  it("rejects failed execution even with a supplied transfer log",async()=>{mockRpc(evmOverrides({eth_getTransactionReceipt:{transactionHash:txid,status:"0x0",blockHash:"canonical",blockNumber:"0x64",logs:[log]}}));expect((await verifyEvm(config,txid))[0].successful).toBe(false);});
  it("rejects wrong RPC chain before invoice creation",async()=>{mockRpc({eth_chainId:"0x38"});await expect(snapshotChain(config)).rejects.toThrow("wrong network");});
  it("aggregates multiple transfers to detect overpayment",async()=>{
    vi.stubEnv("CRYPTO_RPC_ERC20",config.rpcUrl);vi.stubEnv("CRYPTO_TOKEN_USDT_ERC20",token);vi.stubEnv("CRYPTO_DECIMALS_USDT_ERC20","6");vi.stubEnv("CRYPTO_WALLETS_USDT_ERC20",JSON.stringify([address]));
    mockRpc(evmOverrides({eth_getTransactionReceipt:{transactionHash:txid,status:"0x1",blockHash:"canonical",blockNumber:"0x64",logs:[log,{...log,logIndex:"0x1"}]}}));
    expect((await verifyTransaction({crypto_asset:"USDT",crypto_network:"ERC20",token_contract:token,token_decimals:6} as PaymentOrder,txid))[0].amount).toBe("98.000000");
  });
  it.each(["confirmed","finalized"])("checks Solana %s against actual token balance",async(status)=>{
    mockRpc({getSignatureStatuses:{value:[{confirmationStatus:status,confirmations:1,err:null}]},getTransaction:{slot:123,blockTime:100,meta:{err:null,preTokenBalances:[{accountIndex:1,mint:"mint",owner:"owner",uiTokenAmount:{amount:"1000000",decimals:6}}],postTokenBalances:[{accountIndex:1,mint:"mint",owner:"owner",uiTokenAmount:{amount:"50000000",decimals:6}}]}}});
    const result=await verifySolana({...config,network:"SOL"},"signature");expect(result[0]).toMatchObject({amount:"49.000000",destination:"owner",token:"mint",finalized:status==="finalized"});
  });
  it("does not accept a failed Solana transaction",async()=>{
    mockRpc({getSignatureStatuses:{value:[{confirmationStatus:"finalized",confirmations:null,err:{error:"failed"}}]},getTransaction:{slot:123,blockTime:100,meta:{err:{error:"failed"},preTokenBalances:[],postTokenBalances:[{accountIndex:1,mint:"mint",owner:"owner",uiTokenAmount:{amount:"49000000",decimals:6}}]}}});expect((await verifySolana({...config,network:"SOL"},"sig"))[0].successful).toBe(false);
  });
  it.each([false,true])("requires TRON solidified receipt (%s)",async(solidified)=>{
    const receipt={id:txid.slice(2),blockNumber:100,blockTimeStamp:100000,receipt:{result:"SUCCESS"},log:[{address:token.slice(2),topics:log.topics.map(t=>t.slice(2)),data:log.data.slice(2)}]};
    vi.stubGlobal("fetch",vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes("walletsolidity")?(solidified?receipt:{}):url.includes("getnowblock")?{block_header:{raw_data:{number:130}}}:receipt})));
    const result=await verifyTron({...config,network:"TRC20",token:tronAddress(token)},txid.slice(2));expect(result[0]).toMatchObject({finalized:solidified,successful:true,destination:tronAddress(address),token:tronAddress(token),amount:"49.000000"});
  });
});
