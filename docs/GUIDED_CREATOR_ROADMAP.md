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

## Alpha 9: independent conditions per authorized vehicle (2026-11-23)

The green `ALLOWED` (permit-only / whitelist) intent still requires selecting **at least one vehicle type**. On the **next step**, each selected vehicle receives its own independent controls:

- **Requires a permit**: only this vehicle needs a selected permit; that vehicle gets an independent country-permit checklist with alphabetical ordering and accent-insensitive autocomplete. Enabling this requirement without choosing a pass blocks Next.
- **Requires minimum occupancy**: only this vehicle needs an integer minimum of at least 2; an enabled requirement without a valid number blocks Next.
- **Neither checkbox enabled**: this vehicle is **directly authorized**, without inheriting a permit or occupancy rule selected for another vehicle.
- Both checked: both conditions are recorded for this vehicle as a **design proposal**, but combinations / AND-OR semantics and native WME eligibility remain unverified.

Example: select `PRIVATE`, `MOTORCYCLE`, `EV` and `HYBRID`. Enable *Requires a permit* with a chosen pass **only** for `PRIVATE` and `MOTORCYCLE`. Leave `EV` and `HYBRID` without additional requirements. The summary must show the first two as **CONDITIONAL** and the other two as **DIRECT**, and must not display a shared permit applying to all four. The default underlying restriction model remains `BLOCKED` with proposed `FREE` exceptions for authorized traffic.

The per-vehicle draft has independent `requiresPass`, `permitIds`, `requiresOccupancy`, and `minPassengers` state. Deselecting a vehicle discards its conditions, so reselecting it creates a clean direct-authorization state. Changing the restriction intent clears all per-vehicle conditions. Pure validation rejects unselected/stale vehicle rules, unrecognized country passes, required passes with no selection, and invalid or inactive occupancy requirements. The read-only summary now displays requirements **per vehicle**; red `BLOCKED` and blue `TOLL` retain their prior Advanced conditions UI.

**Important limitation:** This is a UI and read-only draft model, not proof that WME's routing engine can represent the example through independent rules without overlap. Categories such as private, electric and hybrid may have intersecting real-world interpretations; exact semantics, rule precedence, SDK serialization and supported country combinations must be verified in WME before enabling any write. No map changes or presets are saved.

**Manual testing:** Use the exact four-type example above. Verify no condition is inherited by EV/HYBRID, Next blocks only when a requirement was enabled without a valid value, the independent pass autocomplete works, returning to earlier steps preserves matching vehicle conditions, and deselect/reselect clears stale conditions. Check WME Standard and Beta.

## License plate restricted zones: official Waze app coverage (2026-11-23)

