"use strict";
// Use the same public, curated API as the agency directory.
document.addEventListener("DOMContentLoaded", async () => {
  const count = document.getElementById("directoryIndexCount");
  const heading = document.getElementById("directoryIndexHeading");
  const description = document.getElementById("directoryIndexDescription");
  if (!count || !heading || !description) return;
  try {
    const response = await fetch("/api/public-agencies", { cache: "no-store" });
    if (!response.ok) throw new Error("Directory unavailable");
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid directory response");
    const agencies = data.filter(agency => agency && agency.status === "approved"
      && agency.published === true && agency.demoProfile !== true
      && /^[a-z0-9_-]{1,80}$/i.test(String(agency.slug || "")));
    const total = agencies.length;
    count.textContent = String(total);
    heading.textContent = total === 0 ? "No approved agencies yet"
      : `${total} approved ${total === 1 ? "agency" : "agencies"} in the directory`;
    description.textContent = total === 0
      ? "Approved agency profiles will appear in the directory once published."
      : "Explore published agency profiles in the directory. Directory inclusion does not assign a review rank or verification badge.";
  } catch {
    count.textContent = "—";
    heading.textContent = "Agency index unavailable";
    description.textContent = "We could not load the directory count. Refresh this page to try again.";
  }
});
