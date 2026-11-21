# Restriction Manager for Waze Map Editor

**Restriction Manager (SDK)** is an independent Tampermonkey userscript for Waze Map Editor (WME). It provides reusable restriction presets, calendars with holiday exclusions, before/after previews, conflict warnings and SDK diagnostics.

**Restriction Manager (SDK)** è uno userscript indipendente per Tampermonkey e Waze Map Editor (WME), con preset di restrizioni, calendari e festività, anteprime Prima/Dopo, controllo dei conflitti e diagnostica SDK.

**Interface languages / Lingue:** 🇮🇹 Italiano · 🇬🇧 English · 🇫🇷 Français · 🇪🇸 Español · 🇩🇪 Deutsch · 🇵🇹 Português

> [!IMPORTANT]
> **Community project, not an official Waze product. / Progetto della community, non è un prodotto ufficiale Waze.**
> Export a JSON backup before updating, check the preview before applying, and inspect pending changes before saving WME.
> Esporta un backup JSON prima di aggiornare, controlla l'anteprima prima dell'applicazione e verifica le modifiche in sospeso prima di salvare WME.

## ⬇ Install / Installazione

### [Install the latest stable userscript / Installa l'ultima versione stabile](https://github.com/1cman/wme-restriction-manager/releases/latest/download/Restriction_Manager.user.js)

