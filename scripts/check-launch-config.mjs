// Run with Node's --env-file option. Prints check names only, never environment values.
const env=process.env;const present=key=>Boolean(env[key]?.trim());const long=key=>(env[key]?.length||0)>=32;
const https=key=>{try{const u=new URL(env[key]);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/';}catch{return false;}};
const checks=[
 ['Canonical HTTPS origin',https('NEXT_PUBLIC_SITE_URL')],
 ['Supabase URL',https('NEXT_PUBLIC_SUPABASE_URL')],
 ['Supabase public client key',present('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')||present('NEXT_PUBLIC_SUPABASE_ANON_KEY')],
 ['Supabase private server key',present('SUPABASE_SERVICE_ROLE_KEY')],
 ['Registration email secret',long('REGISTRATION_EMAIL_SECRET')],
 ['Transactional email API',present('RESEND_API_KEY')],
 ['Registration email sender',present('REGISTRATION_EMAIL_FROM')||present('PAYMENT_EMAIL_FROM')],
 ['Payment email sender',present('PAYMENT_EMAIL_FROM')],
 ['Payment admin recipients',present('PAYMENT_ADMIN_EMAILS')],
 ['Crypto monitor authorization',long('CRYPTO_MONITOR_SECRET')],
 ['PayPal monitor authorization',long('PAYPAL_MONITOR_SECRET')],
 ['Distinct payment monitor secrets',long('CRYPTO_MONITOR_SECRET')&&long('PAYPAL_MONITOR_SECRET')&&env.CRYPTO_MONITOR_SECRET!==env.PAYPAL_MONITOR_SECRET],
 ['PayPal production enabled',env.PAYPAL_ENV==='live'&&env.PAYPAL_LIVE_ENABLED==='true'],
 ['PayPal credentials and verification IDs',['PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MERCHANT_ID','PAYPAL_WEBHOOK_ID'].every(present)],
 ['Crypto production enabled',env.WALLET_CRYPTO_ENABLED==='true'],
 ...['ERC20','TRC20','BEP20','ARBITRUM','BASE','BITCOIN'].map(network=>['Wallet RPC '+network,present('WALLET_RPC_'+network)]),
 ['Bitcoin quote API and secondary verifier',present('TATUM_API_KEY')&&present('WALLET_BTC_SECONDARY_URL')],
 ['Public operator mailing address supplied',present('BILLING_SELLER_ADDRESS')],
];
let failed=0;for(const [name,ok]of checks){console.log(`${ok?'PASS':'NEEDS REVIEW'}: ${name}`);if(!ok)failed++;}
console.log(`\n${checks.length-failed}/${checks.length} configuration presence checks passed.`);
console.log('Presence checks do not confirm credentials, SMTP setup, DNS ownership, wallet control, scheduler health or delivery. Do not share an environment file.');
process.exitCode=failed?1:0;
