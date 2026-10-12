"use client";
import { useEffect, useState } from "react";
import BillingCycleSelector from "./BillingCycleSelector";
interface Plan {code:string;name:string;monthly_price_usd:number;annual_price_usd:number|null;}
export default function PlanSelection({plans,initial}:{plans:Plan[];initial:string}) {
  const [code,setCode]=useState(initial);
  const plan=plans.find(p=>p.code===code)||plans[0];
  useEffect(()=>{document.querySelectorAll<HTMLElement>("[data-checkout-plan-name]").forEach(el=>{el.textContent=plan.name;});},[plan.name]);
  return <div className="reliable-plan-selection"><label>2. Subscription plan<select name="plan" value={code} onChange={event=>setCode(event.target.value)}>{plans.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></label><BillingCycleSelector key={code} monthlyPrice={Number(plan.monthly_price_usd)} annualPrice={Number(plan.annual_price_usd)} /></div>;
}
