import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "../../_components/portal-shells";
import { EditorialForm } from "../editorial-form";
export default async function NewEditorialPage({searchParams}:{searchParams:Promise<{error?:string}>}){const {user}=await requireStaffRole(["super_admin","moderator"]);const params=await searchParams;return <OwnerOperationsShell active="editorial" email={user.email}><main className="editorial-editor"><Link href="/owners/dashboard/editorial">← EDITORIAL LIBRARY</Link><div className="editorial-editor-head"><p>NEW EDITORIAL POST</p><h1>Build the next edition.</h1></div>{params.error&&<p className="operation-error">{params.error}</p>}<EditorialForm /></main></OwnerOperationsShell>}
