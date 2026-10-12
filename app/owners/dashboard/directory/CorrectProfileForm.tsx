import { correctProfile } from "./actions";
import { claimProfileSnapshot } from "@/lib/agencies/claim-profile";
export default function CorrectProfileForm({ agency }: { agency: Record<string, unknown> }) {
  const details = agency.directory_information && typeof agency.directory_information === "object" ? agency.directory_information as Record<string, unknown> : {};
  return <details><summary>Correct this agency&apos;s information before approval</summary>
    <form action={correctProfile.bind(null, String(agency.id))}>
      <input type="hidden" name="profile_snapshot" value={JSON.stringify(claimProfileSnapshot(agency))} />
      <label>Agency name<input name="name" defaultValue={String(agency.name ?? "")} required minLength={2} maxLength={160} /></label>
      <label>Official website<input name="website" type="url" pattern="https://.*" defaultValue={String(agency.website_url ?? "")} required /></label>
      <label>Country<input name="country" defaultValue={String(agency.country ?? "")} /></label>
      <label>City<input name="city" defaultValue={String(agency.city ?? "")} /></label>
      <label>About<textarea name="about" defaultValue={String(agency.about ?? "")} required minLength={40} /></label>
      <label>Services, one per line<textarea name="services" defaultValue={Array.isArray(agency.services) ? agency.services.join("\n") : ""} /></label>
      {[["legal_name", "Legal entity"], ["registration_number", "Company registration"], ["registered_address", "Registered address"], ["public_email", "Public contact email"], ["public_phone", "Public phone"]].map(([key, label]) => <label key={key}>{label}<input name={key} defaultValue={String(details[key] ?? "")} /></label>)}
      <label>Official source supporting corrections<input name="source" type="url" pattern="https://.*" required /></label>
      <label>What you checked<textarea name="note" minLength={10} required /></label>
      <button type="submit">Save reviewed corrections</button>
    </form>
  </details>;
}
