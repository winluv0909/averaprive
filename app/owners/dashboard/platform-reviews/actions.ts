"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaffRole } from "@/lib/auth/authorization";

export async function moderatePlatformReview(
  id: string,
  decision: "approved" | "rejected",
  form: FormData,
) {
  const { supabase } = await requireStaffRole(["super_admin"]);

  const { error } = await supabase.rpc(
    "ap_moderate_platform_review",
    {
      target_review: id,
      decision,
      explanation: String(form.get("note") ?? ""),
      expected_revision: Number(form.get("revision")),
    },
  );

  revalidatePath("/platform-reviews");
  revalidatePath("/owners/dashboard/platform-reviews");

  redirect(
    `/owners/dashboard/platform-reviews?${
      error
        ? `error=${encodeURIComponent(error.message)}`
        : "saved=1"
    }`,
  );
}