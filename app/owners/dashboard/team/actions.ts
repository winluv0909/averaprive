"use server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/lib/auth/authorization";
import { isPlatformRole, passwordError } from "@/lib/auth/platform-access";
export async function createStaff(form: FormData) {
  const { user } = await requireStaffRole(["super_admin"]);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("temporary_password") || "");
  const role = String(form.get("role") || "");
  if (!isPlatformRole(role) || role === "super_admin" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || passwordError(password,password)) redirect("/owners/dashboard/team?error=Use%20a%20valid%20email,%20staff%20role,%20and%20temporary%20password%20of%2012%E2%80%93128%20characters.");
  const db = createAdminClient();
  const result = await db.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{platform_password_change_required:true}});
  if (result.error || !result.data.user) redirect("/owners/dashboard/team?error=Account%20creation%20failed.%20The%20email%20may%20already%20be%20registered%20or%20the%20password%20may%20not%20meet%20your%20policy.");
  const assigned = await db.from("ap_staff_roles").insert({user_id:result.data.user.id,role,granted_by:user.id});
  if (assigned.error) {
    // Roll back this new account only, never an existing account.
    const rollback = await db.auth.admin.deleteUser(result.data.user.id);
    redirect(`/owners/dashboard/team?error=${encodeURIComponent(rollback.error ? "Role assignment failed. An account without platform permissions remains; ask the administrator to remove it." : "Role assignment failed. The new account was rolled back; no platform access was granted.")}`);
  }
  redirect("/owners/dashboard/team?created=1");
}
