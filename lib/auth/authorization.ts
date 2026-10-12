import { needsPasswordChange } from "./platform-access";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AgencyRole = "owner" | "admin" | "editor" | "analyst" | "billing";
export type StaffRole = "super_admin" | "moderator" | "verification_reviewer" | "support" | "finance";

// Check database roles, never user-editable account metadata. Accounts without
// a membership can still finish onboarding or accept an agency invitation.
export async function getAgencyPortalAccessError(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: staffRoles, error } = await supabase
    .from("ap_staff_roles")
    .select("role")
    .eq("user_id", userId);

  // Fail closed: an unavailable role lookup must not grant agency access.
  if (error || !staffRoles) {
    return "Your account access could not be verified. Please try again.";
  }

  if (staffRoles.length > 0) {
    return "Platform staff accounts cannot access the agency portal. Please use the owner login with your platform account, or a separate agency account.";
  }

  return null;
}

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/agency/login");

  const accessError = await getAgencyPortalAccessError(supabase, user.id);
  if (accessError) {
    redirect(`/forbidden?portal=agency&error=${encodeURIComponent(accessError)}`);
  }

  return { supabase, user };
}

export async function requireAgencyRole(agencyId: string, allowed: AgencyRole[]) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("ap_agency_memberships")
    .select("role,status")
    .eq("agency_id", agencyId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!data || !allowed.includes(data.role as AgencyRole)) {
    redirect("/forbidden?portal=agency");
  }

  return { supabase, user, role: data.role as AgencyRole };
}

export async function requireStaffRole(allowed: StaffRole[], options: { allowPasswordSetup?: boolean } = {}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/owners/login");

  const { data, error } = await supabase
    .from("ap_staff_roles")
    .select("role")
    .eq("user_id", user.id);

  const role = data
    ?.map((item) => item.role as StaffRole)
    .find((item) => allowed.includes(item));

  if (error || !role) redirect("/forbidden?portal=owner");

  if (!options.allowPasswordSetup && needsPasswordChange(user.app_metadata)) redirect("/owners/account");

  return { supabase, user, role };
}