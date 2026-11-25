# AGENTS.md — Restriction Manager (WME) / Codex

> Istruzioni per gli agenti che lavorano in questo repository. Stato verificato al **25 novembre 2026**; leggere sempre i file e il branch correnti, che possono cambiare.
>
> **Stabile:** `3.2.0` su `main`. **Sviluppo attivo:** `4.0.0-alpha.22` su `develop/v4-guided-restrictions`. La Alpha è separata e **soltanto in lettura**.

## Fonti da leggere prima di toccare codice

1. **`docs/GUIDED_CREATOR_ROADMAP.md`** — storia *integrale* delle Alpha 4–22, screenshot/evidenze native, decisioni, rischi, collaudi, backlog e attività successive. Conservare questo documento: contiene molti più dettagli del presente sommario. Le sezioni storiche possono riportare comportamenti successivamente corretti (in particolare la semantica del rosso): prevalgono codice corrente e ultime sezioni della roadmap.
2. **`alpha/Restriction_Manager_Guided_Alpha.user.js`** — implementazione reale del wizard (prototipo).
3. **`tests/guided-alpha.cjs`** — test isolati delle funzioni pure e verifiche di non-scrittura.
4. **`dist/Restriction_Manager.user.js`**, **`README.md`**, **`tests/validate.cjs`**, **`docs/RELEASE_NOTES_3.2.0.md`** — funzionalità, API e invarianti della stabile.
5. **`docs/CODEX_HANDOFF_PROMPT.md`** — prompt da incollare nella prossima conversazione con Codex.

## Architettura e dipendenze

- **Userscript autonomi Tampermonkey**, senza build o dipendenze npm dichiarate: funzionano su **Waze Map Editor Standard e Beta**, tramite **SDK ufficiale WME**. Mantengono **namespace e ID distinti**, quindi possono essere installati insieme.
- `dist/Restriction_Manager.user.js` (**3.2.0**) è la versione stabile, con `@grant GM_xmlhttpRequest`, `@grant unsafeWindow` e `@connect nagerholidays.com`. Usa `unsafeWindow` per accedere alla pagina/SDK; `localStorage` per preset (`rtmgr:`), calendari (`rmcal:`) e diagnostica; servizio Nager.Holidays per festività pubbliche/territoriali. Ha import/export JSON, preset, calendari avanzati, festività/esclusioni, ricorrenze mensili, rinnovo assistito, anteprima Prima/Dopo, rilevamento preliminare conflitti, diagnostica e applicazione di modifiche **in sospeso** tramite `sdk.DataModel.Segments.updateSegment` con conferma dell'editor; il **Save nativo WME è manuale**. Alcune condizioni motore dipendono da API **private `W.model`**.
- `alpha/Restriction_Manager_Guided_Alpha.user.js` (**4.0.0-alpha.22**) ha `@grant unsafeWindow`, un ID separato `rm-guided-alpha`, **nessun salvataggio / rete / modifica mappa**, lettura SDK, wizard e diagnostica. Esporta in Node funzioni pure tramite `module.exports` per testare senza eseguire WME.
- `tests/validate.cjs` controlla la stabile; `tests/guided-alpha.cjs` usa Node built-in `assert`/`vm` per la Alpha. Workflow `.github/workflows/checks.yml`: Node **22**, push su `main`/`develop/v4-guided-restrictions` e PR. Le notifiche GitHub possono essere duplicate tra push e PR; evitare commit di test non verificati. Workflow `draft-release.yml` e script `scripts/*` servono al rilascio stabile, non alla Alpha.

**NON MODIFICARE la stabile**, non promuovere la Alpha in `main` o in Releases e non cambiare il formato backup/preset senza richiesta esplicita. La stabile 3.2.0 non è stata sostituita dalla Alpha.

## Regole di sicurezza non negoziabili

