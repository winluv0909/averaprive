import RecoveryShell from "../forgot-password/RecoveryShell";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {savePassword} from "./actions";
import "../forgot-password/recovery.css";
export const metadata={title:"Set a new password",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const p=await searchParams;
 if(!p.done){const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user)redirect("/forgot-password?error=Open%20your%20recovery%20link%20first.");}
 return <RecoveryShell><p className="recovery-kicker">SECURE ACCOUNT ACCESS</p><h1>{p.done?"You’re ready.":<>A new password.<br/>A fresh start.</>}</h1>{p.done?<p className="recovery-intro" role="status">If you’ve just completed your reset, sign in below using your new password.</p>:<><p className="recovery-intro">Choose a unique password between 12 and 128 characters to protect your workspace.</p>{p.error&&<p className="recovery-alert" role="alert">{p.error}</p>}<form action={savePassword}><label htmlFor="new-password">NEW PASSWORD</label><input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/><label htmlFor="confirm-password">CONFIRM NEW PASSWORD</label><input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/><button>Save new password <span>→</span></button></form></>}</RecoveryShell>;
}