Official user-facing help: [Navigate in license plate restricted zones](https://support.google.com/waze/answer/7666525?hl=it). The article explains that drivers enter the **last two digits** of a plate in the app. Listed availability is **seven countries, only in specified locations**:

- Brazil: São Paulo
- Colombia: Bogotá, Bucaramanga, Cali, Medellín, Popayán, Villavicencio
- Costa Rica: San José
- Ecuador: Quito
- Philippines: Manila
- Indonesia: Jakarta
- Peru: Lima and Arequipa

**Critical distinction**: this list describes **app navigation** availability, NOT independently verified permissions for WME segment restrictions or SDK write operations. The [WME SDK DriveProfileAttributes](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.DriveProfileAttributes.html) interface includes a `licensePlateNumber` field referencing the `LICENSE_PLATES` type; that proves a property exists but **does not verify its allowed values, rule operators, or geographic enablement**. Do not equate last-two-digits app input with a WME SDK rule without inspecting WME native UI / validated official SDK capabilities.

**Proposed future Alpha behavior (not implemented):**
1. Only consider license-plate options after the selected segment's **country and locality** are known and match the current source coverage; do not use UI locale or editor location as geographic proxies. City boundaries and metro coverage may differ; use an authoritative WME eligibility signal where available, not a brittle city-name-only gate.
2. For a selected vehicle, offer a conditional plate criterion as a **separate per-vehicle rule**, not as a globally applied condition. Other selected vehicle classes may remain directly authorized, or require a permit/occupancy.
3. Identify the exact native supported plate conditions (last digit, last two digits, parity, enumerated values, calendars) through the native WME UI and SDK docs before exposing choices. Do not invent a two-digit mask or infer an SDK enum from the app's user input.
4. If data/eligibility is missing, display a clear unavailable/unverified note. Never write an unverified rule.
5. Keep a read-only preview and add validation tests for mixed direct/conditional vehicles, excluded geographies, and missing city / unsupported countries.

No change to active Alpha 4.0.0-alpha.9 scripting behavior is authorized by this reference alone.

## Native WME plate-suffix condition — direct editor screenshot (2026-11-23)

The editor supplied an image of the **Portuguese native WME restriction rule** displaying:

> Qualquer veículo com Placa do veículo com final 0

Meaning: "Any vehicle with a license plate ending in 0." This is **direct interface evidence** that the WME native restriction panel can represent an end-of-plate digit condition. The image shows a green rule chip and a single digit `0`. It does **not** show the segment's country, municipality, time frame, complete condition picker, or SDK payload.

The editor further reports from their sources that in the seven countries listed in [official Waze app help](https://support.google.com/waze/answer/7666525?hl=it), WME allows editors to enter a last license-plate digit in restrictions for **specific dates and times**. Preserve this as **editor-provided evidence that still needs location-specific validation**; the screenshot alone does not prove identical WME authoring capabilities across all cities. The app's last **two** digits setting and the shown WME **last digit** condition must not be conflated.

The current WME SDK API index lists `LicensePlateRule` as a type alias / variable; earlier published `DriveProfileAttributes` includes `licensePlateNumber`. This indicates an SDK-level concept but does not establish exact enum values or the write schema. Reference: [WME SDK module](https://web-assets.waze.com/wme_sdk_docs/production/latest/modules/index.SDK.html), [WME SDK beta DriveProfileAttributes](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.DriveProfileAttributes.html).

**Updated implementation plan, not yet in the active Alpha:**

1. Add a third optional criterion under **each individually selected vehicle type**: license-plate **final digit**. It must not automatically apply to other selected vehicle types. Directly authorized classes must remain unconditional unless explicitly configured.
2. Draft UI may offer a choice of final digits from `0` through `9`, but check in native WME whether multiple digits are supported in the same rule or require multiple rules; never assume a list can be serialized as one SDK rule.
3. Couple these authorizations to a **per-rule schedule** covering applicable dates, weekdays and local time ranges. Do not apply a vehicle-specific date restriction to all types; reuse the existing SAFE12 scheduling logic only after native compatibility validation.
4. Derive real eligibility from the **selected segment geography and native editor capabilities**, not the editor's language. When locality/permissions cannot be verified, keep the feature read-only or unavailable.
5. Before any WME writes: inspect actual `LicensePlateRule` SDK schema and native WME rule output, determine interaction with pass and occupancy conditions, test precedence and overlapping vehicle classes, preview before/after, enforce SAFE12 guardrails, and require explicit editor confirmation.

**Status**: native WME single final-digit rule is **observed**; country/city coverage and schedule details are **reported** but not fully independently confirmed for WME; SDK serialization and write eligibility are **not yet verified**. Alpha `4.0.0-alpha.9` stays unchanged and read-only.

## Alpha 10: separate red BLOCKED pathway, optional motorcycle engine, date/time schedule (2026-11-23)

**Historical note:** The statement below that red-selected vehicle types are *exempt* was corrected in **Alpha 11**: selected vehicle types are prohibited. Alpha 10's date/time navigation is retained, while its red selection semantics are superseded.


The red **Transito vietato** intent now has a different guided flow from green and blue:

- Direction → scope → lane → restriction type → **vehicles exempt from prohibition**.
- **Without MOTORCYCLE in the exempt vehicles:** go **directly to red dates and time ranges**, **never** to the green-style occupancy/permits/plate-conditions step.
- **With MOTORCYCLE among the exempt vehicles:** first show an **optional experimental engine type** step, then red dates and time ranges.
- Finish with a **read-only summary** showing default BLOCKED, optional FREE vehicle exemptions, optional motor type and the proposed schedule. Back navigation follows the same conditional path.

The experimental motorcycle step is deliberately limited. The real stable **3.2.0** script uses private WME model methods `getDriveProfileList("BLOCKED")`, `getEngineCapacities()` and their `engineType`, `operator`, `capacityThreshold` fields to **preserve and reapply existing complete motorcycle engine conditions**. It does **not** document a complete list of supported engine-type enum values nor establish that an arbitrary new value may be written. The Alpha offers an opt-in **read-only engineType code draft** (free text), with autocomplete suggestions **only from engine types already observed on the selected segment**. The input must be nonempty when the opt-in is enabled; disabling it keeps the exemption unqualified by engine type. No new engine rule, operator or threshold is serialized. This is a navigation/design prototype; it is not equivalent to v3.2.0's complete experimental restore path.

The red schedule step offers:
- Optional ISO start/end dates, validated chronologically; days of the week (at least one required).
- An **all-day** switch or one or more explicit non-overnight time ranges with start earlier than end.
- A read-only time-frame preview. Draft slots are limited to **12**, matching the numeric ceiling of stable SAFE12, but *without* running the stable's full per-operation counts across segments, retained restrictions, calendars and generated occurrences. The limit must be rechecked by that full engine before any future application.
- The selected segment's actual time zone, holiday exclusions, monthly recurrences and support for overnight windows remain unverified; the draft marks `timeZone:null` and `verified:false`. No WME modifications or preset writes occur.

The **green ALLOWED** path retains independent per-vehicle pass/occupancy conditions; the **blue TOLL** path currently retains its existing Advanced conditions step. Neither is routed through the red-only time scheduling at this stage.

**Regression tests:** red with no exempt vehicles; red with non-motorcycle exemptions; red with MOTORCYCLE (opt-in off/on), invalid engine code, weekday/date/time errors, multiple slots and >12 draft slots; Back path; green/blue unaffected. Check the corresponding UI in WME Standard and Beta.

## Alpha 11: red BLOCKED means prohibit selected vehicles, not exempt them (2026-11-23)

The native WME editor screenshot supplied by the maintainer shows **"Guidare è vietato per"** with radio choices **"Tutti i veicoli"** and **"Tipi di veicoli selezionati"**. Selected motorcycles can then be restricted as a whole or further qualified by experimental **engine type, engine displacement (cc), or power (kW)**. This directly corrects the former Alpha 10 interpretation, which mistakenly regarded red-selected vehicles as **exceptions** to a prohibition. Alpha 10 is **superseded** for red selection semantics.

The [official WME SDK SegmentRestriction interface](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.SegmentRestriction.html) documents the relevant combinations:

| Wizard red selection | Expected behavior | Proposed SDK draft |
| --- | --- | --- |
| No vehicle selected | **All vehicles prohibited** for the schedule | `defaultType: BLOCKED`, no vehicle override rules |
| One or more types selected | **Only selected vehicle types prohibited**, other types allowed | `defaultType: FREE`, `vehicleRules.BLOCKED` with the selected types |
| MOTORCYCLE selected without motor conditions | **All motorcycles** prohibited (or all selected types, if other categories also chosen) | Same selective restriction as above |
| MOTORCYCLE selected with motor conditions | **Only matching motorcycles** prohibited; other types/engine variants not automatically banned | Draft-only `BLOCKED` motorcycle conditions, with native serialization and rule precedence **not yet verified** |

Green `ALLOWED` keeps the opposite meaning: `defaultType: BLOCKED` plus `FREE` authorizations for selected vehicle classes and their individual conditions. Blue `TOLL` is unchanged. Switching card type clears incompatible state.

**Red guided flow:** direction → scope → lane → red type → optional choice of vehicle types to **PROHIBIT** → optional motorcycle engine conditions **only when MOTORCYCLE was selected** → red date/day/time schedule → read-only summary. Without motorcycles, the optional engine step is skipped; no red pass, occupant-count or license-plate step is shown.

**Motorcycle prototype:** based on the supplied native WME screenshot, the Alpha's optional engine step now offers independent preview rows labeled **Fuel powered** (displacement in cc) and **Fully electric** (power output in kW), with comparators **All**, **<** and **≤**. These are design/UI identifiers (`FUEL` / `ELECTRIC`, `ALL` / `LT` / `LTE`) and are **not assumed to be actual internal WME SDK enums**. Thresholds must be positive, displacement an integer, and a motor filter must have at least one selected engine condition. With no motor filter enabled, all selected motorcycles are prohibited. If enabled, only the motorcycles satisfying the chosen motor conditions are intended to be prohibited. Rules involving multiple motor conditions, country eligibility, exact internal `engineType`/`operator`/`capacityThreshold` values and interactions with the schedule require native verification. **No real WME rule is generated or modified.**

**Testing:** zero selected vehicles must remain BLOCKED; selecting PRIVATE, MOTORCYCLE or several categories must yield proposed FREE default and BLOCKED vehicle overrides. Verify motorcycle engine disabled (all motorcycles) and conditional fuel/electric thresholds, invalid thresholds, green whitelist/TOLL regressions, forward/back navigation and read-only guards on both WME Standard and Beta.

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
