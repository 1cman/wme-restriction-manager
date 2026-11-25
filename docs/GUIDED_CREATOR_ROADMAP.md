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
| Red: `BLOCKED`, Transito vietato (**historical Alpha 7; superseded by Alpha 11**) | `BLOCKED` if no types chosen, otherwise `FREE` | `BLOCKED` rules for chosen types | No selection prohibits all; selecting types prohibits only those |
| Green: `ALLOWED`, Transito consentito *solo agli autorizzati* | `BLOCKED` | `FREE` for allowed criteria | **Alpha 8:** at least one authorized vehicle type is mandatory; passes and occupancy are additional, optional draft conditions |
| Blue: `TOLL`, Transito a pedaggio | `TOLL` | `FREE` exemptions | Existing vehicle-exemption requirement retained |

`ALLOWED` **is an internal wizard intent, not an SDK RESTRICTION_TYPE**. Never submit it or mistake it for SDK `FREE`. Green and red currently share a BLOCKED base but have different draft intent and validation; the green flow is an explicit whitelist. The green vehicle step says **choose vehicles to authorize**, not vehicles to prohibit. Other traffic remains blocked. **Historical note:** Alpha 7 allowed progression without a selected vehicle type; Alpha 8 supersedes this behavior and requires at least one authorized vehicle. Changing the intent clears existing vehicle and advanced draft selections to avoid accidental authorizations.

For the green ALLOWED flow only, the summary should show a `BLOCKED` base and `FREE` authorizations, plus a note that all other traffic is blocked; this does not describe the red BLOCKED flow corrected in Alpha 11. Because the current draft does not model native AND/OR groups, combining vehicle types, permits and passenger counts **does not yet establish the exact eligibility logic in WME**. Country-specific license plate options remain unavailable pending native verification. There is still **no WME write, apply, save or preset creation** in this Alpha. The stable script is untouched.

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

## Alpha 12: SDK observation, consistency guard and write-readiness gate (2026-11-23)

