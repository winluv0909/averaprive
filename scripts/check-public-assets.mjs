import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,extname,relative} from 'node:path';
const root=resolve('public');let checked=0;const missing=[];
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(resolve(dir,item.name)):[resolve(dir,item.name)]);}
for(const file of walk(root).filter(path=>['.html','.css'].includes(extname(path)))){
 const content=readFileSync(file,'utf8');
 const refs=extname(file)==='.html'?[...content.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(x=>x[1]):[...content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(x=>x[1]);
 for(const ref of refs){if(/^(?:[a-z]+:|\/\/|#)/i.test(ref))continue;const path=ref.split(/[?#]/)[0];if(!/\.(?:css|js|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|mp4|webm)$/i.test(path))continue;checked++;const target=path.startsWith('/')?resolve(root,'.'+path):resolve(dirname(file),path);if(relative(root,target).split(/[\\/]/)[0]==='..'||!existsSync(target))missing.push({file:relative(root,file),asset:ref});}
}
console.log(JSON.stringify({checked,missing},null,2));process.exitCode=missing.length?1:0;