- **Alpha read-only**: nessun `updateSegment`, `undo`/azione WME di scrittura, persistenza locale, invio esterno o auto-Save. La verifica di conversione deve continuare a produrre `status:"BLOCKED"`, `saveAllowed:false`, `verified:false`, `sdkWritePayload:null`.
- **Non eliminare né alterare** restrizioni già presenti, comprese restrizioni non modificabili, con categorie SDK non selezionabili nel wizard, formati legacy, condizioni moto sperimentali o campi sconosciuti. Se non interpretabile → **UNKNOWN / blocco**, non "nessun conflitto".
- Non trattare `SegmentRestriction` (lettura) come `SegmentRestrictionData` (scrittura). Verificare API e modelli **ufficiali aggiornati** e la UI nativa prima di introdurre qualunque serializzazione reale.
- Non inventare enum SDK, semantica delle condizioni `AND/OR`, precedenze, compatibilità per Paese, date, codici moto o targa. Distinguere **fonte SDK**, **screenshot/collaudo utente**, **test simulato** e **ipotesi di progetto**.
- Non mostrare/loggare identificativi dei pass, valori delle targhe o dettagli motore riservati; nelle diagnostiche mostrare soltanto presenza, conteggio, nomi di campo e categorie quando necessario.
- Conservare le **sei lingue** `it/en/fr/es/de/pt` e l'esperienza WME Standard/Beta. Tenere `@version` uguale a `VERSION`. Non scambiare test Node verdi con collaudo live.

## Scelte funzionali consolidate della Alpha (non regredire)

- Selezione di **un solo segmento** tramite `sdk.Editing.getSelection` e `sdk.DataModel.Segments.getById`; Paese derivato dall'**indirizzo del segmento**, non dalla lingua editor. Scheda `RM Guided Alpha` e pulsante **Crea restrizione guidata** accanto al comando nativo **Aggiungi/Modifica restrizioni**; il pulsante nativo di modifica rimane utilizzabile. Funziona sui segmenti con restrizioni esistenti.
- Quattro **sole categorie selezionabili per nuove restrizioni**, nell'ordine: `PRIVATE` (Auto private), `EV` (Veicoli elettrici), `MOTORCYCLE` (Motociclette), `TAXI` (Taxi). È una scelta dell'editor, **non** prova che altri tipi SDK non funzionino nel client. Leggere e preservare comunque tutte le categorie native esistenti.
- Tre tipologie con sfondi **rosso / verde / azzurro**:
  - **Rosso «Transito vietato»**: **nessun tipo selezionato = tutti vietati**, regola `BLOCKED` generale; **tipi selezionati = solo quei tipi vietati**, base `FREE` e regole `BLOCKED` per i selezionati. **Non** trattare i selezionati come esentati. Nessun pass/occupanti/targa nel percorso rosso. Solo con `MOTORCYCLE`, passaggio facoltativo per motore sperimentale; poi date/orari.
  - **Verde «Transito consentito»**: selezionare **almeno un tipo**; base `BLOCKED` con regole `FREE` per gli autorizzati. Ogni categoria ha **condizioni proprie**: pass e/o occupanti; le categorie scelte senza condizioni sono autorizzate direttamente. La scelta del pass è alfabetica con ricerca/autocompletamento. **Pass PRIVATE non si applica automaticamente a EV** (collaudo positivo). Poi date/orari.
  - **Azzurro «Transito esente da pedaggio»**: tipi esentati, base `TOLL` con regole `FREE`; salta pass/occupanti/targa, va direttamente a date/orari. Predispone **solo come progetto** `hasToll:true`; l'attributo della strada interessa **ENTRAMBE** le direzioni anche per esenzione unidirezionale. Coordinamento atomico/rollback non verificato.
