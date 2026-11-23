# Restriction Manager 4.0 — Guided Creator roadmap

## Alpha 4 (isolated, read-only)

Install the separate userscript in alpha/Restriction_Manager_Guided_Alpha.user.js alongside stable Restriction Manager. The script namespace and SDK ID differ. It does not write map data, save presets, access storage or connect to cloud services. It is not a stable release.

Select exactly one segment in WME Standard or Beta. Open RM Guided Alpha in the scripts sidebar. Check country, existing restriction count and native button detection. If the native Add restrictions control is uniquely detectable by its exact localized label, a separate Create guided restriction button is inserted alongside it. Otherwise use the sidebar fallback. Walk through direction, full segment or lane scope, and lane design choice. Scope and lane choices are **proposals only**, not validated SDK enum values or country-specific permissions. No writes can be made at the summary.

## WME native UI evidence — Italian editor, 2026-11-23

Initial live testing confirmed the read-only Alpha starts successfully and the guided controls work. The editor supplied screenshots from WME of two **separate** native dropdowns:

- **Ambito / disposizione:** `Corsia di sinistra`, `Corsia centrale`, `Nessuna`, `Corsia di destra`, `Intero Segmento`.
- **Tipologia:** `Nessuno`, `Express`, `Fast`, `HOV`, `Mezzi Pubblici`, `No pedaggio per Carpool`.

**Do not conflate** `Nessuna` (scope) with `Intero Segmento` or `Nessuno` (lane type). Their exact SDK values and availability by country are not yet verified; these labels are evidence for an Italian WME context only.

A subsequent editor screenshot confirmed WME's red validation message **«Seleziona una corsia per applicare la restrizione»** when the scope remains **Nessuna**. In Alpha 3 the `Nessuna` scope is therefore **hidden** from the wizard: no scope is preselected, a red accessible warning appears and the **Next** button is disabled until the editor explicitly chooses `Intero Segmento` or one of the three lanes. Validation is repeated inside the Next handler and when normalizing the draft. In contrast, `Nessuno` in the **lane-type** dropdown remains a valid, separate selection. The wizard still does not write to WME.

This is a UI parity prototype, **not** an authorization to write the design values into WME. The next phase must verify the typed enum values for the native panel, and country/user permissions before enabling edits.

## Alpha 4: guided restriction type and vehicle exceptions (2026-11-23)

The wizard now continues beyond direction/scope/lane type:

1. **Type of default restriction**: `BLOCKED`, `FREE` or `TOLL` (as documented for segment restriction rules).
2. **Vehicle exceptions**: multiselect from the 15 documented `VehicleType` SDK values, with explanations of how default restrictions and overrides interact.
3. **Read-only summary**: indicates the primary rule, the override rule and selected vehicle categories; clearly marks the result **unverified** and does not write map data.

### SDK rule semantics

- `BLOCKED`: all vehicles blocked by default; optional `FREE` exceptions.
- `FREE`: vehicles allowed by default; at least one `BLOCKED` rule required.
- `TOLL`: toll by default; at least one `FREE` exception required.

For now each selected vehicle type represents a proposed rule exception. **Country eligibility, lane-type combinations, license plate rules, motorcycle engine limits, compound AND/OR conditions and remaining WME restriction kinds are not yet supported by this prototype.** Occupancy and country permits are available only as read-only draft choices in Alpha 6; this does not establish editing eligibility or an SDK serialization format. The full matrix remains part of the acceptance criteria before enabling real writes. Current dropdowns are a generic SDK catalogue, not a guarantee that an editor can apply them in the current country.

Sources consulted:
- [WME SDK SegmentRestriction](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.SegmentRestriction.html)
- [WME SDK VehicleType](https://web-assets.waze.com/wme_sdk_docs/production/latest/types/index.SDK.VehicleType.html)
- [WME SDK RESTRICTION_TYPE](https://web-assets.waze.com/wme_sdk_docs/beta/latest/variables/index.SDK.RESTRICTION_TYPE.html)

### Test protocol

Select a segment and enter the wizard, explicitly select direction and lane, choose `BLOCKED`, `FREE`, or `TOLL`, then choose zero or more vehicle categories. Check that `FREE` and `TOLL` require at least one override vehicle. Check that the summary correctly preserves your selections when going backward and forward. No save/apply action should exist.

## Alpha 5–6: restriction colors and advanced draft (2026-11-23)

- **Alpha 5:** Restriction type options are shown as softly colored cards: red (BLOCKED), green (FREE) and blue (TOLL). Selection is indicated by a stronger shade and border. These are approximate interface colors, not sampled WME CSS variables.
- **Alpha 6:** Add a read-only **Advanced conditions** step between vehicle exceptions and summary. An optional `minPassengers` draft accepts empty or an integer of at least 2. It is a proposal and **not yet mapped to WME vehicle rules or verified for the local country**.
- The permit checklist is read from `sdk.DataModel.Countries.getById({countryId})` using the **selected segment's country** and its `restrictionSubscriptions` list (each item has an `id` and `name`). No Italian-specific list or current-editor-location fallback is used. SDK failures/unavailable country return an unknown state (not an empty list); unknown permit IDs are rejected by draft validation.
- License plate conditions remain explicitly unavailable in the Alpha pending native verification. Motorcycle-specific parameters and condition combination logic are also still out of scope.
- The summary displays occupancy and selected permit names without creating an SDK restriction payload, saving presets, modifying WME, reading browser storage or exporting data. Invalid conditions and changes to the segment country/permit list block advancement. The stable 3.2 branch is unchanged.

Sources:
- [SDK Country.restrictionSubscriptions](https://www.waze.com/editor/sdk/interfaces/index.SDK.Country.html)
- [SDK Countries.getById](https://web-assets.waze.com/wme_sdk_docs/production/latest/classes/index.SDK.Countries.html)
- [SDK Subscription](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.Subscription.html)
- [SDK DriveProfileAttributes](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.DriveProfileAttributes.html)

**Manual test:** Select a single segment and traverse the guided wizard. In Advanced conditions, leave occupancy blank, enter 2 (then 3), try an invalid fractional value, and inspect the available passes. All choices must appear in the read-only summary. Confirm that the pass list belongs to the segment country rather than the editor language and that no Save/Apply action appears. Validate both WME Standard and Beta.

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
