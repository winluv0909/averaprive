"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
export default function PaymentRefresh({url,paid}:{url:string;paid:boolean}) {
  const router=useRouter();const [error,setError]=useState(false);
  useEffect(()=>{
    if(paid) return;
    const controller=new AbortController(); let busy=false;
    const timer=setInterval(async()=>{
      if(busy || document.hidden) return;busy=true;
      try {const response=await fetch(url,{cache:"no-store",signal:controller.signal});if(!response.ok || response.redirected) throw new Error("Unavailable");await response.json();setError(false);router.refresh();} catch {if(!controller.signal.aborted)setError(true);} finally{busy=false;}
    },10000);
    return ()=>{clearInterval(timer);controller.abort();};
  },[url,paid,router]);
  return <p role="status">{paid?"Payment confirmed. Your subscription is active.":error?"Status refresh unavailable. Reload the page; this does not mean payment succeeded.":"Status refreshes automatically every 10 seconds."}</p>;
}
