/* eslint-disable @next/next/no-html-link-for-pages -- Recovery links intentionally reload the full document, including after root-layout failure. */
import type { CSSProperties } from "react";
const page: CSSProperties = {minHeight:"100vh",display:"grid",placeItems:"center",padding:"32px 20px",background:"#f8f6f0",color:"#20291f",fontFamily:"Arial, sans-serif"};
const card: CSSProperties = {maxWidth:560,width:"100%",padding:"48px 32px",border:"1px solid #dfd7c7",borderRadius:16,background:"white",boxShadow:"0 20px 70px #20291f0a"};
export default function FailurePanel({missing = false, retry}: {missing?: boolean; retry?: () => void}) {
  return <main style={page}><section style={card} aria-labelledby="failure-title">
    <a href="/" style={{color:"#20291f",textDecoration:"none",fontFamily:"Georgia,serif",fontSize:25}}>Avera Privé</a>
    <p style={{color:"#93733c",letterSpacing:3,fontSize:11,marginTop:40}}>{missing ? "PAGE NOT FOUND · 404" : "A MOMENT, PLEASE"}</p>
    <h1 id="failure-title" style={{fontFamily:"Georgia,serif",fontWeight:400,fontSize:38,lineHeight:1.15}}>{missing ? "This page has moved out of view." : "We couldn’t load this page."}</h1>
    <p style={{lineHeight:1.7,color:"#62675f"}}>{missing ? "The link may have changed, or the page is no longer available. Explore the directory to find your next connection." : "Please try again. If the problem continues, return home and come back shortly."}</p>
    <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:28}}>
      {retry && <button onClick={retry} style={{padding:"12px 20px",background:"#243222",color:"white",border:0,borderRadius:4,cursor:"pointer"}}>Try again</button>}
      <a href="/" style={{padding:"12px 0",color:"#243222"}}>Return home</a>
      <a href="/agencies.html" style={{padding:"12px 0",color:"#243222"}}>Browse agencies</a>
    </div>
  </section></main>;
}
