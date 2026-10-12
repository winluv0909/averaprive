// Run with: node --env-file=.env.local scripts/crypto-monitor.mjs
// Keep this process running. Production should use a hosted scheduler/worker.
const base=process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000";
const secret=process.env.CRYPTO_MONITOR_SECRET;
if(!secret || secret.length<32) throw new Error("Configure CRYPTO_MONITOR_SECRET with at least 32 random characters");
async function tick() {
  try {
    const response=await fetch(new URL("/api/internal/crypto-monitor",base),{method:"POST",headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(290000)});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(new Date().toISOString(),await response.json());
  } catch {console.error(new Date().toISOString(),"Payment monitor failed. Check the server and configuration; no payment was approved.");}
}
while(true) {await tick();await new Promise(resolve=>setTimeout(resolve,15000));}
