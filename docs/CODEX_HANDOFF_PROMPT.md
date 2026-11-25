# Prompt per continuare lo sviluppo con Codex

Copia il testo seguente nella nuova conversazione con Codex (preferibilmente con GitHub collegato e il repository selezionato).

---

Sto sviluppando **Restriction Manager** per **Waze Map Editor (WME)**. Voglio che tu riprenda **esattamente dal punto raggiunto** nel repository GitHub:

- Repository: https://github.com/1cman/wme-restriction-manager
- **Branch di lavoro:** `develop/v4-guided-restrictions`; NON `main`.
- **Prototipo attivo:** `alpha/Restriction_Manager_Guided_Alpha.user.js`, versione attuale al passaggio `4.0.0-alpha.22` (controlla se nel frattempo è cambiata).
- **Stabile da preservare:** `dist/Restriction_Manager.user.js` v`3.2.0`. Non modificarla né pubblicare una Release.
- **Prima di iniziare leggi integralmente `AGENTS.md` nella root** e poi `docs/GUIDED_CREATOR_ROADMAP.md`, `README.md`, il codice Alpha e i test `tests/guided-alpha.cjs` / `tests/validate.cjs`. `AGENTS.md` riporta architettura, scelte tecniche, collaudi reali, dipendenze, requisiti e backlog; la roadmap conserva la cronologia completa di tutte le versioni. Non ricominciare il progetto da zero e non inventare API o comportamenti WME.

**Stato già verificato:** l'Alpha è una procedura guidata **solo lettura** per restrizioni rosse (divieto), verdi (autorizzazione) e azzurre (esenzione pedaggio); quattro tipi veicolo `PRIVATE`, `EV`, `MOTORCYCLE` e `TAXI`; pass e occupanti indipendenti per tipo; calendario comune; corsie, esenzioni, filtro moto sperimentale, riepilogo, diagnostica SDK, confronto restrizioni esistenti, conflitti per veicolo e analisi di conservazione. Pulsante di creazione anche dove WME mostra “Modifica restrizioni”. Il progetto è stato collaudato progressivamente in **WME Standard e Beta**; vedere in `AGENTS.md` quali funzioni sono state realmente verificate. Le condizioni SDK avanzate e il salvataggio **non** sono ancora sicuri.

**Ultimissimo riscontro reale (primo task da affrontare):** nella versione `4.0.0-alpha.22`, una restrizione preesistente ha `FREE` / `FWD` / `WHOLE_SEGMENT` con gruppo `BLOCKED` per `MOTORCYCLE`. Diagnostica: 0 pass, vecchio `driveProfiles` e `vehicleRules` equivalenti, ma compare il campo **non riconosciuto `minPassengers`**. Il codice attuale riconosce `numPassengers` e non `minPassengers`. Il valore di `minPassengers` NON è mostrato nello screenshot. Prima verifica le definizioni effettive del WME SDK e il comportamento di entrambi i campi, i valori speciali 0/1 e l'eventuale relazione con altre condizioni; **non** concludere che esista un obbligo occupanti soltanto dal nome del campo. Aggiorna in modo minimale e prudente la **diagnostica di sola lettura** e aggiungi test per valori validi, sconosciuti, campi combinati, legacy e assenza di perdita dati. Se una semantica non è verificabile, restituisci `UNKNOWN` e segnala cosa va confrontato nel pannello nativo.

**Vincoli inderogabili:** non modificare `dist/`, non abilitare `Segments.updateSegment` o salvataggi WME, non copiare il modello SDK di lettura in payload di scrittura, non eliminare restrizioni native sconosciute, non dichiarare “nessun conflitto” se il controllo non è completo, non mostrare ID pass/targhe o dati riservati. Preserva le sei lingue, i 4 veicoli scelti, la semantica corretta rosso/verde/azzurro, i calendari, la sicurezza SAFE12 e il flusso nativo WME.

**Procedura di lavoro:**
1. Mostrami brevemente cosa hai letto nel repository, la versione/commit e i punti ancora non verificati. Distingui fatti ufficiali, evidenze del mio collaudo e ipotesi.
2. Implementa il prossimo intervento prudente sul **branch di sviluppo**, con test di regressione e roadmap aggiornata. Non chiedermi di ripetere scelte già documentate.
3. Esegui `node --check alpha/Restriction_Manager_Guided_Alpha.user.js`, `node --check dist/Restriction_Manager.user.js`, `node tests/validate.cjs` e `node tests/guided-alpha.cjs`, e verifica il risultato GitHub Actions del commit.
4. Fornisci un changelog concreto in **italiano**, commit e link ai file aggiornati, un collegamento per installare/aggiornare l'Alpha se modificata, e **un test manuale preciso** che io possa effettuare in WME Standard e Beta. Non dichiarare collaudate funzioni che non ho ancora provato.
5. Prosegui poi, in ordine, con i problemi ancora aperti descritti in `AGENTS.md`/roadmap: lettura completa condizioni native, formati calendario/weekday/timezone, regole e precedenze avanzate, serializzazione SDK corretta, round-trip senza perdita delle vecchie restrizioni, conflitti, SAFE12 intera operazione, toll `hasToll` coordinato, anteprima Prima/Dopo e solo infine eventuale salvataggio esplicito con autorizzazione.

**Obiettivo finale:** rendere il Guided Creator affidabile e compatibile con WME, senza perdere le funzioni e le garanzie già costruite nella stabile e nelle Alpha. Inizia dalla verifica di `minPassengers` e lavora sul repository reale, non su codice inventato.

---

Ulteriori riferimenti: [AGENTS.md](../AGENTS.md) · [Roadmap completa](GUIDED_CREATOR_ROADMAP.md) · [README](../README.md).