- **Motori moto**: la stabile conserva dati reali `engineType`, `operator`, `capacityThreshold` anche da modello WME interno. La Alpha offre solo progetto **Carburante/Completamente elettrico**, cilindrata cc o potenza kW, `Tutti` / `<` / `≤`. Identificatori interni Alpha `FUEL/ELECTRIC` e `ALL/LT/LTE` NON sono enum SDK confermati. Senza filtro sono vietate tutte le motociclette selezionate.
- **Targhe**: la guida Waze per l'app descrive **ultime due cifre** in aree/città di 7 Paesi (Brasile, Colombia, Costa Rica, Ecuador, Filippine, Indonesia, Perù); screenshot nativo WME in portoghese mostrava filtro **ultima cifra 0**. Non equiparare le due rappresentazioni. Restrizioni native sulle targhe, supporto geografico ed esatta scrittura non sono implementati. Cfr. roadmap e https://support.google.com/waze/answer/7666525?hl=it.
- **Corsie**: scopo del segmento (intero, sinistra, centrale, destra), tipo (`lane_none/express/fast/hov/public_transport/carpool_toll_free`). L'utente ha **confermato queste scelte nella UI nativa WME**. Valori `laneScope` **candidati** `WHOLE_SEGMENT/LEFT_LANE/MIDDLE_LANE/RIGHT_LANE`, ma nessuna mappatura SDK di scrittura verificata; sinistra/destra dipendono dal verso di marcia.
- **Calendari per tutti i colori**: date iniziali/finali facoltative, giorni settimana, tutto il giorno o più fasce; Alpha non supporta ancora notturni, festività/esclusioni speciali, ricorrenze complete o fuso orario serializzato. `normalizeRedSchedule` è condivisa dalle tre tipologie. Limite bozza **12 fasce**; `estimateSafe12Budget` è solo una **stima locale**.
- **SAFE12 stabile**: massimo **12 restrizioni** e **12 definizioni temporali** per **intera operazione**, sommando tutti i segmenti, regole generate e conservate; `assertOperationLimit` della stabile controlla il batch. **Non** sostituirlo con la stima Alpha. La stabile supporta festività/esclusioni/ricorrenze mensili e rinnovo calendario locale, non un rinnovo automatico della mappa.
- **Gestione restrizioni esistenti**: `listExistingRestrictions` mostra elenco e date/direzioni/corsie; «Modifica nel pannello WME» usa comando nativo. `restrictionSnapshot` rileva bozze divenute obsolete (solo campi SDK osservati). `auditRestrictionPreservation` segnala `NO_EXISTING/REQUIRES_ROUNDTRIP/UNKNOWN` e dati non modificabili/legacy/opachi, senza produrre oggetti scrivibili.
- **Conflitti**: `previewRestrictionConflicts` confronta direzione/corsia/date/giorni/orari e tipi di regole; `reviewVehicleConflictEffects` confronta separatamente le 4 categorie, **senza** supporre che PRIVATE ed EV siano mutuamente esclusive. Stati possibili `POTENTIAL_CONFLICT/OVERLAP_REVIEW/SEPARATE/UNKNOWN/NONE`. Requisiti non interpretabili e precedenze restano `CONDITIONAL/UNKNOWN`; nessun esito autorizza la scrittura.
- **Diagnostica `4.0.0-alpha.22`**: `inspectNativeVehicleCondition`, `inspectNativeVehicleRules`, `compareLegacyVehicleRules` leggono `vehicleRules` e vecchio `driveProfiles`, pass (conteggio), occupanti, presenza targa/motore e campi ignoti; non esportano valori sensibili. `reviewSdkConversion` resta un **piano semantico non scrivibile**.

## Collaudi live confermati e ultimo riscontro

L'editor ha confermato: comportamento pass indipendenti e fasce orarie; pulsante guida con restrizioni esistenti su **WME Standard e Beta**; conversion review `alpha.18`; preservation audit `alpha.19`; avviso conflitti ed edit nativo `alpha.20`; comparazione delle quattro categorie su **Standard e Beta** `alpha.21`. Per `alpha.22` un primo screenshot non mostrava la diagnostica perché l'userscript non era aggiornato; dopo l'aggiornamento, la diagnostica è comparsa.

**PROSSIMO PROBLEMA REALE DA AFFRONTARE** — ultimo screenshot `alpha.22`:
- Restrizione esistente: `FREE`, `FWD`, `WHOLE_SEGMENT`, gruppo `BLOCKED`, veicolo `MOTORCYCLE`, pass rilevati **0**, gruppi legacy e attuali equivalenti.
- Compare **«Campi non riconosciuti (solo nomi): minPassengers»**.
- Il codice della Alpha riconosce `numPassengers`, **non `minPassengers`**. Lo screenshot **non mostra il valore** di `minPassengers`; non dedurre se 0/1/altro significhino obbligo occupanti o assenza di requisito.
- Giorni WME letti: `SUNDAY … SATURDAY`; zona `Europe/Rome`. Intervalli mostrati come puntini non dimostrano che date/orari non esistano.

