"use server";

import { redirect } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";

function returnWithMessage(
  agencyId: string,
  key: string,
  value: string
): never {
  redirect(
    `/agency/dashboard/agencies/${agencyId}/team?${key}=${encodeURIComponent(value)}`
  );
}

export async function inviteMember(
  agencyId: string,
  formData: FormData
) {
  const { supabase } = await requireAgencyRole(agencyId, ["owner"]);

  const email = String(formData.get("email") || "").trim();
  const role = String(formData.get("role") || "editor");

  const { error } = await supabase.rpc("ap_invite_agency_member", {
    target_agency: agencyId,
    invite_email: email,
    invite_role: role,
  });

  if (error) {
    returnWithMessage(agencyId, "error", error.message);
  }

  returnWithMessage(agencyId, "invited", "1");
}

export async function manageMember(
  agencyId: string,
  membershipId: string,
  formData: FormData
) {
  const { supabase } = await requireAgencyRole(agencyId, ["owner"]);

  const role = String(formData.get("role") || "editor");
  const status = String(formData.get("status") || "active");

  const { error } = await supabase.rpc("ap_manage_agency_member", {
    target_agency: agencyId,
    target_membership: membershipId,
    next_role: role,
    next_status: status,
  });

  if (error) {
    returnWithMessage(agencyId, "error", error.message);
  }

  returnWithMessage(agencyId, "updated", "1");
}

export async function cancelInvitation(
  agencyId: string,
  invitationId: string
) {
  const { supabase } = await requireAgencyRole(agencyId, ["owner"]);

  const { error } = await supabase.rpc(
    "ap_cancel_agency_invitation",
    {
      target_agency: agencyId,
      target_invitation: invitationId,
    }
  );

  if (error) {
    returnWithMessage(agencyId, "error", error.message);
  }

  returnWithMessage(agencyId, "cancelled", "1");
}