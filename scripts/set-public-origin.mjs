import {readFileSync,writeFileSync} from 'node:fs';
const args=process.argv.slice(2),index=args.indexOf('--origin');
if(index<0)throw new Error('Usage: node scripts/set-public-origin.mjs --origin https://your-domain --write (omit --write for a preview)');
const value=args[index+1],url=new URL(value);
if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Use a bare HTTPS origin without credentials, query, fragment or path.');
const pages=['index','agencies','compare','for-agencies','pricing','insights','rankings','reviews','trust','about','demo','legal'];
for(const name of pages){const file=`public/${name}.html`,target=url.origin+(name==='index'?'/':`/${name}.html`);let s=readFileSync(file,'utf8');const canonical=`<link rel="canonical" href="${target}">`;if(/<link\b[^>]*rel=["']canonical["'][^>]*>/i.test(s))s=s.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/ig,canonical);else s=s.replace(/<\/head>/i,canonical+'\n</head>');const og=`<meta property="og:url" content="${target}">`;if(/<meta\b[^>]*property=["']og:url["'][^>]*>/i.test(s))s=s.replace(/<meta\b[^>]*property=["']og:url["'][^>]*>/ig,og);else s=s.replace(/<\/head>/i,og+'\n</head>');if(args.includes('--write'))writeFileSync(file,s);console.log(`${args.includes('--write')?'UPDATED':'PREVIEW'}: ${file}`);}
console.log('Also update Vercel NEXT_PUBLIC_SITE_URL, Supabase Site URL/redirect allowlist, OAuth provider callbacks, PayPal webhooks and email templates. This command does not change DNS or account settings.');
