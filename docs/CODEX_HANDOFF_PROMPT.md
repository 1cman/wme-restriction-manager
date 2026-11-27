# Prompt per continuare lo sviluppo in una nuova sessione

Copia il testo seguente in una nuova conversazione (preferibilmente con GitHub collegato e il repository selezionato).

---

Sto sviluppando **Restriction Manager** per **Waze Map Editor (WME)**. Voglio che tu riprenda **esattamente dal punto raggiunto** nel repository GitHub:

- Repository: https://github.com/1cman/wme-restriction-manager
- **Branch di lavoro:** `develop/v4-guided-restrictions`; NON `main`.
- **Prototipo attivo:** `alpha/Restriction_Manager_Guided_Alpha.user.js`, versione attuale `4.0.0-alpha.43` (controlla se nel frattempo è cambiata).
- **Stabile da preservare:** `dist/Restriction_Manager.user.js` v`3.2.0`. Non modificarla né pubblicare una Release finché la 4.0 non sarà completa e approvata.
- **Prima di iniziare leggi integralmente `AGENTS.md` nella root** e poi `docs/GUIDED_CREATOR_ROADMAP.md`, `README.md`, il codice Alpha e i test `tests/guided-alpha.cjs` / `tests/validate.cjs`. `AGENTS.md` riporta architettura, scelte tecniche, collaudi reali, vincoli e piano approvato in 6 fasi; la roadmap conserva la cronologia completa di tutte le versioni. Non ricominciare il progetto da zero e non inventare API o comportamenti WME.

**Stato già verificato live in WME Standard e Beta (fino ad `alpha.42`, con igiene repo e test i18n completi in `alpha.43`):** l'Alpha è una procedura guidata **solo lettura** per restrizioni rosse (divieto), verdi (autorizzazione) e azzurre (esenzione pedaggio); quattro tipi veicolo `PRIVATE`, `EV`, `MOTORCYCLE` e `TAXI`; pass e occupanti indipendenti per tipo; calendario comune con fasce notturne in bozza e input focus-safe + isolamento tastiera modale; preflight SDK su permessi, percorribilità e stato pedaggio (`alpha.40`); avviso immediato su segmenti con restrizioni esistenti, pulsante **Modifica o elimina nel pannello WME** persistente anche dalla scheda dello script e blocco conflitti fail-closed (`alpha.41–42`); diagnostica opt-in del modello interno per condizioni moto e calendari (`alpha.32–39`). Nessuna scrittura sulla mappa è ancora attiva.

**Prossimo passo del piano approvato (Fase 1 — `alpha.44–45`, ancora in sola lettura):**
Progettare e testare il serializzatore puro `SegmentRestrictionData` + `AddableVehicleRule` e il round-trip lossless delle restrizioni SDK preesistenti (senza ancora eseguire `Segments.updateSegment`), classificando in modo fail-closed tutto ciò che è fuori dallo schema SDK ufficiale (`editable: false`, campi/tipi sconosciuti, `engineCapacities`, tipi corsia speciali) e producendo un'anteprima Prima/Dopo strutturata per il futuro passo di modifica/eliminazione guidata (Fase 2) e prima scrittura controllata su singolo segmento (Fase 3).

**Vincoli inderogabili:** non modificare `dist/`, non abilitare `Segments.updateSegment` o salvataggi WME nelle Fasi 1–2, non copiare il modello SDK di lettura in payload di scrittura senza serializzatore verificato, non eliminare restrizioni native sconosciute o `editable: false`, non permettere aggiunte in conflitto o sovrapposte, non mostrare ID pass/targhe o dati riservati. Preserva le sei lingue (`it/en/fr/es/de/pt`), i 4 veicoli scelti, la semantica rosso/verde/azzurro, i calendari, la sicurezza SAFE12 e il flusso nativo WME.

**Procedura di lavoro:**
1. Mostra brevemente cosa hai letto nel repository, la versione/commit e i punti ancora non verificati. Distingui sempre fatti SDK ufficiali, evidenze del collaudo live e ipotesi.
2. Implementa il prossimo intervento incrementale sul **branch di sviluppo**, con test di regressione e roadmap aggiornata. Non chiedere di ripetere scelte già documentate.
3. Esegui `node --check alpha/Restriction_Manager_Guided_Alpha.user.js`, `node --check dist/Restriction_Manager.user.js`, `node tests/validate.cjs` e `node tests/guided-alpha.cjs`, e verifica il risultato GitHub Actions del commit.
4. Rispondi sempre in **italiano** includendo: (1) cosa è stato modificato e perché, (2) test superati, (3) cosa rimane da verificare, (4) link GitHub a file e commit, (5) URL raw per aggiornare l'Alpha se modificata, (6) collaudo manuale preciso in WME Standard e Beta.

---

Ulteriori riferimenti: [AGENTS.md](../AGENTS.md) · [Roadmap completa](GUIDED_CREATOR_ROADMAP.md) · [README](../README.md).