**Prima attività consigliata per Codex:** verificare nelle definizioni SDK attuali e nel read model reale `minPassengers` vs `numPassengers` (significati, alias, valore neutro/validazione); poi correggere **solo la diagnostica read-only** con test che gestiscano campi mancanti/ambigui e non mostrino valori privati. Non dichiarare sicurezza dei conflitti per questa correzione. Riprovare su Standard e Beta.

## Backlog tecnico (blocchi prima del salvataggio)

1. Campi SDK reali per pass (`subscriptions`), occupanti (`minPassengers/numPassengers`), targhe, condizioni moto; combinazioni `AND/OR` e precedenza, restrizioni sovrapposte e tipi di veicoli intersecanti. Mantenere risultati incerti quando non provati.
2. Formato calendario SDK: giorni come stringhe/bitmask numeriche, inclusività, zona del segmento, fasce notturne, festività/esclusioni, ricorrenze; compatibilità con motore stabile.
3. `SegmentRestrictionData` e `AddableVehicleRule` reali; verificare shape di `laneScope/laneType`, condizioni motore/targa e permessi/Paesi. Il read model `SegmentRestriction` non è automaticamente scrivibile.
4. **Round-trip non distruttivo** di tutte le restrizioni preesistenti, anche non modificabili, legacy, tipi SDK non selezionabili e condizioni sperimentali; costruire anteprima Prima/Dopo **senza modifiche**, snapshot e confronto.
5. Conflitti semantici per veicolo e date con classificazione prudente; nessun falso "nessun conflitto". Completare SAFE12 **per batch intero**, non per singolo segmento.
6. Validare diritti dell'editor, geografia, direzione, tipo corsia e disponibilità native; rileggere la selezione/stato immediatamente prima di qualunque futura scrittura.
7. Pedaggio `hasToll:true` in entrambe le direzioni + esenzione eventualmente unidirezionale: evitare applicazione parziale; progettare reversibilità/undo.
8. **Solo quando ogni verifica è superata**: preview diff, conferma esplicita dell'editor, eventuale applicazione SDK di modifiche pendenti, salvataggio **manuale WME**, test Standard/Beta e rilascio controllato. Le modifiche multi-segmento non sono atomiche.
9. Fase successiva opzionale: collegare preset/calendari alla struttura stabile senza rompere backup; archivio locale, riconciliazione Save, promemoria rinnovo; eventuale cloud/OAuth **solo** dopo permessi e valutazione privacy/policy.

## Workflow e definizione di completamento

Lavorare su `develop/v4-guided-restrictions`; leggere sempre i file correnti, modificare la minima superficie necessaria e aggiornare la roadmap con prove, limiti e collaudo richiesto. Eseguire:

```sh
node --check alpha/Restriction_Manager_Guided_Alpha.user.js
node --check dist/Restriction_Manager.user.js
node tests/validate.cjs
node tests/guided-alpha.cjs
```

Verificare i risultati GitHub Actions dopo il push; test automatici ≠ collaudo live. Mantenere versione userscript allineata. **Non toccare `main` né la stabile per modifiche Alpha.** Per ogni consegna rispondere in **italiano**, con commit/URL aggiornati, ciò che è stato davvero verificato e un preciso test in WME Standard/Beta. Se si aggiorna la Alpha, install URL:

https://raw.githubusercontent.com/1cman/wme-restriction-manager/develop/v4-guided-restrictions/alpha/Restriction_Manager_Guided_Alpha.user.js

**Definizione di completamento della singola iterazione:** codice su branch sviluppo, sintassi e suite verdi, roadmap aggiornata, invarianti mantenuti, nessuna scrittura WME, indicazioni test manuale chiare. Accettazione live soltanto quando confermata dall'editor.
