"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {passwordError} from "@/lib/auth/platform-access";
export async function savePassword(form:FormData){
 const supabase=await createClient();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user) redirect("/forgot-password?error=Request%20a%20new%20recovery%20link.");
 const password=String(form.get("password")||""), confirmation=String(form.get("confirmation")||"");
 const invalid=passwordError(password,confirmation);
 if(invalid) redirect(`/reset-password?error=${encodeURIComponent(invalid)}`);
 const result=await supabase.auth.updateUser({password});
 if(result.error) redirect("/reset-password?error=Password%20could%20not%20be%20updated.%20Try%20a%20different%20password%20or%20request%20a%20new%20link.");
 const signedOut=await supabase.auth.signOut({scope:"global"});
 if(signedOut.error) {await supabase.auth.signOut({scope:"local"});redirect("/forgot-password?error=Password%20updated.%20Session%20revocation%20could%20not%20be%20confirmed.%20Contact%20support.");}
 redirect("/reset-password?done=1");
}
