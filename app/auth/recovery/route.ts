import {NextResponse,type NextRequest} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(request:NextRequest){
 const params=request.nextUrl.searchParams,code=params.get("code"),hash=params.get("token_hash");
 const invalid=()=>NextResponse.redirect(new URL("/forgot-password?error=The%20link%20is%20invalid%20or%20expired.%20Request%20a%20new%20one.",request.url));
 if(!code&&!(hash&&params.get("type")==="recovery"))return invalid();
 try {
  const supabase=await createClient();
  const result=code?await supabase.auth.exchangeCodeForSession(code):await supabase.auth.verifyOtp({token_hash:hash!,type:"recovery"});
  if(result.error||!result.data.user)return invalid();
 } catch { return invalid(); }
 return NextResponse.redirect(new URL("/reset-password",request.url));
}
