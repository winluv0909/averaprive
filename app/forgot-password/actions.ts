"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
export async function requestReset(form:FormData){
 const email=String(form.get("email")||"").trim();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)) redirect("/forgot-password?error=Enter%20a%20valid%20email%20address.");
 const base=process.env.NEXT_PUBLIC_SITE_URL;
 if(!base) redirect("/forgot-password?error=Recovery%20is%20temporarily%20unavailable.%20Contact%20support.");
 const callback=new URL("/auth/recovery",base);
 if(callback.protocol!=="https:" && callback.hostname!=="localhost") redirect("/forgot-password?error=Recovery%20is%20temporarily%20unavailable.%20Contact%20support.");
 const supabase=await createClient();
 await supabase.auth.resetPasswordForEmail(email,{redirectTo:callback.toString()});
 redirect("/forgot-password?sent=1");
}