[Latest stable release / Ultima release](https://github.com/1cman/wme-restriction-manager/releases/latest) · [Changelog / Novità](CHANGELOG.md) · [Report a bug / Segnala un bug](https://github.com/1cman/wme-restriction-manager/issues/new/choose)

1. Install **Tampermonkey** in your browser. / Installa **Tampermonkey** nel browser.
2. Open the installation link above and install the userscript. If the browser downloads a file instead of opening the Tampermonkey installer, import the downloaded .user.js file into Tampermonkey. / Apri il link e installa lo script; se viene scaricato un file, importalo in Tampermonkey.
3. Open [WME Standard](https://www.waze.com/editor) or [WME Beta](https://beta.waze.com/editor), then find the **Restriction Manager** tab in the sidebar. / Apri WME Standard o Beta e cerca la scheda **Restriction Manager** nella barra laterale.

The stable userscript includes **@updateURL** and **@downloadURL**, pointing to the latest published stable GitHub Release. Tampermonkey checks for updates according to its settings. Older manual installations without these fields may need a fresh installation.

Lo script stabile contiene **@updateURL** e **@downloadURL** verso l'ultima Release stabile pubblicata. Tampermonkey verifica gli aggiornamenti secondo le proprie impostazioni. Le vecchie installazioni prive di questi metadati potrebbero richiedere una reinstallazione.

## 🆕 Monthly recurrences and SAFE12 / Ricorrenze mensili e limite SAFE12 (v3.2.0)

**🇮🇹 Italiano**

- Crea ricorrenze come **il secondo martedì di ogni mese**, **l'ultimo venerdì** o **il giorno 15 di ogni mese**, scegliendo la finestra iniziale e da 1 a 12 mesi.
- La generazione è **limitata a 12 restrizioni e 12 definizioni temporali complessive per singola operazione**, sommando tutte le regole, i preset, le restrizioni conservate e **tutti i segmenti selezionati**. Una selezione di due segmenti con 7 restrizioni ciascuno viene bloccata (7 + 7 = 14).
- Il limite viene controllato durante la preparazione del calendario, l'anteprima e prima dell'aggiornamento WME. Se la configurazione supera il limite, **l'operazione viene bloccata**: non viene ridotta automaticamente.
- L'opzione **Ripeti ogni anno** non è disponibile per le ricorrenze speciali (mensili, giorno della settimana in un mese specifico, Pasqua). I calendari settimanali ordinari possono continuare a ripetersi.
- Prima della scadenza delle ricorrenze mensili viene proposto **Prepara il rinnovo mensile**. Il rinnovo sposta la finestra nel **calendario salvato localmente**, dopo conferma dell'editor; **non modifica i segmenti WME**. L'editor deve verificare festività e esclusioni, salvare e applicare separatamente le modifiche ai segmenti corretti.
- Per le ricorrenze numeriche, i mesi che non contengono il giorno scelto sono saltati (ad esempio il 31 febbraio). Si consiglia di salvare un permalink dei segmenti interessati.
- Prima di aggiornare, **esporta un backup JSON**. Un calendario preesistente con più di 12 restrizioni generate deve essere corretto prima di essere riapplicato con la nuova versione.

**🇬🇧 English**

- Create monthly rules such as the **second Tuesday of every month**, **last Friday**, or **day 15 of each month** over a configurable 1–12-month window.
- A strict **12-restriction and 12-time-frame maximum per operation** applies across all rules, templates, retained restrictions and **selected segments combined**. Two selected segments with 7 restrictions each are blocked (7 + 7 = 14).
- Limits are checked at calendar preparation, preview and immediately before WME writes. Exceeding a limit **blocks the operation**, without silently truncating it.
- **Repeat every year** is disabled for special occurrences (monthly rules, nth weekday in a given month, Easter), while ordinary weekly recurrences remain available.
- As monthly occurrences near expiration, **Prepare monthly renewal** proposes the next window, but updates **only the local saved calendar** after editor confirmation. **No WME segments are changed**. The editor must check holidays/exclusions, save and explicitly reapply the calendar to the intended segments.
- Months without the chosen numerical date are skipped (for example, February 31). Editors should keep a permalink to the affected segments.
- **Export a JSON backup before upgrading.** Older calendars generating more than 12 restrictions must be revised before they can be reapplied.

> **Safety note / Nota di sicurezza:** Automated tests validate our userscript's limits, not the behavior of WME servers or private editor APIs. Review the preview and pending edits. / I test automatici verificano i limiti dello script, non il comportamento dei server WME o delle API interne. Controlla sempre anteprima e modifiche in sospeso.

## Quick start / Guida rapida

### 🇮🇹 Italiano

1. **Preset:** seleziona un segmento in WME, imposta le restrizioni e salva un preset con un nome nella scheda **Preset**.
2. **Calendari:** scegli giorni, fasce orarie e periodo di validità. Seleziona Paese e Regione per le festività; aggiungi manualmente eventuali altre chiusure.
3. **Applica:** seleziona i segmenti di destinazione, scegli il preset o calendario e apri **l'anteprima Prima/Dopo**.
4. **Verifica:** controlla le direzioni, le restrizioni sostituite e i possibili conflitti. Conferma, verifica le modifiche in sospeso e salva in WME.
5. **Strumenti:** trovi backup JSON, compatibilità SDK e registro diagnostico.

### 🇬🇧 English

1. **Presets:** select a WME segment, configure restrictions, then name and save a preset in **Presets**.
2. **Calendars:** choose weekdays, time slots and validity dates. Set the holiday country and optional region; add any extra closures manually.
3. **Apply:** select destination segments, choose a preset or calendar and open the **Before/After preview**.
4. **Review:** inspect directions, replaced restrictions and potential conflicts. Confirm, review pending WME changes and save the map.
5. **Tools:** JSON backups, SDK compatibility and diagnostic log.

### 🇫🇷 Français

1. **Préréglages :** sélectionnez un segment WME, configurez les restrictions, puis nommez et enregistrez un préréglage.
2. **Calendriers :** définissez jours, horaires et dates de validité. Choisissez le pays et éventuellement la région pour les jours fériés ; ajoutez les exclusions locales.
3. **Appliquer :** sélectionnez les segments de destination, choisissez le préréglage ou calendrier et ouvrez l'**aperçu Avant/Après**.
4. **Vérifier :** contrôlez les directions, les restrictions remplacées et les conflits possibles ; confirmez, vérifiez les modifications en attente et enregistrez dans WME.
5. **Outils :** sauvegardes JSON, compatibilité SDK et journal de diagnostic.

### 🇪🇸 Español

1. **Ajustes predefinidos:** selecciona un segmento WME, configura las restricciones, asigna un nombre y guarda el ajuste.
2. **Calendarios:** define días, franjas horarias y fechas de validez. Selecciona el país y, si procede, la región para los festivos; añade otras exclusiones manualmente.
3. **Aplicar:** selecciona los segmentos de destino, elige un ajuste o calendario y abre la **vista previa Antes/Después**.
4. **Revisar:** comprueba direcciones, restricciones sustituidas y posibles conflictos. Confirma, revisa los cambios pendientes y guarda en WME.
5. **Herramientas:** copias JSON, compatibilidad SDK y registro de diagnóstico.

### 🇩🇪 Deutsch

1. **Vorlagen:** Wähle ein WME-Segment, konfiguriere die Beschränkungen und speichere eine benannte Vorlage.
2. **Kalender:** Lege Wochentage, Zeitfenster und Gültigkeit fest. Wähle das Land und bei Bedarf die Region für Feiertage; füge weitere Ausnahmen manuell hinzu.
3. **Anwenden:** Wähle die Zielsegmente und eine Vorlage oder einen Kalender und öffne die **Vorher/Nachher-Vorschau**.
4. **Prüfen:** Kontrolliere Richtungen, ersetzte Beschränkungen und mögliche Konflikte. Bestätige, prüfe die ausstehenden WME-Änderungen und speichere.
5. **Werkzeuge:** JSON-Sicherungen, SDK-Kompatibilität und Diagnoseprotokoll.

### 🇵🇹 Português

1. **Predefinições:** seleciona um segmento WME, configura as restrições e guarda uma predefinição com um nome.
2. **Calendários:** define dias, horários e datas de validade. Seleciona o país e, se necessário, a região para os feriados; adiciona as restantes exclusões manualmente.
3. **Aplicar:** seleciona os segmentos de destino, escolhe uma predefinição ou calendário e abre a **pré-visualização Antes/Depois**.
4. **Verificar:** confirma as direções, as restrições substituídas e os possíveis conflitos. Confirma a operação, verifica as alterações pendentes e guarda no WME.
5. **Ferramentas:** cópias JSON, compatibilidade SDK e registo de diagnóstico.

> **Holiday scope / Ambito delle festività:** The interface language follows WME, but holiday **country and region** are selected separately. Public holiday imports may not cover municipal holidays or school closures; verify local rules and add exclusions manually when needed.
> La lingua segue WME, ma **Paese e Regione** per le festività sono impostati separatamente. Le festività importate potrebbero non includere le ricorrenze comunali o le vacanze scolastiche.

## 🐛 Bug reports and suggestions / Segnalazioni e suggerimenti

**[Open a bug report / Segnala un bug](https://github.com/1cman/wme-restriction-manager/issues/new/choose)** · **[Suggest a feature / Proponi una funzione](https://github.com/1cman/wme-restriction-manager/issues/new/choose)** · **[Browse all issues / Tutte le segnalazioni](https://github.com/1cman/wme-restriction-manager/issues)**

Choose **Bug report / Segnalazione bug** or **Feature request / Nuova funzione**. These forms are available in the repository.

For a useful report, include / Per una segnalazione utile, indica:

- **Script version / Versione dello script** (for example, 3.1.1).
- **WME environment / Ambiente WME:** Standard, Beta or both; browser and Tampermonkey version if relevant.
- **Steps to reproduce / Passaggi per riprodurre**.
- **Expected and actual result / Risultato atteso ed effettivo**.
- **Optional diagnostic JSON / JSON diagnostico facoltativo:** Restriction Manager → **Tools / Strumenti** → **Diagnostic log / Registro diagnostico** → Export / Esporta.

**Privacy / Privacy:** Review any diagnostic file before attaching it. Never publish tokens, passwords, personal data, confidential WME editing details or sensitive screenshots. / Controlla gli allegati prima di pubblicarli; non condividere credenziali, dati personali o dettagli riservati della mappa.

## Compatibility and limits / Compatibilità e limiti

- The stable **v3.1.1** has been user-tested on **WME Standard and Beta**. / La **v3.1.1** è stata collaudata su **WME Standard e Beta**.
- SDK diagnostics check required API capabilities, but cannot guarantee compatibility with all future WME releases. / La diagnostica verifica le funzioni SDK richieste, ma non può garantire la compatibilità con ogni aggiornamento futuro.
- Motorcycle engine conditions depend partly on **private WME APIs** and may need adaptation. / Le condizioni motore per le motociclette dipendono in parte da **API interne WME**.
- Multi-segment updates are **not atomic**: earlier segments may already have pending changes if a later operation fails. / Le modifiche a più segmenti **non sono atomiche**.
- Calendar expiration reminders **do not automatically update WME restrictions**. / Gli avvisi di scadenza **non aggiornano automaticamente le restrizioni**.

## Development and controlled releases / Sviluppo e distribuzione

The userscript has no external translation-library dependency. / Nessuna dipendenza esterna per le traduzioni.

**Local validation / Verifiche locali:**

    node tests/validate.cjs
    node --check dist/Restriction_Manager.user.js

**Maintainer release workflow / Pubblicazione nuove versioni:**

1. Update **@version** and **SCRIPT_VERSION**, and document changes in [CHANGELOG.md](CHANGELOG.md).
2. Run validation, then test in WME Standard and Beta.
3. Commit reviewed changes to **main** and confirm [GitHub Actions](https://github.com/1cman/wme-restriction-manager/actions) passes.
4. Run **Actions → Draft a tested release**, entering the version **without the v prefix**.
5. Verify the draft and the **Restriction_Manager.user.js** asset; publish only when ready for stable distribution. Keep experiments in separate branches or pre-releases.

Only **published stable Releases** are targeted by automatic updates; a commit to main is not itself a new stable version. / Solo le **Releases stabili pubblicate** attivano gli aggiornamenti; un commit su main non è una nuova versione stabile.

## License and attribution / Licenza e attribuzioni

MIT license: [LICENSE](LICENSE). Preserve the attribution of original contributors when redistributing this community project. / Licenza MIT: preservare le attribuzioni dei contributori originali. Questo progetto non è affiliato ufficialmente a Waze.
