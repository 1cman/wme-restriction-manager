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

Select a segment and enter the wizard, explicitly select direction and lane, choose `BLOCKED`, `FREE`, or `TOLL`, then choose zero or more vehicle categories. For Alpha 7, test the green whitelist `ALLOWED` intent with explicit authorizations and a `BLOCKED` default; the blue `TOLL` intent still requires at least one exempt vehicle. Check that the summary correctly preserves your selections when going backward and forward. No save/apply action should exist.

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

## Alpha 7: ALLOWED means whitelist, not default allow (2026-11-23)

The earlier Alpha 6 erroneously represented **Transito consentito** with SDK `defaultType: FREE` and `BLOCKED` vehicle rules: that model permits **all traffic except selected vehicle types**. The expected WME **Permesso / Driving is Allowed for** behavior is the opposite: the base must be **`BLOCKED`** and the explicitly authorized criteria receive **`FREE`** overrides. See [official Waze editor guide](https://www.waze.com/discuss/t/restrizioni-orarie/376323), [SDK SegmentRestriction](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.SegmentRestriction.html), and [Waze restrictions training discussion](https://www.waze.com/discuss/t/level-up-your-editing-advanced-training-on-segment-restrictions-now-live/382923).

Alpha 7 separates **wizard intents** from **SDK defaultType enum values**:

| Wizard card / intent | Proposed SDK default | Proposed SDK override | Draft validation |
| --- | --- | --- | --- |
| Red: `BLOCKED`, Transito vietato | `BLOCKED` | optional `FREE` exceptions | Can omit exceptions |
| Green: `ALLOWED`, Transito consentito *solo agli autorizzati* | `BLOCKED` | `FREE` for allowed criteria | **Alpha 8:** at least one authorized vehicle type is mandatory; passes and occupancy are additional, optional draft conditions |
| Blue: `TOLL`, Transito a pedaggio | `TOLL` | `FREE` exemptions | Existing vehicle-exemption requirement retained |

`ALLOWED` **is an internal wizard intent, not an SDK RESTRICTION_TYPE**. Never submit it or mistake it for SDK `FREE`. Green and red currently share a BLOCKED base but have different draft intent and validation; the green flow is an explicit whitelist. The green vehicle step says **choose vehicles to authorize**, not vehicles to prohibit. Other traffic remains blocked. **Historical note:** Alpha 7 allowed progression without a selected vehicle type; Alpha 8 supersedes this behavior and requires at least one authorized vehicle. Changing the intent clears existing vehicle and advanced draft selections to avoid accidental authorizations.

In the summary, show the SDK `BLOCKED` base and `FREE` exemptions, plus a prominent note that all other traffic is blocked. Because the current draft does not model native AND/OR groups, combining vehicle types, permits and passenger counts **does not yet establish the exact eligibility logic in WME**. Country-specific license plate options remain unavailable pending native verification. There is still **no WME write, apply, save or preset creation** in this Alpha. The stable script is untouched.

Testing: select the green intent, choose PRIVATE and EV, and confirm the summary shows a BLOCKED default and FREE authorizations (not a FREE default with BLOCKED exceptions). In Alpha 8, verify that the green intent **cannot proceed without at least one selected vehicle**, irrespective of permits or occupancy. Test red and blue flows for regression and both WME Standard and Beta. Waze editors have reported routing risks if e.g. PRIVATE is allowed but EV is omitted from whitelist; use native restrictions with care.

## Alpha 8: vehicle selection required and alphabetic permit typeahead (2026-11-23)

Following WME editor testing, the green **Transito consentito** whitelist now **always requires at least one selected vehicle type** before proceeding. A permit or minimum occupancy can no longer replace that step. Both the disabled Next button and the Next handler enforce the requirement, and the read-only draft validator independently rejects an empty whitelist. Red `BLOCKED` continues to allow no vehicle exceptions; blue `TOLL` retains its existing vehicle-exemption requirement. The earlier Alpha 7 allowance for a pass-only or occupancy-only whitelist is intentionally retired.

The Advanced conditions step now offers a **searchable pass list with autocomplete**:
- The visible checklist is alphabetically sorted by pass name using the active editor UI language's locale, with stable ID tie-breaking; the SDK result is not mutated.
- Search ignores letter case and accents, filters the checklist as you type, and offers a dropdown of alphabetically ordered suggestions (up to 8). Keyboard arrows navigate suggestions, Enter toggles the highlighted (or first) pass, Escape clears the search.
- Selecting an autocomplete suggestion or clicking a checkbox updates the **same persistent set of selected permit IDs**; searching or clearing the input does not drop earlier selections. A live count shows the selected total.
- No hardcoded Italian pass list. The values still come from `sdk.DataModel.Countries.getById({countryId})` for the **segment's** country. If unavailable, the UI shows an unknown-list message rather than offering guessed passes.
- The experiment remains **read-only**: it does not apply restrictions, generate actual SDK write payloads, modify presets, or use local/cloud storage. Country eligibility, compound AND/OR matching, and plate restrictions are not yet verified.

**Test:** choose green and confirm Next stays disabled with no selected vehicle even if previously selected pass/occupancy exists; select a vehicle and continue. On the pass screen inspect alphabetical names, type a substring or an accent-free version of an accented name, use autocomplete by mouse and Enter, select multiple passes, clear search and confirm selections persist. Validate Standard and Beta WME.

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
