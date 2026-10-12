"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/authorization";

export async function acceptInvitation(
  invitationId: string
) {
  const { supabase } = await requireUser();

  const { data: agencyId, error } =
    await supabase.rpc(
      "ap_accept_agency_invitation",
      {
        target_invitation: invitationId,
      }
    );

  if (error) {
    redirect(
      `/agency/dashboard?invite_error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  if (!agencyId) {
    redirect(
      "/agency/dashboard?invite_error=The invitation could not be accepted."
    );
  }

  redirect(
    `/agency/dashboard/agencies/${agencyId}`
  );
}