# Changelog

Version numbers follow the MAJOR.MINOR.PATCH convention. Stable builds are distributed via GitHub Releases.

## [3.2.0] — 2026-11-21
### Added
- Monthly nth-weekday and numerical day-of-month occurrences, with a configurable 1–12 month window.
- Renewal preparation and expiry reminder; the editor must confirm changes to the saved local calendar and separately reapply them to WME segments.
### Safety
- Limit all restrictions and time-frame definitions to 12 for an entire operation, including retained restrictions and all selected segments.
- Disable yearly repetition when special occurrences are configured; reject incompatible legacy configurations on application.
- Validate calendar expansion, import, preview and the SDK write path; never silently truncate results over the cap.
- Expand automated regression coverage for calendar, recurrence and batch edge cases.
### Notes
- No automatic updates to WME segments on calendar renewal.
- Use JSON backup before installing. Always review previews, WME pending changes, and official local schedules.

## [3.1.2] — 2026-11-19 (released)
### Fixed
- The sidebar header version badge now reads the runtime SCRIPT_VERSION instead of a hardcoded older number.
- New tests guard against static version badges, so future releases keep the label in sync.
### Unchanged
- All restriction, calendar, holiday, preview, diagnostics and multilingual behaviors.

## [3.1.1] — 2026-11-18 (released)
### Fixed
- Resolve asynchronous SDK and WME version getters in the compatibility panel.
- Identify Beta/Standard environment with the async SDK.
- Include resolved version data in JSON diagnostic exports.
### Unchanged
- Presets, calendars, preview, conflict checks, and multilingual UI.

## [3.1.0] — 2026-11-18 (tested on WME production/Beta; diagnostics issue found)
### Added
- SDK capability report (version, environment, required and optional functions).
- Small local-only diagnostic log with bounded history, redacted counters and JSON export.
- A recheck button and clear-log action in Tools.
- Repository scaffold, GitHub issue templates, CI and manual draft-release workflow.
### Changed
- Removed a debug statement that printed raw saved presets to the browser console.
### Known limits
- Private WME APIs for motorcycle engine conditions remain experimental.
- Multi-segment operations are not atomic; an error may occur after earlier segments were updated locally.
- WME production/Beta editing was user-tested; async SDK metadata displayed n/a (fixed in 3.1.1).

## [3.0.2] — 2026-11-18 (user-tested)
- Automatic country-based holiday selection and dynamic ISO subdivision choices.
- Removed the Italy-only holiday checkbox; legacy calendars preserved.

## [3.0.1] — 2026-11-17
- Tampermonkey cross-origin holiday requests and Nager.Date v4 integration.

## [3.0.0] — 2026-11-17
- Holiday territory selection and calendar expiration notices.

## [2.9.0] — 2026-11-17 (user-tested)
- Before/after preview of changes and potential overlap/conflict detection.

## [2.8.0] — 2026-11-17 (user-tested)
- Internal translation dictionaries: Italian, English, French, Spanish, German and Portuguese.

## [2.7.x] — 2026-11
- National holidays, custom excluded dates and periods; Beta SDK initialization fallback.

## [2.6.x] and earlier
- Calendar library, mobile dates, motorcycle engine data, direction inversion, responsive WME sidebar and JSON backup.
