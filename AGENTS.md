# AGENTS.md — Restriction Manager (WME) / Guided Creator 4.0

> Istruzioni per gli agenti che lavorano in questo repository. Stato verificato al **27 novembre 2026**; leggere sempre i file e il branch correnti, che possono cambiare.
>
> **Stabile:** `3.2.0` su `main`. **Sviluppo attivo:** `4.0.0-alpha.49` su `develop/v4-guided-restrictions`. La Alpha è separata dalla stabile `3.2.0` e in **Fase 4A** applica solo modifiche **in sospeso** verificate su singolo segmento (perimetro 100% SDK + conservazione sicura via `W.model`/`ActionManager` delle condizioni motore moto esistenti, conferma esplicita, verifica post-scrittura, rollback `undo` e **Save manuale WME**).

## Fonti da leggere prima di toccare codice

1. **`docs/GUIDED_CREATOR_ROADMAP.md`** — storia *integrale* delle Alpha 4–49, screenshot/evidenze native, decisioni, rischi, collaudi, backlog e attività successive. Conservare questo documento: contiene molti più dettagli del presente sommario. Le sezioni storiche possono riportare comportamenti successivamente corretti (in particolare la semantica del rosso): prevalgono codice corrente e ultime sezioni della roadmap.
2. **`alpha/Restriction_Manager_Guided_Alpha.user.js`** — implementazione reale del wizard (e base dell'evoluzione verso Restriction Manager 4.0).
3. **`tests/guided-alpha.cjs`** — test isolati delle funzioni pure, integrità delle 6 lingue, smoke test DOM simulato e verifiche dei gate di scrittura controllata / conservazione motori.
4. **`dist/Restriction_Manager.user.js`**, **`README.md`**, **`tests/validate.cjs`**, **`docs/RELEASE_NOTES_3.2.0.md`** — funzionalità, API e invarianti della stabile.
5. **`docs/CODEX_HANDOFF_PROMPT.md`** — prompt di continuità per nuove sessioni.

## Architettura e dipendenze

- **Userscript autonomi Tampermonkey**, senza build o dipendenze npm dichiarate: funzionano su **Waze Map Editor Standard e Beta**, tramite **SDK ufficiale WME**. Mantengono **namespace e ID distinti**, quindi possono essere installati insieme.
- `dist/Restriction_Manager.user.js` (**3.2.0**) è la versione stabile, con `@grant GM_xmlhttpRequest`, `@grant unsafeWindow` e `@connect nagerholidays.com`. Usa `unsafeWindow` per accedere alla pagina/SDK; `localStorage` per preset (`rtmgr:`), calendari (`rmcal:`) e diagnostica; servizio Nager.Holidays per festività pubbliche/territoriali. Ha import/export JSON, preset, calendari avanzati, festività/esclusioni, ricorrenze mensili, rinnovo assistito, anteprima Prima/Dopo, rilevamento preliminare conflitti, diagnostica e applicazione di modifiche **in sospeso** tramite `sdk.DataModel.Segments.updateSegment` con conferma dell'editor; il **Save nativo WME è manuale**. Alcune condizioni motore dipendono da API **private `W.model`**.
- `alpha/Restriction_Manager_Guided_Alpha.user.js` (**4.0.0-alpha.49**) ha `@grant unsafeWindow`, un ID separato `rm-guided-alpha`, **nessun salvataggio automatico / persistenza locale / rete**, lettura SDK, wizard guidato snellito (rimossi i vecchi riquadri tecnici dal pannello laterale, Step 2 e Step 6), controllo conflitti bloccante, serializzatore/round-trip puro SDK (Fase 1), flussi guidati di modifica/eliminazione/ricreazione per restrizioni `editable: true` con salto rapido ai passaggi (Fase 2), scrittura controllata in sospeso tramite unico punto autorizzato `executeControlledSegmentWrite` (Fase 3), e conservazione sicura delle condizioni motore moto esistenti via `ActionManager` + `restriction.with()` + verifica `extractNormalizedMotorStamp` (Fase 4A). Esporta in Node funzioni pure, `VERSION`, `LANGS`, `labels` e `vehicleLabels` tramite `module.exports` per testare senza eseguire WME.
- `tests/validate.cjs` controlla la stabile; `tests/guided-alpha.cjs` usa Node built-in `assert`/`vm` per la Alpha (incluse verifiche complete su tutte le chiavi delle 6 lingue e smoke test DOM). Workflow `.github/workflows/checks.yml`: Node **22**, `concurrency` per evitare run duplicati su push/PR, `node --check` su entrambi gli userscript e entrambe le suite di test. Workflow `draft-release.yml` e script `scripts/*` servono al rilascio stabile, non alla Alpha.

**NON MODIFICARE la stabile**, non promuovere la Alpha in `main` o in Releases e non cambiare il formato backup/preset senza richiesta esplicita. La stabile 3.2.0 non è stata sostituita dalla Alpha.

## Regole di sicurezza non negoziabili

- **Scrittura controllata (Fase 3–4A, `alpha.47–49`)**: `Segments.updateSegment` è invocabile **esclusivamente** da `executeControlledSegmentWrite`, solo dopo superamento di `evaluateControlledWriteGate`, conferma esplicita via checkbox Prima/Dopo, rilettura freschezza pre-scrittura, verifica canonica post-scrittura (`verifyAppliedSegmentRestrictions` + verifica `extractNormalizedMotorStamp` per righe con condizioni motore conservate) e rollback chirurgico `sdk.Editing.undo()` su discrepanza. **Nessun auto-Save (`Editing.save` vietato)**, nessuna persistenza `localStorage` e nessuna chiamata di rete. Restano rigorosamente **bloccati**: creazione da zero di nuovi filtri motore moto (in attesa di verifica enum interni), tipi di corsia speciali (`laneType !== null`, Fase 4B), `TOLL`/`hasToll` (Fase 4C), orari notturni, `minPassengers > 4`, permessi/percorribilità non confermati, `editable: false`.
- **Non eliminare né alterare** restrizioni già presenti, comprese restrizioni non modificabili (`editable: false`), con categorie SDK non selezionabili nel wizard, formati legacy, condizioni moto sperimentali (`engineCapacities` fuori dallo schema `AddableVehicleRule` SDK) o campi sconosciuti. Se non interpretabile → **UNKNOWN / blocco**, non "nessun conflitto".
- **Gestione obbligatoria delle restrizioni esistenti (regola di prodotto confermata dall'editor):**
  - Se sui segmenti selezionati esistono già restrizioni, l'editor deve essere **avvisato immediatamente** (pannello laterale e Step 0 in modalità creazione) con accesso diretto alla modifica o eliminazione e pulsante dinamico **«Modifica restrizione guidata»**.
  - **È vietato aggiungere restrizioni potenzialmente in conflitto o sovrapposte** (blocco rigido fail-closed su `POTENTIAL_CONFLICT`, `OVERLAP_REVIEW`, `UNKNOWN`); occorre prima modificare o eliminare e ricreare le restrizioni esistenti.
  - La modifica/eliminazione guidata opera solo su singole restrizioni con `editable: true` e anteprima Prima/Dopo, senza mai toccare `editable: false` e mantenendo sempre il fallback al pannello nativo WME.
- Non trattare `SegmentRestriction` (lettura) come `SegmentRestrictionData` (scrittura). Verificare API e modelli **ufficiali aggiornati** e la UI nativa prima di estendere la scrittura ai casi avanzati (Fase 4B–4C).
- Non inventare enum SDK, semantica delle condizioni `AND/OR`, precedenze, compatibilità per Paese, date, codici moto o targa. Distinguere sempre **fonte SDK**, **screenshot/collaudo utente**, **test simulato** e **ipotesi di progetto**.
- Non mostrare/loggare identificativi dei pass, valori delle targhe o dettagli motore riservati; nelle diagnostiche mostrare soltanto presenza, conteggio, nomi di campo e categorie quando necessario.
- Conservare le **sei lingue** `it/en/fr/es/de/pt` e l'esperienza WME Standard/Beta. Tenere `@version` uguale a `VERSION`. Non scambiare test Node verdi con collaudo live.

## Scelte funzionali consolidate della Alpha (non regredire)

- **Selezione e accesso:** attualmente **un solo segmento** tramite `sdk.Editing.getSelection` e `sdk.DataModel.Segments.getById` (multi-segmento previsto in Fase 5); Paese derivato dall'**indirizzo del segmento**, non dalla lingua editor. Scheda `RM Guided Alpha` pulita (senza vecchi box di diagnostica tecnica) e pulsante **Crea restrizione guidata** / **Modifica restrizione guidata** accanto al comando nativo **Aggiungi/Modifica restrizioni**; il pulsante nativo di modifica rimane utilizzabile anche dalla scheda dello script (`findNativeAnchor(allowHidden)` con guida `edit_native_switch_tab` se il pannello segmento è smontato).
- **Preflight SDK in sola lettura (`alpha.40`):** `readContext` interroga `Segments.hasPermissions({segmentId})`, `Segments.isRoadTypeDrivable({roadType})` (con `segment.isDrivable`) e `Segments.isTollSegment({segmentId})`; `inspectSegmentEligibility` e `inspectSegmentTollState` classificano in modo conservativo permessi, percorribilità e stato pedaggio.
- **Avviso immediato e blocco conflitti (`alpha.41–42`):** `inspectExistingRestrictionNotice` mostra banner di avviso (`role="alert"`) nella scheda laterale e allo Step 0 (in modalità creazione); `evaluateConflictGate` blocca in modo rigido ogni aggiunta non provatamente `NONE` o `SEPARATE`. Gli input data/ora/numeric aggiornano feedback e pulsante Avanti in-place senza perdere focus, e `<dialog>` isola `keydown`/`keyup`/`keypress` per impedire al tastierino numerico di spostare la mappa WME.
- **Quattro sole categorie selezionabili per nuove restrizioni**, nell'ordine: `PRIVATE` (Auto private), `EV` (Veicoli elettrici), `MOTORCYCLE` (Motociclette), `TAXI` (Taxi). Scelta dell'editor, **non** prova che altri tipi SDK non funzionino nel client. Leggere e preservare comunque tutte le categorie native esistenti.
- **Tre tipologie con sfondi rosso / verde / azzurro:**
  - **Rosso «Transito vietato»**: **nessun tipo selezionato = tutti vietati**, regola `BLOCKED` generale; **tipi selezionati = solo quei tipi vietati**, base `FREE` e regole `BLOCKED` per i selezionati. **Non** trattare i selezionati come esentati. Nessun pass/occupanti/targa nel percorso rosso. Solo con `MOTORCYCLE`, passaggio facoltativo per motore sperimentale; poi date/orari.
  - **Verde «Transito consentito»**: selezionare **almeno un tipo**; base `BLOCKED` con regole `FREE` per gli autorizzati. Ogni categoria ha **condizioni proprie**: pass e/o occupanti; le categorie scelte senza condizioni sono autorizzate direttamente. Scelta pass alfabetica con ricerca/autocompletamento. **Pass PRIVATE non si applica automaticamente a EV** (collaudo positivo). Poi date/orari.
  - **Azzurro «Transito esente da pedaggio»**: tipi esentati, base `TOLL` con regole `FREE`; salta pass/occupanti/targa, va direttamente a date/orari. Predispone **solo come progetto** `hasToll:true`; l'attributo della strada interessa **ENTRAMBE** le direzioni anche per esenzione unidirezionale. Coordinamento atomico/rollback non verificato (Fase 4C).
- **Motori moto (`alpha.32–38`, Fase 4A `alpha.49`):** il contratto SDK pubblico `AddableVehicleRule` omette `engineCapacities`. In Fase 4A (`alpha.49`) la Alpha porta il meccanismo sicuro della stabile `3.2.0` (`captureInternalMotorPreservation` + intercettazione chirurgica `ActionManager.add` + `restriction.with()` + verifica `extractNormalizedMotorStamp` + rollback `undo()`) per **conservare senza perdite** le restrizioni moto esistenti con condizioni motore durante aggiunte/modifiche/eliminazioni di altre regole sul segmento. La creazione da zero di nuovi filtri motore resta bloccata finché gli enum interni non saranno verificati.
- **Targhe:** guida Waze descrive ultime due cifre in aree/città di 7 Paesi; screenshot WME portoghese mostrava ultima cifra 0. Non equiparare le due rappresentazioni; non implementate in scrittura.
- **Corsie:** scopo del segmento (`WHOLE_SEGMENT/LEFT_LANE/MIDDLE_LANE/RIGHT_LANE`) e tipo (`lane_none/express/fast/hov/public_transport/carpool_toll_free`). I codici interni osservati sono `INTERNAL_LANE_SCOPES` / `INTERNAL_LANE_TYPES`; i tipi speciali restano bloccati in scrittura finché verificati (Fase 4B).
- **Calendari e SAFE12 (`alpha.30–39`):** `normalizeRedSchedule` è condivisa dalle tre tipologie (supporta fasce notturne con avviso giorno successivo in bozza); `countSafe12Operation` / `estimateGuidedOperationBudget` allineati ai limiti SAFE12 della stabile (max 12 restrizioni e 12 fasce per intera operazione).
- **Diagnostica nativa (`alpha.22–39`):** `minPassengers` e `numPassengers` gestiti entrambi in lettura (`ZERO` / `MINIMUM` / `UNKNOWN`); alias deprecati SDK (`disposition`, `driveProfiles`, `daysOfMonth`, `numPassengers`, `licensePlateNumber`) riconosciuti nello snapshot di freschezza senza perdere rigore nell'audit di preservazione.

## Collaudi live confermati

L'editor ha confermato in **WME Standard e Beta** tutti i traguardi fino a **`4.0.0-alpha.48`**: Fasi 0–2 complete, creazione/eliminazione/modifica guidata controllata in sospeso (Fase 3 `alpha.47–48`), barra di salto rapido ai passaggi in Modifica guidata, verifica post-scrittura e blocco rigoroso dei casi fuori perimetro.

## Piano approvato verso Restriction Manager 4.0

1. **Fase 0 (`alpha.43`, completata e confermata live):** pulizia repository, rimozione codice/label morti, controllo automatico completo delle 6 lingue, deduplicazione CI.
2. **Fase 1 (`alpha.44`, completata e confermata live):** serializzatore puro `SegmentRestrictionData` + `AddableVehicleRule` + round-trip lossless delle restrizioni SDK preesistenti.
3. **Fase 2 (`alpha.45–46`, completata e confermata live):** modifica guidata, elimina / elimina e ricrea per `editable: true` e pulsante dinamico **«Modifica restrizione guidata»**.
4. **Fase 3 (`alpha.47–48`, completata e confermata live):** scrittura controllata in sospeso singolo segmento (`Segments.updateSegment`, conferma esplicita, verifica post-scrittura, rollback chirurgico `undo`, Salva manuale WME, salto rapido in Modifica guidata) per il perimetro 100% SDK.
5. **Fase 4 (in corso — casi avanzati uno per volta):**
   - **4A (`alpha.49`, in collaudo live):** conservazione sicura delle condizioni motore moto esistenti via `ActionManager` + `restriction.with()` + verifica `extractNormalizedMotorStamp` + rollback `undo`, insieme alla pulizia dei vecchi riquadri tecnici dall'UI (pannello laterale, Step 2, Step 6).
   - **4B (prossima):** tipi di corsia speciali (`HOV`/`HOT`/`EXPRESS`/`BUS`/`FAST`) verificati uno per uno in WME Standard e Beta.
   - **4C (dopo 4B):** gestione coordinata pedaggio `hasToll: true` + esenzione `TOLL` con avviso bidirezionale e reversibilità + verifica orari notturni.
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
