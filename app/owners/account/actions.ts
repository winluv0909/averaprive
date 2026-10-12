"use server";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";
import { passwordError, platformRoles } from "@/lib/auth/platform-access";

export async function changePassword(form: FormData) {
  const { supabase, user } = await requireStaffRole([...platformRoles], { allowPasswordSetup: true });
  const current = String(form.get("current_password") || "");
  const password = String(form.get("password") || "");
  const confirmation = String(form.get("confirmation") || "");
  const error = passwordError(password, confirmation);
  if (error || !current || current === password) redirect(`/owners/account?error=${encodeURIComponent(error || "Enter your current password and choose a different new password.")}`);
  if (!user.email) redirect("/owners/account?error=Your%20account%20email%20is%20unavailable.");
  const reauth = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (reauth.error || reauth.data.user?.id !== user.id) redirect("/owners/account?error=Your%20current%20password%20could%20not%20be%20verified.");
  const result = await supabase.auth.updateUser({ password });
  if (result.error) redirect("/owners/account?error=Password%20could%20not%20be%20updated.%20Check%20the%20password%20policy%20and%20try%20again.");
  // Sign out all sessions after rotation so the temporary password session is not retained.
  await supabase.auth.signOut({ scope: "global" });
  redirect("/owners/login?changed=1");
}
