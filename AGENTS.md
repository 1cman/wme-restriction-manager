# AGENTS.md — Restriction Manager (WME) / Guided Creator 4.0

> Istruzioni per gli agenti che lavorano in questo repository. Stato verificato al **27 novembre 2026**; leggere sempre i file e il branch correnti, che possono cambiare.
>
> **Stabile:** `3.2.0` su `main`. **Sviluppo attivo:** `4.0.0-alpha.44` su `develop/v4-guided-restrictions`. La Alpha è separata e **soltanto in lettura** fino al completamento di tutte le verifiche di sicurezza (Fasi 0–2).

## Fonti da leggere prima di toccare codice

1. **`docs/GUIDED_CREATOR_ROADMAP.md`** — storia *integrale* delle Alpha 4–44, screenshot/evidenze native, decisioni, rischi, collaudi, backlog e attività successive. Conservare questo documento: contiene molti più dettagli del presente sommario. Le sezioni storiche possono riportare comportamenti successivamente corretti (in particolare la semantica del rosso): prevalgono codice corrente e ultime sezioni della roadmap.
2. **`alpha/Restriction_Manager_Guided_Alpha.user.js`** — implementazione reale del wizard (e base dell'evoluzione verso Restriction Manager 4.0).
3. **`tests/guided-alpha.cjs`** — test isolati delle funzioni pure, integrità delle 6 lingue e verifiche di non-scrittura.
4. **`dist/Restriction_Manager.user.js`**, **`README.md`**, **`tests/validate.cjs`**, **`docs/RELEASE_NOTES_3.2.0.md`** — funzionalità, API e invarianti della stabile.
5. **`docs/CODEX_HANDOFF_PROMPT.md`** — prompt di continuità per nuove sessioni.

## Architettura e dipendenze

- **Userscript autonomi Tampermonkey**, senza build o dipendenze npm dichiarate: funzionano su **Waze Map Editor Standard e Beta**, tramite **SDK ufficiale WME**. Mantengono **namespace e ID distinti**, quindi possono essere installati insieme.
- `dist/Restriction_Manager.user.js` (**3.2.0**) è la versione stabile, con `@grant GM_xmlhttpRequest`, `@grant unsafeWindow` e `@connect nagerholidays.com`. Usa `unsafeWindow` per accedere alla pagina/SDK; `localStorage` per preset (`rtmgr:`), calendari (`rmcal:`) e diagnostica; servizio Nager.Holidays per festività pubbliche/territoriali. Ha import/export JSON, preset, calendari avanzati, festività/esclusioni, ricorrenze mensili, rinnovo assistito, anteprima Prima/Dopo, rilevamento preliminare conflitti, diagnostica e applicazione di modifiche **in sospeso** tramite `sdk.DataModel.Segments.updateSegment` con conferma dell'editor; il **Save nativo WME è manuale**. Alcune condizioni motore dipendono da API **private `W.model`**.
- `alpha/Restriction_Manager_Guided_Alpha.user.js` (**4.0.0-alpha.44**) ha `@grant unsafeWindow`, un ID separato `rm-guided-alpha`, **nessun salvataggio / rete / modifica mappa**, lettura SDK, diagnostica opt-in del modello interno per moto/calendari, wizard guidato, controllo conflitti bloccante e serializzatore/round-trip puro SDK in sola lettura (Fase 1). Esporta in Node funzioni pure, `VERSION`, `LANGS`, `labels` e `vehicleLabels` tramite `module.exports` per testare senza eseguire WME.
- `tests/validate.cjs` controlla la stabile; `tests/guided-alpha.cjs` usa Node built-in `assert`/`vm` per la Alpha (incluse verifiche complete su tutte le chiavi delle 6 lingue). Workflow `.github/workflows/checks.yml`: Node **22**, `concurrency` per evitare run duplicati su push/PR, `node --check` su entrambi gli userscript e entrambe le suite di test. Workflow `draft-release.yml` e script `scripts/*` servono al rilascio stabile, non alla Alpha.

**NON MODIFICARE la stabile**, non promuovere la Alpha in `main` o in Releases e non cambiare il formato backup/preset senza richiesta esplicita. La stabile 3.2.0 non è stata sostituita dalla Alpha.

## Regole di sicurezza non negoziabili

- **Alpha read-only (Fasi 0–2)**: nessun `updateSegment`, `undo`/azione WME di scrittura, persistenza locale, invio esterno o auto-Save. La verifica di conversione deve continuare a produrre `status:"BLOCKED"`, `saveAllowed:false`, `verified:false`, `sdkWritePayload:null` finché ogni controllo di Fase 1 e Fase 2 non è completato e approvato.
- **Non eliminare né alterare** restrizioni già presenti, comprese restrizioni non modificabili (`editable: false`), con categorie SDK non selezionabili nel wizard, formati legacy, condizioni moto sperimentali (`engineCapacities` fuori dallo schema `AddableVehicleRule` SDK) o campi sconosciuti. Se non interpretabile → **UNKNOWN / blocco**, non "nessun conflitto".
- **Gestione obbligatoria delle restrizioni esistenti (regola di prodotto confermata dall'editor):**
  - Se sui segmenti selezionati esistono già restrizioni, l'editor deve essere **avvisato immediatamente** (pannello laterale e Step 0) con accesso diretto alla modifica o eliminazione.
  - **È vietato aggiungere restrizioni potenzialmente in conflitto o sovrapposte** (blocco rigido fail-closed su `POTENTIAL_CONFLICT`, `OVERLAP_REVIEW`, `UNKNOWN`); occorre prima modificare o eliminare e ricreare le restrizioni esistenti.
  - Quando si introdurrà la modifica/eliminazione guidata dentro 4.0 (Fase 2), operare solo su singole restrizioni con `editable: true` e anteprima Prima/Dopo, senza mai toccare `editable: false` e mantenendo sempre il fallback al pannello nativo WME.
- Non trattare `SegmentRestriction` (lettura) come `SegmentRestrictionData` (scrittura). Verificare API e modelli **ufficiali aggiornati** e la UI nativa prima di introdurre qualunque serializzazione reale.
- Non inventare enum SDK, semantica delle condizioni `AND/OR`, precedenze, compatibilità per Paese, date, codici moto o targa. Distinguere sempre **fonte SDK**, **screenshot/collaudo utente**, **test simulato** e **ipotesi di progetto**.
- Non mostrare/loggare identificativi dei pass, valori delle targhe o dettagli motore riservati; nelle diagnostiche mostrare soltanto presenza, conteggio, nomi di campo e categorie quando necessario.
- Conservare le **sei lingue** `it/en/fr/es/de/pt` e l'esperienza WME Standard/Beta. Tenere `@version` uguale a `VERSION`. Non scambiare test Node verdi con collaudo live.

## Scelte funzionali consolidate della Alpha (non regredire)

- **Selezione e accesso:** attualmente **un solo segmento** tramite `sdk.Editing.getSelection` e `sdk.DataModel.Segments.getById` (multi-segmento previsto in Fase 5); Paese derivato dall'**indirizzo del segmento**, non dalla lingua editor. Scheda `RM Guided Alpha` e pulsante **Crea restrizione guidata** accanto al comando nativo **Aggiungi/Modifica restrizioni**; il pulsante nativo di modifica rimane utilizzabile anche dalla scheda dello script (`findNativeAnchor(allowHidden)` con guida `edit_native_switch_tab` se il pannello segmento è smontato).
- **Preflight SDK in sola lettura (`alpha.40`):** `readContext` interroga `Segments.hasPermissions({segmentId})`, `Segments.isRoadTypeDrivable({roadType})` (con `segment.isDrivable`) e `Segments.isTollSegment({segmentId})`; `inspectSegmentEligibility` e `inspectSegmentTollState` classificano in modo conservativo permessi, percorribilità e stato pedaggio.
- **Avviso immediato e blocco conflitti (`alpha.41–42`):** `inspectExistingRestrictionNotice` mostra banner di avviso (`role="alert"`) nella scheda laterale e allo Step 0; `evaluateConflictGate` blocca in modo rigido (Step 7, `advance()` e `reviewSdkConversion`) ogni aggiunta non provatamente `NONE` o `SEPARATE`. Gli input data/ora/numeric aggiornano feedback e pulsante Avanti in-place senza perdere focus, e `<dialog>` isola `keydown`/`keyup`/`keypress` per impedire al tastierino numerico di spostare la mappa WME.
- **Quattro sole categorie selezionabili per nuove restrizioni**, nell'ordine: `PRIVATE` (Auto private), `EV` (Veicoli elettrici), `MOTORCYCLE` (Motociclette), `TAXI` (Taxi). Scelta dell'editor, **non** prova che altri tipi SDK non funzionino nel client. Leggere e preservare comunque tutte le categorie native esistenti.
- **Tre tipologie con sfondi rosso / verde / azzurro:**
  - **Rosso «Transito vietato»**: **nessun tipo selezionato = tutti vietati**, regola `BLOCKED` generale; **tipi selezionati = solo quei tipi vietati**, base `FREE` e regole `BLOCKED` per i selezionati. **Non** trattare i selezionati come esentati. Nessun pass/occupanti/targa nel percorso rosso. Solo con `MOTORCYCLE`, passaggio facoltativo per motore sperimentale; poi date/orari.
  - **Verde «Transito consentito»**: selezionare **almeno un tipo**; base `BLOCKED` con regole `FREE` per gli autorizzati. Ogni categoria ha **condizioni proprie**: pass e/o occupanti; le categorie scelte senza condizioni sono autorizzate direttamente. Scelta pass alfabetica con ricerca/autocompletamento. **Pass PRIVATE non si applica automaticamente a EV** (collaudo positivo). Poi date/orari.
  - **Azzurro «Transito esente da pedaggio»**: tipi esentati, base `TOLL` con regole `FREE`; salta pass/occupanti/targa, va direttamente a date/orari. Predispone **solo come progetto** `hasToll:true`; l'attributo della strada interessa **ENTRAMBE** le direzioni anche per esenzione unidirezionale. Coordinamento atomico/rollback non verificato.
- **Motori moto (`alpha.32–38`):** il contratto SDK pubblico `AddableVehicleRule` omette `engineCapacities` (evidenza sorgente Standard/Beta). La stabile 3.2.0 conserva dati reali via modello interno `W.model`. La Alpha offre solo diagnostica opt-in del conteggio/parità motore e segnala il gap di preservazione SDK in Prima/Dopo; i filtri motore restano bozza sperimentale bloccata in scrittura finché gestiti in Fase 4.
- **Targhe:** guida Waze descrive ultime due cifre in aree/città di 7 Paesi; screenshot WME portoghese mostrava ultima cifra 0. Non equiparare le due rappresentazioni; non implementate in scrittura.
- **Corsie:** scopo del segmento (`WHOLE_SEGMENT/LEFT_LANE/MIDDLE_LANE/RIGHT_LANE`) e tipo (`lane_none/express/fast/hov/public_transport/carpool_toll_free`). I codici interni osservati sono `INTERNAL_LANE_SCOPES` / `INTERNAL_LANE_TYPES`; i tipi speciali restano bloccati in scrittura finché verificati (Fase 4).
- **Calendari e SAFE12 (`alpha.30–39`):** `normalizeRedSchedule` è condivisa dalle tre tipologie (supporta fasce notturne con avviso giorno successivo in bozza); confronto read-only tra calendario SDK e JSON interno (`inspectInternalCalendarPreservation`) con fuso orario registrato (`Europe/Rome` confermato live). `countSafe12Operation` / `estimateGuidedOperationBudget` allineati ai limiti SAFE12 della stabile (max 12 restrizioni e 12 fasce per intera operazione).
- **Diagnostica nativa (`alpha.22–39`):** `minPassengers` e `numPassengers` gestiti entrambi in lettura (`ZERO` / `MINIMUM` / `UNKNOWN`); alias deprecati SDK (`disposition`, `driveProfiles`, `daysOfMonth`, `numPassengers`, `licensePlateNumber`) riconosciuti nello snapshot di freschezza senza perdere rigore nell'audit di preservazione.

## Collaudi live confermati

L'editor ha confermato in **WME Standard e Beta** tutti i traguardi fino a **`4.0.0-alpha.42`**: pass indipendenti, fasce orarie, corsie, diagnostica nativa (`minPassengers`, calendario SDK vs interno `Europe/Rome`, conteggio/confronto opt-in condizioni motore), preflight permessi/percorribilità/stato pedaggio (`alpha.40`, 5 screenshot), avviso immediato restrizioni esistenti e blocco conflitti (`alpha.41`), persistenza del pulsante di modifica nativa dalla scheda script, conservazione del focus negli input orari e isolamento tastiera del tastierino numerico (`alpha.42`: *"perfetto adesso funziona tutto correttamente"*).

## Piano approvato verso Restriction Manager 4.0

1. **Fase 0 (`alpha.43`, completata):** pulizia repository, rimozione codice/label morti, controllo automatico completo di tutte le chiavi nelle 6 lingue, deduplicazione CI (`concurrency` + `node --check`), riallineamento documentazione.
2. **Fase 1 (`alpha.44–45`, prossima — ancora read-only):** serializzatore puro `SegmentRestrictionData` + `AddableVehicleRule` + round-trip lossless delle restrizioni SDK preesistenti (fail-closed per `editable: false`, campi/tipi sconosciuti, `engineCapacities`, tipi corsia speciali) e anteprima Prima/Dopo strutturata.
3. **Fase 2 (`alpha.46–47`, ancora read-only):** flusso **«Modifica guidata»** (per singola restrizione `editable: true` rappresentabile senza perdite) ed **«Elimina / Elimina e ricrea»** nel wizard con diff Prima/Dopo e fallback al pannello nativo WME.
4. **Fase 3 (`alpha.48–50`, prima scrittura controllata singolo segmento):** abilitazione graduale di `Segments.updateSegment` (solo modifiche pendenti, conferma esplicita, rilettura post-scrittura, `undo` su discrepanza, **Save manuale WME**) **esclusivamente** per il perimetro 100% SDK (`laneType: null`, rosso senza motore, verde, modifica/eliminazione `editable: true`), con blocco esplicito se la lettura opt-in rivela condizioni motore non rappresentabili via SDK.
5. **Fase 4 (`alpha.51–53`):** casi avanzati verificati uno per uno — preservazione/scrittura condizioni motore moto (modello interno sicuro come stabile 3.2.0), tipi corsia speciali e gestione coordinata `hasToll` con reversibilità.
6. **Fase 5 (`4.0.0-beta.1+`):** integrazione delle funzioni della stabile `3.2.0` (multi-segmento con SAFE12 globale, orari separati per direzione `A→B` / `B→A` Issue #3, preset, calendari avanzati con festività/esclusioni/ricorrenze mensili/rinnovo, backup JSON 100% retrocompatibile) e collaudo finale prima del rilascio `4.0.0`.

## Workflow e definizione di completamento

Lavorare su `develop/v4-guided-restrictions`; leggere sempre i file correnti, modificare la minima superficie necessaria e aggiornare la roadmap con prove, limiti e collaudo richiesto. Eseguire:

```sh
node --check alpha/Restriction_Manager_Guided_Alpha.user.js
node --check dist/Restriction_Manager.user.js
node tests/validate.cjs
node tests/guided-alpha.cjs
```

Verificare i risultati GitHub Actions dopo il push; test automatici ≠ collaudo live. Mantenere `@version` allineato a `VERSION`. **Non toccare `main` né la stabile per modifiche Alpha.** Per ogni consegna rispondere in **italiano**, con: (1) cosa è stato modificato e perché, (2) test superati (locali + CI), (3) cosa rimane da verificare (distinguendo fatti SDK, evidenze live e ipotesi), (4) link GitHub ai file e commit, (5) URL di aggiornamento Alpha, (6) collaudo preciso in WME Standard e Beta:

https://raw.githubusercontent.com/1cman/wme-restriction-manager/develop/v4-guided-restrictions/alpha/Restriction_Manager_Guided_Alpha.user.js

**Definizione di completamento della singola iterazione:** codice su branch sviluppo, sintassi e suite verdi, CI verde, roadmap aggiornata, invarianti mantenuti, indicazioni test manuale chiare. Accettazione live soltanto quando confermata dall'editor.
