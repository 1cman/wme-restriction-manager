# Restriction Manager 4.0 — Guided Creator roadmap

## Alpha 1 (isolated, read-only)

Install the separate userscript in alpha/Restriction_Manager_Guided_Alpha.user.js alongside stable Restriction Manager. The script namespace and SDK ID differ. It does not write map data, save presets, access storage or connect to cloud services. It is not a stable release.

Select exactly one segment in WME Standard or Beta. Open RM Guided Alpha in the scripts sidebar. Check country, existing restriction count and native button detection. If the native Add restrictions control is uniquely detectable by its exact localized label, a separate Create guided restriction button is inserted alongside it. Otherwise use the sidebar fallback. Walk through direction, full segment or lane scope, and lane design choice. Scope and lane choices are **proposals only**, not validated SDK enum values or country-specific permissions. No writes can be made at the summary.

## Acceptance criteria before real editing

- Read country from the selected segment address, independently of UI language and editor location.
- Discover and verify native WME eligibility for each country, segment, travel direction, user permission, restriction kind, vehicle category and condition. No hardcoded Italy-only policy. Unknown capability means no write. Mixed-country selections require individual validation.
- Entire segment or left / center / right lane, relative to the selected traffic direction. Preserve actual SDK laneScope/laneType values; verify Express, Fast, HOV, public transport and toll-free carpool against WME. Never treat a design label as an SDK value.
- Match all native restriction types and supported condition combinations, including locally supported vehicle rules, permits/subscriptions, occupancy, plate rules and motorcycle engine conditions wherever available. Preserve unsupported or noneditable existing conditions; do not silently drop data. Experimental internal APIs remain opt-in and must have fallbacks.
- Add scheduling guided by intent, reuse the existing SAFE12 engine, preserve unrelated restrictions and stop if the total operation would exceed 12 restrictions or 12 time-frame definitions. Recheck selection and current map state before any write, show complete before/after preview, require editor confirmation and manual WME save. Test Standard and Beta.
- Save complete preset/calendar only on explicit choice, preserve old backups and six UI languages.
- Later: personal local archive, save-confirmation reconciliation, permissibility review with Waze before optional cloud storage, least-privilege Google authorization, expiration notifications and explicitly confirmed renewal.

## Test

Run node tests/guided-alpha.cjs in this branch. These are isolated tests, not a live WME integration test. The prototype cannot establish country-specific availability or detect every native layout. For live testing, report WME environment, locale, country name, whether the native button appears, and the available labels from the native restriction panel (redact private information).
