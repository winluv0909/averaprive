"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
export async function requestReset(form:FormData){
 const email=String(form.get("email")||"").trim();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)) redirect("/forgot-password?error=Enter%20a%20valid%20email%20address.");
 const base=process.env.NEXT_PUBLIC_SITE_URL;
 if(!base) redirect("/forgot-password?error=Recovery%20is%20temporarily%20unavailable.%20Contact%20support.");
 let callback:URL;
 try {
   const origin=new URL(base);
   if(origin.username||origin.password||origin.search||origin.hash||!(origin.protocol==="https:"||(process.env.NODE_ENV!=="production"&&origin.protocol==="http:"&&["localhost","127.0.0.1"].includes(origin.hostname)))) throw new Error("Invalid origin");
   callback=new URL("/auth/recovery",origin.origin);
 } catch { redirect("/forgot-password?error=Recovery%20is%20temporarily%20unavailable.%20Contact%20support."); }
 if(callback.protocol!=="https:" && !["localhost","127.0.0.1"].includes(callback.hostname)) redirect("/forgot-password?error=Recovery%20is%20temporarily%20unavailable.%20Contact%20support.");
 const supabase=await createClient();
 // Keep account eligibility private even when the upstream service throws.
 try { await supabase.auth.resetPasswordForEmail(email,{redirectTo:callback.toString()}); } catch { /* Same neutral result; delivery is verified through Auth/provider logs. */ }
 redirect("/forgot-password?sent=1");
}