The SDK [SegmentRestriction](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.SegmentRestriction.html) interface explicitly documents `defaultType`, `direction`, `editable`, `laneScope`, `laneType`, `timeFrames`, and `vehicleRules`; `disposition` and `driveProfiles` are deprecated in favor of `laneScope` and `vehicleRules`. The [VehicleType](https://web-assets.waze.com/wme_sdk_docs/production/latest/types/index.SDK.VehicleType.html) reference lists the documented vehicle identifiers used in the prototype.

**Implemented in read-only Alpha 12:**
- The sidebar now offers an expandable **Technical inspection (SDK read-only)** of *existing* restrictions on the selected segment. It shows observed `laneScope`/`disposition` values, `laneType`, default restriction kinds, time-zone strings present in existing `timeFrames`, and counts of editable/non-editable/unknown restrictions. Duplicate values are removed and values are sorted. This panel shows **only bounded category metadata and counts**—no segment IDs, free-text descriptions, named permits, or raw private engine data.
- The observation panel explicitly warns that observing an enum value in an existing restriction **does not prove** that it can be used to create a new restriction at that location or with current user permissions. No observed value is automatically mapped into a new draft.
- On opening the wizard, it captures a **fingerprint** of the selected segment's documented SDK restriction fields and its traffic directions. Before each Next transition, the selected segment/country/available passes/direction checks still run; it now also aborts if that fingerprint changed. This prevents continuing a stale draft after a detectable SDK restriction modification.
- The fingerprint covers SDK `direction`, `defaultType`, `laneScope`, `disposition`, `laneType`, `description`, `timeFrames`, `vehicleRules`, `driveProfiles`, `editable` and the segment directional flags. It is only kept in the current wizard session; it is not exported or stored. Unknown or circular SDK data produces an **unknown** snapshot rather than guessed data. **This is NOT a complete private-WME-model snapshot**; changes only in internal motorcycle engine metadata may escape detection and would need separate validation.
- Nothing writes WME, stores presets, or enables a Save/Apply button. Stable 3.2.0 is unchanged. Alpha 11's red/green/blue selection logic remains the same.

**Verified versus outstanding, with source confidence:**

| Topic | Evidence today | Status for real writes |
| --- | --- | --- |
| Red default/selected and green allowlist `BLOCKED`/`FREE` combinations | Documented SDK `SegmentRestriction`, maintainer native WME screenshots, isolated tests | **SDK semantics verified; live write behavior not yet tested** |
| SDK restriction field names | Documented `SegmentRestriction`, including deprecations | **Field names verified** |
| Scope and lane-type enum values and geographic eligibility | WME screenshots + values observed on existing selected segments | **Mapping and new-write eligibility not verified** |
| Country permit list | SDK `Countries.getById` / `restrictionSubscriptions` | **Read/list verified in prototype; actual rule composition not verified** |
| Engine and capacity/power comparisons | Native WME screenshot + internal preservation logic from stable 3.2.0 | **New-rule SDK/native mapping and country support not verified** |
| Last-digit plate restriction | Native WME Portuguese screenshot and Waze app help | **WME per-city support and write shape not verified** |
| Red dates and hours | Pure draft validation and SAFE12 concept from stable | **Per-segment timezone, holiday exclusions, full SAFE12 operation budget and native serialization not verified** |
| Editing safety | Alpha change fingerprint + isolated tests | **Partial SDK-only stale-draft detection; no real-write safety approval** |

**Field validation protocol (next):** in WME Standard and Beta, select one segment with an existing restriction and inspect the new technical panel. Compare observed scopes, lane types, time zones and editable counts with the native panel. Then select an unrelated segment without any restrictions: the observed fields should be empty/unknown (never invented). Open the wizard, then edit an existing restriction in WME separately and verify the next step reports that the data has changed. For motorcycle engine types, compare a known WME native example and the 3.2.0 read-only preservation path separately; avoid assuming arbitrary engine enums. Do not enable writes before all unknowns above are resolved.

## Alpha 13: toll-free passage with direct scheduling and planned toll-road flag (2026-11-24)

**New user-facing name:** blue `TOLL` is displayed as **Transito esente da pedaggio** (and equivalently translated in all six languages). The user selects **one or more vehicle categories exempt from the toll**. The exemption is modeled as a `TOLL` default plus `FREE` vehicle rules in the read-only preview; other vehicles remain subject to the toll. At least one exempt vehicle remains mandatory.

**Blue-specific navigation:** choose blue type → select toll-exempt vehicles → **directly enter date(s), weekdays and time bands** → read-only summary. Do not show the green pass / minimum occupancy / plate conditions step. Blue and red share the existing pure date/time validator and draft UI, with separate localized labels. Back from blue schedule returns directly to exempt vehicle selection. Green still routes to independent per-vehicle requirements and remains unchanged. Red keeps its optional motorcycle conditions.

**Automatic road-toll activation requirement:** selecting blue automatically attaches a planned, **read-only** segment-attribute change to the draft: `hasToll: true`, targeting the currently selected segment. A pure function `normalizeTollActivationDraft` validates target IDs and returns the requested change with `applied:false` and `verified:false`; the summary exposes the planned attribute and explains that the Alpha has not applied it. For future multi-segment support, the function accepts a set of unique positive segment IDs, but the **current wizard still requires exactly one selected segment**. No `updateSegment` method is invoked.

**SDK verification:** The current [SDK Segments.updateSegment reference](https://web-assets.waze.com/wme_sdk_docs/beta/latest/classes/index.SDK.Segments.html) documents `hasToll?: boolean`, and explicitly states that setting it updates **both directions** of the segment. The SDK [Segments.isTollSegment](https://web-assets.waze.com/wme_sdk_docs/beta/latest/classes/index.SDK.Segments.html) returns true if the segment is a toll road **or has a toll-free restriction**, so its value by itself is NOT enough to prove that the underlying `hasToll` road flag is already active. The restriction [SegmentRestriction](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.SegmentRestriction.html) supports `TOLL` defaults with `FREE` vehicle rules.

**Safety gate before actual WME edits:** only when real guided application is developed, apply the `hasToll:true` segment update together with the intended toll exemption after validating each segment, permissions, country, all existing restrictions, time frames, the full SAFE12 budget, and the current toll flag. Show a before/after preview and require explicit editor confirmation; use the native WME save flow. The user must be warned that `hasToll` affects both directions even when an exemption is directional, and this may impact routing. Avoid partially setting the road to toll while failing to create the corresponding exemption. If the operation cannot be validated atomically / safely, do not modify the map.

**Regression tests:** blue step 4→7→6 and reverse 6→7→4; green unchanged, red still 4→5→7→6 when motorcycles selected. Verify mandatory exempt vehicles, multiple time bands, `TOLL`/`FREE` preview, single-segment automatic toll flag draft, both-direction warning, no writes, and WME Standard/Beta UI before promotion.

## Alpha 14: calendar for green authorizations and conservative SAFE12 estimate (2026-11-24)

The green **Transito consentito** path now proceeds from **per-vehicle authorization conditions** directly to a **calendar step**, then to the read-only summary. This completes the scheduling step for all three colored intents:

| Intent | Steps after vehicle selection | Calendar semantics |
| --- | --- | --- |
| Red `BLOCKED` | Optional experimental motorcycle engine condition, then schedule and summary | Time-window restriction of the prohibition |
| Green `ALLOWED` | Individual pass/occupancy options, then schedule and summary | Time-window authorization of the selected vehicle classes and their independent conditions |
| Blue `TOLL` | Schedule and summary, without pass/occupancy | Time-window exemption for selected vehicle classes; planned `hasToll:true` remains a separate all-directions road attribute |

The **same pure date/time validator** powers the new green step: optional start/end date, selected weekdays, whole-day or up to 12 explicit daytime slots. Back from the green schedule returns to the **individual vehicle rules** without losing earlier selections. The summary now includes the actual proposed green time frames; it does not assert an SDK write schema or that a restriction on a segment would automatically block travel outside the listed periods.

**SAFE12 preflight (estimate, never an approval):**
- A pure `estimateSafe12Budget(existingRestrictions, proposedTimeFrames)` counts the restrictions already on the *selected segment*, their currently reported SDK time frames, and the number of proposed frames.
- The proposal conservatively assumes **one additional restriction per proposed time frame**, matching the stable 3.2.0's calendar expansion strategy. Thus `projectedRestrictions = existingRestrictions.length + proposedFrames.length`, `projectedFrames = sum(existing.timeFrames.length) + proposedFrames.length`. These are simple arithmetic estimates for a single segment, not the final SDK payload.
- Status `WITHIN_ESTIMATE` means both totals are at most 12; `OVER` means either exceeds 12; `UNKNOWN` means the existing SDK restrictions or their `timeFrames` are incomplete, or proposed frames are missing or malformed.
- **None** of these statuses authorizes editing. The stable 3.2.0 checks the complete batch with `assertOperationLimit`, counting every output restriction and every time-frame definition **across all updates**. It also expands holiday and recurrence calendars and handles reapplication and preservation of existing items. The Alpha does **not** yet perform those operations.
- The summary shows all counts, a clear warning if over-limit or unknown, and an explanation of the conservative assumptions. The read-only prototype never writes the segment, stores data or saves presets.

**Remaining blockers before real writes:** exact `laneScope` / `laneType` mapping and local eligibility; time zone from the selected segment; native WME schedule serialization and recurrence/exclusion handling; how independent green vehicle conditions map to SDK `vehicleRules` AND/OR semantics; retention of existing restrictions and experimental motorcycle conditions; atomic or reversible handling of blue `hasToll:true`; and confirmation in both WME Standard and Beta.

**Manual test:** select a segment with no restrictions, create a green draft with PRIVATE requiring a pass and EV allowed directly, then pick a weekday and two time ranges. Verify the summary preserves the per-vehicle distinction, shows both ranges and a SAFE12 estimate of **2 new restrictions, 2 new time-frame definitions** (derived from the two chosen slots). Next test with an existing segment restriction and compare the counts against that segment's SDK values. Use an existing segment with incomplete restriction metadata to confirm UNKNOWN instead of a guessed count. Do not attempt to save map changes from the Alpha.

## Alpha 15: editor-approved four-vehicle shortlist (2026-11-24)

Following successful live checks of the green path (per-vehicle pass remains off for EV and time bands are created correctly), the editor requested that new restriction creation expose **only** these four categories, in this exact order:

| Italian UI label | SDK VehicleType identifier |
| --- | --- |
| Auto private | `PRIVATE` |
| Veicoli elettrici | `EV` |
| Motociclette | `MOTORCYCLE` |
| Taxi | `TAXI` |

This deliberately narrows the **Guided Creator user interface** and its pure validation models, not the entire SDK or the WME read-only model. Other documented SDK vehicle identifiers are no longer selectable for new red, green or blue drafts and are rejected if supplied to `selectedVehicleTypes`, `normalizeDraft` or `normalizeVehicleRules`. The locale labels remain available in all six Alpha languages. The read-only SDK inspection, change fingerprint and existing-restriction preservation research must still recognize native restrictions involving other vehicle types: **do not remove or rewrite existing WME rules** just because their vehicle type is not in this shortlist.

The choice of four is based on the editor's desired client-facing workflow; this alone does **not prove** that every omitted SDK vehicle identifier is universally unsupported by Waze navigation in every country or version. Future changes to the shortlist require separate verified WME/client findings and an explicit product decision.

**Regression test:** In all three colored flows, confirm that the vehicle selection offers exactly PRIVATE, EV, MOTORCYCLE and TAXI (translated appropriately), that the red empty selection still prohibits all, that green and blue still require a choice, and that green pass/occupancy conditions remain independently scoped to each chosen type. Verify that a pre-existing WME restriction for a vehicle type outside the shortlist remains visible in the read-only inspector and is never rewritten. The Alpha remains read-only; stable 3.2.0 is untouched.

## Alpha 16: proposed laneScope mapping and observed SDK comparison (2026-11-24)

The editor accepted Alpha 15's four-category vehicle shortlist. The next blocker remains the difference between **wizard design labels** and the native WME SDK fields for lane restrictions.

**Sources / confidence:** The official [SDK SegmentRestriction reference](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.SegmentRestriction.html) confirms `laneScope` (with deprecated `disposition`) and specialized `laneType`, but does not by itself prove the current editor's accepted **write** enum combinations for each country/road/direction. [Community userscript source showing the four update-model scope names](https://greasyfork.org/en/scripts/528552-wme-ezroad-mod/code) is useful secondary evidence for a mapping candidate, **not an official permission or cross-version compatibility guarantee**.

**New read-only pure model in Alpha 16:** `inspectLaneDraft({scope,lane},existingRestrictions)` compares the selected wizard scope with observed SDK `laneScope` (or deprecated `disposition`) in already-existing restrictions on the selected segment. It always returns `verified:false`, cannot submit data to the WME SDK, and does not silently choose a specialized `laneType`.

| Wizard scope (design label) | Candidate update-model value (NOT write-authorized) |
| --- | --- |
| `segment` | `WHOLE_SEGMENT` |
| `left` | `LEFT_LANE` |
| `center` | `MIDDLE_LANE` |
| `right` | `RIGHT_LANE` |

The analysis displays (a) candidate scope, (b) whether that exact scope was previously observed on the selected segment, (c) the list of lane-type strings observed on its existing restrictions, and (d) a warning that left/center/right must be interpreted relative to the selected **travel direction**. An observed value is not proof of support for creating new restrictions. For `lane_none`, the script records no requested specialized lane type; for `express`, `fast`, `hov`, `public_transport` or `carpool_toll_free`, the mapping is deliberately **UNMAPPED** and never converted to a guessed SDK enum. If the existing restriction data is unavailable, the analysis reports unknown/unavailable rather than inventing evidence.

This report is included both immediately after the special-lane selection step and in the final read-only summary of **red BLOCKED**, **green ALLOWED**, and **blue TOLL**. Alpha 15 vehicle filtering, SAFE12 estimates, the per-vehicle conditions, the schedule, and the stable 3.2.0 remain unchanged.

**Manual verification before a real edit:** In WME Standard and Beta, inspect a segment with an existing native whole-segment or single-lane restriction, selecting an appropriate travel direction. Compare the report's candidate `laneScope`, existing observed scope, and lane-type strings against the native panel. Repeat on a segment with no existing restrictions (observed values should be empty, not inferred). Separately test each specialized lane type in the native WME editor before establishing its SDK code and country availability. Do **not** enable writes until mapping, edit permissions, permissions by country and segment, and full SAFE12 handling are verified.

## Alpha 17: native 'Edit restrictions' anchor and editor-confirmed lane UI (2026-11-24)

**Live WME observation supplied by the editor:** when a selected segment already has driving restrictions, its sidebar shows the native action **Modifica restrizioni** rather than the **Aggiungi restrizioni** action visible on an unrestricted segment. The previous Alpha launcher only recognized native "add" labels, which made the *inline* guided button disappear precisely when existing restrictions were present. The RM Guided Alpha sidebar tab remained an independent fallback.

**Fix in read-only Alpha 17:**
- Recognize native **add** and **edit** restriction actions in Italian, English, French, Spanish, German and Portuguese using exact normalized text matching, not a broad substring match. Do not replace or click the original WME action.
- Search native button/custom-button/link controls; if none is present, allow a unique visible exact-label text leaf as a fallback for WME builds that use a role-less clickable element. Multiple competing matches are intentionally rejected (script-sidebar fallback).
- Insert **Crea restrizione guidata** adjacent to the currently detected native action and refresh its location when WME switches between Add and Edit. A click on the guided button does not bubble to the underlying native handler.
- Keep the persistent independent launch button in the **RM Guided Alpha** sidebar and all existing draft validation safeguards. No real editing, overwriting of native restrictions, preset modification or SDK write action is enabled.

**Lane validation update:** the editor directly confirmed that the wizard's **four scope choices** (whole segment, left, center, right) and **six lane-type choices** (none, express, fast, HOV, public transport, carpool toll-free) appear and can be selected in their WME native restriction interface. This is observed **native UI availability**, not a test of the exact underlying SDK write payload or every country/road combination. Alpha 16's proposed laneScope enum mapping remains unverified for writes; do not conflate a native label with an accepted serialized SDK value.

**Manual regression protocol:**
1. Select a segment with **zero** existing driving restrictions: the WME action should be Add and the inline guided button should appear immediately beside it.
2. Select a segment with **one or more** restrictions: the WME action should be Edit and the inline guided button should likewise appear, without launching the native edit view when clicked.
3. Confirm the independent button in the RM Guided Alpha tab remains usable even if an inline anchor cannot be detected.
4. Switch between those segments without reloading and repeat in WME Standard and Beta. No existing restriction is to be changed, and the wizard should still show the existing restriction count from the SDK.

## Alpha 18: deterministic SDK conversion review, always non-writable (2026-11-24)

The maintainer has now **confirmed the Alpha 17 native button fix in both WME Standard and WME Beta**, including segments that already have driving restrictions. This closes the Add/Edit button detection acceptance check for both editor variants.

**Official SDK contracts consulted:**
- [SegmentRestriction](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.SegmentRestriction.html) documents `defaultType`, `vehicleRules`, `direction`, `laneScope`, `laneType`, and `timeFrames`. It explicitly allows a `BLOCKED` default with `FREE` exceptions (or none), a `FREE` default with `BLOCKED` vehicle rules, and a `TOLL` default with `FREE` vehicle rules.
- [Segments.updateSegment](https://web-assets.waze.com/wme_sdk_docs/beta/latest/classes/index.SDK.Segments.html) supports `restrictions?: SegmentRestrictionData[]` and `hasToll?: boolean`; the toll attribute applies to **both** segment directions.
- These declarations identify **read-model fields and write entry points**, but are not evidence that the Alpha's private engine filters, conditional per-vehicle pass/occupancy groups, country-specific eligibility, or calendar values have been correctly mapped to the real SDK **write** model.

**Implemented in Alpha 18:** `reviewSdkConversion(draft, segment, schedule, vehicleRules, permits, motorDraft, country)` is a pure deterministic function that validates the existing wizard draft and produces a **read-only semantic plan**, not a serialized `SegmentRestrictionData` object. It never calls SDK mutation methods. Its status is unconditionally `BLOCKED`, `saveAllowed:false`, `verified:false`, `sdkWritePayload:null`. The final summary shows a collapsible **SDK conversion review (preview)** with the expected general rule, vehicle-specific override semantics, selected direction, proposed schedule count, the projected `hasToll:true` for blue restrictions, and the remaining verification blockers.

| Wizard scenario | Documented rule pairing only | Preview vehicle treatment (NOT SDK write schema) |
| --- | --- | --- |
| Red with no vehicle selection | `defaultType: BLOCKED` | No vehicle override |
| Red with selected types | `defaultType: FREE`, override `BLOCKED` | Selected PRIVATE/EV/MOTORCYCLE/TAXI are prohibited |
| Green with selected types | `defaultType: BLOCKED`, override `FREE` | Each selected category independently DIRECT or CONDITIONAL (pass/occupants); all others blocked |
| Blue with selected types | `defaultType: TOLL`, override `FREE` | Selected types exempt from toll, others toll-paying; plan `hasToll:true` for both directions |

**Blockers are explicit and contextual**, rather than guessing defaults or silently dropping conditions:
- The full `SegmentRestrictionData` and `AddableVehicleRule` write shape and existing restriction preservation strategy have not been validated end-to-end.
- Date/time conversion, local segment timezone, native `laneScope`/`laneType` eligibility, country rules and full stable SAFE12 operation budget are not verified.
- Green permit+occupancy composition and precedence, experimental motorcycle engine operators/codes, and safe coordination of a blue toll flag plus a directional exemption remain conditional blockers.
- Missing SDK restriction arrays are reported as unknown, and existing restrictions require a separate preservation validation. If the preliminary SAFE12 estimate exceeds the limit, the review explicitly calls out that blocker.

**Automated checks:** red-all versus red-selected, motorcycle engine filtering, green direct EV alongside PRIVATE requiring pass/occupants, toll exemption plus planned `hasToll`, existing unrelated SDK vehicle rules (including BUS) preserved, missing restriction data, SAFE12 over-limit, invalid inputs, and hard read-only safeguards. No real map edits or preset writes; stable 3.2.0 unchanged.

**Next validation milestone:** Verify exact write-model structures and enum mappings in the official current SDK typings and/or a **non-destructive native WME observation**, including the difference between fields returned by the read model (`SegmentRestriction`) and fields accepted by `Segments.updateSegment` (`SegmentRestrictionData`). Do not treat snapshots of existing restrictions as directly writable objects. Verify timing, local timezone and AND/OR semantics; only after that develop an explicit before/after preservation-safe draft operation and full stable SAFE12 validation. No actual Apply/Save action until those checks are passed.

## Alpha 19: preservation audit before any restrictions write (2026-11-24)

The maintainer has **tested Alpha 18's SDK conversion review in WME and confirmed a positive result**. This closes the read-only semantic review check for the tested editor environment; it does not establish SDK write compatibility.

**Source distinction:** [SegmentRestriction](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.SegmentRestriction.html) is the documented SDK *read model*. [Segments.updateSegment](https://web-assets.waze.com/wme_sdk_docs/beta/latest/classes/index.SDK.Segments.html) accepts a `restrictions?: SegmentRestrictionData[]` **write-model array**. The exact conversion of all existing read-model restrictions to addable data, including legacy/private properties, conditions and noneditable restrictions, must **not** be assumed. The docs do not confirm an implicit preservation/merge behavior for unrelated restrictions, so this remains a critical gate.

**New in Alpha 19:** pure `auditRestrictionPreservation(segment)` returns a read-only per-segment aggregate status:
- `NO_EXISTING` — SDK explicitly reports an empty existing restriction array. This means there is no existing restriction to preserve, **not that an SDK write is authorized**.
- `REQUIRES_ROUNDTRIP` — SDK reports one or more structurally readable restrictions; a safe native read/write round trip is mandatory before attempting to append any new restriction.
- `UNKNOWN` — the restrictions array is missing, cannot be fingerprinted, is circular/unserializable, or one or more entries do not expose a minimally recognizable read model. This must fail closed.

The audit counts existing restrictions, reported time-frame definitions, those with `editable:false`, those without a known `editable` boolean, rules with nonempty or otherwise opaque `vehicleRules` objects, presence of deprecated `disposition` / `driveProfiles` fields, and incomplete read-model entries. **No individual existing restriction IDs, vehicle rules, descriptions, plate data, country permits or raw objects are exported or displayed.** An opaque or noneditable rule is *never* discarded: it is flagged as requiring future conversion/preservation validation. Even a fully empty segment returns `writeReady:false` and `verified:false`.

The Alpha 18 `reviewSdkConversion` now includes this preservation report, and adds contextual blockers for unknown data and unverified read/write round trips. Its `saveAllowed:false`, `sdkWritePayload:null` and unconditional `BLOCKED` status remain unchanged. The wizard's final read-only summary displays the audit's status and aggregate counts in a localized sub-section.

**Automated safety tests:** no-existing, unknown missing-array, existing editable/noneditable/unknown editability, existing unsupported SDK types (including BUS and HAZARDOUS_MATERIALS) retained untouched, deprecated fields, incomplete data, cycles, review integration, immutable input, missing write payload and no SDK mutation. Stable 3.2.0 is untouched.

**Next gate for development:** obtain authoritative current SDK write-model typings for `SegmentRestrictionData`, `AddableVehicleRule`, `TimeFrame`, `RestrictionSegmentLaneScope` and `RestrictionSegmentLaneType`. Compare against actual native structures in WME Standard and Beta, including empty, editable and noneditable restrictions and legacy/experimental motorcycle conditions. Only then implement a **non-mutating, round-trip-preserving** preview with exact existing restrictions and proposed additions. Add full SAFE12 operation validation and exact timezone behavior before a write path can ever be enabled.

## Alpha 20: visible existing restrictions and conservative conflict preflight (2026-11-24)

The maintainer requested two connected protections before any SDK write: **show each existing restriction immediately, including its useful details**, and **warn when a proposed restriction may conflict with existing segment restrictions**. Alpha 19's preservation audit had exposed counts but not the individual rules. The SDK [SegmentRestriction read interface](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.SegmentRestriction.html) documents direction, default type, lane scope/type, timeFrames, editable state and vehicleRules; the [Segment](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.Segment.html) exposes the selected segment's restrictions.

**Delivered, still read-only:**
1. A new **Restrizioni già presenti sul segmento** section is visible immediately in the RM Guided Alpha sidebar, and on the first screen of the wizard before any choices. Each existing restriction is individually expandable and shows its original SDK default type, direction, lane scope/type, editable/expired state where known, description (truncated), time-frame dates, times, raw weekday SDK value, timezone and **vehicle rule group names only**. Complex vehicle/pass/plate/engine details are intentionally marked *unconverted*, never silently guessed. The section is also accessible on the final summary.
2. **Modifica nel pannello WME** is offered only when the actual native **Edit restrictions** action is currently found. It calls that native action on an explicit user click, after closing any open guided modal; there is no custom direct editing of existing SDK restrictions in Alpha 20. If the native action is not present, editors can use WME's own sidebar directly.
3. `previewRestrictionConflicts(draft, segment, schedule)` compares each existing restriction to the proposed read-only draft on *direction*, *lane scope*, *dates*, *weekday intersection when both have readable weekday arrays*, *time ranges* and the *general restriction type*. Results remain deliberately conservative:
   - `POTENTIAL_CONFLICT`: physical and temporal overlap established from recognized data, with different default types — potential contradiction, not proven vehicle/routing conflict
   - `OVERLAP_REVIEW`: established overlap with the same default type; may be duplicate or complementary
   - `SEPARATE`: demonstrably disjoint directions, distinct non-whole-segment lanes, dates, weekdays or non-overlapping time ranges
   - `UNKNOWN`: cannot exclude overlap because SDK direction, scope, timeframes, weekday number/bitmask, overnight ranges, complex recurrence, or other attributes cannot be interpreted safely
   - `NONE`: SDK confirms that the segment has no existing restrictions
4. A new **Controllo preventivo conflitti (sola lettura)** appears during the scheduling step when the proposed calendar is valid, and again in the final summary. It lists an independent result for each existing restriction and a combined status, together with a warning that *no status is a write authorization*. The SDK-read snapshot is included in sidebar refresh identity so editing an existing restriction updates this list even if the restriction count is unchanged.
5. The pure display and conflict functions do not change SDK objects, serialize any `SegmentRestrictionData`, save presets, or perform WME writes. The read-only conversion review, original stability guards, SAFE12 estimate, four permitted wizard vehicle categories, and stable 3.2.0 all remain untouched.

**Limitations, intentional:** Current SDK `TimeFrame.weekdays` may be numeric and its bit mapping has not yet been independently validated in the wizard; such values return `UNKNOWN` rather than inventing weekday intersections. Null/unknown direction, lane scopes, empty or missing time frames, unverified recurrence and advanced permit/plate/engine eligibility also fail conservatively. A preliminary lack of overlap does **not** guarantee no conflict of vehicle rules across all WME conditions. An overlapping restriction with a different default type is a *potential* conflict until native semantics are verified. The UI cannot yet edit the exact existing restriction *inside the guided wizard*; it routes deliberately to the native WME panel instead.

**Manual acceptance tests:** in both WME Standard and Beta, select (a) a segment with no restrictions, (b) one with a known existing restriction and dates, (c) one with multiple restrictions/directions, and (d) one with vehicle-specific conditions not among the wizard's four types. Verify all existing rules are visible before choosing a new draft; the native edit shortcut opens the original restrictions panel without applying anything; different directions/date ranges produce separation only when provable, and undecodable calendars produce `UNKNOWN`. Change an existing restriction in the native editor and confirm the sidebar reflects the change. Do not enable real application until native time-frame and vehicle-rule semantics, complete preservation and full-operation SAFE12 validation are confirmed.

## Alpha 21: per-vehicle conflict effects, conservative precedence (2026-11-24)

The maintainer successfully tested Alpha 20's overlap alert and the direct native **Modifica restrizioni** shortcut. The next step is to compare **vehicle-specific effects** without confusing a global `defaultType` with the `vehicleRules` overriding it.

**Official reference:** [WME SDK BaseRestriction](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.BaseRestriction.html) defines the supported default/override pairings (`BLOCKED` + optional `FREE` rules, `FREE` + `BLOCKED` rules, `TOLL` + `FREE` rules). [SegmentRestriction](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.SegmentRestriction.html) includes `vehicleRules`, `laneScope`, `direction` and `timeFrames`. These are **documented model concepts**, not proof of full combined restriction routing semantics or permission to write SDK payloads.

**Implemented in read-only Alpha 21:** `reviewVehicleConflictEffects(existing, normalizedDraft, proposal)` compares the four user-selected categories `PRIVATE`, `EV`, `MOTORCYCLE` and `TAXI` separately. It analyzes a native existing rule only when the rule collection is a narrowly recognizable `{FREE:[{vehicleTypes:[...]}]}` or `{BLOCKED:[{vehicleTypes:[...]}]}` pattern consistent with its `defaultType`. Other native fields, additional conditions, unsupported vehicle types or multiple native rules for the same category are flagged **CONDITIONAL** or **UNKNOWN** rather than converted into unconditional exemptions. A nonempty unverified legacy `driveProfiles` read that may differ from `vehicleRules` also fails closed.

For the proposed restriction, the review distinguishes:
- Red **all prohibited** versus red **selected prohibited**; optional motorcycle engine matching is `CONDITIONAL`, not a blanket motorcycle ban.
- Green **default blocked**, each selected vehicle either directly free or conditional on its **own** pass/occupancy requirements. Missing per-vehicle state is `UNKNOWN`, not silently treated as free.
- Blue **default toll**, with selected vehicle categories marked as toll-free in the semantic proposal.

A four-row comparison lists the existing and proposed category effects and one of `SAME`, `DIFFERENT`, `CONDITIONAL` or `UNKNOWN`. When a physical/time overlap was already established, differing effects for any same named vehicle category can **elevate** the result to **possible conflict** even when top-level default types match. It never classifies physical/time overlap as **definitely separate** solely because vehicle names differ. The per-vehicle detail is still shown as *partial evidence* if time/weekday data are undecodable.

**Hard limitations:** The four WME vehicle types are not assumed mutually exclusive (for example a private car can also be electric). A native rule's AND/OR logic, pass subscriptions, motorcycle engine ranges, number-plate restrictions, multiple overlapping restrictions, precedence/priority and geographic applicability are not fully evaluated. Complex or foreign vehicle groups and repeated native rules are conservatively uncertain. Identical predicted effect labels do **not** mean a new restriction is safe or unnecessary. All reviews report `verified:false` and `saveAllowed:false`; the entire Alpha remains read-only.

**Acceptance in WME Standard and Beta:** select segments with (a) a general prohibition, (b) a native motorcycle-only rule, (c) green authorization for private cars with a pass and EV without a pass, (d) a toll exemption, and (e) unknown/legacy or multi-rule vehicle conditions. Check that the expanded **Confronto per tipo di veicolo** lists the four categories independently and flags partial/unknown results rather than offering a false guarantee. Existing native restrictions remain intact. Stable 3.2.0 is not changed.

**Next milestone:** derive verified effects from the official SDK's full `VehicleRule` model and native editor examples, including country permits, occupancy and motorcycle engine logic; validate SDK weekday bitmask/timeframe semantics. Only after these and the complete SAFE12 operation safety gates are closed can a write preview be considered. No Apply/Save action is enabled.

## Alpha 22: SDK native-condition diagnostics and legacy comparison (2026-11-24)

The maintainer **confirmed the Alpha 21 four-category comparison is displayed separately in WME Standard and Beta**, including the expected warning when an existing native restriction references unsupported vehicle classes or advanced conditions. This closes the UI test only, not the real interpretation or routing precedence test.

**Documentation reviewed:** [DriveProfile](https://www.waze.com/editor/sdk/interfaces/index.SDK.DriveProfile.html) documents the fields `vehicleTypes`, `subscriptions`, `numPassengers` and `licensePlateNumber` in the SDK drive profile model. [BaseRestriction](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.BaseRestriction.html) describes `vehicleRules` and the deprecated `driveProfiles` field. Neither source establishes every neutral numeric default, all nested engine/plate constraints, OR/AND combinations or precedence between overlapping restrictions.

**Delivered in read-only Alpha 22:**

1. `inspectNativeVehicleCondition` reads individual native SDK profile objects **without modifying them**. It identifies vehicle category names, the **count** of subscriptions/pass IDs, occupancy threshold where explicitly represented by an integer of at least 2, whether a plate condition exists, and whether an engine-related condition is present. It flags any unrecognized field names and produces `UNCONDITIONAL`, `CONDITIONAL` or `UNKNOWN` as **diagnostic interpretations**, not proof of a routing outcome.
2. **Protect sensitive values:** diagnostic output does not contain pass IDs, plate-number values or raw internal engine values. Only the number of passes, presence of a plate/engine condition, known occupant threshold, selected vehicle type names and *unrecognized field names* are displayed.
3. A missing/invalid category array, unknown rule fields, malformed subscriptions, and unverified `numPassengers` values (including 0 and 1) cause `UNKNOWN`, not an assumed free pass. Simple recognized empty fields (e.g., empty subscriptions, empty license-plate string and empty engine-capacities list) are treated as neutral in the read-only diagnostic **only**; live native behavior still needs verification.
4. `compareLegacyVehicleRules` now tests structural equality of the **current** and **deprecated** rule collections, even when WME returns distinct object instances with identical data. Only exact, cycle-safe, structurally equivalent plain objects allow treating the two representations as matching. Differences, cyclic/private non-plain data or unknown representations remain unverified and cannot be used to claim safe writing. This reduces an avoidable source of `UNKNOWN` in the Alpha 21 comparison without discarding legacy data.
5. The already-visible **Restrizioni già presenti sul segmento** section now includes an expandable **Dettaglio condizioni native (diagnostica)** for each rule. The conflict viewer additionally summarizes rule groups that require manual inspection. The four supported wizard classes remain PRIVATE, EV, MOTORCYCLE and TAXI. Other observed native vehicle classes are not discarded or silently converted.

**Safety limits:** This still does not parse/verify country passes, plate parity or suffix rules, specific motor types, SDK numeric weekday bitmasks, conditions combined with AND/OR, vehicle class intersections, or multiple restriction precedence. The `UNKNOWN` and `CONDITIONAL` outcomes remain conservative. Existing native restrictions are not edited, rewritten, exported, or removed. `saveAllowed:false` and `sdkWritePayload:null` are retained. Stable 3.2.0 is untouched.

**Automated tests:** plain native profile; pass plus occupancy plus masked plate; engine presence without exposing its raw value; opaque and invalid attributes; numeric/empty vehicle types; structurally equal vs different vs cyclic legacy profiles; native profile comparison before/after; read-only UI and no write SDK call.

**Suggested live validation:** in both WME Standard and Beta, select a segment with a known native restriction requiring a **pass**, then open **Restrizioni già presenti sul segmento → Restrizione → Dettaglio condizioni native (diagnostica)**. Confirm the pass **count** appears without its ID/value, vehicle types are shown correctly, and the presence of any occupancy/plate/motor condition is reflected accurately. Test a basic native motorcycle restriction and an EV authorization, if available. A screenshot of these diagnostic rows (without private values) will help establish which actual SDK read-model shapes need additional interpretation. No map edits are necessary.

**Next milestone:** confirm real read-model values on WME Standard/Beta, then extend verified native field interpretation and calendar weekday mapping before considering any reversible non-mutating write-model round-trip preview or full SAFE12 validation. Do **not** enable Apply/Save until all remaining write gates have been passed.

## Alpha 23 — Read-only occupancy diagnostics (2026-11-25)

**Live evidence from Alpha 22.** The editor saw `minPassengers` listed as an unknown field on an existing `FREE / FWD / WHOLE_SEGMENT` restriction with a `BLOCKED` motorcycle rule, zero passes and matching legacy/current rule groups. The screenshot did not expose the occupancy value or establish how the native editor interprets it. The weekday list ran from `SUNDAY` to `SATURDAY` and the reported zone was `Europe/Rome`.

**SDK definitions.** The read model `VehicleRule` uses `minPassengers: number` for the minimum required and deprecates `numPassengers` in its favor. `AddableVehicleRule` lists `0 | 2 | 3 | 4`. The read model does not document which defaults are returned for an omitted native occupancy condition, whether the driver is counted, or how WME handles disagreeing aliases. See [VehicleRule Standard](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.VehicleRule.html), [VehicleRule Beta](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.VehicleRule.html), [AddableVehicleRule Standard](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.AddableVehicleRule.html) and [AddableVehicleRule Beta](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.AddableVehicleRule.html).

**Diagnostic behavior.** The inspector reports the field names present. Either name can supply a documented positive minimum (`2`, `3`, `4`). If both are present, the values must agree before a threshold is displayed. A reported `0` is visible and remains `UNKNOWN` for conflict review until checked against the native UI. `1`, other unsupported readings, explicit `null`/`undefined` and conflicting aliases are `UNKNOWN`, with only field names displayed. With neither field present, the inspector records no reported minimum and preserves the existing assessment of the other observed conditions. The deprecated `driveProfiles` comparison remains exact. The diagnostic never rewrites native data or authorizes saving.

**Isolated regression tests.** Both names, both names agreeing/disagreeing, missing fields, zero, the documented positive minima, malformed values, a frozen motorcycle fixture starting from the observed rule shape, and continued `UNKNOWN` conflict handling. The fixture uses a synthetic zero, not the unseen screenshot value. Pass IDs, plate values and engine details stay out of the diagnostic.

**Live acceptance in Standard and Beta.** Update the Guided Alpha, reload WME, and select the same segment with the native motorcycle rule. Open **Existing restrictions on this segment → Restriction → Native condition details (diagnostics)**. Confirm `BLOCKED`/`MOTORCYCLE` and pass count `0` still appear, and that `minPassengers` moves from unknown fields to the occupancy line. Compare that line with the existing rule in WME's native restriction panel. If the diagnostic reports `0`, record whether the native rule shows an occupancy condition. On another existing restriction with an explicit minimum, check that the displayed value matches the native panel. Open and close without applying or saving, and compare pending edits before and after. Record the SDK environment/version and the occupancy label only where useful.

## Alpha 24 — Native plate condition diagnostics (2026-11-25)

**SDK definitions.** `VehicleRule` uses `licensePlateRule` and deprecates `licensePlateNumber` in its favor. The public enum describes single-digit suffixes and parity. `subscriptions` holds required subscription IDs. Engine details are outside the public `VehicleRule` contract. See [VehicleRule](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.VehicleRule.html), [LicensePlateRule Standard](https://web-assets.waze.com/wme_sdk_docs/production/latest/variables/index.SDK.LicensePlateRule.html) and [LicensePlateRule Beta](https://web-assets.waze.com/wme_sdk_docs/beta/latest/variables/index.SDK.LicensePlateRule.html).

**Read-only behavior.** The inspector still shows presence only for plate data. Supported canonical or matching legacy enum values remain conditional. Conflicting aliases, undocumented strings and opaque objects are `UNKNOWN` for the per-vehicle review and are preserved in the original restriction. The legacy empty string accepted by `DriveProfileAttributes` stays readable alongside a canonical null. Pass IDs and engine details remain hidden. Neither country coverage nor Waze app plate semantics are inferred from the enum or the earlier native screenshot.

**Tests and live acceptance.** Node tests cover documented suffix and parity forms, both aliases, mismatch, unrecognized representations and data redaction. In Standard and Beta, inspect an existing plate restriction in the native panel and open the same rule under **Native condition details (diagnostics)**. Verify that the diagnostic reports the condition's presence without showing the suffix or parity, and that vehicle conflict review does not present it as unconditional. Repeat on a rule known to have no plate condition. If available, confirm only count for a pass and presence for an engine condition. Close the panels without applying or saving.

## Alpha 25 — Native calendar diagnostics and SDK update contract (2026-11-25)

**SDK and WME evidence.** Standard and Beta declare `TimeFrame.weekdays` as an array of named `WeekDay` strings or null, despite the prose referring to a bitmask. The Alpha 22 WME capture showed named weekdays. `repeatYearly` is a nullable boolean. `dayAlternation` uses `EVEN_DAYS` or `ODD_DAYS`, with null documented for all dates. `daysOfMonth` is its deprecated alias. The public fields also include ISO civil dates, 24-hour times, and a time-zone identifier. See [TimeFrame Standard](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.TimeFrame.html), [TimeFrame Beta](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.TimeFrame.html), [WeekDay](https://web-assets.waze.com/wme_sdk_docs/production/latest/variables/index.SDK.WeekDay.html) and [DayAlternation](https://web-assets.waze.com/wme_sdk_docs/production/latest/variables/index.SDK.DayAlternation.html).

**Read-only calendar review.** Existing restriction details now show annual recurrence and documented day alternation. Advanced or unrecognized frames request a check in the native panel. The temporal comparison returns uncertainty before testing dates or weekdays for yearly repeats, alternation, numeric/missing weekdays, overnight intervals and opaque or malformed frames. In particular, a Monday overnight interval can reach Tuesday. Touching time endpoints are also uncertain. Simple same-segment comparisons remain a civil-time screening assumption because the draft has no confirmed SDK time zone. The calendar builder does not yet handle overnight intervals, holidays, exclusions or special recurrences. Stable 3.2.0 has holiday/exclusion expansion and monthly occurrence tests that can serve as reference for an eventual shared model.

**Documented update shape.** `SegmentRestrictionData` requires `defaultType`, `direction`, `laneScope` and `vehicleRules`, includes `description` and `laneType`, and allows optional `timeFrames` without `daysOfMonth`. The replacement vehicle-rule shape uses `AddableVehicleRule`, and the update enums name the four lane scopes and include an SDK vehicle category outside the Guided Alpha shortlist (`PUBLIC_TRANSPORTATION`). The public specialized lane enum contains `BUS`, `EXPRESS`, `FAST`, `HOT`, and `HOV`. The applicable lane/direction/country combinations and UI mapping still require evidence. The write contract omits `editable`, `isExpired`, `disposition` and `driveProfiles`, and it cannot express private engine details or all readable vehicle types. `Segments.updateSegment` documents a segment-level `hasToll` affecting both directions and an optional `restrictions` list. Neither atomic application of the two fields nor lossless preservation or rollback follows from this signature. See [SegmentRestrictionData Standard](https://web-assets.waze.com/wme_sdk_docs/production/latest/types/index.SDK.SegmentRestrictionData.html), [SegmentRestrictionData Beta](https://web-assets.waze.com/wme_sdk_docs/beta/latest/types/index.SDK.SegmentRestrictionData.html), [UpdateableRestrictionSegmentLaneScope](https://web-assets.waze.com/wme_sdk_docs/production/latest/variables/index.SDK.UpdateableRestrictionSegmentLaneScope.html), [RestrictionSegmentLaneType](https://web-assets.waze.com/wme_sdk_docs/production/latest/variables/index.SDK.RestrictionSegmentLaneType.html), [AddableVehicleType](https://web-assets.waze.com/wme_sdk_docs/production/latest/variables/index.SDK.AddableVehicleType.html) and [Segments.updateSegment](https://web-assets.waze.com/wme_sdk_docs/production/latest/classes/index.SDK.Segments.html#updateSegment).

**Tests and live acceptance.** Node tests cover recurrence, canonical/legacy alternation, ambiguous aliases, numeric and null weekday representations, opaque frames, touching times and overnight spillover. In WME Standard and Beta, inspect an existing restriction with a simple weekday/time interval and compare days, dates, times and time zone to WME. Repeat with an existing annual or even/odd-day restriction where available. For an overnight rule, use a draft that starts the next morning and confirm that the conflict review remains uncertain. At each step, read only and compare the pending edits before and after. Once these formats are corroborated, use a read-only preservation comparison to identify entries the update contract cannot represent before implementing complete SAFE12 accounting and a Before/After preview.

## Alpha 26 — Preservation snapshots and conflicting legacy data (2026-11-25)

**Read-only preservation.** The draft freshness check compares all own fields of the SDK restriction list, including unexpected fields and `isExpired`, in addition to segment selection/direction. Field order alone does not invalidate a draft. The comparison remains in memory. Cycles, sparse arrays, opaque objects, accessors and values that JSON would omit or coerce cannot establish equality. Such a snapshot is unavailable and the preservation audit stays `UNKNOWN`; known data still requires a verified round trip. This check cannot see fields omitted by the SDK and has no write-side test.

**Conflict screening.** Malformed or non-comparable `driveProfiles` stay `UNKNOWN`, even if the SDK returns the same object in both fields. A repeated rule cannot hide an unknown condition for the same vehicle. Disagreeing `laneScope` and `disposition` cannot establish lane separation. Known possible conflicts remain visible. Automated regressions cover opaque-field and expiry changes, cycles, coercion and getters, alias mismatches and repeated rules.

**Live acceptance.** In Standard and Beta, select a segment with several existing restrictions, including a non-editable entry if available. Record the displayed restriction count and directions, then inspect the preservation audit in the wizard's final summary. Confirm the audit still requires a round trip or reports uncertainty. Close the wizard and confirm the original restrictions and pending edits are unchanged. Select another segment and reopen the wizard to check that its list reflects the new selection. The wizard is modal. Fingerprint changes and opaque input shapes are checked with Node fixtures, without needing to modify restrictions during the live test.

**Toll gate.** The public `Segment` model does not expose `hasToll` as a raw property. `Segments.isTollSegment` returns a derived answer that can also be true because of a toll-free restriction. The answer cannot recover the prior raw flag for rollback. Keep the blue proposal read-only while verifying an official way to distinguish those cases and the behavior of a coordinated flag-plus-restrictions update. See [Segment Standard](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.Segment.html), [Segment Beta](https://web-assets.waze.com/wme_sdk_docs/beta/latest/interfaces/index.SDK.Segment.html) and [Segments.isTollSegment](https://web-assets.waze.com/wme_sdk_docs/production/latest/classes/index.SDK.Segments.html#isTollSegment).

**Read-only toll check.** In both WME environments, choose a segment with both travel directions, draft a blue exemption for one direction and check that the summary keeps the exemption directional while it explains the proposed toll attribute's effect on both directions. Close the wizard and check that native toll status and pending edits are unchanged.

## Alpha 27 — SAFE12 operation counting (2026-11-25)

**Implemented and tested in isolation.** The same two limits as stable 3.2.0 apply to the provided lists for the entire operation, including all retained restrictions and materialized frames for all segments. The count returns an unavailable result for incomplete structures, including sparse lists and missing frames. Tests cover the exact boundary (`12` / `12`), separate overflows of each count across two segments, both limits in the single-segment estimate, and invalid input. No changes were made to stable's existing checks.

**Wizard status.** The single-segment summary uses this count with the existing one-restriction-per-draft-frame estimate. Final SAFE12 validation still depends on the full, verified list of preserved and generated restrictions after advanced calendar expansion. In WME Standard and Beta select a segment with known existing restrictions, create a read-only draft with two separate time slots, and verify the projected counts in the summary equal the existing counts plus two. On an available segment with enough existing restrictions or frames, choose a number of draft slots that moves one count over 12 and check the warning. This screens the estimate only. Close the wizard and confirm pending edits are unchanged.

**Before/After preview prerequisite.** The future preview needs a complete and fresh SDK snapshot, a verified preservation comparison for every native entry, fully expanded generated rules, a batch-wide SAFE12 result, and separate display of the segment toll flag and direction-specific exemptions. Before a write can be considered, matching against the read model must account for noneditable entries and data outside the public update model. A successful numeric count provides no evidence about preservation, permissions, time-zone semantics, toll rollback, or routing precedence.

## Alpha 28 — Overnight ranges in the guided draft (2026-11-25)

**Live acceptance reported for Alpha 27.** The maintainer reported that the read-only checks passed in their area, with overnight range entry as the one issue found. The screenshots show the native motorcycle row (`FREE / FWD / WHOLE_SEGMENT`, group `BLOCKED`, zero passes) reporting an occupancy value of `0` under both field names. The legacy/current rule collections still show as different or not comparable. No routing meaning for the zero was established. The screenshots also show the two-slot SAFE12 estimate (`2` restrictions / `2` time frames), the directional blue exemption and both-direction toll flag preview, and the calendar rejecting `22:00–06:00`. The maintainer accepted the plate diagnostic on the basis of the SDK contract and automated coverage because there are no applicable restrictions in their area. Local live plate verification is not required to close this diagnostic check. Geographic availability and real writes remain separate questions.

**Draft behavior.** The shared red, green and blue calendar accepts a valid end time earlier than the start time. The editor and summary identify the next-day ending. Selected weekdays and calendar dates describe the starts, so a Sunday-only range runs into Monday morning without starting a second range on Monday night. The original times and starting dates stay together in one draft frame and use one slot in the existing preliminary SAFE12 estimate. Equal times remain invalid, and full-day restrictions use **All day**. The [Waze community editing guide](https://www.waze.com/discuss/t/partial-restrictions/377950) describes native next-day behavior, including the morning portion after the last date. The official SDK [TimeFrame](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.TimeFrame.html) documents the fields and `HH:MM` format. This change does not establish the payload, exact time-boundary semantics, or routing behavior. Time-based conflict screening remains `UNKNOWN` when an overnight range might reach another weekday or date. Independently proven direction/lane separation still applies.

**Regression tests and live acceptance.** Node checks cover `22:00–06:00`, an exact midnight endpoint, mixed daytime/overnight ranges, equal and malformed times, SAFE12 counting and the 12-slot limit, and safe handling of a Sunday-to-Monday overlap across the final date. In WME Standard and Beta, choose Sunday only, turn off **All day**, enter `22:00–06:00`, and advance to the summary. Verify that Sunday is still the only starting day, `06:00` is marked as next day, and the estimate adds one restriction and one time frame. Add `08:00–09:00` to confirm a two-slot draft. Repeat with a green or blue draft to check the shared UI. Close without applying, and compare pending edits with the initial state.

## Alpha 29 — Preservation review for each existing restriction (2026-11-25)

**Live evidence.** The maintainer confirmed that Alpha 28 now accepts the overnight range in WME. This confirms guided entry. SDK serialization, routing boundaries and time-zone behavior remain open.

**Public SDK contract.** The current Standard and Beta `SegmentRestrictionData` definitions narrow the read model and omit aliases and read-only metadata. `AddableVehicleRule` specifies the current field names and supported shapes. `PUBLIC_TRANSPORTATION` belongs to the documented SDK update enum even though the wizard intentionally offers four vehicle categories. The earlier observation that an existing rule can use other readable categories remains relevant for preservation. See [SegmentRestrictionData Standard](https://web-assets.waze.com/wme_sdk_docs/production/latest/types/index.SDK.SegmentRestrictionData.html), [SegmentRestrictionData Beta](https://web-assets.waze.com/wme_sdk_docs/beta/latest/types/index.SDK.SegmentRestrictionData.html), [AddableVehicleRule](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.AddableVehicleRule.html), and [AddableVehicleType](https://web-assets.waze.com/wme_sdk_docs/production/latest/variables/index.SDK.AddableVehicleType.html).

**Read-only inspection.** The preservation audit now shows an entry for each existing restriction in the wizard summary. It identifies missing or unsupported field shapes, editability to check, mismatched aliases, and data outside the published model. A missing snapshot keeps the overall audit `UNKNOWN` and still allows unaffected records to show their individual findings. Findings use fixed field paths without displaying subscription IDs, plate values, private engine values, descriptions or arbitrary object keys. A record with no findings from this check still requires a verified round trip. The audit does not produce SDK update data, and conversion remains `BLOCKED`.

**Automated and live checks.** The isolated tests cover documented and unsupported native categories, noneditable and opaque rows, mismatched aliases for lanes, vehicles, occupancy, plates and calendars, and redaction. In WME Standard and Beta, select the previously tested motorcycle segment, reach the wizard summary, and open **SDK conversion review (preview) → Existing restrictions preservation audit → Restriction 1**. Check that findings correspond to the existing entry. If WME returns different legacy and current rule groups again, the entry should identify `driveProfiles / vehicleRules`. If a regular rule has no findings, check that the row says round-trip verification is required. With a segment containing more than one restriction, verify that numbering matches the existing restriction list. Close the wizard and confirm that native restrictions and pending edits are unchanged.

## Alpha 30 — Explain incomplete preservation checks (2026-11-25)

**Live evidence from Alpha 29.** On an unrestricted segment, the maintainer saw zero existing restrictions and WME Save stayed disabled after closing the wizard. On a segment with an existing restriction, the expanded audit row reported `SegmentRestriction` and a generic message about incomplete or non-serializable data. This established that the restriction was present and the exact snapshot check failed. The screenshot does not identify the specific field or representation that failed.

**Read-only diagnostic.** When exact comparison cannot be established, the audit reports the known SDK path and the reason, such as an undefined value, a dynamic property, a circular reference, an unsupported object prototype or a malformed array. It continues the shape checks on ordinary data properties it can inspect. It does not invoke property getters. Paths use public field names and array indexes, with unrecognized keys shown as `[…]`. The report does not expose field values or raw errors. The precise comparison and no-write gates remain in force. Partial data is used only for this diagnostic.

**Automated and live checks.** Regression fixtures exercise nested undefined values, a getter, a circular reference, a custom prototype and a sparse list, and check that other readable fields still appear in the findings. On the same WME segment in Standard and Beta, open the wizard summary, expand **SDK conversion review (preview)**, and open **Restriction 1 · Data to verify**. Capture the path and reason shown by the new check. Save must remain disabled when the wizard is the only action on the map.

## Alpha 31 — SDK accessor aliases and read-only engine count (2026-11-25)

**Live evidence from Alpha 30.** The screenshots show `disposition`, `daysOfMonth`, `numPassengers` and `licensePlateNumber` exposed as dynamic properties. The previous audit reported them as accessors and also as absent or different from their current fields. The native restriction panel shows two motorcycle engine conditions, one for fuel with a displacement threshold and one for fully electric power. The public SDK vehicle rule displayed by the diagnostic omits those engine conditions. This confirms a gap in the read model for this case. The public [VehicleRule](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.VehicleRule.html) and [AddableVehicleRule](https://web-assets.waze.com/wme_sdk_docs/production/latest/interfaces/index.SDK.AddableVehicleRule.html) contracts do not list engine capacity or power fields.

**Stable 3.2.0 reference.** The stable pairs SDK and internal restriction rows by position, with matching list lengths and a direction check when present in the internal data. It reads `getDriveProfileList("BLOCKED") → getDriveProfiles() → getEngineCapacities()` on the internal model. During preset capture it compares the observed conditions with the ones under `engineCapacities` in the original internal JSON and blocks capture if they differ. Its experimental application path restores the private data in the SDK-generated WME restriction action, keeps the SDK-normalized time frames and checks the conditions after the action. See [native motor reader](../dist/Restriction_Manager.user.js#L550), [restriction pairing and preset capture](../dist/Restriction_Manager.user.js#L2526) and [application path](../dist/Restriction_Manager.user.js#L2672).

**Alpha behavior.** The preservation audit identifies documented deprecated accessors, skips comparisons involving unreadable values and continues to flag measurable alias differences. Exact snapshot comparison remains unavailable for these getters. Motorcycle rules with no additional visible condition cannot be assumed unconditional. The diagnostics offer an opt-in count using the stable's private read methods. The count refers to the selected segment and the internal `BLOCKED` group. It exposes no condition values, does not associate SDK and internal rows, and is never used to authorize changes. An incompatible or unavailable internal model gets a separate message.

**Verification.** Node tests cover the observed alias paths, protection from evaluating getters during preservation review, genuine discrepancies and unknown motor effects. They also test the count on mocked models with readable, empty and unavailable conditions. In WME Standard and Beta, on the same segment, expand **Native condition details (diagnostic)** and click **Count engine conditions in the internal model**. If this is the same segment with one restriction and the internal model is available, compare the count with the two conditions visible in the native panel. In the wizard summary, the same alias paths should be reported as deprecated SDK accessors without duplicate discrepancy messages. Saving stays blocked while the association and write-side round trip remain unverified.

## Alpha 32 — Pair internal engine evidence with SDK restrictions (2026-11-25)

**Live evidence from Alpha 31.** The maintainer's screenshots show two engine conditions in the internal-model segment count. The preservation review shows the documented aliases as dynamic and does not claim an alias mismatch. The public motorcycle row still marks engine details for native review.

**Read-only comparison.** The existing opt-in count also inspects the internal `toJSON()` view used by stable 3.2.0. It requires equal SDK and internal list lengths plus a unique association in both directions. The evidence includes direction and shared internal identity fields where present, such as default restriction type and lane scope or type. Ambiguous or unreadable identities keep the segment count and leave individual rows unpaired. Internal list order is not required to match SDK list order.

For an associated restriction, the diagnostic compares engine conditions from the internal getters with the records under `engineCapacities` in the internal JSON. It compares vehicle type, engine type, operator and threshold within each `BLOCKED` profile, retaining profile order and duplicate conditions. A missing or malformed reading stays unavailable or reports a difference when both views are readable. Only row numbers, counts and outcomes are displayed. This is a comparison of existing data in memory. WME application and post-update preservation remain unverified, so saving stays blocked.

**Verification.** Node tests cover a two-condition match, different thresholds or counts, conditions moved between profiles, missing JSON, incompatible shapes, reordered restriction rows and ambiguous assignments. In WME Standard and Beta, select the same motorcycle segment and expand **Native condition details (diagnostic)**. Click **Count engine conditions in the internal model**. Check that the segment total is 2 and note whether **Restriction 1** displays a matching comparison, unavailable comparison or unverified association. Close the wizard and confirm Save is still disabled when the wizard was the only action on the map.

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
