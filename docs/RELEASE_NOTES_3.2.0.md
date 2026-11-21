# Restriction Manager SDK v3.2.0 — Monthly Recurrences / Ricorrenze mensili

## 🇮🇹 Novità
- Ricorrenze mensili: N-esimo giorno della settimana o giorno numerico (1–31), con finestra fino a 12 mesi.
- Limite complessivo **12 restrizioni e 12 definizioni temporali per operazione**: include tutte le regole, le restrizioni conservate e tutti i segmenti selezionati.
- Le combinazioni oltre il limite sono bloccate prima dell'applicazione, senza troncare alcuna restrizione.
- "Ripeti ogni anno" disabilitato quando sono presenti ricorrenze speciali.
- Rinnovo assistito delle ricorrenze mensili: aggiorna solo il calendario salvato localmente dopo conferma, **mai la mappa automaticamente**.
- Aggiornati test automatici, README e controlli di compatibilità.

**Attenzione:** esporta un backup JSON prima dell'aggiornamento. Dopo il rinnovo, seleziona i segmenti interessati e riapplica il calendario. L'interfaccia WME reale non è stata ancora collaudata per questo rilascio: testa su un segmento prima di intervenire su più segmenti.

## 🇬🇧 What's new
- Monthly nth-weekday or numerical day (1–31) recurrences over a configurable 1–12 month window.
- Strict **12 restrictions and 12 time-frame definitions per operation** across rules, retained restrictions and all selected segments.
- Oversized operations are rejected before applying; nothing is silently truncated.
- "Repeat every year" disabled when special recurrence rules are present.
- Assisted monthly renewal updates only the saved local calendar with editor confirmation; **never auto-edits WME segments**.
- Expanded automated safety tests and updated documentation.

**Caution:** export a JSON backup before upgrading. After renewal, explicitly select and reapply the calendar to the intended WME segments. This release has not yet been user-tested in live WME: test on one segment before larger edits.

[Documentation / Documentazione](https://github.com/1cman/wme-restriction-manager#readme) · [Report issues / Segnala problemi](https://github.com/1cman/wme-restriction-manager/issues/new/choose)
