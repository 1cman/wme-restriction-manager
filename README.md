# Restriction Manager for Waze Map Editor

Uno userscript indipendente per gli editor Waze: preset di restrizioni, calendari, festività, anteprima delle modifiche e controllo dei possibili conflitti. Interfaccia in **IT / EN / FR / ES / DE / PT**.

An independent WME userscript for restriction presets, calendars, holidays, change preview, and potential-conflict detection. Interface in **six languages**.

> **Community project, not an official Waze product.** Make a JSON backup first, check preview and pending WME changes before saving. WME private APIs used for motorcycle engine conditions may change at any time.

## Install / Installazione

**Until the repository's first GitHub Release is published**, install the candidate file `dist/Restriction_Manager.user.js` manually in Tampermonkey. Automatic updates are **not yet enabled** in the unconfigured template.

After publication, install the `Restriction_Manager.user.js` asset from the **latest stable Release**. The release-built script will contain `@updateURL` and `@downloadURL` pointing to that stable asset. Existing manually installed copies without those headers may need one reinstall to adopt automatic updates.

## Use / Utilizzo

1. Open WME standard or Beta. / Apri WME standard o Beta.
2. Open the **Restriction Manager** sidebar tab. / Apri la scheda laterale.
3. Save a preset from a selected segment, or configure a calendar. / Salva un preset oppure configura un calendario.
4. **Preview the changes** before confirming. / Verifica sempre l'anteprima.
5. Review the resulting pending WME changes before saving the map. / Controlla le modifiche WME prima di salvarle.

### Calendars and holidays

Choose the relevant holiday country and optionally an ISO 3166-2 subdivision. Holiday dates are imported from Nager.Date and stored in each calendar backup. Local festivities and school holidays may require manual exclusions. Verify official local rules before applying restrictions.

### Maintenance / Manutenzione

Use **Tools / Strumenti → SDK compatibility** to view WME and SDK versions, available functions and experimental motorcycle-internal status.

Use **Tools / Strumenti → Diagnostic log / Registro diagnostico** to export an optional JSON report when opening a GitHub issue. It is local to the browser and intentionally excludes segment identifiers, coordinates, usernames, preset names and stored restriction data. Read the exported file before posting.

## Development

No runtime translation library or npm dependencies are required. For local checks:

```bash
node tests/validate.cjs
node --check dist/Restriction_Manager.user.js
```

## Publishing / Pubblicazione

1. Create a GitHub public repository (recommended name `wme-restriction-manager`).
2. Configure **your own GitHub owner and repo name** in the userscript headers:

   ```bash
   node scripts/configure-release-urls.mjs YOUR_GITHUB_USERNAME wme-restriction-manager
   node tests/validate.cjs
   node scripts/check-release.cjs 3.1.1
   ```

3. Commit the files to `main` and enable **Actions** and **Issues**.
4. Go to **Actions → Draft a tested release → Run workflow** and enter `3.1.1`.
5. The workflow verifies the script and creates a **draft** Release with the installable `.user.js` asset. Review and test it, then click **Publish release** (not *Pre-release* for stable distribution).
6. Only after publication does GitHub's `/releases/latest/download/Restriction_Manager.user.js` URL point to that stable version. Tampermonkey checks for a newer `@version` using `@updateURL` / `@downloadURL` according to its settings.
7. Publish subsequent stable updates by incrementing `@version`, updating `CHANGELOG.md`, testing, and manually publishing a new Release draft. Keep experimental versions as pre-releases or separate branches.

**Important:** The template does **not** contain a real GitHub owner or release URL yet. Do not distribute it as automatically updating until step 2 and the first published stable Release.

## Bug reports and new ideas

Use GitHub **Issues → New issue**. Choose Bug report or Feature request. The bug template requests the environment, script version, reproduction steps, expected/actual outcomes and an optional sanitized diagnostic report. Never share tokens, login details or private editing information.

## Compatibility and limits

The script checks for public SDK capabilities, rather than relying on a fixed minimum version. It reports whether the private WME action/model objects are detectable, but this check **does not guarantee** that the experimental motorcycle path will behave correctly after every WME update.

Some operations use WME internal model structures. Multi-segment updates can be partially applied if a later segment fails. Calendar expiration alerts do not change map restrictions automatically. This project is maintained by its contributors and is not endorsed by Waze.

## License

MIT, respecting original contributions and attribution. Review upstream attribution before the first public release.
