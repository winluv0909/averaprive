"use server";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";

function value(data: FormData, key: string) { return String(data.get(key) || "").trim(); }
export async function saveEditorialPost(postId: string | null, formData: FormData) {
  const { supabase } = await requireStaffRole(["super_admin", "moderator"]);
  let coverUrl = value(formData,"existing_cover_url"); const file = formData.get("cover_image");
  if (file instanceof File && file.size) {
    if (file.size > 8388608 || !["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) redirect("/owners/dashboard/editorial?error=Invalid+cover+image");
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"; const path = `${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("editorial-media").upload(path, file, { contentType:file.type, upsert:false });
    if (uploadError) redirect(`/owners/dashboard/editorial?error=${encodeURIComponent(uploadError.message)}`);
    coverUrl = supabase.storage.from("editorial-media").getPublicUrl(path).data.publicUrl;
  }
  const publishAt = value(formData,"publish_at");
  const { data: savedId, error } = await supabase.rpc("ap_save_editorial_post", { post_id:postId||null, post_title:value(formData,"title"), post_slug:value(formData,"slug"), post_type:value(formData,"content_type"), post_category:value(formData,"category"), post_summary:value(formData,"summary"), post_body:value(formData,"body"), post_tags:value(formData,"tags").split(",").map(x=>x.trim()).filter(Boolean), post_author:value(formData,"author_name"), post_cover_url:coverUrl, post_cover_alt:value(formData,"cover_image_alt"), post_seo_title:value(formData,"seo_title"), post_seo_description:value(formData,"seo_description"), post_canonical:value(formData,"canonical_url"), post_status:value(formData,"status"), post_disclosure:value(formData,"commercial_disclosure"), post_publish_at:publishAt?new Date(publishAt).toISOString():null });
  if (error) redirect(`/owners/dashboard/editorial${postId?`/${postId}`:"/new"}?error=${encodeURIComponent(error.message)}`);
  redirect(`/owners/dashboard/editorial/${savedId}?saved=1`);
}
