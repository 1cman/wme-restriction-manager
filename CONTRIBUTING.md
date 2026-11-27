# Contributing

Please open an Issue first for major behavior changes. Prefer small pull requests, preserve the userscript ID/namespace to avoid duplicate installations, and keep saved JSON formats backward compatible.

- Run `node --check dist/Restriction_Manager.user.js`, `node --check alpha/Restriction_Manager_Guided_Alpha.user.js`, `node tests/validate.cjs`, and `node tests/guided-alpha.cjs`.
- Describe how the change was verified in WME standard and Beta.
- Do not post real segment IDs, user identifiers, credentials, raw preset backups, or restricted maps in public issues.
- Add translations for all six languages when introducing visible UI strings.
- Treat WME private APIs (motorcycle rules) as experimental: fail safely and document behavior.
- Changes to update URLs or release metadata must be reviewed. Releases are drafts until the maintainer publishes them.
