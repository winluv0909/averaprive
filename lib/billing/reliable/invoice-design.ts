import "server-only";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import QRCode from "qrcode";
import {invoiceState} from "./invoice-state";
import type {Invoice} from "./invoice";
const ink=[0.09,0.09,0.085],gold=[0.65,0.51,0.29],muted=[0.43,0.42,0.39],ivory=[0.974,0.967,0.947],white=[1,1,1];
type FontMetric = {name:string;widths:number[];bbox:number[];ascent:number;descent:number};
const metrics: FontMetric[]=JSON.parse(readFileSync(join(process.cwd(),"public/assets/invoice/font-metrics.json"),"utf8"));
const winAnsi: Record<number,number>={0x20ac:128,0x201a:130,0x192:131,0x201e:132,0x2026:133,0x2020:134,0x2021:135,0x2c6:136,0x2030:137,0x160:138,0x2039:139,0x152:140,0x17d:142,0x2018:145,0x2019:146,0x201c:147,0x201d:148,0x2022:149,0x2013:150,0x2014:151,0x2dc:152,0x2122:153,0x161:154,0x203a:155,0x153:156,0x17e:158,0x178:159};
const escape=(value:string)=>Array.from(value.replace(/[\r\n\t]/g," ")).map(c=>{
  const unicode=c.codePointAt(0)!;
  const code=winAnsi[unicode] ?? unicode;
  if(c==="\\" || c==="(" || c===")") return "\\"+c;
  if(code>=32 && code<=126) return c;
  if(code>=128 && code<=255) return "\\"+code.toString(8).padStart(3,"0");
  return `[U+${code.toString(16).toUpperCase()}]`;
}).join("");
function width(text:string,size:number) {
  const encoded=escape(text).replace(/\\([0-7]{3})/g,(_,octal:string)=>String.fromCharCode(parseInt(octal,8))).replace(/\\([\\()])/g,"$1");
  // Use the wider regular/bold measurement because billing names use bold.
  return Math.max(...metrics.slice(0,2).map(font=>Array.from(encoded).reduce((total,c)=>total+(font.widths[c.charCodeAt(0)] ?? 1000),0)))*size/1000;
}
function wrap(value:string,maxWidth:number,size:number):string[] {
  const text=String(value).replace(/[\r\n\t]/g," ");const lines:string[]=[];let line="";
  for(const word of text.split(" ")) {
    if(width(line+(line?" ":"")+word,size)<=maxWidth) {line+=(line?" ":"")+word;continue;}
    if(line) {lines.push(line);line="";}
    for(const c of word) {if(width(line+c,size)>maxWidth && line){lines.push(line);line="";}line+=c;}
  }
  if(line || !lines.length) lines.push(line);return lines;
}
const date=(value:unknown)=>{const d=new Date(String(value));return Number.isNaN(d.getTime())?String(value||"Not recorded"):d.toISOString().replace("T"," ").slice(0,16)+" UTC";};
const money=(value:unknown)=>Number(value||0).toFixed(2);
export function premiumInvoicePdf(invoice:Invoice):Buffer {
  const c=invoice.customer_snapshot,p=invoice.payment_snapshot,s=invoice.seller_snapshot;
  const state=invoiceState(invoice.status,p);
  const sandbox=p.provider==="paypal" && p.environment==="sandbox";
  const sample=/sample/i.test(invoice.invoice_number)||sandbox,paid=invoice.status==="paid";
  let logo:Buffer|null=null;try {logo=readFileSync(join(process.cwd(),"public/assets/invoice/monogram.jpg"));} catch { /* Wordmark stays readable if an asset is missing. */ }
  const streams:string[][]=[];let operations:string[]=[],y=180;
  function text(value:string,x:number,top:number,size=10,font="F1",color=ink) {
    const actual=/[^\x20-\xff]/u.test(value)?`/Span << /ActualText <FEFF${Buffer.from(value,"utf16le").swap16().toString("hex")}> >> BDC `:"";
    operations.push(`BT /${font} ${size} Tf ${color.join(" ")} rg 1 0 0 1 ${x} ${792-top} Tm ${actual}(${escape(value)}) Tj${actual?" EMC":""} ET`);
  }
  function rect(x:number,top:number,w:number,h:number,color:number[]) {operations.push(`${color.join(" ")} rg ${x} ${792-top-h} ${w} ${h} re f`);}
  function line(x:number,top:number,w:number,color=gold) {operations.push(`${color.join(" ")} RG 0.7 w ${x} ${792-top} m ${x+w} ${792-top} l S`);}
  function header() {
    rect(0,0,612,112,[0,0,0]);rect(0,112,612,3,gold);
    if(logo) operations.push("q 34 682 94 94 re W n 144 0 0 144 10 656 cm /Logo Do Q");
    const sellerName=String(s.name||"Avera Privé");
    const sellerSize=Math.max(10,Math.min(25,25*270/Math.max(1,width(sellerName,25))));
    text(wrap(sellerName,270,sellerSize)[0],logo?142:42,63,sellerSize,"F3",white);
    text("AGENCY SERVICES & SUBSCRIPTIONS",logo?142:42,85,7.5,"F2",[0.75,0.65,0.45]);
    text("INVOICE",435,55,27,"F3",white);
    rect(435,72,135,23,[0.19,0.17,0.12]);text(sandbox?"SANDBOX TEST":sample?"SAMPLE / "+invoice.status.toUpperCase():(p.provider === "paypal" && ["refunded","reversed","partially_refunded"].includes(String(p.status)) ? String(p.status).replaceAll("_"," ").toUpperCase() : invoice.status.toUpperCase()),447,87,8,"F2",[0.86,0.73,0.47]);
    text(invoice.invoice_number,42,143,10,"F2");text(`Issued ${date(invoice.issued_at)}`,340,143,8,"F1",muted);
  }
  function footer() {
    line(42,742,528,[0.84,0.81,0.74]);
    text(sample?"SAMPLE PREVIEW ONLY - NOT A REAL PAYMENT INVOICE":"AVERA PRIVÉ / BILLING RECORD",42,759,7,"F2",muted);
    text(`${streams.length+1}`,558,759,8,"F1",muted);
  }
  function nextPage() {footer();streams.push(operations);operations=[];header();y=190;}
  function ensure(height:number) {if(y+height>714) nextPage();}
  function paragraph(value:string,x=42,w=528,size=9,font="F1",color=ink) {
    for(const part of wrap(value,w,size)){ensure(size+6);text(part,x,y,size,font,color);y+=size+4;}
  }
  function section(label:string) {ensure(44);y+=12;text(label,42,y,8,"F2",gold);y+=17;}
  header();
  const from=[String(s.name||"Avera Privé"),String(s.address||""),String(s.email||""),s.taxId?`Tax ID: ${s.taxId}`:""].filter(Boolean).flatMap(v=>wrap(v,235,9));
  const to=[String(c.legal_name||c.company_name||""),c.full_name?`Contact: ${c.full_name}`:"",String(c.billing_email||""),String(c.billing_address||""),c.tax_id?`Tax ID: ${c.tax_id}`:""].filter(Boolean).flatMap(v=>wrap(v,235,9));
  const visible=Math.min(9,Math.max(from.length,to.length));const cardHeight=42+visible*13;
  y=171;rect(42,y,528,cardHeight,ivory);text("BILLED FROM",56,y+24,8,"F2",gold);text("BILLED TO",324,y+24,8,"F2",gold);
  from.slice(0,9).forEach((v,i)=>text(v,56,y+38+i*13,9,i===0?"F2":"F1"));to.slice(0,9).forEach((v,i)=>text(v,324,y+38+i*13,9,i===0?"F2":"F1"));
  y+=cardHeight+18;
  function tableHeading(){ensure(46);rect(42,y,528,25,ink);text("SUBSCRIPTION / DESCRIPTION",54,y+17,8,"F2",white);text("QTY",413,y+17,8,"F2",white);text(`AMOUNT (${invoice.currency})`,468,y+17,8,"F2",white);y+=40;}
  tableHeading();
  for(const item of invoice.line_items) {
    const description=wrap(String(item.description),337,10);
    if(description.length*15+18<480) {if(y+description.length*15+18>714){nextPage();tableHeading();}}
    text(String(item.quantity),422,y,10);text(money(item.amount),496,y,10,"F2");
    paragraph(String(item.description),54,337,10);y+=8;ensure(2);line(42,y,528,[0.87,0.85,0.80]);y+=15;
  }
  ensure(106);const totalY=y;
  text(sandbox?"Sandbox test payment":p.status==="refunded"?"Payment refunded":p.status==="reversed"?"Payment reversed":p.status==="partially_refunded"?"Partial refund recorded":state.label,42,totalY+18,11,"F2");
  for(const [i,part] of wrap(paid?`Paid ${date(invoice.paid_at)}`:state.note,230,8).entries()) text(part,42,totalY+38+i*11,8,"F1",muted);
  const address=String(p.receiving_address||"");
  if(state.canShowPaymentQr && address && !sample){const qr=QRCode.create(address,{errorCorrectionLevel:"M"}),unit=54/(qr.modules.size+8);
    for(let row=0;row<qr.modules.size;row++)for(let col=0;col<qr.modules.size;col++)if(qr.modules.get(row,col))rect(281+(col+4)*unit,totalY+12+(row+4)*unit,unit,unit,ink);
    text("Address QR",280,totalY+82,7,"F1",muted);
  }
  rect(351,totalY-2,219,98,ivory);text("Subtotal",365,totalY+17,9,"F1",muted);text(money(invoice.subtotal),505,totalY+17,9);
  text("Tax",365,totalY+36,9,"F1",muted);text(money(invoice.tax_amount),505,totalY+36,9);line(365,totalY+47,191,[0.82,0.78,0.70]);
  text("TOTAL",365,totalY+75,9,"F2",gold);const totalText=`${invoice.currency} ${money(invoice.total_amount)}`;
  const totalSize=Math.min(17,17*138/Math.max(1,width(totalText,17)));
  text(totalText,556-width(totalText,totalSize),totalY+76,totalSize,"F2");y+=104;
  section("PAYMENT DETAILS");
  if (p.provider === "paypal") {
    paragraph(`PayPal / ${p.environment === "sandbox" ? "SANDBOX TEST ONLY" : "Live payment"}`,42,528,11,"F2");
    paragraph(`Payment ID: ${invoice.order_id}`);
    paragraph(`Invoice ID: ${invoice.id}`);
    paragraph(`PayPal order: ${p.paypal_order_id || p.order_id || "Not recorded"}`);
    paragraph(`PayPal capture: ${p.capture_id || "Not confirmed"}`);
    paragraph(`Receiving merchant: ${p.merchant_id || "Not recorded"}`);
    paragraph(`Payment state: ${p.status || "Not confirmed"}`);
    if(sandbox) paragraph("No real money received. Live subscription unchanged.");
  } else {
  paragraph(`${p.asset==="BTC"?(p.network==="BITCOIN"?"BTC (native Bitcoin)":"Wrapped BTC"):p.asset||"Crypto"} / ${p.network||""} / Exact amount: ${p.expected_crypto_amount||p.amount||"Not recorded"}`,42,528,11,"F2");
  paragraph(`Receiving provider: ${p.wallet_generation==="trust_wallet_v1"?"Trust Wallet":p.receiving_provider==="binance"?"Binance":"Blockchain wallet"}`);
  if(p.matching_adjustment!==undefined) paragraph(`Matching adjustment (included): ${p.matching_adjustment} ${p.asset}`);
  paragraph(`Receiving address: ${p.receiving_address||p.destination||"Not recorded"}`);
  paragraph(`Token contract / mint: ${p.token_contract||p.token||"Not recorded"}`);
  paragraph(`Payment ID: ${invoice.order_id}`);
  paragraph(`Invoice ID: ${invoice.id}`);
  paragraph(`Verified TXID: ${p.verified_transaction_hash||"Not confirmed"}`);
  paragraph(`Confirmations: ${p.confirmations??"Not recorded"}`);
  if(p.expires_at) paragraph(`Payment expiry: ${date(p.expires_at)}`);
  if(p.receiving_provider==="binance") paragraph(`Binance deposit credit: ${p.custodian_credit?"Verified":"Awaiting verified credit"}`);
  }
  if(state.refund) {
    section("REFUND RECORD");paragraph(state.label,42,528,10,"F2");paragraph(state.note);
    if(state.recorded){paragraph(`Outgoing refund TXID: ${p.refund_txid||"Not recorded"}`);paragraph(`Refund amount: ${p.refund_amount||"Not recorded"} ${p.asset||""}`);}
  }
  if(from.length>9 || to.length>9) {
    ensure(104);
    section("BILLING INFORMATION - CONTINUED");
    if(from.length>9){paragraph("Billed from - continued",42,528,9,"F2");from.slice(9).forEach(v=>paragraph(v));}
    if(to.length>9){paragraph("Billed to - continued",42,528,9,"F2");to.slice(9).forEach(v=>paragraph(v));}
  }
  if(invoice.notes){section(state.stopped?"HISTORICAL NOTES - DO NOT USE AS PAYMENT INSTRUCTIONS":"NOTES");paragraph(invoice.notes,42,528,8,"F1",muted);}
  footer();streams.push(operations);
  const objects:Buffer[]=[Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),Buffer.alloc(0)];
  const fontIds:number[]=[];
  for(const metric of metrics){
    const fontId=objects.length+1, descriptorId=fontId+1,fileId=fontId+2; fontIds.push(fontId);
    const bytes=readFileSync(join(process.cwd(),"public/assets/invoice",metric.name+".ttf"));
    objects.push(Buffer.from(`<< /Type /Font /Subtype /TrueType /BaseFont /${metric.name} /Encoding /WinAnsiEncoding /FirstChar 0 /LastChar 255 /Widths [${metric.widths.join(" ")}] /FontDescriptor ${descriptorId} 0 R >>`));
    objects.push(Buffer.from(`<< /Type /FontDescriptor /FontName /${metric.name} /Flags 32 /FontBBox [${metric.bbox.join(" ")}] /ItalicAngle 0 /Ascent ${metric.ascent} /Descent ${metric.descent} /CapHeight ${metric.ascent} /StemV 80 /FontFile2 ${fileId} 0 R >>`));
    objects.push(Buffer.concat([Buffer.from(`<< /Length ${bytes.length} /Length1 ${bytes.length} >>\nstream\n`),bytes,Buffer.from("\nendstream")]));
  }
  let logoId:number|null=null;
  if(logo){logoId=objects.length+1;objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 2000 /Height 2000 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`),logo,Buffer.from("\nendstream")]));}
  const ids:number[]=[];
  for(const operations of streams) {
    const pageId=objects.length+1,streamId=pageId+1;ids.push(pageId);
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontIds[0]} 0 R /F2 ${fontIds[1]} 0 R /F3 ${fontIds[2]} 0 R >> ${logoId?`/XObject << /Logo ${logoId} 0 R >>`:""} >> /Contents ${streamId} 0 R >>`));
    const stream=Buffer.from(operations.join("\n"));objects.push(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),stream,Buffer.from("\nendstream")]));
  }
  objects[1]=Buffer.from(`<< /Type /Pages /Kids [${ids.map(id=>`${id} 0 R`).join(" ")}] /Count ${ids.length} >>`);
  const chunks=[Buffer.from("%PDF-1.4\n")],offsets=[0];let length=chunks[0].length;
  objects.forEach((object,i)=>{offsets.push(length);const chunk=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from("\nendobj\n")]);chunks.push(chunk);length+=chunk.length;});
  chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(v=>`${String(v).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`));
  return Buffer.concat(chunks);
}
