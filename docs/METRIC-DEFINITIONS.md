# Avera Privé analytics definitions

These definitions are the product contract. Dashboard labels, SQL aggregation and reports must use the same denominator and time zone. Store timestamps in UTC and display the selected reporting time zone separately.

| Metric | Exact definition | Source of truth | Deduplication |
|---|---|---|---|
| Profile views | Count of accepted `profile_view` events for one approved agency | Validated interaction events | One event key; also report unique session views separately |
| Search appearances | Count of times an approved agency was actually included in a rendered search result set | `search_appearance` linked to a recorded search and agency | One event key per search plus agency; pagination creates a new appearance only when rendered |
| Creator searches | Count of accepted directory searches, including a filter-only search | `ap_analytics_searches` | One `search_key`; do not count every keystroke |
| Search → profile clicks | Count and rate of `search_profile_click` events | Search-linked interaction events | Clicks ÷ search appearances for the same agency and period; state both numerator and denominator |
| Profile → contact conversion | Submitted inquiries attributed to a profile divided by eligible profile views | `contact_submitted` plus profile views | Primary rate uses unique sessions; show starts separately from submitted contacts |
| Qualified leads | Inquiries changed to qualified by the trusted screening workflow | `lead_qualified` business event | One qualification event per lead state transition; reversals need a compensating event or current-state calculation |
| Lead acceptance | Qualified leads accepted by the agency divided by qualified leads offered to that agency | Trusted lead outcome events | One current outcome per agency and lead; define response window in reports |
| Free → paid conversion | Agencies on Free that become an active paid subscription in the period divided by eligible Free agencies at period start | Verified billing webhook and monthly subscription snapshot | First valid transition per agency and period; failed or abandoned checkout does not count |
| Agency retention | Paid agencies active at both the start and end of the period divided by paid agencies active at the start | Monthly subscription snapshots | Exclude trials and test subscriptions; state period and cohort |
| Agency churn | Paid agencies active at the start but inactive at the end divided by paid agencies active at the start | Monthly subscription snapshots | Cancellation intent alone does not count until paid access actually ends |

## Reporting requirements

- Every card displays the reporting range, time zone, data freshness and whether data is complete.
- Percentages show their numerator and denominator in a tooltip or detail view.
- Zero means a measured zero. An em dash means tracking is unavailable or incomplete.
- Compare periods only when both periods have equivalent tracking coverage.
- Test, staff, bot and monitoring traffic must be identified and excluded from production reports.
- Raw creator search text is private operational data. Agencies receive aggregate terms or categories only after privacy review and minimum-count thresholds.
- Paid placement performance is labelled and reported separately from organic discovery.

## Attribution

Keep original source fields on the inquiry and business event. Recommended views are:

- **Last meaningful platform touch:** the last Avera Privé surface before contact submission.
- **First platform touch:** the first known Avera Privé source in the consented session.
- **Direct profile:** contact submitted from an agency profile without a recorded search in that session.

Reports must name the attribution model. Do not combine models in one trend line.
