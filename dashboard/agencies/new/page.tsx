import Link from "next/link";
import { createAgencyDraft } from "../actions";
import { requireUser } from "@/lib/auth/authorization";
import { AgencyWorkspaceShell } from "../../_components/portal-shells";

export default async function NewAgencyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user } = await requireUser();
  const params = await searchParams;
  return <AgencyWorkspaceShell email={user.email}><main className="workflow-main">
    <div className="workflow-breadcrumb"><Link href="/agency/dashboard">WORKSPACE</Link><span>／</span><b>CREATE PROFILE</b></div>
    <header className="workflow-header"><div><p>PRIVATE PROFILE SETUP</p><h1>Create your agency.</h1><span>Start with your identity and preferred public URL. You can complete the full profile privately before submitting it for moderation.</span></div><div className="workflow-progress"><span>STEP 1 OF 3</span><div><i /></div><small>Agency foundation</small></div></header>
    <div className="workflow-layout">
      <form className="workflow-form" action={createAgencyDraft}>
        <div className="workflow-form-head"><span>01</span><div><h2>Agency identity</h2><p>Use the name clients and creators recognize publicly.</p></div></div>
        {params.error && <p className="workflow-alert" role="alert">{params.error}</p>}
        <label><span>LEGAL OR TRADING NAME <b>REQUIRED</b></span><input name="name" required minLength={2} placeholder="Example: Northstar Talent Management" /><small>You can update this later before moderation.</small></label>
        <label><span>PREFERRED PROFILE URL</span><div className="workflow-slug"><i>agencyprive.com/agencies/</i><input name="slug" placeholder="northstar-talent" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></div><small>Lowercase letters, numbers, and hyphens only. Leave blank to generate it automatically.</small></label>
        <div className="workflow-private-note"><span>◆</span><div><b>Your draft stays private</b><p>Creating this profile does not publish it or grant verification. You control when it is ready for moderation.</p></div></div>
        <div className="workflow-actions"><Link href="/agency/dashboard">CANCEL</Link><button>CREATE PRIVATE DRAFT <span>→</span></button></div>
      </form>
      <aside className="workflow-aside"><p>WHAT HAPPENS NEXT</p><ol><li><span>01</span><div><b>Complete your profile</b><small>Add services, location, website, niches, and agency positioning.</small></div></li><li><span>02</span><div><b>Submit for moderation</b><small>Our trust team checks quality, accuracy, and policy compliance.</small></div></li><li><span>03</span><div><b>Choose when to publish</b><small>Approval and public visibility remain separate decisions.</small></div></li></ol><div><b>Need help?</b><p>Use accurate business information. Profiles that are specific and complete move through review more efficiently.</p></div></aside>
    </div>
  </main></AgencyWorkspaceShell>;
}
