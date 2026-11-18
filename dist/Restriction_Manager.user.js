// ==UserScript==
// @name         Restriction Manager (SDK)
// @namespace    https://github.com/community-userscripts
// @version      3.1.1
// @updateURL    https://github.com/1cman/wme-restriction-manager/releases/latest/download/Restriction_Manager.user.js
// @downloadURL  https://github.com/1cman/wme-restriction-manager/releases/latest/download/Restriction_Manager.user.js
// @supportURL   https://github.com/1cman/wme-restriction-manager/issues
// @homepageURL  https://github.com/1cman/wme-restriction-manager
// @description  Preset e calendari multilingua con festivita territoriali, anteprima, compatibilita SDK e diagnostica locale
// @author       kjg53 / SDK rewrite / community adaptation
// @license      MIT
// @match        https://www.waze.com/editor*
// @match        https://www.waze.com/*/editor*
// @match        https://beta.waze.com/editor*
// @match        https://beta.waze.com/*/editor*
// @exclude      https://beta.waze.com/editor/sdk/*
// @exclude      https://beta.waze.com/*/editor/sdk/*
// @exclude      https://beta.waze.com/user/*
// @exclude      https://www.waze.com/user/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      nagerholidays.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    // With Tampermonkey grants, window is sandboxed. WME SDK and W.model
    // must be accessed via the actual WME page window (official SDK guidance).
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

    const SCRIPT_ID = "restriction-manager-sdk";
    const SCRIPT_NAME = "Restriction Manager";
    const SCRIPT_VERSION = "3.1.1";
    const STORAGE_PREFIX = "rtmgr:";
    const CAL_PREFIX = "rmcal:";
    const FORMAT = 5;
    const MAX_EXCLUSION_DAYS = 5 * 366;
    const MAX_CUSTOM_EXCLUSIONS = 80;
    const MAX_LOCAL_ANNUAL_HOLIDAYS = 25;
    const HOLIDAY_API = "https://nagerholidays.com/api/v4/Holidays";
    const EXPIRY_WARNING_DAYS = 30;
    const MAX_CALENDAR_FRAMES = 100;
    const MAX_SPECIAL_YEARS = 10;
    const DIR = Object.freeze({
        A_TO_B: "A_TO_B", B_TO_A: "B_TO_A",
        TWO_WAY: "TWO_WAY", UNKNOWN: "UNKNOWN"
    });

    let sdk = null;
    let tabPane = null;
    let busy = false;
    let preparedPreview = null;
    let sdkCompatibility = null;


    // Internal localization: WME UI-inspired dictionaries, no @require or network fetches.
    const TRANSLATION_ROWS = [["Preset, calendari e restrizioni in un pannello più semplice e moderno.","Presets, calendars and restrictions in a simpler, modern panel.","Préréglages, calendriers et restrictions dans un panneau moderne et simplifié.","Preajustes, calendarios y restricciones en un panel más sencillo y moderno.","Voreinstellungen, Kalender und Beschränkungen in einem modernen, einfachen Bereich.","Predefinições, calendários e restrições num painel mais simples e moderno."],["Calendari","Calendars","Calendriers","Calendarios","Kalender","Calendários"],["Motori moto","Motorcycle engines","Moteurs moto","Motores de motos","Motorradmotoren","Motores de motos"],["Supportati","Supported","Pris en charge","Compatibles","Unterstützt","Suportados"],["JSON locale","Local JSON","JSON local","JSON local","Lokales JSON","JSON local"],["Strumenti","Tools","Outils","Herramientas","Werkzeuge","Ferramentas"],["Restriction Manager pronto.","Restriction Manager ready.","Restriction Manager prêt.","Restriction Manager listo.","Restriction Manager bereit.","Restriction Manager pronto."],["Gestione preset","Preset management","Gestion des préréglages","Gestión de preajustes","Voreinstellungen verwalten","Gestão de predefinições"],["Crea, seleziona e applica preset di restrizioni ai segmenti selezionati.","Create, select and apply restriction presets to selected segments.","Créez, sélectionnez et appliquez des préréglages aux segments sélectionnés.","Crea, selecciona y aplica preajustes de restricciones a los segmentos seleccionados.","Beschränkungsvorlagen erstellen, auswählen und auf ausgewählte Segmente anwenden.","Crie, selecione e aplique predefinições de restrições aos segmentos selecionados."],["Nome preset","Preset name","Nom du préréglage","Nombre del preajuste","Name der Vorlage","Nome da predefinição"],["Preset salvati","Saved presets","Préréglages enregistrés","Preajustes guardados","Gespeicherte Vorlagen","Predefinições guardadas"],["Uso rapido","Quick actions","Actions rapides","Acciones rápidas","Schnellaktionen","Ações rápidas"],["Salva / Applica / Elimina","Save / Apply / Delete","Enregistrer / Appliquer / Supprimer","Guardar / Aplicar / Eliminar","Speichern / Anwenden / Löschen","Guardar / Aplicar / Eliminar"],["Compatibilità","Compatibility","Compatibilité","Compatibilidad","Kompatibilität","Compatibilidade"],["Direzioni A↔B e regole moto","A↔B directions and motorcycle rules","Directions A↔B et règles moto","Sentidos A↔B y reglas para motos","A↔B-Richtungen und Motorradregeln","Sentidos A↔B e regras de motos"],["💾 Salva preset","💾 Save preset","💾 Enregistrer le préréglage","💾 Guardar preajuste","💾 Vorlage speichern","💾 Guardar predefinição"],["🗑️ Elimina preset","🗑️ Delete preset","🗑️ Supprimer le préréglage","🗑️ Eliminar preajuste","🗑️ Vorlage löschen","🗑️ Eliminar predefinição"],["🚀 Applica ai segmenti selezionati","🚀 Apply to selected segments","🚀 Appliquer aux segments sélectionnés","🚀 Aplicar a segmentos seleccionados","🚀 Auf ausgewählte Segmente anwenden","🚀 Aplicar aos segmentos selecionados"],["Calendario collegato","Linked calendar","Calendrier associé","Calendario vinculado","Verknüpfter Kalender","Calendário associado"],["Applica un calendario salvato al preset selezionato senza toccare direzioni e veicoli.","Link a saved calendar to the preset without changing directions or vehicles.","Associez un calendrier au préréglage sans modifier sens ni véhicules.","Vincula un calendario al preajuste sin modificar sentidos ni vehículos.","Gespeicherten Kalender mit einer Vorlage verknüpfen, ohne Richtungen oder Fahrzeuge zu ändern.","Associe um calendário à predefinição sem alterar sentidos ou veículos."],["Collegamento","Link","Association","Vínculo","Verknüpfung","Associação"],["Calendario da usare con il preset","Calendar for this preset","Calendrier du préréglage","Calendario del preajuste","Kalender für diese Vorlage","Calendário da predefinição"],["Se scegli “nessun calendario”, il preset mantiene i suoi orari originali.","Choosing “no calendar” keeps the preset’s original hours.","« Aucun calendrier » conserve les horaires d’origine.","« Sin calendario » conserva los horarios originales.","„Kein Kalender“ behält die ursprünglichen Zeiten bei.","« Sem calendário » mantém os horários originais."],["🔗 Salva collegamento al preset selezionato","🔗 Save calendar link","🔗 Enregistrer l’association","🔗 Guardar vínculo al calendario","🔗 Kalenderverknüpfung speichern","🔗 Guardar associação ao calendário"],["⛓️‍💥 Scollega calendario dal preset","⛓️‍💥 Unlink calendar","⛓️‍💥 Dissocier le calendrier","⛓️‍💥 Desvincular calendario","⛓️‍💥 Kalenderverknüpfung lösen","⛓️‍💥 Desassociar calendário"],["📄 Copia preset con questo calendario","📄 Copy preset with this calendar","📄 Copier avec ce calendrier","📄 Copiar con este calendario","📄 Vorlage mit Kalender kopieren","📄 Copiar com este calendário"],["Libreria calendari","Calendar library","Bibliothèque de calendriers","Biblioteca de calendarios","Kalenderbibliothek","Biblioteca de calendários"],["Calendari locali e riutilizzabili. Non sono gli Scheduler comunitari delle zone scolastiche.","Reusable local calendars, not the community school-zone schedulers.","Calendriers locaux réutilisables, différents des planifications communautaires des zones scolaires.","Calendarios locales reutilizables, distintos de los planificadores comunitarios de zonas escolares.","Lokale, wiederverwendbare Kalender; nicht die Community-Zeitpläne für Schulzonen.","Calendários locais reutilizáveis, diferentes dos agendamentos comunitários das zonas escolares."],["Calendari salvati","Saved calendars","Calendriers enregistrés","Calendarios guardados","Gespeicherte Kalender","Calendários guardados"],["Nome calendario","Calendar name","Nom du calendrier","Nombre del calendario","Kalendername","Nome do calendário"],["Fuso orario (IANA)","Time zone (IANA)","Fuseau horaire (IANA)","Zona horaria (IANA)","Zeitzone (IANA)","Fuso horário (IANA)"],["Intervallo di validità","Validity period","Période de validité","Periodo de validez","Gültigkeitszeitraum","Período de validade"],["Limita a un intervallo di date","Limit to date range","Limiter à une période","Limitar a un intervalo de fechas","Auf Datumsbereich begrenzen","Limitar a um intervalo de datas"],["Ripeti ogni anno","Repeat every year","Répéter chaque année","Repetir cada año","Jährlich wiederholen","Repetir todos os anos"],["Data iniziale","Start date","Date de début","Fecha de inicio","Startdatum","Data de início"],["Data finale","End date","Date de fin","Fecha de fin","Enddatum","Data de fim"],["Sintesi rapida","Quick summary","Résumé rapide","Resumen rápido","Kurzübersicht","Resumo rápido"],["Puoi usare solo fasce settimanali, solo ricorrenze mobili oppure entrambe.","Use weekly time slots, movable dates, or both.","Utilisez des plages hebdomadaires, des dates mobiles ou les deux.","Usa franjas semanales, fechas móviles o ambas.","Wöchentliche Zeitfenster, bewegliche Termine oder beides verwenden.","Use horários semanais, datas móveis ou ambos."],["🚫 Giorni esclusi","🚫 Excluded days","🚫 Jours exclus","🚫 Días excluidos","🚫 Ausgeschlossene Tage","🚫 Dias excluídos"],["Le restrizioni NON saranno attive durante festività e vacanze. Imposta prima un intervallo preciso di validità; con esclusioni attive non usare «Ripeti ogni anno».","Restrictions will NOT apply on holidays or breaks. Set a precise date range; do not use “Repeat every year” with exclusions.","Les restrictions ne s’appliquent PAS pendant les jours fériés ou vacances. Définissez des dates précises sans répétition annuelle.","Las restricciones NO se aplicarán en festivos ni vacaciones. Define fechas exactas y desactiva la repetición anual.","Beschränkungen gelten NICHT an Feiertagen und in Ferien. Genaue Daten festlegen und jährliche Wiederholung deaktivieren.","As restrições NÃO se aplicam em feriados ou férias. Defina datas exatas e desative a repetição anual."],["Escludi automaticamente festività nazionali italiane (compresi Pasqua, Pasquetta e 4 ottobre dal 2026)","Automatically exclude Italian public holidays (including Easter, Easter Monday and 4 October from 2026)","Exclure les jours fériés italiens (dont Pâques, lundi de Pâques et le 4 octobre dès 2026)","Excluir festivos nacionales italianos (incluidos Pascua, Lunes de Pascua y 4 de octubre desde 2026)","Italienische Feiertage ausschließen (einschließlich Ostern, Ostermontag und 4. Oktober ab 2026)","Excluir feriados nacionais italianos (incluindo Páscoa, segunda-feira de Páscoa e 4 de outubro desde 2026)"],["+ Aggiungi data o periodo escluso","+ Add excluded date or period","+ Ajouter un jour ou une période exclus","+ Añadir día o periodo excluido","+ Ausgeschlossenen Tag oder Zeitraum hinzufügen","+ Adicionar data ou período excluído"],["Per le scuole inserisci manualmente vacanze regionali, chiusure dell'istituto e Santo Patrono. Le date escluse hanno precedenza su tutte le fasce e ricorrenze.","For schools, manually add regional breaks, school closures and the patron saint day. Excluded dates take precedence over all time slots and recurrences.","Pour les écoles, ajoutez manuellement vacances régionales, fermetures et fête patronale. Les exclusions prévalent sur tous les horaires.","Para escuelas, añade vacaciones regionales, cierres y fiesta patronal. Las exclusiones prevalecen sobre todos los horarios.","Für Schulen regionale Ferien, Schließtage und Patronatsfest manuell eintragen. Ausschlüsse haben Vorrang.","Para escolas, adicione férias regionais, encerramentos e feriado do padroeiro. As exclusões prevalecem sobre todos os horários."],["Fasce orarie e giorni","Time slots and days","Plages horaires et jours","Franjas horarias y días","Zeitfenster und Tage","Horários e dias"],["Ogni fascia genera una restrizione distinta quando necessario.","Each time slot creates a separate restriction when needed.","Chaque plage crée une restriction distincte si nécessaire.","Cada franja crea una restricción independiente cuando es necesario.","Jedes Zeitfenster erstellt bei Bedarf eine eigene Beschränkung.","Cada horário cria uma restrição distinta quando necessário."],["+ Aggiungi fascia oraria","+ Add time slot","+ Ajouter une plage horaire","+ Añadir franja horaria","+ Zeitfenster hinzufügen","+ Adicionar horário"],["Date mobili e applicazione","Movable dates and application","Dates mobiles et application","Fechas móviles y aplicación","Bewegliche Termine und Anwendung","Datas móveis e aplicação"],["Ricorrenze annuali come Pasqua, Pasquetta o la seconda domenica di marzo.","Annual dates such as Easter, Easter Monday or the second Sunday in March.","Dates annuelles comme Pâques, lundi de Pâques ou le deuxième dimanche de mars.","Fechas anuales como Pascua, Lunes de Pascua o el segundo domingo de marzo.","Jährliche Termine wie Ostern, Ostermontag oder der zweite Sonntag im März.","Datas anuais como Páscoa, segunda-feira de Páscoa ou o segundo domingo de março."],["Ricorrenze","Recurrences","Récurrences","Recurrencias","Wiederholungen","Recorrências"],["Ricorrenze annuali su date mobili","Annual movable-date recurrences","Récurrences annuelles à date mobile","Recurrencias anuales de fechas móviles","Jährliche bewegliche Termine","Recorrências anuais em datas móveis"],["Ogni occorrenza genera una restrizione distinta e va rinnovata al termine delle annualità.","Each occurrence creates a separate restriction and must be renewed after the selected years.","Chaque occurrence crée une restriction distincte à renouveler après la période.","Cada fecha crea una restricción distinta que deberá renovarse al terminar los años elegidos.","Jeder Termin erstellt eine eigene Beschränkung und muss nach Ablauf erneuert werden.","Cada ocorrência cria uma restrição distinta, a renovar após os anos escolhidos."],["Anno iniziale","Start year","Année de début","Año inicial","Startjahr","Ano inicial"],["Anno finale","End year","Année de fin","Año final","Endjahr","Ano final"],["+ Aggiungi ricorrenza mobile","+ Add movable recurrence","+ Ajouter une date mobile","+ Añadir fecha móvil","+ Beweglichen Termin hinzufügen","+ Adicionar data móvel"],["Anteprima calendario","Calendar preview","Aperçu du calendrier","Vista previa del calendario","Kalendervorschau","Pré-visualização do calendário"],["🆕 Nuovo","🆕 New","🆕 Nouveau","🆕 Nuevo","🆕 Neu","🆕 Novo"],["📄 Duplica","📄 Duplicate","📄 Dupliquer","📄 Duplicar","📄 Duplizieren","📄 Duplicar"],["💾 Salva calendario","💾 Save calendar","💾 Enregistrer le calendrier","💾 Guardar calendario","💾 Kalender speichern","💾 Guardar calendário"],["🗑️ Elimina calendario","🗑️ Delete calendar","🗑️ Supprimer le calendrier","🗑️ Eliminar calendario","🗑️ Kalender löschen","🗑️ Eliminar calendário"],["📅 Applica SOLO il calendario alle restrizioni selezionate","📅 Apply ONLY calendar to selected restrictions","📅 Appliquer UNIQUEMENT le calendrier aux restrictions","📅 Aplicar SOLO el calendario a las restricciones","📅 NUR Kalender auf ausgewählte Beschränkungen anwenden","📅 Aplicar APENAS o calendário às restrições"],["“Solo calendario” cambia gli orari delle restrizioni esistenti senza cambiare veicoli o direzioni. Modificare qui un calendario non aggiorna automaticamente le restrizioni già salvate su WME.","“Calendar only” updates the times of existing restrictions without changing vehicles or directions. Editing a calendar does not automatically update WME segments.","« Calendrier seul » modifie les horaires sans modifier véhicules ou sens. Modifier un calendrier ne met pas à jour automatiquement WME.","« Solo calendario » cambia horarios, no vehículos ni sentidos. Modificar un calendario no actualiza automáticamente WME.","„Nur Kalender“ ändert Zeiten, nicht Fahrzeuge oder Richtungen. Kalenderänderungen aktualisieren WME nicht automatisch.","« Apenas calendário » altera horários, não veículos nem sentidos. Alterações no calendário não atualizam o WME automaticamente."],["Opzioni avanzate","Advanced options","Options avancées","Opciones avanzadas","Erweiterte Optionen","Opções avançadas"],["Usa queste opzioni solo quando ti servono le condizioni motore delle motociclette.","Use these options only when motorcycle engine rules are needed.","Utilisez ces options uniquement pour les conditions de moteur de moto.","Utiliza estas opciones solo para condiciones de motor de motos.","Diese Optionen nur für Motorrad-Motorregeln verwenden.","Use estas opções apenas para condições de motor de motos."],["Avanzate","Advanced","Avancé","Avanzadas","Erweitert","Avançadas"],["Abilita applicazione sperimentale delle condizioni motore","Enable experimental engine-rule application","Activer l’application expérimentale des règles moteur","Activar aplicación experimental de reglas de motor","Experimentelle Anwendung von Motorregeln aktivieren","Ativar aplicação experimental das regras de motor"],["Utilizza un’interfaccia interna WME non supportata dallo SDK. Anche la selezione multipla procede un segmento per volta: in caso di errore gli aggiornamenti precedenti potrebbero essere già applicati. Verifica sempre prima di salvare.","Uses an internal WME interface not supported by the SDK. Multi-selection processes one segment at a time; earlier changes may remain if a later step fails. Check before saving.","Utilise une interface interne WME non prise en charge par le SDK. Le traitement multiple est séquentiel; en cas d’échec, des modifications peuvent subsister. Vérifiez avant d’enregistrer.","Usa una interfaz interna WME no admitida por el SDK. Procesa los segmentos uno a uno; si falla, puede haber cambios previos. Comprueba antes de guardar.","Nutzt eine interne WME-Schnittstelle ohne SDK-Unterstützung. Mehrfachauswahl wird nacheinander verarbeitet; bei Fehlern können Änderungen verbleiben. Vor dem Speichern prüfen.","Usa uma interface interna WME não suportada pelo SDK. Processa segmentos um a um; em caso de erro podem subsistir alterações. Verifique antes de guardar."],["Backup e manutenzione","Backup and maintenance","Sauvegarde et maintenance","Copia de seguridad y mantenimiento","Sicherung und Wartung","Cópia de segurança e manutenção"],["Esporta o importa preset e calendari in un unico file JSON.","Export or import presets and calendars in a single JSON file.","Exportez ou importez préréglages et calendriers dans un seul fichier JSON.","Exporta o importa preajustes y calendarios en un único JSON.","Vorlagen und Kalender in einer einzigen JSON-Datei exportieren oder importieren.","Exporte ou importe predefinições e calendários num único ficheiro JSON."],["⬇️ Esporta JSON","⬇️ Export JSON","⬇️ Exporter JSON","⬇️ Exportar JSON","⬇️ JSON exportieren","⬇️ Exportar JSON"],["⬆️ Importa JSON","⬆️ Import JSON","⬆️ Importer JSON","⬆️ Importar JSON","⬆️ JSON importieren","⬆️ Importar JSON"],["Il backup include preset, collegamenti ai calendari e libreria calendari.","The backup includes presets, calendar links and the calendar library.","La sauvegarde inclut préréglages, liens et bibliothèque de calendriers.","La copia incluye preajustes, vínculos y biblioteca de calendarios.","Das Backup enthält Vorlagen, Kalenderverknüpfungen und die Kalenderbibliothek.","A cópia inclui predefinições, associações e biblioteca de calendários."],["Stato e note","Status and notes","État et notes","Estado y notas","Status und Hinweise","Estado e notas"],["Messaggi operativi e promemoria d’uso.","Operation messages and reminders.","Messages et rappels d’utilisation.","Mensajes operativos y recordatorios.","Betriebsmeldungen und Hinweise.","Mensagens de operação e lembretes."],["Stato","Status","État","Estado","Status","Estado"],["I preset sono locali al browser. Le condizioni motore vengono salvate dal modello interno WME. Il backup JSON include anche la libreria calendari. Dopo l’applicazione verifica sempre il risultato prima di salvare in WME.","Presets are stored locally in the browser. Engine rules use the internal WME model. JSON backups include calendars. Always check changes before saving in WME.","Les préréglages sont locaux au navigateur. Les règles moteur utilisent le modèle interne WME. Les sauvegardes incluent les calendriers. Vérifiez avant d’enregistrer dans WME.","Los preajustes se guardan en el navegador. Las reglas de motor usan el modelo interno WME. Las copias incluyen calendarios. Comprueba antes de guardar en WME.","Vorlagen bleiben lokal im Browser. Motorregeln nutzen das interne WME-Modell. JSON-Backups enthalten Kalender. Vor dem Speichern in WME prüfen.","As predefinições ficam no navegador. As regras de motor usam o modelo interno WME. Os backups incluem calendários. Verifique antes de guardar no WME."],["Nome del preset","Preset name","Nom du préréglage","Nombre del preajuste","Vorlagenname","Nome da predefinição"],["Esempio: Orari accesso scuola","Example: School access hours","Exemple : horaires d’accès à l’école","Ejemplo: horario de acceso escolar","Beispiel: Schulzufahrtszeiten","Exemplo: horário de acesso à escola"],["-- Nuovo calendario --","-- New calendar --","-- Nouveau calendrier --","-- Nuevo calendario --","-- Neuer Kalender --","-- Novo calendário --"],["Nessun calendario — orari originali","No calendar — original hours","Aucun calendrier — horaires d’origine","Sin calendario — horarios originales","Kein Kalender — ursprüngliche Zeiten","Sem calendário — horários originais"],["-- Seleziona un preset --","-- Select a preset --","-- Sélectionnez un préréglage --","-- Seleccionar preajuste --","-- Vorlage auswählen --","-- Selecionar predefinição --"],["Rimuovi","Remove","Supprimer","Quitar","Entfernen","Remover"],["Dalle","From","De","Desde","Von","Das"],["Alle","To","À","Hasta","Bis","Até"],["Da","From","De","Desde","Von","De"],["A","To","À","Hasta","Bis","Até"],["Fascia settimanale","Weekly time slot","Plage hebdomadaire","Franja semanal","Wöchentliches Zeitfenster","Horário semanal"],["Tutto il giorno","All day","Toute la journée","Todo el día","Ganztägig","Todo o dia"],["tutto il giorno","all day","toute la journée","todo el día","ganztägig","todo o dia"],["Ricorrenza","Recurrence","Récurrence","Recurrencia","Wiederholung","Recorrência"],["N-esimo giorno del mese","Nth weekday of the month","N-ième jour de semaine du mois","N.º día de la semana del mes","N-ter Wochentag des Monats","N.º dia da semana do mês"],["Pasqua gregoriana (± giorni)","Gregorian Easter (± days)","Pâques grégorienne (± jours)","Pascua gregoriana (± días)","Gregorianisches Ostern (± Tage)","Páscoa gregoriana (± dias)"],["Settimana","Ordinal","Rang","Semana","Woche","Semana"],["Giorno","Weekday","Jour","Día","Wochentag","Dia"],["Mese","Month","Mois","Mes","Monat","Mês"],["Prima","First","Première","Primera","Erste","Primeira"],["Seconda","Second","Deuxième","Segunda","Zweite","Segunda"],["Terza","Third","Troisième","Tercera","Dritte","Terceira"],["Quarta","Fourth","Quatrième","Cuarta","Vierte","Quarta"],["Quinta","Fifth","Cinquième","Quinta","Fünfte","Quinta"],["Ultima","Last","Dernière","Última","Letzte","Última"],["Primo","First","Premier","Primero","Erster","Primeiro"],["Secondo","Second","Deuxième","Segundo","Zweiter","Segundo"],["Terzo","Third","Troisième","Tercero","Dritter","Terceiro"],["Quarto","Fourth","Quatrième","Cuarto","Vierter","Quarto"],["Quinto","Fifth","Cinquième","Quinto","Fünfter","Quinto"],["Ultimo","Last","Dernier","Último","Letzter","Último"],["Giorni da Pasqua","Days from Easter","Jours après Pâques","Días desde Pascua","Tage ab Ostern","Dias desde a Páscoa"],["0 = Pasqua, +1 = lunedì di Pasqua","0 = Easter, +1 = Easter Monday","0 = Pâques, +1 = lundi de Pâques","0 = Pascua, +1 = Lunes de Pascua","0 = Ostern, +1 = Ostermontag","0 = Páscoa, +1 = segunda-feira de Páscoa"],["Motivo dell'esclusione (facoltativo)","Reason for exclusion (optional)","Motif de l’exclusion (facultatif)","Motivo de exclusión (opcional)","Grund für Ausschluss (optional)","Motivo da exclusão (opcional)"],["Es. Vacanze natalizie o Santo Patrono","E.g. Christmas holidays or patron saint","Ex. vacances de Noël ou fête patronale","Ej. vacaciones navideñas o fiesta patronal","Z. B. Weihnachtsferien oder Patronatsfest","Ex.: férias de Natal ou dia do padroeiro"],["Dal giorno","From date","Du","Desde el día","Ab Datum","Desde o dia"],["Al giorno (vuoto = un giorno)","To date (blank = one day)","Au (vide = un jour)","Hasta (vacío = un día)","Bis Datum (leer = ein Tag)","Até ao dia (vazio = um dia)"],["✕ Rimuovi esclusione","✕ Remove exclusion","✕ Supprimer l’exclusion","✕ Quitar exclusión","✕ Ausschluss entfernen","✕ Remover exclusão"],["Lun","Mon","Lun","Lun","Mo","Seg"],["Mar","Tue","Mar","Mar","Di","Ter"],["Mer","Wed","Mer","Mié","Mi","Qua"],["Gio","Thu","Jeu","Jue","Do","Qui"],["Ven","Fri","Ven","Vie","Fr","Sex"],["Sab","Sat","Sam","Sáb","Sa","Sáb"],["Dom","Sun","Dim","Dom","So","Dom"],["doppio senso","two-way","double sens","doble sentido","beidseitig","duplo sentido"],["direzione sconosciuta","unknown direction","sens inconnu","sentido desconocido","Richtung unbekannt","sentido desconhecido"],["motori","engines","moteurs","motores","Motoren","motores"],["da risalvare","re-save required","à réenregistrer","volver a guardar","neu speichern","voltar a guardar"],["senza calendario","without calendar","sans calendrier","sin calendario","ohne Kalender","sem calendário"],["(copia)","(copy)","(copie)","(copia)","(Kopie)","(cópia)"],["Ogni settimana, senza scadenza","Every week, no end date","Chaque semaine, sans date de fin","Cada semana, sin fecha de fin","Wöchentlich, ohne Enddatum","Todas as semanas, sem prazo"],["Ripetizione annuale","Annual recurrence","Récurrence annuelle","Repetición anual","Jährliche Wiederholung","Repetição anual"],["Festività nazionali italiane: escluse (incl. Pasqua e Pasquetta)","Italian public holidays excluded (incl. Easter and Easter Monday)","Jours fériés italiens exclus (dont Pâques et lundi de Pâques)","Festivos italianos excluidos (incl. Pascua y Lunes de Pascua)","Italienische Feiertage ausgeschlossen (inkl. Ostern und Ostermontag)","Feriados italianos excluídos (incl. Páscoa e segunda-feira)"],["Validità {start} → {end}","Validity {start} → {end}","Validité {start} → {end}","Validez {start} → {end}","Gültigkeit {start} → {end}","Validade {start} → {end}"],["Occorrenze generate: anni {start}–{end} (non automatiche oltre la fine)","Generated occurrences: {start}–{end} (not renewed automatically)","Occurrences générées : {start}–{end} (sans renouvellement automatique)","Fechas generadas: {start}–{end} (sin renovación automática)","Erzeugte Termine: {start}–{end} (keine automatische Verlängerung)","Ocorrências geradas: {start}–{end} (sem renovação automática)"],["Escluso: {dates}","Excluded: {dates}","Exclu : {dates}","Excluido: {dates}","Ausgeschlossen: {dates}","Excluído: {dates}"],["Giorni esclusi nel periodo: {count}","Excluded days in range: {count}","Jours exclus dans la période : {count}","Días excluidos en el periodo: {count}","Ausgeschlossene Tage im Zeitraum: {count}","Dias excluídos no período: {count}"],["Restrizioni generate per modello: {count}","Restrictions generated per template: {count}","Restrictions générées par modèle : {count}","Restricciones generadas por plantilla: {count}","Beschränkungen je Vorlage: {count}","Restrições geradas por modelo: {count}"],["Fuso: {tz}","Time zone: {tz}","Fuseau : {tz}","Zona horaria: {tz}","Zeitzone: {tz}","Fuso horário: {tz}"],["Pasqua {offset} giorni","Easter {offset} days","Pâques {offset} jours","Pascua {offset} días","Ostern {offset} Tage","Páscoa {offset} dias"],["Da completare: {detail}","To complete: {detail}","À compléter : {detail}","Por completar: {detail}","Noch auszufüllen: {detail}","Por completar: {detail}"],["Lingua di WME","WME language","Langue WME","Idioma de WME","WME-Sprache","Idioma do WME"],["Lingua aggiornata: {language}","Language updated: {language}","Langue actualisée : {language}","Idioma actualizado: {language}","Sprache aktualisiert: {language}","Idioma atualizado: {language}"],["Restrizione non valida.","Invalid restriction.","Restriction invalide.","Restricción no válida.","Ungültige Beschränkung.","Restrição inválida."],["Direzione restrizione non valida.","Invalid restriction direction.","Sens de restriction invalide.","Sentido de restricción no válido.","Ungültige Beschränkungsrichtung.","Sentido da restrição inválido."],["Tipo di restrizione non valido.","Invalid restriction type.","Type de restriction invalide.","Tipo de restricción no válido.","Ungültiger Beschränkungstyp.","Tipo de restrição inválido."],["laneScope mancante.","Missing laneScope.","laneScope manquant.","Falta laneScope.","laneScope fehlt.","laneScope em falta."],["Regole veicoli non valide.","Invalid vehicle rules.","Règles véhicule invalides.","Reglas de vehículo no válidas.","Ungültige Fahrzeugregeln.","Regras de veículos inválidas."],["Calendario non valido.","Invalid calendar.","Calendrier invalide.","Calendario no válido.","Ungültiger Kalender.","Calendário inválido."],["Inserisci un nome calendario (massimo 90 caratteri).","Enter a calendar name (max 90 characters).","Saisissez un nom de calendrier (90 caractères max.).","Introduce un nombre de calendario (máx. 90 caracteres).","Kalendernamen eingeben (max. 90 Zeichen).","Introduza um nome de calendário (máx. 90 caracteres)."],["Fuso orario non valido (es. Europe/Rome).","Invalid time zone (e.g. Europe/Rome).","Fuseau horaire invalide (ex. Europe/Rome).","Zona horaria no válida (p. ej. Europe/Rome).","Ungültige Zeitzone (z. B. Europe/Rome).","Fuso horário inválido (ex.: Europe/Rome)."],["Per la validità temporale devi indicare sia la data iniziale sia quella finale.","Enter both a start and an end date.","Indiquez une date de début et de fin.","Indica fecha inicial y final.","Start- und Enddatum eingeben.","Indique a data inicial e final."],["Intervallo di date non valido.","Invalid date range.","Période invalide.","Intervalo de fechas no válido.","Ungültiger Datumsbereich.","Intervalo de datas inválido."],["La ripetizione annuale richiede un intervallo di date.","Annual recurrence requires a date range.","La répétition annuelle nécessite une période.","La repetición anual requiere un intervalo de fechas.","Jährliche Wiederholung benötigt einen Datumsbereich.","A repetição anual requer um intervalo de datas."],["Con i giorni esclusi devi impostare un intervallo preciso di validità (es. settembre–giugno).","With exclusions, set an exact date range (e.g. September–June).","Avec exclusions, définissez une période exacte (ex. septembre–juin).","Con exclusiones, define fechas exactas (p. ej. septiembre–junio).","Bei Ausschlüssen genauen Datumsbereich wählen (z. B. September–Juni).","Com exclusões, defina um período exato (ex.: setembro–junho)."],["Con i giorni esclusi disattiva «Ripeti ogni anno»: per sicurezza i periodi vanno generati per anni specifici.","Disable “Repeat every year” with exclusions: generate dates for specific years.","Désactivez « Répéter chaque année » avec exclusions : utilisez des années précises.","Desactiva « Repetir cada año » con exclusiones: usa años concretos.","Bei Ausschlüssen „Jährlich wiederholen“ deaktivieren: konkrete Jahre nutzen.","Desative « Repetir todos os anos » com exclusões: use anos concretos."],["Periodo con esclusioni troppo lungo (massimo 5 anni). Riduci l'intervallo.","Excluded-date period too long (max 5 years). Shorten the range.","Période d’exclusion trop longue (5 ans max.). Réduisez-la.","Periodo con exclusiones demasiado largo (máx. 5 años). Redúcelo.","Ausschlusszeitraum zu lang (max. 5 Jahre). Kürzen.","Período com exclusões demasiado longo (máx. 5 anos). Reduza."],["Inserisci non più di 20 fasce settimanali.","Use no more than 20 weekly time slots.","Utilisez au maximum 20 plages hebdomadaires.","Usa como máximo 20 franjas semanales.","Höchstens 20 wöchentliche Zeitfenster verwenden.","Use no máximo 20 horários semanais."],["Le fasce orarie si sovrappongono sullo stesso giorno.","Time slots overlap on the same day.","Des plages horaires se chevauchent le même jour.","Las franjas horarias se solapan en el mismo día.","Zeitfenster überschneiden sich am selben Tag.","Os horários sobrepõem-se no mesmo dia."],["Massimo 8 ricorrenze speciali per calendario.","Maximum 8 special recurrences per calendar.","8 récurrences spéciales maximum par calendrier.","Máximo 8 recurrencias especiales por calendario.","Maximal 8 Sondertermine pro Kalender.","Máximo de 8 recorrências especiais por calendário."],["Inserisci almeno una fascia settimanale o una ricorrenza speciale.","Add at least one weekly slot or special recurrence.","Ajoutez une plage hebdomadaire ou une récurrence spéciale.","Añade una franja semanal o una fecha especial.","Mindestens ein wöchentliches Zeitfenster oder Sondertermin erforderlich.","Adicione um horário semanal ou recorrência especial."],["Orario non valido. Usa HH:MM (00:00–23:59).","Invalid time. Use HH:MM (00:00–23:59).","Heure invalide. Utilisez HH:MM (00:00–23:59).","Hora no válida. Usa HH:MM (00:00–23:59).","Ungültige Uhrzeit. Format HH:MM (00:00–23:59).","Hora inválida. Use HH:MM (00:00–23:59)."],["Il calendario non ha date attive: controlla le esclusioni e il periodo.","Calendar has no active dates: check exclusions and date range.","Aucune date active : vérifiez exclusions et période.","El calendario no tiene fechas activas: comprueba exclusiones y periodo.","Kalender hat keine aktiven Tage: Ausschlüsse und Zeitraum prüfen.","O calendário não tem datas ativas: verifique exclusões e período."],["Esiste già un calendario con questo nome.","A calendar with this name already exists.","Un calendrier porte déjà ce nom.","Ya existe un calendario con ese nombre.","Ein Kalender mit diesem Namen existiert bereits.","Já existe um calendário com esse nome."],["Seleziona un calendario da eliminare.","Select a calendar to delete.","Sélectionnez un calendrier à supprimer.","Selecciona un calendario para eliminar.","Kalender zum Löschen auswählen.","Selecione um calendário para eliminar."],["Seleziona un preset dal menu.","Select a preset from the menu.","Sélectionnez un préréglage dans le menu.","Selecciona un preajuste del menú.","Vorlage im Menü auswählen.","Selecione uma predefinição no menu."],["Il preset non ha un calendario collegato.","The preset has no linked calendar.","Aucun calendrier associé à ce préréglage.","El preajuste no tiene un calendario vinculado.","Die Vorlage hat keinen verknüpften Kalender.","A predefinição não tem calendário associado."],["Seleziona il preset originale dal menu.","Select the original preset.","Sélectionnez le préréglage d’origine.","Selecciona el preajuste original.","Ursprüngliche Vorlage auswählen.","Selecione a predefinição original."],["Calendario non trovato.","Calendar not found.","Calendrier introuvable.","Calendario no encontrado.","Kalender nicht gefunden.","Calendário não encontrado."],["Nome del nuovo preset non valido o già utilizzato.","New preset name is invalid or already used.","Nom du nouveau préréglage invalide ou déjà utilisé.","Nombre del nuevo preajuste no válido o ya utilizado.","Neuer Vorlagenname ungültig oder bereits vergeben.","Nome da nova predefinição inválido ou já utilizado."],["Seleziona un preset salvato dal menu.","Select a saved preset from the menu.","Sélectionnez un préréglage enregistré.","Selecciona un preajuste guardado.","Gespeicherte Vorlage auswählen.","Selecione uma predefinição guardada."],["Seleziona un calendario già salvato.","Select a saved calendar.","Sélectionnez un calendrier enregistré.","Selecciona un calendario guardado.","Gespeicherten Kalender auswählen.","Selecione um calendário guardado."],["Attiva l'opzione sperimentale per aggiornare segmenti con condizioni motore.","Enable the experimental option to update segments with engine rules.","Activez l’option expérimentale pour modifier les règles moteur.","Activa la opción experimental para modificar reglas de motor.","Experimentelle Option für Segmente mit Motorregeln aktivieren.","Ative a opção experimental para alterar regras de motor."],["Seleziona uno o più segmenti.","Select one or more segments.","Sélectionnez un ou plusieurs segments.","Selecciona uno o varios segmentos.","Ein oder mehrere Segmente auswählen.","Selecione um ou mais segmentos."],["La selezione non contiene segmenti.","Selection contains no segments.","La sélection ne contient aucun segment.","La selección no contiene segmentos.","Auswahl enthält keine Segmente.","A seleção não contém segmentos."],["Segmento SDK non trovato.","SDK segment not found.","Segment SDK introuvable.","Segmento SDK no encontrado.","SDK-Segment nicht gefunden.","Segmento SDK não encontrado."],["Restrizione interna WME non clonabile.","Cannot clone the internal WME restriction.","Impossible de cloner la restriction interne WME.","No se puede clonar la restricción interna WME.","Interne WME-Beschränkung kann nicht kopiert werden.","Não foi possível clonar a restrição interna WME."],["Direzione della restrizione interna diversa da quella SDK.","Internal restriction direction differs from SDK direction.","Le sens interne diffère de celui du SDK.","El sentido interno difiere del SDK.","Interne Richtung unterscheidet sich von der SDK-Richtung.","O sentido interno difere do SDK."],["Inserisci un nome preset valido.","Enter a valid preset name.","Saisissez un nom de préréglage valide.","Introduce un nombre válido de preajuste.","Gültigen Vorlagennamen eingeben.","Introduza um nome válido de predefinição."],["Per salvare seleziona un solo segmento.","Select a single segment to save a preset.","Sélectionnez un seul segment pour enregistrer.","Selecciona un segmento para guardar el preajuste.","Zum Speichern genau ein Segment auswählen.","Selecione um segmento para guardar."],["Il segmento non contiene restrizioni.","The segment has no restrictions.","Le segment ne comporte aucune restriction.","El segmento no tiene restricciones.","Das Segment enthält keine Beschränkungen.","O segmento não tem restrições."],["Il modello interno non serializza le condizioni del motore nel JSON. Salvataggio bloccato per sicurezza.","Internal model does not serialize engine rules in JSON. Saving blocked for safety.","Le modèle interne ne sérialise pas les règles moteur en JSON. Enregistrement bloqué par sécurité.","El modelo interno no serializa las reglas de motor en JSON. Guardado bloqueado por seguridad.","Internes Modell serialisiert Motorregeln nicht in JSON. Speichern aus Sicherheitsgründen blockiert.","O modelo interno não serializa regras de motor em JSON. Operação bloqueada por segurança."],["Modifica annullata.","Change undone.","Modification annulée.","Cambio deshecho.","Änderung rückgängig gemacht.","Alteração anulada."],["Verifica e annulla l'ultima modifica in WME.","Check and undo the last change in WME.","Vérifiez et annulez la dernière modification dans WME.","Comprueba y deshaz el último cambio en WME.","Letzte Änderung in WME prüfen und rückgängig machen.","Verifique e anule a última alteração no WME."],["ActionManager WME non disponibile: regole motore non applicate.","WME ActionManager unavailable: engine rules not applied.","ActionManager WME indisponible : règles moteur non appliquées.","ActionManager WME no disponible: reglas de motor no aplicadas.","WME ActionManager nicht verfügbar: Motorregeln nicht angewendet.","ActionManager WME indisponível: regras de motor não aplicadas."],["La sottoazione WME non contiene le restrizioni attese.","WME subaction does not contain the expected restrictions.","La sous-action WME ne contient pas les restrictions attendues.","La subacción WME no contiene las restricciones esperadas.","WME-Unteraktion enthält nicht die erwarteten Beschränkungen.","A subação WME não contém as restrições esperadas."],["Numero restrizioni diverso nell'azione WME.","Restriction count differs in the WME action.","Nombre de restrictions différent dans l’action WME.","Cantidad de restricciones distinta en la acción WME.","Abweichende Anzahl von Beschränkungen in WME-Aktion.","Número de restrições diferente na ação WME."],["Mancano i dati WME completi delle regole motore.","Complete WME engine-rule data is missing.","Données complètes des règles moteur WME manquantes.","Faltan los datos completos de motor de WME.","Vollständige WME-Motorregeldaten fehlen.","Faltam dados completos das regras de motor WME."],["SegmentRestriction.with() non disponibile.","SegmentRestriction.with() unavailable.","SegmentRestriction.with() indisponible.","SegmentRestriction.with() no disponible.","SegmentRestriction.with() nicht verfügbar.","SegmentRestriction.with() indisponível."],["La ricostruzione ha perso condizioni motociclistiche.","Motorcycle engine conditions were lost during reconstruction.","Les conditions moteur ont été perdues lors de la reconstruction.","Se han perdido condiciones de motor al reconstruir.","Motorrad-Motorbedingungen gingen bei der Rekonstruktion verloren.","As condições de motor perderam-se na reconstrução."],["Impossibile intercettare il gestore azioni WME.","Cannot intercept the WME action manager.","Impossible d’intercepter le gestionnaire d’actions WME.","No se puede interceptar el gestor de acciones WME.","WME-Aktionsmanager kann nicht abgefangen werden.","Não foi possível intercetar o gestor de ações WME."],["Controlla le modifiche in sospeso in WME.","Check pending changes in WME.","Vérifiez les modifications en attente dans WME.","Comprueba los cambios pendientes en WME.","Ausstehende Änderungen in WME prüfen.","Verifique as alterações pendentes no WME."],["Verifica e annulla manualmente l'ultima modifica WME.","Check and manually undo the last WME change.","Vérifiez et annulez manuellement la dernière modification WME.","Comprueba y deshaz manualmente el último cambio en WME.","Letzte WME-Änderung prüfen und manuell rückgängig machen.","Verifique e anule manualmente a última alteração no WME."],["Seleziona un preset.","Select a preset.","Sélectionnez un préréglage.","Selecciona un preajuste.","Vorlage auswählen.","Selecione uma predefinição."],["Questo preset moto è stato salvato senza i dati completi. Risalvalo dalla restrizione originale.","This motorcycle preset lacks complete data. Re-save it from the original restriction.","Ce préréglage moto manque de données complètes. Réenregistrez-le depuis la restriction d’origine.","Este preajuste de motos no tiene datos completos. Vuelve a guardarlo desde el original.","Diese Motorradvorlage enthält keine vollständigen Daten. Aus ursprünglicher Beschränkung neu speichern.","Esta predefinição de moto não tem dados completos. Guarde novamente a partir da restrição original."],["Il calendario collegato al preset non esiste più. Ricollega un calendario o seleziona 'Nessun calendario'.","Linked calendar no longer exists. Link another calendar or choose “No calendar”.","Le calendrier associé n’existe plus. Associez-en un autre ou choisissez « Aucun calendrier ».","El calendario vinculado ya no existe. Vincula otro o elige « Sin calendario ».","Verknüpfter Kalender existiert nicht mehr. Anderen auswählen oder „Kein Kalender“.","O calendário associado já não existe. Associe outro ou escolha « Sem calendário »."],["Per applicare condizioni motore, abilita prima la casella sperimentale.","Enable the experimental checkbox to apply engine rules.","Activez la case expérimentale pour appliquer les règles moteur.","Activa la casilla experimental para aplicar reglas de motor.","Experimentelles Kontrollkästchen für Motorregeln aktivieren.","Ative a caixa experimental para aplicar regras de motor."],["Preset non trovato.","Preset not found.","Préréglage introuvable.","Preajuste no encontrado.","Vorlage nicht gefunden.","Predefinição não encontrada."],["Backup di preset e calendari esportato.","Presets and calendars backup exported.","Sauvegarde des préréglages et calendriers exportée.","Copia de preajustes y calendarios exportada.","Vorlagen- und Kalender-Backup exportiert.","Cópia de segurança exportada."],["File JSON non valido.","Invalid JSON file.","Fichier JSON invalide.","Archivo JSON no válido.","Ungültige JSON-Datei.","Ficheiro JSON inválido."],["Backup vuoto.","Empty backup.","Sauvegarde vide.","Copia vacía.","Leeres Backup.","Cópia vazia."],["SDK WME presente, ma moduli necessari non disponibili.","WME SDK found, but required modules are unavailable.","SDK WME présent, mais modules requis indisponibles.","SDK WME presente, pero faltan módulos necesarios.","WME SDK gefunden, aber erforderliche Module fehlen.","SDK WME presente, mas faltam módulos necessários."],["La scheda WME non è stata restituita dallo SDK.","SDK did not return a WME tab.","Le SDK n’a pas renvoyé d’onglet WME.","El SDK no ha devuelto una pestaña WME.","SDK hat keinen WME-Tab zurückgegeben.","O SDK não devolveu um separador WME."],["Calendario «{name}» salvato. I segmenti già modificati non si aggiornano automaticamente.","Calendar “{name}” saved. Previously edited segments are not updated automatically.","Calendrier « {name} » enregistré. Les segments déjà modifiés ne sont pas mis à jour automatiquement.","Calendario «{name}» guardado. Los segmentos anteriores no se actualizan automáticamente.","Kalender „{name}“ gespeichert. Bereits bearbeitete Segmente werden nicht automatisch aktualisiert.","Calendário «{name}» guardado. Os segmentos anteriores não são atualizados automaticamente."],["Calendario non salvato: {detail}","Calendar not saved: {detail}","Calendrier non enregistré : {detail}","Calendario no guardado: {detail}","Kalender nicht gespeichert: {detail}","Calendário não guardado: {detail}"],["Calendario «{name}» eliminato.","Calendar “{name}” deleted.","Calendrier « {name} » supprimé.","Calendario «{name}» eliminado.","Kalender „{name}“ gelöscht.","Calendário «{name}» eliminado."],["Calendario scollegato dal preset «{name}».","Calendar unlinked from preset “{name}”.","Calendrier dissocié du préréglage « {name} ».","Calendario desvinculado de «{name}».","Kalender von Vorlage „{name}“ getrennt.","Calendário desassociado de «{name}»."],["Calendario «{calendar}» collegato al preset «{name}».","Calendar “{calendar}” linked to preset “{name}”.","Calendrier « {calendar} » associé au préréglage « {name} ».","Calendario «{calendar}» vinculado a «{name}».","Kalender „{calendar}“ mit Vorlage „{name}“ verknüpft.","Calendário «{calendar}» associado à predefinição «{name}»."],["Creato preset «{newName}»; l'originale «{name}» è rimasto invariato.","Preset “{newName}” created; original “{name}” is unchanged.","Préréglage « {newName} » créé ; original « {name} » inchangé.","Preajuste «{newName}» creado; original «{name}» sin cambios.","Vorlage „{newName}“ erstellt; Original „{name}“ unverändert.","Predefinição «{newName}» criada; original «{name}» inalterada."],["Orari del calendario applicati a {count} segmenti. Verifica in WME prima di salvare.","Calendar times applied to {count} segments. Check in WME before saving.","Horaires appliqués à {count} segments. Vérifiez dans WME avant d’enregistrer.","Horarios aplicados a {count} segmentos. Comprueba en WME antes de guardar.","Kalenderzeiten auf {count} Segmente angewendet. Vor dem Speichern in WME prüfen.","Horários aplicados a {count} segmentos. Verifique no WME antes de guardar."],["Calendario interrotto. Segmenti già aggiornati: {count}. {detail}","Calendar operation stopped. Segments already updated: {count}. {detail}","Opération interrompue. Segments déjà modifiés : {count}. {detail}","Operación interrumpida. Segmentos ya modificados: {count}. {detail}","Kalendervorgang abgebrochen. Bereits aktualisierte Segmente: {count}. {detail}","Operação interrompida. Segmentos já alterados: {count}. {detail}"],["Salvate {count} restrizioni nel preset \"{name}\". Regole motore: {motors}.","Saved {count} restrictions in preset “{name}”. Engine rules: {motors}.","{count} restrictions enregistrées dans « {name} ». Règles moteur : {motors}.","{count} restricciones guardadas en «{name}». Reglas motor: {motors}.","{count} Beschränkungen in Vorlage „{name}“ gespeichert. Motorregeln: {motors}.","{count} restrições guardadas em «{name}». Regras de motor: {motors}."],["Applicato a {count} segmenti. Verifica in WME e salva solo dopo il controllo.","Applied to {count} segments. Check in WME before saving.","Appliqué à {count} segments. Vérifiez dans WME avant d’enregistrer.","Aplicado a {count} segmentos. Comprueba en WME antes de guardar.","Auf {count} Segmente angewendet. Vor dem Speichern in WME prüfen.","Aplicado a {count} segmentos. Verifique no WME antes de guardar."],["Applicazione interrotta. Segmenti già aggiornati: {count}. {detail}","Application stopped. Segments already updated: {count}. {detail}","Application interrompue. Segments déjà modifiés : {count}. {detail}","Aplicación interrumpida. Segmentos ya modificados: {count}. {detail}","Anwendung abgebrochen. Bereits aktualisierte Segmente: {count}. {detail}","Aplicação interrompida. Segmentos já alterados: {count}. {detail}"],["Preset \"{name}\" eliminato.","Preset “{name}” deleted.","Préréglage « {name} » supprimé.","Preajuste «{name}» eliminado.","Vorlage „{name}“ gelöscht.","Predefinição «{name}» eliminada."],["Importati {presets} preset e {calendars} calendari.","Imported {presets} presets and {calendars} calendars.","{presets} préréglages et {calendars} calendriers importés.","Importados {presets} preajustes y {calendars} calendarios.","{presets} Vorlagen und {calendars} Kalender importiert.","Importadas {presets} predefinições e {calendars} calendários."],["Importazione non riuscita: {detail}","Import failed: {detail}","Échec de l’import : {detail}","Error al importar: {detail}","Import fehlgeschlagen: {detail}","Importação falhou: {detail}"],["Errore di inizializzazione: {detail}","Initialization error: {detail}","Erreur d’initialisation : {detail}","Error de inicialización: {detail}","Initialisierungsfehler: {detail}","Erro de inicialização: {detail}"],["Massimo {count} periodi esclusi.","Maximum {count} excluded periods.","{count} périodes exclues maximum.","Máximo {count} periodos excluidos.","Maximal {count} Ausschlusszeiträume.","Máximo de {count} períodos excluídos."],["Massimo 20 fasce per calendario.","Maximum 20 time slots per calendar.","20 plages horaires maximum par calendrier.","Máximo 20 franjas por calendario.","Maximal 20 Zeitfenster pro Kalender.","Máximo de 20 horários por calendário."],["Massimo 8 ricorrenze speciali.","Maximum 8 special recurrences.","8 récurrences spéciales maximum.","Máximo 8 fechas especiales.","Maximal 8 Sondertermine.","Máximo de 8 recorrências especiais."],["Nome del NUOVO preset (l'originale rimane invariato):","Name of NEW preset (original remains unchanged):","Nom du NOUVEAU préréglage (l’original reste inchangé) :","Nombre del NUEVO preajuste (original sin cambios):","Name der NEUEN Vorlage (Original bleibt unverändert):","Nome da NOVA predefinição (original inalterada):"],["Applicare {name} a {count} segmenti?","Apply {name} to {count} segments?","Appliquer {name} à {count} segments ?","¿Aplicar {name} a {count} segmentos?","{name} auf {count} Segmente anwenden?","Aplicar {name} a {count} segmentos?"],["Direzione origine: {direction}.","Source direction: {direction}.","Sens d’origine : {direction}.","Sentido de origen: {direction}.","Ausgangsrichtung: {direction}.","Sentido de origem: {direction}."],["Segmenti con inversione FWD/REV: {count}.","Segments with FWD/REV inversion: {count}.","Segments avec inversion FWD/REV : {count}.","Segmentos con inversión FWD/REV: {count}.","Segmente mit FWD/REV-Umkehrung: {count}.","Segmentos com inversão FWD/REV: {count}."],["Calendario collegato: {name}.","Linked calendar: {name}.","Calendrier associé : {name}.","Calendario vinculado: {name}.","Verknüpfter Kalender: {name}.","Calendário associado: {name}."],["Orari originali del preset.","Original preset hours.","Horaires d’origine du préréglage.","Horarios originales del preajuste.","Ursprüngliche Vorlagenzeiten.","Horários originais da predefinição."],["Le restrizioni delle altre direzioni saranno conservate.","Restrictions in other directions will be preserved.","Les restrictions des autres sens seront conservées.","Se conservarán las restricciones de otros sentidos.","Beschränkungen anderer Richtungen bleiben erhalten.","Restrições noutros sentidos serão mantidas."],["Verifica prima di salvare WME.","Check before saving WME.","Vérifiez avant d’enregistrer WME.","Comprueba antes de guardar WME.","Vor dem Speichern in WME prüfen.","Verifique antes de guardar no WME."],["Sovrascrivere il preset \"{name}\"?","Overwrite preset “{name}”?","Écraser le préréglage « {name} » ?","¿Sobrescribir preajuste «{name}»?","Vorlage „{name}“ überschreiben?","Substituir a predefinição «{name}»?"],["Eliminare il preset \"{name}\"?","Delete preset “{name}”?","Supprimer le préréglage « {name} » ?","¿Eliminar preajuste «{name}»?","Vorlage „{name}“ löschen?","Eliminar a predefinição «{name}»?"],["Importare {presets} preset e {calendars} calendari?","Import {presets} presets and {calendars} calendars?","Importer {presets} préréglages et {calendars} calendriers ?","¿Importar {presets} preajustes y {calendars} calendarios?","{presets} Vorlagen und {calendars} Kalender importieren?","Importar {presets} predefinições e {calendars} calendários?"],["Gli elementi con lo stesso nome o ID saranno sovrascritti. Si consiglia di esportare prima un backup.","Items with the same name or ID will be overwritten. Export a backup first.","Les éléments du même nom ou ID seront écrasés. Exportez une sauvegarde auparavant.","Se sobrescribirán elementos con el mismo nombre o ID. Exporta antes una copia.","Elemente mit gleichem Namen oder gleicher ID werden überschrieben. Zuerst Backup exportieren.","Elementos com o mesmo nome ou ID serão substituídos. Exporte primeiro uma cópia."],["Applicare SOLO gli orari del calendario «{name}» a {count} segmenti?","Apply ONLY calendar times “{name}” to {count} segments?","Appliquer UNIQUEMENT les horaires du calendrier « {name} » à {count} segments ?","¿Aplicar SOLO los horarios de «{name}» a {count} segmentos?","NUR Zeiten des Kalenders „{name}“ auf {count} Segmente anwenden?","Aplicar APENAS os horários de «{name}» a {count} segmentos?"],["Verranno aggiornate TUTTE le {count} restrizioni già presenti sui segmenti.","ALL {count} existing restrictions will be updated.","Toutes les {count} restrictions existantes seront mises à jour.","Se actualizarán TODAS las {count} restricciones existentes.","ALLE {count} bestehenden Beschränkungen werden aktualisiert.","Serão atualizadas TODAS as {count} restrições existentes."],["Tipi veicolo, motori e direzioni non saranno modificati.","Vehicle types, engines and directions will not be changed.","Types de véhicules, moteurs et sens resteront inchangés.","No se modificarán vehículos, motores ni sentidos.","Fahrzeugtypen, Motoren und Richtungen bleiben unverändert.","Tipos de veículos, motores e sentidos não serão alterados."],["Controlla le modifiche prima di salvare la mappa.","Check changes before saving the map.","Vérifiez les modifications avant d’enregistrer la carte.","Comprueba los cambios antes de guardar el mapa.","Änderungen vor dem Speichern der Karte prüfen.","Verifique as alterações antes de guardar o mapa."],["ATTENZIONE: presenti condizioni motore. Verrà usata la modalità sperimentale, segmento per segmento. In caso di errore, le operazioni precedenti potrebbero già essere applicate.","WARNING: engine rules are present. Experimental mode will process segments one by one. Earlier changes may already be applied if an error occurs.","ATTENTION : règles moteur présentes. Le mode expérimental traite les segments un par un. Certaines modifications peuvent subsister en cas d’erreur.","AVISO: hay reglas de motor. El modo experimental procesa los segmentos uno a uno. Algunos cambios pueden permanecer si hay un error.","WARNUNG: Motorregeln vorhanden. Experimenteller Modus verarbeitet Segmente einzeln. Bei Fehlern können frühere Änderungen bestehen bleiben.","ATENÇÃO: existem regras de motor. O modo experimental processa os segmentos um a um. Alterações anteriores podem subsistir em caso de erro."],["ATTENZIONE: applicazione sperimentale di {count} condizioni motore.","WARNING: experimental application of {count} engine conditions.","ATTENTION : application expérimentale de {count} conditions moteur.","AVISO: aplicación experimental de {count} condiciones de motor.","WARNUNG: Experimentelle Anwendung von {count} Motorbedingungen.","ATENÇÃO: aplicação experimental de {count} condições de motor."],["L'azione verrà verificata per ciascun segmento, ma non è supportata ufficialmente. Una parte degli aggiornamenti potrebbe già essere applicata se un segmento successivo fallisce. Verifica prima di salvare WME.","Each segment will be checked, but this is not officially supported. Earlier changes may remain if a later segment fails. Check before saving WME.","Chaque segment sera vérifié, mais cette fonction n’est pas officiellement prise en charge. Des modifications peuvent subsister. Vérifiez avant d’enregistrer WME.","Se verificará cada segmento, pero la función no está admitida oficialmente. Pueden quedar cambios si falla un segmento. Comprueba antes de guardar WME.","Jedes Segment wird geprüft, aber die Funktion ist nicht offiziell unterstützt. Bei späteren Fehlern können Änderungen bestehen bleiben. Vor dem Speichern prüfen.","Cada segmento será verificado, mas a função não tem suporte oficial. Algumas alterações podem subsistir se ocorrer um erro. Verifique antes de guardar."],["Eliminare il calendario «{name}»?","Delete calendar “{name}”?","Supprimer le calendrier « {name} » ?","¿Eliminar calendario «{name}»?","Kalender „{name}“ löschen?","Eliminar calendário «{name}»?"],["{count} preset collegati verranno scollegati. Le restrizioni in WME non saranno modificate.","{count} linked presets will be unlinked. WME restrictions will not be changed.","{count} préréglages associés seront dissociés. Aucune restriction WME ne sera modifiée.","Se desvincularán {count} preajustes. No cambiarán las restricciones de WME.","{count} Vorlagen werden getrennt. WME-Beschränkungen bleiben unverändert.","{count} predefinições serão desassociadas. As restrições WME não serão alteradas."],["Scollegare il calendario dal preset «{name}»? Il preset e gli orari originali saranno conservati.","Unlink calendar from preset “{name}”? The preset and its original hours will be kept.","Dissocier le calendrier du préréglage « {name} » ? Le préréglage et ses horaires d’origine seront conservés.","¿Desvincular calendario de «{name}»? Se conservarán el preajuste y los horarios originales.","Kalender von Vorlage „{name}“ trennen? Vorlage und ursprüngliche Zeiten bleiben erhalten.","Desassociar calendário de «{name}»? A predefinição e horários originais serão mantidos."],["Regole {type} non valide.","Invalid {type} rules.","Règles {type} invalides.","Reglas {type} no válidas.","Ungültige {type}-Regeln.","Regras {type} inválidas."],["Regola veicolo {type} non valida.","Invalid {type} vehicle rule.","Règle véhicule {type} invalide.","Regla vehículo {type} no válida.","Ungültige Fahrzeugregel {type}.","Regra de veículo {type} inválida."],["Il calendario {id} non ha un identificativo valido.","Calendar {id} has an invalid ID.","Le calendrier {id} a un identifiant invalide.","El calendario {id} tiene un ID no válido.","Kalender {id} hat ungültige ID.","O calendário {id} tem ID inválido."],["Identificativo calendario ripetuto: {id}","Duplicate calendar ID: {id}","Identifiant de calendrier dupliqué : {id}","ID de calendario duplicado: {id}","Doppelte Kalender-ID: {id}","ID de calendário duplicado: {id}"],["Nome preset non valido: {name}","Invalid preset name: {name}","Nom de préréglage invalide : {name}","Nombre de preajuste no válido: {name}","Ungültiger Vorlagenname: {name}","Nome de predefinição inválido: {name}"],["Numero restrizioni inatteso: {actual} anziché {expected}.","Unexpected restriction count: {actual} instead of {expected}.","Nombre de restrictions inattendu : {actual} au lieu de {expected}.","Cantidad inesperada: {actual} en lugar de {expected}.","Unerwartete Beschränkungsanzahl: {actual} statt {expected}.","Número inesperado de restrições: {actual} em vez de {expected}."],["Date/orari non corrispondenti nella restrizione {index}.","Dates/times do not match in restriction {index}.","Dates/heures différentes dans la restriction {index}.","Fechas/horarios no coinciden en restricción {index}.","Datum/Uhrzeit in Beschränkung {index} stimmt nicht überein.","Datas/horários não correspondem na restrição {index}."],["Nella fascia {index} seleziona almeno un giorno.","Select at least one day in slot {index}.","Sélectionnez au moins un jour dans la plage {index}.","Selecciona al menos un día en franja {index}.","Mindestens einen Tag im Zeitfenster {index} wählen.","Selecione pelo menos um dia no horário {index}."],["Fascia {index}: inizio e fine non possono coincidere. Usa «Tutto il giorno».","Slot {index}: start and end cannot match. Use “All day”.","Plage {index} : début et fin ne peuvent pas être identiques. Utilisez « Toute la journée ».","Franja {index}: inicio y fin no pueden coincidir. Usa « Todo el día ».","Zeitfenster {index}: Beginn und Ende dürfen nicht gleich sein. „Ganztägig“ nutzen.","Horário {index}: início e fim não podem coincidir. Use « Todo o dia »."],["Fascia {index}: con giorni esclusi non usare fasce che attraversano la mezzanotte. Dividile prima di applicare il calendario.","Slot {index}: with excluded days, split overnight slots before applying the calendar.","Plage {index} : avec exclusions, divisez les plages de nuit avant application.","Franja {index}: con exclusiones, divide franjas nocturnas antes de aplicar.","Zeitfenster {index}: bei Ausschlüssen Nachtfenster vor Anwendung teilen.","Horário {index}: com exclusões, divida horários noturnos antes de aplicar."],["Ricorrenza {index}: tipo non valido.","Recurrence {index}: invalid type.","Récurrence {index} : type invalide.","Recurrencia {index}: tipo no válido.","Wiederholung {index}: ungültiger Typ.","Recorrência {index}: tipo inválido."],["Ricorrenza {index}: usa orari crescenti nello stesso giorno (notturni non supportati).","Recurrence {index}: use increasing times within the same day (overnight not supported).","Récurrence {index} : heures croissantes le même jour (nuit non prise en charge).","Recurrencia {index}: usa horas crecientes en el mismo día (no nocturnas).","Wiederholung {index}: aufsteigende Zeiten am selben Tag (keine Nachtzeiten).","Recorrência {index}: horas crescentes no mesmo dia (noturno não suportado)."],["Ricorrenza {index}: mese, settimana o giorno non validi.","Recurrence {index}: invalid month, ordinal or weekday.","Récurrence {index} : mois, rang ou jour invalide.","Recurrencia {index}: mes, semana o día no válido.","Wiederholung {index}: ungültiger Monat, Rang oder Wochentag.","Recorrência {index}: mês, semana ou dia inválido."],["Ricorrenza {index}: scostamento dalla Pasqua non valido (-60 a +60 giorni).","Recurrence {index}: invalid Easter offset (-60 to +60 days).","Récurrence {index} : décalage de Pâques invalide (-60 à +60 jours).","Recurrencia {index}: desplazamiento de Pascua no válido (-60 a +60).","Wiederholung {index}: ungültiger Osterversatz (-60 bis +60 Tage).","Recorrência {index}: deslocamento da Páscoa inválido (-60 a +60 dias)."],["Puoi inserire al massimo {count} date o intervalli esclusi.","Maximum {count} excluded dates or ranges.","{count} exclusions ou périodes maximum.","Máximo {count} fechas o periodos excluidos.","Höchstens {count} ausgeschlossene Tage/Zeiträume.","Máximo de {count} datas ou períodos excluídos."],["Esclusione {index}: inserisci date valide in ordine crescente.","Exclusion {index}: enter valid dates in order.","Exclusion {index} : saisissez des dates valides dans l’ordre.","Exclusión {index}: introduce fechas válidas y ordenadas.","Ausschluss {index}: gültige Daten in Reihenfolge eingeben.","Exclusão {index}: introduza datas válidas em ordem."],["Anni delle ricorrenze non validi (massimo {count} annualità, dal 2000 al 2099).","Invalid recurrence years (max {count} years, 2000–2099).","Années invalides (max {count} années, 2000–2099).","Años no válidos (máx. {count}, 2000–2099).","Ungültige Wiederholungsjahre (max. {count}, 2000–2099).","Anos de recorrência inválidos (máx. {count}, 2000–2099)."],["Il segmento {id} non ha restrizioni: prima creane una in WME.","Segment {id} has no restrictions: create one in WME first.","Le segment {id} ne possède aucune restriction : créez-en une dans WME.","El segmento {id} no tiene restricciones: crea una en WME.","Segment {id} hat keine Beschränkungen: zuerst in WME erstellen.","O segmento {id} não tem restrições: crie uma no WME."],["Restrizioni SDK/modello interno non allineate sul segmento {id}.","SDK/internal model restrictions do not match on segment {id}.","Restrictions SDK/modèle interne incohérentes sur le segment {id}.","Restricciones SDK/modelo interno no coinciden en segmento {id}.","SDK/interne Beschränkungen in Segment {id} stimmen nicht überein.","Restrições SDK/modelo interno não coincidem no segmento {id}."],["Calendario troppo grande: {count} restrizioni per modello (limite {limit}). Riduci periodo o fasce.","Calendar too large: {count} restrictions per template (limit {limit}). Shorten the period or slots.","Calendrier trop grand : {count} restrictions par modèle (limite {limit}). Réduisez période ou plages.","Calendario demasiado grande: {count} restricciones por plantilla (límite {limit}). Reduce periodo o franjas.","Kalender zu groß: {count} Beschränkungen je Vorlage (Grenze {limit}). Zeitraum oder Fenster reduzieren.","Calendário demasiado grande: {count} restrições por modelo (limite {limit}). Reduza período ou horários."],["Troppe restrizioni generate ({templates} × {frames}). Riduci annualità o fasce.","Too many restrictions generated ({templates} × {frames}). Reduce years or time slots.","Trop de restrictions générées ({templates} × {frames}). Réduisez les années ou plages.","Demasiadas restricciones ({templates} × {frames}). Reduce años o franjas.","Zu viele Beschränkungen ({templates} × {frames}). Jahre oder Zeitfenster reduzieren.","Demasiadas restrições ({templates} × {frames}). Reduza anos ou horários."],["Il calendario {name} non ha un identificativo valido.","Calendar {name} has an invalid identifier.","Calendrier {name} : identifiant invalide.","El calendario {name} tiene un identificador no válido.","Kalender {name}: ungültige Kennung.","O calendário {name} tem identificador inválido."],["Calendario {id} non trovato.","Calendar {id} not found.","Calendrier {id} introuvable.","Calendario {id} no encontrado.","Kalender {id} nicht gefunden.","Calendário {id} não encontrado."],["Identificativo calendario incoerente: {id}","Inconsistent calendar ID: {id}","Identifiant de calendrier incohérent : {id}","ID de calendario incoherente: {id}","Inkonsistente Kalender-ID: {id}","ID de calendário incoerente: {id}"],["Formato preset non riconosciuto.","Unknown preset format.","Format de préréglage inconnu.","Formato de preajuste desconocido.","Unbekanntes Vorlagenformat.","Formato de predefinição desconhecido."],["Il JSON originale non conserva integralmente le condizioni motore. Risalva il preset dalla restrizione originale.","The original JSON does not preserve all engine conditions. Re-save the preset from its source restriction.","Le JSON original ne conserve pas toutes les conditions moteur. Réenregistrez depuis la restriction d’origine.","El JSON original no conserva todas las condiciones de motor. Vuelve a guardar desde la restricción original.","Original-JSON enthält nicht alle Motorbedingungen. Vorlage aus der ursprünglichen Beschränkung neu speichern.","O JSON original não preserva todas as condições de motor. Guarde a predefinição a partir da restrição original."],["Preset vuoto.","Empty preset.","Préréglage vide.","Preajuste vacío.","Leere Vorlage.","Predefinição vazia."],["Modello interno WME indisponibile per il segmento {id}.","Internal WME model unavailable for segment {id}.","Modèle interne WME indisponible pour le segment {id}.","Modelo interno WME no disponible para segmento {id}.","Internes WME-Modell für Segment {id} nicht verfügbar.","Modelo interno WME indisponível para o segmento {id}."],["Verifica delle condizioni motociclistiche non riuscita.","Motorcycle engine rule verification failed.","Échec de la vérification des règles moteur.","Error al verificar las reglas de motor.","Prüfung der Motorrad-Motorregeln fehlgeschlagen.","Falha na verificação das regras de motor."],["Calendario non verificato: {detail}","Calendar verification failed: {detail}","Échec de vérification du calendrier : {detail}","Error al verificar el calendario: {detail}","Kalenderprüfung fehlgeschlagen: {detail}","Falha na verificação do calendário: {detail}"]];
    const TRANSLATIONS = Object.fromEntries(
        ["it", "en", "fr", "es", "de", "pt"].map((lang, index) =>
            [lang, Object.fromEntries(TRANSLATION_ROWS.map(row => [row[0], row[index]]))])
    );
    // UI preview translations, embedded in the same userscript.
    const PREVIEW_TRANSLATION_ROWS = [["Anteprima modifiche","Change preview","Aperçu des modifications","Vista previa de cambios","Änderungsvorschau","Pré-visualização das alterações"],["L’anteprima non modifica la mappa. Esamina i segmenti prima di confermare.","The preview does not edit the map. Review the segments before confirming.","L’aperçu ne modifie pas la carte. Vérifiez les segments avant de confirmer.","La vista previa no modifica el mapa. Revisa los segmentos antes de confirmar.","Die Vorschau ändert die Karte nicht. Segmente vor dem Bestätigen prüfen.","A pré-visualização não altera o mapa. Verifique os segmentos antes de confirmar."],["Segmenti selezionati","Selected segments","Segments sélectionnés","Segmentos seleccionados","Ausgewählte Segmente","Segmentos selecionados"],["Da modificare","To update","À modifier","Por modificar","Zu ändern","A modificar"],["Invariati","Unchanged","Inchangés","Sin cambios","Unverändert","Sem alterações"],["Con possibili conflitti","Potential conflicts","Conflits possibles","Posibles conflictos","Mögliche Konflikte","Possíveis conflitos"],["Saltati per conflitto","Skipped due to conflict","Ignorés (conflit)","Omitidos por conflicto","Wegen Konflikten übersprungen","Ignorados por conflito"],["Segmento {id}","Segment {id}","Segment {id}","Segmento {id}","Segment {id}","Segmento {id}"],["Aggiunte: {count}","Added: {count}","Ajoutées : {count}","Añadidas: {count}","Hinzugefügt: {count}","Adicionadas: {count}"],["Rimosse/sostituite: {count}","Removed/replaced: {count}","Supprimées/remplacées : {count}","Eliminadas/sustituidas: {count}","Entfernt/ersetzt: {count}","Removidas/substituídas: {count}"],["Conservate: {count}","Preserved: {count}","Conservées : {count}","Conservadas: {count}","Beibehalten: {count}","Mantidas: {count}"],["Inversione FWD/REV","FWD/REV inversion","Inversion FWD/REV","Inversión FWD/REV","FWD/REV umgekehrt","Inversão FWD/REV"],["Nessuna modifica","No change","Aucun changement","Sin cambios","Keine Änderung","Sem alterações"],["Possibile conflitto","Potential conflict","Conflit possible","Posible conflicto","Möglicher Konflikt","Possível conflito"],["Sostituzioni da verificare","Replacements to review","Remplacements à vérifier","Sustituciones por revisar","Ersetzungen prüfen","Substituições a verificar"],["Possibile sovrapposizione tra restrizioni {first} e {second}.","Possible overlap between restrictions {first} and {second}.","Chevauchement possible entre les restrictions {first} et {second}.","Posible solapamiento entre restricciones {first} y {second}.","Mögliche Überlappung der Beschränkungen {first} und {second}.","Possível sobreposição entre as restrições {first} e {second}."],["Il preset sostituirà {count} restrizioni esistenti su questo segmento.","The preset will replace {count} existing restrictions on this segment.","Le préréglage remplacera {count} restrictions existantes sur ce segment.","El preajuste sustituirá {count} restricciones existentes en este segmento.","Die Vorlage ersetzt {count} vorhandene Beschränkungen auf diesem Segment.","A predefinição substituirá {count} restrições existentes neste segmento."],["Escludi i segmenti con possibili conflitti (consigliato)","Skip segments with potential conflicts (recommended)","Ignorer les segments avec des conflits possibles (recommandé)","Omitir segmentos con posibles conflictos (recomendado)","Segmente mit möglichen Konflikten überspringen (empfohlen)","Ignorar segmentos com possíveis conflitos (recomendado)"],["Ho controllato l’anteprima e accetto le sostituzioni o sovrapposizioni segnalate.","I reviewed the preview and accept the indicated replacements or overlaps.","J’ai vérifié l’aperçu et j’accepte les remplacements ou chevauchements signalés.","He revisado la vista previa y acepto las sustituciones o solapamientos indicados.","Ich habe die Vorschau geprüft und akzeptiere die angezeigten Ersetzungen oder Überlappungen.","Revisei a pré-visualização e aceito as substituições ou sobreposições indicadas."],["Conferma applicazione","Confirm application","Confirmer l’application","Confirmar aplicación","Anwendung bestätigen","Confirmar aplicação"],["Annulla anteprima","Cancel preview","Annuler l’aperçu","Cancelar vista previa","Vorschau abbrechen","Cancelar pré-visualização"],["Nessun cambiamento da applicare.","There are no changes to apply.","Aucune modification à appliquer.","No hay cambios que aplicar.","Keine Änderungen anzuwenden.","Não há alterações a aplicar."],["Seleziona la conferma dopo aver esaminato l’anteprima.","Confirm after reviewing the preview.","Confirmez après avoir vérifié l’aperçu.","Confirma después de revisar la vista previa.","Bestätigen Sie nach Prüfung der Vorschau.","Confirme depois de verificar a pré-visualização."],["Anteprima scaduta: la selezione, il preset, il calendario o le restrizioni in WME sono cambiati. Genera una nuova anteprima.","Preview expired: selection, preset, calendar, or WME restrictions changed. Generate a new preview.","Aperçu expiré : sélection, préréglage, calendrier ou restrictions WME modifiés. Recréez l’aperçu.","Vista previa caducada: cambió la selección, el preajuste, el calendario o las restricciones WME. Genera otra vista previa.","Vorschau veraltet: Auswahl, Vorlage, Kalender oder WME-Beschränkungen wurden geändert. Neue Vorschau erstellen.","Pré-visualização expirada: seleção, predefinição, calendário ou restrições WME alterados. Gere outra."],["Applicati: {done}; ignorati per conflitti: {skipped}; invariati: {unchanged}.","Applied: {done}; skipped due to conflicts: {skipped}; unchanged: {unchanged}.","Appliqués : {done} ; ignorés (conflits) : {skipped} ; inchangés : {unchanged}.","Aplicados: {done}; omitidos por conflictos: {skipped}; sin cambios: {unchanged}.","Angewendet: {done}; Konflikte übersprungen: {skipped}; unverändert: {unchanged}.","Aplicados: {done}; ignorados por conflitos: {skipped}; sem alterações: {unchanged}."],["Applicazione interrotta dopo {done} segmenti. {detail}","Application stopped after {done} segments. {detail}","Application interrompue après {done} segments. {detail}","Aplicación interrumpida tras {done} segmentos. {detail}","Anwendung nach {done} Segmenten abgebrochen. {detail}","Aplicação interrompida após {done} segmentos. {detail}"],["Anteprima del preset «{name}»","Preview of preset “{name}”","Aperçu du préréglage « {name} »","Vista previa del preajuste «{name}»","Vorschau der Vorlage „{name}“","Pré-visualização da predefinição «{name}»"],["Anteprima del calendario «{name}»","Preview of calendar “{name}”","Aperçu du calendrier « {name} »","Vista previa del calendario «{name}»","Vorschau des Kalenders „{name}“","Pré-visualização do calendário «{name}»"],["Nessun segmento applicabile con l’impostazione attuale.","No segments can be updated with the current setting.","Aucun segment ne peut être modifié avec ce réglage.","No se puede actualizar ningún segmento con esta configuración.","Mit dieser Einstellung können keine Segmente geändert werden.","Nenhum segmento pode ser atualizado com esta definição."],["Prima conferma l’anteprima per applicare le modifiche.","Confirm the preview before applying changes.","Confirmez l’aperçu avant d’appliquer les modifications.","Confirma la vista previa antes de aplicar los cambios.","Vorschau bestätigen, bevor Änderungen angewendet werden.","Confirme a pré-visualização antes de aplicar alterações."],["Controlli di conflitto indicativi: verificare sempre date, fasce, veicoli e direzioni in WME.","Conflict checks are indicative: always verify dates, times, vehicles, and directions in WME.","Détection indicative : vérifiez toujours dates, plages, véhicules et sens dans WME.","Detección orientativa: comprueba siempre fechas, horarios, vehículos y sentidos en WME.","Konfliktprüfung ist nur indikativ: Daten, Zeiten, Fahrzeuge und Richtungen stets in WME prüfen.","Verificações indicativas: confirme sempre datas, horários, veículos e sentidos no WME."],["Restrizione {index}: {direction}, {vehicles}, {frames} fasce.","Restriction {index}: {direction}, {vehicles}, {frames} time frames.","Restriction {index} : {direction}, {vehicles}, {frames} plages.","Restricción {index}: {direction}, {vehicles}, {frames} franjas.","Beschränkung {index}: {direction}, {vehicles}, {frames} Zeitfenster.","Restrição {index}: {direction}, {vehicles}, {frames} horários."],["Tutti i veicoli","All vehicles","Tous les véhicules","Todos los vehículos","Alle Fahrzeuge","Todos os veículos"],["Motori: {count}","Engine rules: {count}","Règles moteur : {count}","Reglas de motor: {count}","Motorregeln: {count}","Regras de motor: {count}"],["Dettagli restrizioni","Restriction details","Détails des restrictions","Detalles de restricciones","Beschränkungsdetails","Detalhes das restrições"],["Prima","Before","Avant","Antes","Vorher","Antes"],["Dopo","After","Après","Después","Nachher","Depois"],["Nessuna restrizione","No restrictions","Aucune restriction","Sin restricciones","Keine Beschränkungen","Sem restrições"],["🔎 Anteprima e applica ai segmenti selezionati","🔎 Preview and apply to selected segments","🔎 Aperçu et application aux segments sélectionnés","🔎 Vista previa y aplicación a los segmentos","🔎 Vorschau und Anwendung auf ausgewählte Segmente","🔎 Pré-visualizar e aplicar aos segmentos"],["📅 Anteprima e applica SOLO il calendario","📅 Preview and apply calendar ONLY","📅 Aperçu et application du calendrier UNIQUEMENT","📅 Vista previa y aplicación SOLO del calendario","📅 Vorschau und NUR Kalender anwenden","📅 Pré-visualizar e aplicar APENAS o calendário"],["Nessun conflitto rilevato automaticamente.","No conflicts detected automatically.","Aucun conflit détecté automatiquement.","No se detectaron conflictos automáticamente.","Keine Konflikte automatisch erkannt.","Nenhum conflito detetado automaticamente."]];
    for (const row of PREVIEW_TRANSLATION_ROWS) {
        ["it", "en", "fr", "es", "de", "pt"].forEach((code, index) => {
            TRANSLATIONS[code][row[0]] = row[index];
        });
    }
    const CALENDAR_TRANSLATION_ROWS = [["Scadenze calendari","Calendar expiration alerts","Alertes d'expiration","Avisos de vencimiento","Kalender-Ablaufwarnungen","Avisos de expiração"],["Scaduto: {name} ({date})","Expired: {name} ({date})","Expiré : {name} ({date})","Caducado: {name} ({date})","Abgelaufen: {name} ({date})","Expirado: {name} ({date})"],["In scadenza: {name} — {days} giorni ({date})","Expiring: {name} — {days} days ({date})","Expire bientôt : {name} — {days} jours ({date})","Próximo a vencer: {name} — {days} días ({date})","Läuft bald ab: {name} — {days} Tage ({date})","A expirar: {name} — {days} dias ({date})"],["Apri calendari","Open calendars","Ouvrir les calendriers","Abrir calendarios","Kalender öffnen","Abrir calendários"],["Paese delle festività (ISO)","Holiday country (ISO)","Pays des jours fériés (ISO)","País de los festivos (ISO)","Land der Feiertage (ISO)","País dos feriados (ISO)"],["Regione / suddivisione (ISO 3166-2, facoltativa)","Region / subdivision (ISO 3166-2, optional)","Région / subdivision (ISO 3166-2, facultatif)","Región / subdivisión (ISO 3166-2, opcional)","Region / Unterteilung (ISO 3166-2, optional)","Região / subdivisão (ISO 3166-2, opcional)"],["Località (nome, facoltativo)","Locality (name, optional)","Localité (nom, facultatif)","Localidad (nombre, opcional)","Ort (Name, optional)","Localidade (nome, opcional)"],["Carica le festività del Paese e della Regione","Load country and regional holidays","Charger les jours fériés du pays et de la région","Cargar festivos nacionales y regionales","Landes- und Regionalfeiertage laden","Carregar feriados nacionais e regionais"],["Le festività scaricate vengono memorizzate nel calendario e nei backup. Non vengono aggiornate automaticamente.","Downloaded holidays are saved in the calendar and backups. They are not automatically refreshed.","Les jours fériés téléchargés sont enregistrés avec le calendrier et les sauvegardes. Pas de mise à jour automatique.","Los festivos descargados se guardan en el calendario y en las copias. No se actualizan automáticamente.","Geladene Feiertage werden im Kalender und Backup gespeichert, nicht automatisch aktualisiert.","Os feriados descarregados são guardados no calendário e nas cópias. Não são atualizados automaticamente."],["Festività locali annuali","Annual local holidays","Jours fériés locaux annuels","Festivos locales anuales","Jährliche lokale Feiertage","Feriados locais anuais"],["+ Aggiungi festività locale","+ Add local holiday","+ Ajouter un jour férié local","+ Añadir festivo local","+ Lokalen Feiertag hinzufügen","+ Adicionar feriado local"],["Nome festività","Holiday name","Nom du jour férié","Nombre del festivo","Feiertagsname","Nome do feriado"],["Mese","Month","Mois","Mes","Monat","Mês"],["Giorno","Day","Jour","Día","Tag","Dia"],["I santi patroni e i giorni di chiusura comunali non vengono recuperati automaticamente: inseriscili qui o nei periodi esclusi.","Patron-saint days and municipal closures are not fetched automatically: add them here or as excluded periods.","Les fêtes patronales et fermetures municipales ne sont pas récupérées automatiquement : ajoutez-les ici ou parmi les périodes exclues.","Las fiestas patronales y cierres municipales no se descargan automáticamente: añádelos aquí o como periodos excluidos.","Patronatsfeste und örtliche Schließtage werden nicht automatisch geladen: hier oder als Ausschluss eintragen.","Os feriados dos padroeiros e encerramentos municipais não são obtidos automaticamente: adicione-os aqui ou nos períodos excluídos."],["Festività incluse nell'archivio: {count}","Holidays in loaded data: {count}","Jours fériés dans les données : {count}","Festivos en los datos: {count}","Feiertage in den Daten: {count}","Feriados nos dados: {count}"],["Archivio festività non caricato o non aggiornato per Paese, Regione e anni scelti. Premi «Carica le festività» prima di salvare o applicare.","Holiday data is missing or outdated for the selected country, region, and years. Load holidays before saving or applying.","Les données sont absentes ou obsolètes pour le pays, la région et les années choisis. Chargez les jours fériés avant d'enregistrer ou appliquer.","Los datos están ausentes u obsoletos para el país, la región y los años elegidos. Carga los festivos antes de guardar o aplicar.","Feiertagsdaten für Land, Region und Jahre fehlen oder sind veraltet. Vor Speichern/Anwenden laden.","Os dados de feriados estão ausentes ou desatualizados para o país, região e anos escolhidos. Carregue antes de guardar ou aplicar."],["Festività caricate: {count} giorni ({start}–{end}). Verifica l'eventuale assenza di feste regionali o locali.","Loaded holidays: {count} days ({start}–{end}). Check for missing regional or local holidays.","Jours fériés chargés : {count} jours ({start}–{end}). Vérifiez les jours fériés régionaux et locaux manquants.","Festivos cargados: {count} días ({start}–{end}). Comprueba posibles festivos regionales o locales ausentes.","Feiertage geladen: {count} Tage ({start}–{end}). Fehlende regionale oder örtliche Feiertage prüfen.","Feriados carregados: {count} dias ({start}–{end}). Verifique feriados regionais ou locais em falta."],["Impossibile scaricare le festività: {detail}","Cannot load holidays: {detail}","Impossible de charger les jours fériés : {detail}","No se pueden cargar los festivos: {detail}","Feiertage konnten nicht geladen werden: {detail}","Não foi possível carregar os feriados: {detail}"],["Seleziona un Paese con codice ISO a due lettere (es. IT, DE, FR).","Enter a two-letter ISO country code (e.g. IT, DE, FR).","Indiquez un code pays ISO à deux lettres (IT, DE, FR).","Introduce un código de país ISO de dos letras (IT, DE, FR).","Geben Sie einen ISO-Ländercode mit zwei Buchstaben ein (IT, DE, FR).","Introduza um código de país ISO de duas letras (IT, DE, FR)."],["Il codice Regione deve appartenere al Paese scelto (es. IT-25).","The region code must match the country (e.g. IT-25).","Le code région doit correspondre au pays (ex. IT-25).","El código regional debe corresponder al país (p. ej. IT-25).","Der Regionscode muss zum Land passen (z. B. IT-25).","O código regional deve corresponder ao país (ex.: IT-25)."],["La festività locale {index} ha mese/giorno non validi.","Local holiday {index} has an invalid month/day.","Le jour férié local {index} a un mois/jour invalide.","El festivo local {index} tiene mes/día no válidos.","Lokaler Feiertag {index} hat ungültigen Monat/Tag.","O feriado local {index} tem mês/dia inválidos."],["Per una festa locale è necessario indicare un nome.","A local holiday needs a name.","Un jour férié local nécessite un nom.","El festivo local necesita un nombre.","Ein lokaler Feiertag braucht einen Namen.","O feriado local precisa de nome."],["Seleziona un periodo preciso per caricare le festività.","Set an exact date range before loading holidays.","Définissez une période précise avant de charger les jours fériés.","Define un periodo exacto antes de cargar festivos.","Vor dem Laden einen genauen Zeitraum festlegen.","Defina um intervalo de datas exato antes de carregar feriados."],["Archivio festività: {country} {region} · {count} date","Holiday data: {country} {region} · {count} dates","Données des jours fériés : {country} {region} · {count} dates","Datos de festivos: {country} {region} · {count} fechas","Feiertagsdaten: {country} {region} · {count} Daten","Dados de feriados: {country} {region} · {count} datas"],["Festività nazionali e regionali: escluse","National and regional holidays: excluded","Jours fériés nationaux et régionaux : exclus","Festivos nacionales y regionales: excluidos","Nationale und regionale Feiertage: ausgeschlossen","Feriados nacionais e regionais: excluídos"],["Festività locali annuali: {count}","Annual local holidays: {count}","Jours fériés locaux annuels : {count}","Festivos locales anuales: {count}","Jährliche lokale Feiertage: {count}","Feriados locais anuais: {count}"],["I dati festivi sono informativi: verifica gli ordinamenti locali e il calendario scolastico ufficiale. Le chiusure scolastiche vanno inserite a parte.","Holiday data is informational: verify local regulations and the official school calendar. School breaks must be added separately.","Les données sont indicatives : vérifiez la réglementation locale et le calendrier scolaire officiel. Ajoutez les vacances scolaires séparément.","Los datos son orientativos: verifica la normativa local y el calendario escolar oficial. Las vacaciones escolares se añaden por separado.","Die Feiertagsdaten sind informativ: örtliche Vorschriften und offiziellen Schulkalender prüfen. Schulferien separat eintragen.","Os dados são indicativos: verifique a legislação local e o calendário escolar oficial. Adicione as férias escolares separadamente."],["Le scadenze riguardano i calendari salvati, non le restrizioni già pubblicate: non vengono modificate automaticamente.","Expiration alerts concern saved calendars, not already published restrictions; no automatic map changes.","Les alertes concernent les calendriers enregistrés, pas les restrictions publiées ; aucune modification automatique de la carte.","Las alertas afectan a los calendarios guardados, no a las restricciones publicadas; no se modifica el mapa automáticamente.","Warnungen betreffen gespeicherte Kalender, nicht veröffentlichte Beschränkungen; keine automatischen Kartenänderungen.","Os avisos referem-se aos calendários guardados, não às restrições publicadas; sem alterações automáticas no mapa."],["Seleziona l'area delle festività per il calendario, non il luogo in cui stai modificando la mappa.","Select the holiday area for this calendar, not necessarily your editing location.","Choisissez la zone des jours fériés du calendrier, pas nécessairement votre lieu d'édition.","Selecciona el área festiva del calendario, no necesariamente donde editas el mapa.","Feiertagsgebiet für diesen Kalender wählen, nicht unbedingt den Ort der Kartenbearbeitung.","Selecione a área dos feriados do calendário, não necessariamente o local onde edita o mapa."]];
    for (const row of CALENDAR_TRANSLATION_ROWS) {
        ["it", "en", "fr", "es", "de", "pt"].forEach((code, i) => { TRANSLATIONS[code][row[0]] = row[i]; });
    }
    const HOLIDAY_NETWORK_TRANSLATIONS = [["Impossibile contattare il servizio delle festività. Controlla la connessione e l'autorizzazione Tampermonkey per nagerholidays.com.","Cannot reach the holiday service. Check your connection and Tampermonkey permission for nagerholidays.com.","Service de jours fériés inaccessible. Vérifiez la connexion et l'autorisation Tampermonkey pour nagerholidays.com.","No se puede conectar al servicio de festivos. Comprueba la conexión y el permiso de Tampermonkey para nagerholidays.com.","Feiertagsdienst nicht erreichbar. Verbindung und Tampermonkey-Freigabe für nagerholidays.com prüfen.","Não foi possível contactar o serviço de feriados. Verifique a ligação e a permissão do Tampermonkey para nagerholidays.com."],["Richiesta festività scaduta (timeout). Riprova.","Holiday request timed out. Please retry.","Délai dépassé pour les jours fériés. Réessayez.","Se agotó el tiempo de espera del servicio de festivos. Inténtalo de nuevo.","Zeitüberschreitung beim Abruf der Feiertage. Bitte erneut versuchen.","Tempo de espera excedido ao obter os feriados. Tente novamente."],["Richiesta festività annullata. Riprova.","Holiday request cancelled. Please retry.","Demande de jours fériés annulée. Réessayez.","Solicitud de festivos cancelada. Inténtalo de nuevo.","Feiertagsanfrage abgebrochen. Bitte erneut versuchen.","Pedido de feriados cancelado. Tente novamente."],["Tampermonkey non ha concesso l'accesso alla rete. Reinstalla/aggiorna lo script e autorizza nagerholidays.com.","Tampermonkey network access unavailable. Update/reinstall the script and allow nagerholidays.com.","Accès réseau Tampermonkey indisponible. Réinstallez/mettez à jour le script et autorisez nagerholidays.com.","Sin acceso de red de Tampermonkey. Actualiza/reinstala el script y autoriza nagerholidays.com.","Tampermonkey-Netzwerkzugriff nicht verfügbar. Skript aktualisieren/neu installieren und nagerholidays.com erlauben.","Sem acesso à rede do Tampermonkey. Atualize/reinstale o script e autorize nagerholidays.com."],["Risposta non valida del servizio festività.","Invalid holiday service response.","Réponse invalide du service de jours fériés.","Respuesta no válida del servicio de festivos.","Ungültige Antwort des Feiertagsdienstes.","Resposta inválida do serviço de feriados."]];
    for (const row of HOLIDAY_NETWORK_TRANSLATIONS) {
        ["it", "en", "fr", "es", "de", "pt"].forEach((code, i) => { TRANSLATIONS[code][row[0]] = row[i]; });
    }
    const AUTO_HOLIDAY_TRANSLATIONS = [["Seleziona prima il Paese delle festività.","Select a holiday country first.","Sélectionnez d'abord un pays.","Selecciona primero un país.","Wähle zuerst ein Land.","Selecione primeiro um país."],["Regioni disponibili: {count}. Se manca una suddivisione, inserisci il codice ISO 3166-2 manualmente.","Available subdivisions: {count}. Enter an ISO 3166-2 code manually if missing.","Subdivisions disponibles : {count}. Si une subdivision manque, saisissez son code ISO 3166-2.","Regiones disponibles: {count}. Si falta alguna, introduce manualmente su código ISO 3166-2.","Verfügbare Regionen: {count}. Fehlende ISO-3166-2-Codes manuell eingeben.","Regiões disponíveis: {count}. Se alguma faltar, introduza o código ISO 3166-2 manualmente."],["Seleziona le date iniziale e finale per caricare automaticamente le festività.","Set start and end dates to load holidays automatically.","Définissez les dates de début et de fin pour charger les jours fériés automatiquement.","Indica las fechas de inicio y fin para cargar automáticamente los festivos.","Start- und Enddatum angeben, um Feiertage automatisch zu laden.","Defina as datas de início e fim para carregar feriados automaticamente."],["Caricamento festività per {country} {region}…","Loading holidays for {country} {region}…","Chargement des jours fériés pour {country} {region}…","Cargando festivos de {country} {region}…","Feiertage für {country} {region} werden geladen…","A carregar feriados de {country} {region}…"],["Nessuna festività pubblica disponibile per il Paese e il periodo selezionati.","No public holidays are available for this country and date range.","Aucun jour férié disponible pour ce pays et cette période.","No hay festivos disponibles para ese país y periodo.","Keine Feiertage für das gewählte Land und den Zeitraum verfügbar.","Não há feriados disponíveis para esse país e período."],["🌐 Aggiorna festività del Paese e della Regione","🌐 Refresh country and regional holidays","🌐 Actualiser les jours fériés du pays et de la région","🌐 Actualizar festivos del país y la región","🌐 Landes- und Regionalfeiertage aktualisieren","🌐 Atualizar feriados nacionais e regionais"],["Scegli il Paese e un intervallo di date per caricare automaticamente le festività. Lascia il Paese vuoto se non vuoi escluderle.","Choose a country and date range to load holidays automatically. Leave the country blank to avoid holiday exclusions.","Choisissez un pays et une période pour charger automatiquement les jours fériés. Laissez le pays vide pour ne pas les exclure.","Elige un país y un periodo para cargar los festivos automáticamente. Deja el país vacío si no quieres excluirlos.","Land und Zeitraum wählen, um Feiertage automatisch zu laden. Land leer lassen, um Feiertage nicht auszuschließen.","Escolha um país e um período para carregar os feriados automaticamente. Deixe o país vazio para não os excluir."],["Scegli un periodo preciso: le festività saranno caricate automaticamente. Se il caricamento fallisce, usa Aggiorna festività.","Choose an exact date range: holidays will load automatically. If loading fails, select Refresh holidays.","Choisissez une période précise : les jours fériés seront chargés automatiquement. En cas d'échec, utilisez Actualiser.","Elige un periodo exacto: los festivos se cargarán automáticamente. Si falla, usa Actualizar.","Genauen Zeitraum wählen: Feiertage werden automatisch geladen. Bei Fehlern Aktualisieren wählen.","Escolha um período exato: os feriados serão carregados automaticamente. Se falhar, use Atualizar."],["Scegli Paese, eventuale Regione e un periodo preciso: le festività vengono caricate automaticamente. Se non vuoi escluderle, lascia il Paese vuoto.","Choose a country, optional region and exact date range: holidays load automatically. Leave country blank to keep holidays active.","Choisissez un pays, éventuellement une région et une période précise : les jours fériés se chargent automatiquement. Laissez le pays vide pour ne pas les exclure.","Elige un país, una región opcional y un periodo exacto: los festivos se cargan automáticamente. Deja el país vacío para no excluirlos.","Land, gegebenenfalls Region und genauen Zeitraum wählen: Feiertage werden automatisch geladen. Ohne Ausschluss das Land leer lassen.","Escolha um país, região opcional e período exato: os feriados são carregados automaticamente. Deixe o país vazio para não os excluir."]];
    for (const row of AUTO_HOLIDAY_TRANSLATIONS) {
        ["it", "en", "fr", "es", "de", "pt"].forEach((code, i) => { TRANSLATIONS[code][row[0]] = row[i]; });
    }

    // Maintenance strings in six locales. Stable translation keys remain Italian.
    const MAINTENANCE_TRANSLATIONS = [
        ["Controllo compatibilità SDK", "SDK compatibility check", "Vérification de compatibilité SDK", "Comprobación de compatibilidad SDK", "SDK-Kompatibilitätsprüfung", "Verificação de compatibilidade do SDK"],
        ["Verifica versioni e funzioni necessarie, senza modificare la mappa.", "Checks versions and required functions without changing the map.", "Vérifie les versions et les fonctions requises sans modifier la carte.", "Comprueba versiones y funciones necesarias sin modificar el mapa.", "Prüft Versionen und erforderliche Funktionen ohne Kartenänderung.", "Verifica versões e funções necessárias sem alterar o mapa."],
        ["🔎 Ricontrolla SDK", "🔎 Recheck SDK", "🔎 Revérifier le SDK", "🔎 Volver a comprobar SDK", "🔎 SDK erneut prüfen", "🔎 Verificar SDK novamente"],
        ["Registro diagnostico", "Diagnostic log", "Journal de diagnostic", "Registro de diagnóstico", "Diagnoseprotokoll", "Registo de diagnóstico"],
        ["Ultimi eventi tecnici, salvati solo nel browser. Non includono dati dei segmenti, nomi di preset o coordinate.", "Recent technical events, stored only in this browser. No segment data, preset names or coordinates.", "Événements techniques récents conservés dans ce navigateur, sans données de segments, noms de préréglages ou coordonnées.", "Eventos técnicos recientes guardados solo en este navegador, sin datos de segmentos, nombres de preajustes ni coordenadas.", "Technische Ereignisse nur lokal im Browser; ohne Segmentdaten, Vorlagennamen oder Koordinaten.", "Eventos técnicos recentes guardados apenas neste navegador, sem dados de segmentos, nomes de predefinições ou coordenadas."],
        ["⬇️ Esporta diagnosi JSON", "⬇️ Export diagnostics JSON", "⬇️ Exporter le diagnostic JSON", "⬇️ Exportar diagnóstico JSON", "⬇️ Diagnose-JSON exportieren", "⬇️ Exportar diagnóstico JSON"],
        ["🗑️ Cancella registro", "🗑️ Clear log", "🗑️ Effacer le journal", "🗑️ Borrar registro", "🗑️ Protokoll löschen", "🗑️ Limpar registo"],
        ["SDK compatibile per le operazioni standard", "SDK compatible with standard operations", "SDK compatible pour les opérations standard", "SDK compatible con las operaciones estándar", "SDK für Standardfunktionen kompatibel", "SDK compatível com operações padrão"],
        ["SDK: mancano funzioni necessarie", "SDK: required functions missing", "SDK : fonctions nécessaires manquantes", "SDK: faltan funciones necesarias", "SDK: erforderliche Funktionen fehlen", "SDK: faltam funções necessárias"],
        ["SDK disponibile con avvisi", "SDK available with warnings", "SDK disponible avec avertissements", "SDK disponible con advertencias", "SDK mit Warnungen verfügbar", "SDK disponível com avisos"],
        ["Non verificato", "Not checked", "Non vérifié", "No comprobado", "Nicht geprüft", "Não verificado"],
        ["Funzioni mancanti", "Missing functions", "Fonctions manquantes", "Funciones ausentes", "Fehlende Funktionen", "Funções em falta"],
        ["Funzioni opzionali assenti", "Unavailable optional functions", "Fonctions facultatives indisponibles", "Funciones opcionales ausentes", "Optionale Funktionen fehlen", "Funções opcionais indisponíveis"],
        ["Motori moto: API interna rilevata, ma sperimentale", "Motorcycle engines: internal API detected, still experimental", "Moteurs moto : API interne détectée, toujours expérimentale", "Motores de motos: API interna detectada, aún experimental", "Motorradmotoren: interne API erkannt, weiterhin experimentell", "Motores de motos: API interna detetada, ainda experimental"],
        ["Motori moto: API interna non disponibile", "Motorcycle engines: internal API unavailable", "Moteurs moto : API interne indisponible", "Motores de motos: API interna no disponible", "Motorradmotoren: interne API nicht verfügbar", "Motores de motos: API interna indisponível"],
        ["Ultimi eventi", "Recent events", "Événements récents", "Eventos recientes", "Letzte Ereignisse", "Eventos recentes"],
        ["Nessun evento diagnostico.", "No diagnostic events.", "Aucun événement de diagnostic.", "No hay eventos de diagnóstico.", "Keine Diagnoseereignisse.", "Sem eventos de diagnóstico."],
        ["Il registro è stato cancellato.", "Diagnostic log cleared.", "Journal de diagnostic effacé.", "Registro de diagnóstico borrado.", "Diagnoseprotokoll gelöscht.", "Registo de diagnóstico limpo."],
        ["Diagnosi esportata.", "Diagnostics exported.", "Diagnostic exporté.", "Diagnóstico exportado.", "Diagnose exportiert.", "Diagnóstico exportado."],
        ["Le funzioni SDK necessarie non sono disponibili; applicazione bloccata per sicurezza.", "Required SDK functions are missing; applying changes is blocked for safety.", "Fonctions SDK manquantes ; application bloquée par sécurité.", "Faltan funciones SDK; aplicación bloqueada por seguridad.", "Erforderliche SDK-Funktionen fehlen; Änderungen aus Sicherheitsgründen blockiert.", "Faltam funções SDK; aplicação bloqueada por segurança."],
        ["Questa verifica controlla la disponibilità delle funzioni; non garantisce la compatibilità futura delle API interne.", "This check verifies function availability; it cannot guarantee future compatibility of private APIs.", "Cette vérification contrôle les fonctions disponibles ; elle ne garantit pas la compatibilité future des API internes.", "Esta comprobación verifica funciones disponibles, no garantiza la compatibilidad futura de las API internas.", "Diese Prüfung kontrolliert nur die Verfügbarkeit; zukünftige Kompatibilität interner APIs ist nicht garantiert.", "Esta verificação testa a disponibilidade das funções, não garante compatibilidade futura de APIs internas."]
    ];
    for (const row of MAINTENANCE_TRANSLATIONS) {
        ["it", "en", "fr", "es", "de", "pt"].forEach((language, index) => {
            TRANSLATIONS[language][row[0]] = row[index];
        });
    }

    let currentLanguage = "it";
    const originalText = new WeakMap();
    const originalPlaceholder = new WeakMap();
    const LOCALE_TAGS = {it:"it-IT", en:"en-US", fr:"fr-FR", es:"es-ES", de:"de-DE", pt:"pt-PT"};
    function t(source, args = {}) {
        let translated = TRANSLATIONS[currentLanguage]?.[source] ??
            TRANSLATIONS.en[source] ?? source;
        return String(translated).replace(/\{([a-zA-Z]+)\}/g,
            (match, key) => Object.prototype.hasOwnProperty.call(args, key) ? String(args[key]) : match);
    }
    function localizedWeekday(day) {
        const found = WEEK_DAYS.find(d => d[0] === day);
        return found ? t(found[1]) : day;
    }
    function localeTag() { return LOCALE_TAGS[currentLanguage] || "en-US"; }
    function translateTree(root) {
        if (!root || !document.createTreeWalker) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || parent.closest("#rm-status, #rm-cal-preview, script, style")) continue;
            if (parent.tagName === "OPTION" && parent.value &&
                parent.closest("#rm-presets, #rm-cal-list, #rm-link-calendar")) continue;
            if (!originalText.has(node)) originalText.set(node, node.textContent);
            const raw = originalText.get(node);
            const key = raw.replace(/\s+/g, " ").trim();
            if (!key || !Object.prototype.hasOwnProperty.call(TRANSLATIONS.it, key)) continue;
            const prefix = raw.match(/^\s*/)?.[0] || "";
            const suffix = raw.match(/\s*$/)?.[0] || "";
            node.textContent = prefix + t(key) + suffix;
        }
        for (const input of root.querySelectorAll?.("[placeholder]") || []) {
            if (!originalPlaceholder.has(input)) originalPlaceholder.set(input, input.getAttribute("placeholder"));
            input.setAttribute("placeholder", t(originalPlaceholder.get(input)));
        }
        for (const opt of root.querySelectorAll?.(".rm-special-month option") || []) {
            const month = Number(opt.value);
            if (!Number.isInteger(month) || month < 1 || month > 12) continue;
            opt.textContent = new Intl.DateTimeFormat(localeTag(), {month:"long",timeZone:"UTC"})
                .format(new Date(Date.UTC(2024, month-1, 1)));
        }
    }
    async function updateLanguage(force = false) {
        if (!sdk?.Settings?.getLocale) return;
        try {
            const locale = await Promise.resolve(sdk.Settings.getLocale());
            const code = String(locale?.localeCode || "en").toLowerCase().replace("_", "-").split("-")[0];
            const language = Object.prototype.hasOwnProperty.call(TRANSLATIONS, code) ? code : "en";
            if (!force && language === currentLanguage) return;
            currentLanguage = language;
            if (!force && typeof clearOperationPreview === "function") clearOperationPreview();
            if (tabPane) {
                translateTree(tabPane);
                // Placeholder options may have been recreated after the first render.
                for (const [selector, label] of [
                    ["#rm-cal-list", "-- Nuovo calendario --"],
                    ["#rm-link-calendar", "Nessun calendario — orari originali"],
                    ["#rm-presets", "-- Seleziona un preset --"]
                ]) {
                    const first = tabPane.querySelector(selector)?.querySelector('option[value=""]');
                    if (first) first.textContent = t(label);
                }
                // Keep user choices in forms and selectors unchanged.
                if (!force) notify(t("Lingua aggiornata: {language}", {language: language.toUpperCase()}), "info");
                if (typeof previewCalendar === "function" && $("#rm-cal-preview")) previewCalendar();
                if (typeof refreshExpirationAlerts === "function") refreshExpirationAlerts();
                renderDiagnostics();
                if (typeof updateHolidaySnapshotStatus === "function") updateHolidaySnapshotStatus();
                if (typeof populateHolidayCountries === "function") populateHolidayCountries();
                if (typeof updateHolidayRegionOptions === "function") {
                    updateHolidayRegionOptions($("#rm-holiday-country")?.value?.trim().toUpperCase() || "",
                        $("#rm-holiday-region")?.value?.trim().toUpperCase() || "");
                }
                const presetSelect = $("#rm-presets");
                if (presetSelect) {
                    for (const option of presetSelect.options) {
                        if (!option.value) continue;
                        try {
                            const preset = asPreset(read(option.value));
                            let label = option.value;
                            if (preset.sourceDirection === DIR.TWO_WAY) label += " (" + t("doppio senso") + ")";
                            if (preset.calendarId) label += " 📅";
                            if (preset.motorcycleConditions.some(x => x.length)) label += " 🏍 " + t("motori");
                            if (preset.restrictions.some(hasMotorcycle) && !preset.motorcycleDataCaptured) label += " ⚠ " + t("da risalvare");
                            option.textContent = label;
                        } catch (_) { /* Do not change saved preset names. */ }
                    }
                }
            }
        } catch (error) { errorLog("Locale", error); }
    }

    const log = (...args) => console.log("[Restriction Manager]", ...args);
    const errorLog = (...args) => console.error("[Restriction Manager]", ...args);
    const $ = sel => tabPane?.querySelector(sel);
    const copy = value => JSON.parse(JSON.stringify(value));
    const msg = error => error instanceof Error ? error.message : String(error);


    // Compact diagnostics: allow-listed event types and numeric counters only.
    // The log NEVER records URLs, coordinates, user/segment IDs, preset names,
    // restrictions, full error messages, tokens, or stack traces.
    const DIAG_KEY = "rm-maintenance-diagnostics:v1";
    const DIAG_MAX = 80;
    const DIAG_EVENTS = new Set([
        "startup-ok", "startup-failed", "sdk-missing", "sdk-check", "sdk-optional-missing",
        "preview-ready", "preview-failed", "apply-ok", "apply-failed",
        "preset-saved", "calendar-saved", "holiday-loaded", "holiday-failed",
        "backup-exported", "backup-imported", "backup-failed"
    ]);
    const DIAG_ALLOWED_FIELDS = new Set([
        "segments", "applied", "skipped", "unchanged", "conflicts", "restrictions",
        "presets", "calendars", "holidays", "missing", "optionalMissing"
    ]);
    let diagnostics = [];
    try {
        const saved = JSON.parse(localStorage.getItem(DIAG_KEY) || "[]");
        if (Array.isArray(saved)) diagnostics = saved.slice(-DIAG_MAX).filter(item =>
            item && DIAG_EVENTS.has(item.event) && ["info", "warning", "error"].includes(item.level));
    } catch (_) { /* Never block loading because diagnostic storage is invalid. */ }

    function recordDiagnostic(level, event, fields = {}) {
        if (!DIAG_EVENTS.has(event)) return;
        const counters = {};
        for (const [key, value] of Object.entries(fields)) {
            if (DIAG_ALLOWED_FIELDS.has(key) && Number.isSafeInteger(value) && value >= 0 && value <= 1000000) {
                counters[key] = value;
            }
        }
        diagnostics.push({timestamp: new Date().toISOString(), level, event, counters});
        if (diagnostics.length > DIAG_MAX) diagnostics = diagnostics.slice(-DIAG_MAX);
        try { localStorage.setItem(DIAG_KEY, JSON.stringify(diagnostics)); } catch (_) { /* Quota or privacy mode. */ }
        renderDiagnostics();
    }

    // WME async SDK getters may return Promises, including version and environment.
    // Keep capability checks synchronous; resolve display metadata separately.
    let sdkMetadataRefresh = Promise.resolve();

    function refreshSdkMetadata(report) {
        const pending = [];
        const read = (methodName, field, normalize) => {
            try {
                if (typeof sdk?.[methodName] !== "function") return;
                const value = sdk[methodName]();
                const accept = result => {
                    if (sdkCompatibility !== report) return;
                    const parsed = normalize(result);
                    if (parsed !== null) report[field] = parsed;
                };
                if (value && typeof value.then === "function") {
                    pending.push(Promise.resolve(value).then(accept, () => {}));
                } else {
                    accept(value);
                }
            } catch (_) { /* Metadata errors must not block editing. */ }
        };
        const version = value => typeof value === "string" && value.trim()
            ? value.trim().slice(0, 90) : null;
        read("getSDKVersion", "sdkVersion", version);
        read("getWMEVersion", "wmeVersion", version);
        read("isBetaEnvironment", "environment", value =>
            typeof value === "boolean" ? (value ? "Beta" : "Standard") : null);
        sdkMetadataRefresh = Promise.all(pending).then(() => {
            if (sdkCompatibility === report) renderDiagnostics();
        });
    }

    function inspectSdkCompatibility() {
        const required = {
            "Sidebar.registerScriptTab": sdk?.Sidebar?.registerScriptTab,
            "Editing.getSelection": sdk?.Editing?.getSelection,
            "DataModel.Segments.getById": sdk?.DataModel?.Segments?.getById,
            "DataModel.Segments.updateSegment": sdk?.DataModel?.Segments?.updateSegment
        };
        const optional = {
            "Editing.undo": sdk?.Editing?.undo,
            "Settings.getLocale": sdk?.Settings?.getLocale
        };
        const missing = Object.keys(required).filter(key => typeof required[key] !== "function");
        const optionalMissing = Object.keys(optional).filter(key => typeof optional[key] !== "function");
        // Even basic preset capture uses the raw model in this version.
        // Report its absence as a warning; it may load after the public SDK.
        const rawModelReady = typeof pageWindow.W?.model?.segments?.getObjectById === "function";
        if (!rawModelReady) optionalMissing.push("W.model.segments.getObjectById (private)");
        const internalMotorApi = typeof pageWindow.W?.model?.actionManager?.add === "function" && rawModelReady;
        sdkCompatibility = {
            scriptVersion: SCRIPT_VERSION,
            sdkVersion: "n/a",
            wmeVersion: "n/a",
            environment: pageWindow.location?.hostname === "beta.waze.com" ? "Beta" : "Standard",
            missing, optionalMissing, internalMotorApi,
            ready: missing.length === 0
        };
        refreshSdkMetadata(sdkCompatibility);
        recordDiagnostic(missing.length ? "error" : optionalMissing.length ? "warning" : "info",
            "sdk-check", {missing:missing.length, optionalMissing:optionalMissing.length});
        renderDiagnostics();
        return sdkCompatibility;
    }

    function assertSdkCompatible() {
        if (!sdkCompatibility?.ready) inspectSdkCompatibility();
        if (!sdkCompatibility?.ready) {
            throw new Error(t("Le funzioni SDK necessarie non sono disponibili; applicazione bloccata per sicurezza."));
        }
    }

    function renderDiagnostics() {
        const status = $("#rm-sdk-compat");
        const output = $("#rm-diag-events");
        if (status) {
            const report = sdkCompatibility;
            if (!report) {
                status.textContent = t("Non verificato");
                status.dataset.type = "warning";
            } else {
                const title = report.ready
                    ? report.optionalMissing.length ? t("SDK disponibile con avvisi") : t("SDK compatibile per le operazioni standard")
                    : t("SDK: mancano funzioni necessarie");
                const lines = [title,
                    `RM ${report.scriptVersion} · SDK ${report.sdkVersion} · WME ${report.wmeVersion} · ${report.environment}`];
                if (report.missing.length) lines.push(t("Funzioni mancanti") + ": " + report.missing.join(", "));
                if (report.optionalMissing.length) lines.push(t("Funzioni opzionali assenti") + ": " + report.optionalMissing.join(", "));
                lines.push(t(report.internalMotorApi
                    ? "Motori moto: API interna rilevata, ma sperimentale"
                    : "Motori moto: API interna non disponibile"));
                lines.push(t("Questa verifica controlla la disponibilità delle funzioni; non garantisce la compatibilità futura delle API interne."));
                status.textContent = lines.join("\n");
                status.dataset.type = report.ready ? report.optionalMissing.length ? "warning" : "success" : "error";
            }
        }
        if (output) {
            output.textContent = diagnostics.length
                ? diagnostics.slice(-30).reverse().map(item =>
                    `${item.timestamp} [${item.level}] ${item.event}` +
                    (Object.keys(item.counters || {}).length ? ` ${JSON.stringify(item.counters)}` : "")
                ).join("\n")
                : t("Nessun evento diagnostico.");
        }
    }

    async function exportDiagnostics() {
        // Wait for async metadata so JSON includes actual SDK and WME versions.
        if (sdk) inspectSdkCompatibility();
        try { await sdkMetadataRefresh; } catch (_) { /* Keep export available. */ }
        const report = sdkCompatibility;
        const payload = {
            format: "restriction-manager-diagnostics-v1",
            scriptVersion: SCRIPT_VERSION,
            compatibility: report ? {...report, internalMotorApi: report.internalMotorApi} : null,
            entries: diagnostics.slice()
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"}));
        const link = document.createElement("a");
        link.href = url;
        link.download = "restriction-manager-diagnostics.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify(t("Diagnosi esportata."), "success");
    }

    function clearDiagnostics() {
        diagnostics = [];
        try { localStorage.removeItem(DIAG_KEY); } catch (_) { /* ignore */ }
        renderDiagnostics();
        notify(t("Il registro è stato cancellato."), "success");
    }

    function notify(message, type = "info") {
        const el = $("#rm-status");
        if (el) {
            el.textContent = message;
            el.dataset.type = type;
        } else log(message);
    }

    function setBusy(on) {
        busy = on;
        for (const button of tabPane?.querySelectorAll("button") || []) {
            button.disabled = on;
        }
        if (!on && typeof updatePreviewToggle === "function") updatePreviewToggle();
    }

    function names() {
        return Object.keys(localStorage)
            .filter(key => key.startsWith(STORAGE_PREFIX))
            .map(key => key.slice(STORAGE_PREFIX.length))
            .sort((a, b) => a.localeCompare(b));
    }

    function read(name) {
        const data = localStorage.getItem(STORAGE_PREFIX + name);
        return data === null ? null : JSON.parse(data);
    }

    function sourceDirection(segment) {
        if (segment?.isTwoWay === true) return DIR.TWO_WAY;
        if (segment?.isAtoB === true && segment?.isBtoA !== true) return DIR.A_TO_B;
        if (segment?.isBtoA === true && segment?.isAtoB !== true) return DIR.B_TO_A;
        return DIR.UNKNOWN;
    }

    function directionLabel(direction) {
        if (direction === DIR.A_TO_B) return "A→B";
        if (direction === DIR.B_TO_A) return "B→A";
        if (direction === DIR.TWO_WAY) return t("doppio senso");
        return t("direzione sconosciuta");
    }

    function invertDirection(direction) {
        return direction === "FWD" ? "REV" : direction === "REV" ? "FWD" : direction;
    }

    function shouldInvert(original, target) {
        return (original === DIR.A_TO_B && target === DIR.B_TO_A) ||
            (original === DIR.B_TO_A && target === DIR.A_TO_B);
    }

    function toRestrictionData(source) {
        if (!source || typeof source !== "object" || Array.isArray(source)) {
            throw new Error(t("Restrizione non valida."));
        }
        const direction = source.direction;
        const defaultType = source.defaultType;
        const laneScope = source.laneScope ?? source.disposition;
        if (!["FWD", "REV", "BOTH"].includes(direction)) {
            throw new Error(t("Direzione restrizione non valida."));
        }
        if (typeof defaultType !== "string" || !defaultType) {
            throw new Error(t("Tipo di restrizione non valido."));
        }
        if (typeof laneScope !== "string" || !laneScope) {
            throw new Error(t("laneScope mancante."));
        }
        const sourceRules = source.vehicleRules ?? source.driveProfiles ?? {};
        if (!sourceRules || Array.isArray(sourceRules) || typeof sourceRules !== "object") {
            throw new Error(t("Regole veicoli non valide."));
        }
        const vehicleRules = {};
        for (const [type, rules] of Object.entries(sourceRules)) {
            if (!Array.isArray(rules)) throw new Error(t("Regole {type} non valide.", {type}));
            vehicleRules[type] = rules.map(rule => {
                if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
                    throw new Error(t("Regola veicolo {type} non valida.", {type}));
                }
                const result = copy(rule);
                result.licensePlateRule = rule.licensePlateRule ?? rule.licensePlateNumber ?? null;
                result.minPassengers = rule.minPassengers ?? rule.numPassengers ?? 0;
                result.subscriptions = Array.isArray(rule.subscriptions) ? copy(rule.subscriptions) : [];
                result.vehicleTypes = Array.isArray(rule.vehicleTypes) ? copy(rule.vehicleTypes) : [];
                delete result.licensePlateNumber;
                delete result.numPassengers;
                return result;
            });
        }
        const timeFrames = (Array.isArray(source.timeFrames) ? source.timeFrames : []).map(f => ({
            dayAlternation: f.dayAlternation ?? f.daysOfMonth ?? null,
            endDate: f.endDate ?? null,
            fromTime: f.fromTime ?? null,
            repeatYearly: f.repeatYearly ?? null,
            startDate: f.startDate ?? null,
            timeZone: f.timeZone ?? null,
            toTime: f.toTime ?? null,
            weekdays: Array.isArray(f.weekdays) ? copy(f.weekdays) : null
        }));
        return {
            defaultType, description: source.description ?? null, direction,
            laneScope, laneType: source.laneType ?? null,
            timeFrames, vehicleRules
        };
    }

    // Dati SDK senza proprietà aggiuntive: solo il contratto pubblico.
    function toSdkData(data) {
        const result = toRestrictionData(data);
        for (const rules of Object.values(result.vehicleRules)) {
            for (const rule of rules) {
                const allowed = ["licensePlateRule", "minPassengers", "subscriptions", "vehicleTypes"];
                for (const key of Object.keys(rule)) {
                    if (!allowed.includes(key)) delete rule[key];
                }
            }
        }
        return result;
    }

    function hasMotorcycle(restriction) {
        const rules = restriction.vehicleRules || restriction.driveProfiles || {};
        return Object.values(rules).some(group =>
            Array.isArray(group) && group.some(rule =>
                rule?.vehicleTypes?.includes("MOTORCYCLE")));
    }

    function getRawSegment(id) {
        return pageWindow.W?.model?.segments?.getObjectById?.(id) || null;
    }

    function rawRestrictions(id) {
        const segment = getRawSegment(id);
        const list = segment?.attributes?.restrictions;
        if (!segment || !Array.isArray(list)) {
            throw new Error(t("Modello interno WME indisponibile per il segmento {id}.", {id}));
        }
        return list;
    }

    function motorRules(restriction) {
        if (typeof restriction?.getDriveProfileList !== "function") return [];
        const list = restriction.getDriveProfileList("BLOCKED");
        const profiles = list?.getDriveProfiles?.() || [];
        return profiles.flatMap(profile =>
            (profile.getEngineCapacities?.() || []).map(item => {
                const data = item?.attributes || item;
                return {
                    vehicleType: data.vehicleType,
                    engineType: data.engineType,
                    operator: data.operator,
                    capacityThreshold: data.capacityThreshold
                };
            })
        );
    }

    function normalizedMotorRules(restriction) {
        return motorRules(restriction).map(x => ({
            vehicleType: x.vehicleType,
            engineType: x.engineType,
            operator: x.operator,
            capacityThreshold: Number(x.capacityThreshold)
        })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }

    function sameMotors(left, right) {
        return JSON.stringify(left) === JSON.stringify(right);
    }

    function motorRulesFromRawJson(raw) {
        if (!raw) return [];
        const profiles = raw.driveProfiles ?? raw.vehicleRules ?? {};
        const blocked = profiles.BLOCKED || [];
        return blocked.flatMap(p => (p.engineCapacities || []).map(item => ({
            vehicleType: item.vehicleType,
            engineType: item.engineType,
            operator: item.operator,
            capacityThreshold: Number(item.capacityThreshold)
        }))).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }

    function asPreset(value) {
        const isOldArray = Array.isArray(value);
        if (!isOldArray && (!value || !Array.isArray(value.restrictions))) {
            throw new Error(t("Formato preset non riconosciuto."));
        }
        const rs = isOldArray ? value : value.restrictions;
        if (!rs.length) throw new Error(t("Preset vuoto."));
        const restrictions = rs.map(toRestrictionData);
        const source = isOldArray ? DIR.UNKNOWN : value.sourceDirection;
        const hasDirection = !isOldArray && Object.values(DIR).includes(source) && !value?.legacy;
        const raw = !isOldArray && Array.isArray(value.rawRestrictions)
            ? value.rawRestrictions : null;
        const captured = !isOldArray && value.motorcycleDataCaptured === true &&
            Array.isArray(raw) && raw.length === restrictions.length;
        const engines = captured ? raw.map(motorRulesFromRawJson) : [];
        if (captured && Array.isArray(value.motorcycleConditions) &&
            value.motorcycleConditions.length === restrictions.length) {
            for (let i = 0; i < engines.length; i++) {
                const supplied = copy(value.motorcycleConditions[i] || [])
                    .map(item => ({
                        vehicleType: item.vehicleType,
                        engineType: item.engineType,
                        operator: item.operator,
                        capacityThreshold: Number(item.capacityThreshold)
                    }))
                    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
                if (!sameMotors(supplied, engines[i])) {
                    throw new Error(t("Il JSON originale non conserva integralmente le condizioni motore. Risalva il preset dalla restrizione originale."));
                }
            }
        }
        return {
            formatVersion: FORMAT,
            sourceDirection: hasDirection ? source : DIR.UNKNOWN,
            legacy: !hasDirection,
            restrictions,
            rawRestrictions: raw && raw.length === restrictions.length ? copy(raw) : null,
            motorcycleDataCaptured: captured,
            motorcycleConditions: engines,
            calendarId: !isOldArray && typeof value.calendarId === "string" ? value.calendarId : null
        };
    }

    // --- Calendari locali: non sono Community Schedules WME. ---
    const WEEK_DAYS = [
        ["MONDAY", "Lun"], ["TUESDAY", "Mar"], ["WEDNESDAY", "Mer"],
        ["THURSDAY", "Gio"], ["FRIDAY", "Ven"],
        ["SATURDAY", "Sab"], ["SUNDAY", "Dom"]
    ];
    const WEEK_KEYS = WEEK_DAYS.map(item => item[0]);
    let editingCalendarId = null;
    let loadedHolidaySnapshot = null;

    function newCalendarId() {
        return "cal-" + (window.crypto?.randomUUID?.() ||
            Date.now().toString(36) + "-" + Math.random().toString(36).slice(2));
    }

    function calendarIds() {
        return Object.keys(localStorage).filter(key => key.startsWith(CAL_PREFIX))
            .map(key => key.slice(CAL_PREFIX.length));
    }

    function validDate(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [y, m, d] = value.split("-").map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 &&
            date.getUTCDate() === d;
    }

    function minutes(time) {
        if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
            throw new Error(t("Orario non valido. Usa HH:MM (00:00–23:59)."));
        }
        return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    }

    function normalizeCalendar(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error(t("Calendario non valido."));
        }
        const name = String(value.name || "").trim();
        if (!name || name.length > 90) throw new Error(t("Inserisci un nome calendario (massimo 90 caratteri)."));
        const timeZone = String(value.timeZone || "").trim();
        try { new Intl.DateTimeFormat("it-IT", { timeZone }); }
        catch (_) { throw new Error(t("Fuso orario non valido (es. Europe/Rome).")); }
        const startDate = value.startDate || null;
        const endDate = value.endDate || null;
        if (Boolean(startDate) !== Boolean(endDate)) {
            throw new Error(t("Per la validità temporale devi indicare sia la data iniziale sia quella finale."));
        }
        if (startDate && (!validDate(startDate) || !validDate(endDate) || startDate > endDate)) {
            throw new Error(t("Intervallo di date non valido."));
        }
        const repeatYearly = Boolean(value.repeatYearly);
        if (repeatYearly && !startDate) throw new Error(t("La ripetizione annuale richiede un intervallo di date."));
        // New records opt in by selecting a country. Old records without a
        // checked holiday box and without imported data remain unchanged.
        const legacyHolidayEnabled = Boolean(value.excludeNationalHolidays || value.holidaySnapshot);
        const holidaySelectionEnabled = typeof value.holidaySelectionEnabled === "boolean"
            ? value.holidaySelectionEnabled : legacyHolidayEnabled;
        const holidayCountry = holidaySelectionEnabled
            ? String(value.holidayCountry || "IT").trim().toUpperCase() : "";
        const holidayRegion = holidaySelectionEnabled
            ? String(value.holidayRegion || "").trim().toUpperCase() : "";
        const holidayLocality = String(value.holidayLocality || "").trim().slice(0, 90);
        if (holidayCountry && !/^[A-Z]{2}$/.test(holidayCountry)) {
            throw new Error(t("Seleziona un Paese con codice ISO a due lettere (es. IT, DE, FR)."));
        }
        if (holidayRegion && (!/^[A-Z]{2}-[A-Z0-9-]{1,12}$/.test(holidayRegion) ||
            !holidayRegion.startsWith(holidayCountry + "-"))) {
            throw new Error(t("Il codice Regione deve appartenere al Paese scelto (es. IT-25)."));
        }
        const localAnnualInput = value.localAnnualHolidays ?? [];
        if (!Array.isArray(localAnnualInput) || localAnnualInput.length > MAX_LOCAL_ANNUAL_HOLIDAYS) {
            throw new Error(t("Massimo {count} periodi esclusi.",{count:MAX_LOCAL_ANNUAL_HOLIDAYS}));
        }
        const localAnnualHolidays = localAnnualInput.map((h, i) => {
            const month = Number(h.month), day = Number(h.day);
            const name = String(h.name || "").trim().slice(0, 90);
            if (!name) throw new Error(t("Per una festa locale è necessario indicare un nome."));
            if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 ||
                day < 1 || day > new Date(Date.UTC(2024, month, 0)).getUTCDate()) {
                throw new Error(t("La festività locale {index} ha mese/giorno non validi.",{index:i+1}));
            }
            return {name,month,day};
        });
        const rawSnapshot = value.holidaySnapshot ?? null;
        let holidaySnapshot = null;
        if (rawSnapshot) {
            if (typeof rawSnapshot !== "object" || Array.isArray(rawSnapshot) ||
                !/^[A-Z]{2}$/.test(rawSnapshot.country) ||
                typeof rawSnapshot.region !== "string" ||
                !Number.isInteger(rawSnapshot.firstYear) || !Number.isInteger(rawSnapshot.lastYear) ||
                rawSnapshot.firstYear > rawSnapshot.lastYear ||
                !Array.isArray(rawSnapshot.dates) || rawSnapshot.dates.length > 1000) {
                throw new Error(t("Archivio festività non caricato o non aggiornato per Paese, Regione e anni scelti. Premi «Carica le festività» prima di salvare o applicare."));
            }
            const dates = [...new Set(rawSnapshot.dates)];
            if (dates.some(date => !validDate(date) || Number(date.slice(0,4)) < rawSnapshot.firstYear ||
                Number(date.slice(0,4)) > rawSnapshot.lastYear)) {
                throw new Error(t("Archivio festività non caricato o non aggiornato per Paese, Regione e anni scelti. Premi «Carica le festività» prima di salvare o applicare."));
            }
            holidaySnapshot = {
                country:rawSnapshot.country, region:rawSnapshot.region,
                firstYear:rawSnapshot.firstYear, lastYear:rawSnapshot.lastYear,
                dates:dates.sort(), fetchedAt:String(rawSnapshot.fetchedAt || "").slice(0,40),
                periodStart: validDate(rawSnapshot.periodStart) ? rawSnapshot.periodStart : null,
                periodEnd: validDate(rawSnapshot.periodEnd) ? rawSnapshot.periodEnd : null
            };
        }
        const rawExclusions = value.excludedRanges ?? [];
        if (!Array.isArray(rawExclusions) || rawExclusions.length > MAX_CUSTOM_EXCLUSIONS) {
            throw new Error(t("Puoi inserire al massimo {count} date o intervalli esclusi.", {count:MAX_CUSTOM_EXCLUSIONS}));
        }
        const excludedRanges = rawExclusions.map((item, index) => {
            const start = String(item?.startDate || "").trim();
            const end = String(item?.endDate || start).trim();
            if (!validDate(start) || !validDate(end) || end < start) {
                throw new Error(t("Esclusione {index}: inserisci date valide in ordine crescente.", {index:index+1}));
            }
            const label = String(item?.label || "").trim().slice(0, 90);
            return { startDate: start, endDate: end, label };
        });
        const hasExclusions = Boolean(holidayCountry) || excludedRanges.length > 0 || localAnnualHolidays.length > 0;
        if (holidayCountry) {
            const firstYear = startDate ? Number(startDate.slice(0,4)) : 0;
            const lastYear = endDate ? Number(endDate.slice(0,4)) : 0;
            // Compatibility with Italian calendars created before v3.0.2:
            // they used built-in Italian holidays without an imported snapshot.
            const legacyIT = !holidaySnapshot && value.excludeNationalHolidays === true &&
                holidayCountry === "IT" && !holidayRegion && startDate && endDate &&
                typeof value.holidaySelectionEnabled !== "boolean";
            if (legacyIT) {
                const dates = [];
                for (let year = firstYear; year <= lastYear; year++) dates.push(...italianHolidays(year));
                holidaySnapshot = {country:"IT",region:"",firstYear,lastYear,
                    dates:[...new Set(dates)].filter(d => d >= startDate && d <= endDate).sort(),
                    fetchedAt:"legacy-it",periodStart:startDate,periodEnd:endDate};
            }
            if (!holidaySnapshot || holidaySnapshot.country !== holidayCountry ||
                holidaySnapshot.region !== holidayRegion ||
                holidaySnapshot.firstYear > firstYear || holidaySnapshot.lastYear < lastYear ||
                (holidaySnapshot.periodStart && holidaySnapshot.periodStart !== startDate) ||
                (holidaySnapshot.periodEnd && holidaySnapshot.periodEnd !== endDate)) {
                throw new Error(t("Archivio festività non caricato o non aggiornato per Paese, Regione e anni scelti. Premi «Carica le festività» prima di salvare o applicare."));
            }
        }
        if (hasExclusions) {
            if (!startDate || !endDate) {
                throw new Error(t("Con i giorni esclusi devi impostare un intervallo preciso di validità (es. settembre–giugno)."));
            }
            if (repeatYearly) {
                throw new Error(t("Con i giorni esclusi disattiva «Ripeti ogni anno»: per sicurezza i periodi vanno generati per anni specifici."));
            }
            if (daysBetween(startDate, endDate) + 1 > MAX_EXCLUSION_DAYS) {
                throw new Error(t("Periodo con esclusioni troppo lungo (massimo 5 anni). Riduci l'intervallo."));
            }
        }
        if (!Array.isArray(value.slots) || value.slots.length > 20) {
            throw new Error(t("Inserisci non più di 20 fasce settimanali."));
        }
        const slots = value.slots.map((slot, index) => {
            const days = WEEK_KEYS.filter(day => Array.isArray(slot?.weekdays) && slot.weekdays.includes(day));
            if (!days.length) throw new Error(t("Nella fascia {index} seleziona almeno un giorno.", {index:index+1}));
            const allDay = Boolean(slot?.allDay);
            const fromTime = allDay ? null : slot.fromTime;
            const toTime = allDay ? null : slot.toTime;
            if (!allDay && minutes(fromTime) === minutes(toTime)) {
                throw new Error(t("Fascia {index}: inizio e fine non possono coincidere. Usa «Tutto il giorno».", {index:index+1}));
            }
            if (hasExclusions && !allDay && minutes(toTime) < minutes(fromTime)) {
                throw new Error(t("Fascia {index}: con giorni esclusi non usare fasce che attraversano la mezzanotte. Dividile prima di applicare il calendario.", {index:index+1}));
            }
            return { weekdays: days, allDay, fromTime, toTime };
        });
        // Controlla sovrapposizioni, comprese fasce che attraversano la mezzanotte.
        const week = 7 * 1440;
        const intervals = [];
        for (const slot of slots) {
            const a = slot.allDay ? 0 : minutes(slot.fromTime);
            const b = slot.allDay ? 1440 : minutes(slot.toTime);
            for (const day of slot.weekdays) {
                const d = WEEK_KEYS.indexOf(day);
                intervals.push([
                    d * 1440 + a,
                    d * 1440 + b + (!slot.allDay && b < a ? 1440 : 0)
                ]);
            }
        }
        for (let i = 0; i < intervals.length; i++) {
            for (let j = 0; j < intervals.length; j++) {
                for (const shift of [-week, 0, week]) {
                    if (i === j && shift === 0) continue;
                    if (intervals[i][0] < intervals[j][1] + shift &&
                        intervals[j][0] + shift < intervals[i][1]) {
                        throw new Error(t("Le fasce orarie si sovrappongono sullo stesso giorno."));
                    }
                }
            }
        }
        // Le ricorrenze mobili vengono espanse in date concrete: WME non le
        // interpreta come una ripetizione infinita. L'intervallo è esplicito.
        const specialRules = Array.isArray(value.specialRules) ? value.specialRules : [];
        if (specialRules.length > 8) throw new Error(t("Massimo 8 ricorrenze speciali per calendario."));
        if (!slots.length && !specialRules.length) {
            throw new Error(t("Inserisci almeno una fascia settimanale o una ricorrenza speciale."));
        }
        const currentYear = new Date().getFullYear();
        const specialStartYear = Number(value.specialStartYear ?? currentYear);
        const specialEndYear = Number(value.specialEndYear ?? currentYear + 4);
        if (!Number.isInteger(specialStartYear) || !Number.isInteger(specialEndYear) ||
            specialStartYear < 2000 || specialEndYear > 2099 ||
            specialEndYear < specialStartYear ||
            specialEndYear - specialStartYear + 1 > MAX_SPECIAL_YEARS) {
            throw new Error(t("Anni delle ricorrenze non validi (massimo {count} annualità, dal 2000 al 2099).", {count:MAX_SPECIAL_YEARS}));
        }
        const normalizedSpecial = specialRules.map((rule, index) => {
            const kind = rule?.kind;
            if (!["nth_weekday", "easter"].includes(kind)) {
                throw new Error(t("Ricorrenza {index}: tipo non valido.", {index:index+1}));
            }
            const allDay = Boolean(rule.allDay);
            const fromTime = allDay ? null : rule.fromTime;
            const toTime = allDay ? null : rule.toTime;
            if (!allDay && (minutes(fromTime) >= minutes(toTime))) {
                throw new Error(t("Ricorrenza {index}: usa orari crescenti nello stesso giorno (notturni non supportati).", {index:index+1}));
            }
            const ordinal = kind === "nth_weekday" ? Number(rule.ordinal) : 2;
            const month = kind === "nth_weekday" ? Number(rule.month) : 3;
            const weekday = kind === "nth_weekday" ? rule.weekday : "SUNDAY";
            const offsetDays = kind === "easter" ? Number(rule.offsetDays ?? 0) : 0;
            if (kind === "nth_weekday" &&
                (![-1, 1, 2, 3, 4, 5].includes(ordinal) ||
                 !Number.isInteger(month) || month < 1 || month > 12 ||
                 !WEEK_KEYS.includes(weekday))) {
                throw new Error(t("Ricorrenza {index}: mese, settimana o giorno non validi.", {index:index+1}));
            }
            if (!Number.isInteger(offsetDays) || Math.abs(offsetDays) > 60) {
                throw new Error(t("Ricorrenza {index}: scostamento dalla Pasqua non valido (-60 a +60 giorni).", {index:index+1}));
            }
            return { kind, ordinal, month, weekday, offsetDays, allDay, fromTime, toTime };
        });
        return {
            id: (typeof value.id === "string" && /^cal-[\w-]{6,100}$/.test(value.id))
                ? value.id : null,
            name, timeZone, startDate, endDate, repeatYearly, slots,
            holidaySelectionEnabled:Boolean(holidayCountry), excludedRanges,
            holidayCountry, holidayRegion, holidayLocality, holidaySnapshot, localAnnualHolidays,
            specialRules: normalizedSpecial, specialStartYear, specialEndYear
        };
    }

    function getCalendar(id) {
        if (!id) return null;
        const content = localStorage.getItem(CAL_PREFIX + id);
        return content === null ? null : normalizeCalendar(JSON.parse(content));
    }

    function allCalendars() {
        return calendarIds().map(id => {
            const cal = getCalendar(id);
            if (!cal) throw new Error(t("Calendario {id} non trovato.", {id}));
            if (cal.id !== id) throw new Error(t("Identificativo calendario incoerente: {id}", {id}));
            return cal;
        }).sort((a, b) => a.name.localeCompare(b.name, localeTag()));
    }

    function ymdUTC(year, month, day) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    function weekdayAt(date) {
        return WEEK_KEYS[(date.getUTCDay() + 6) % 7];
    }

    function nthWeekdayDate(year, month, weekday, ordinal) {
        const wanted = WEEK_KEYS.indexOf(weekday);
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        let day;
        if (ordinal === -1) {
            const lastWeekday = (new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay() + 6) % 7;
            day = lastDay - (lastWeekday - wanted + 7) % 7;
        } else {
            const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
            day = 1 + (wanted - firstWeekday + 7) % 7 + 7 * (ordinal - 1);
        }
        return day > lastDay ? null : ymdUTC(year, month, day);
    }

    // Meeus/Jones/Butcher: data della Pasqua gregoriana.
    function gregorianEaster(year) {
        const a = year % 19, b = Math.floor(year / 100), c = year % 100;
        const d = Math.floor(b / 4), e = b % 4;
        const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const z = h + l - 7 * m + 114;
        return ymdUTC(year, Math.floor(z / 31), (z % 31) + 1);
    }

    function specialDate(rule, year) {
        if (rule.kind === "nth_weekday") {
            return nthWeekdayDate(year, rule.month, rule.weekday, rule.ordinal);
        }
        const easter = gregorianEaster(year);
        const date = new Date(easter + "T12:00:00Z");
        date.setUTCDate(date.getUTCDate() + rule.offsetDays);
        return ymdUTC(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }

    // Confronti puramente civili in UTC: le date NON sono timestamp locali.
    function dateUTC(ymd) {
        return new Date(ymd + "T12:00:00Z");
    }

    function addDays(ymd, count) {
        const d = dateUTC(ymd);
        d.setUTCDate(d.getUTCDate() + count);
        return ymdUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }

    function daysBetween(first, last) {
        return Math.round((dateUTC(last) - dateUTC(first)) / 86400000);
    }

    // Festività nazionali italiane: la festa del 4 ottobre è vigente dal 2026.
    // Il patrono locale e le chiusure scolastiche regionali sono inseriti manualmente.
    function italianHolidays(year) {
        const fixed = [
            [1, 1], [1, 6], [4, 25], [5, 1], [6, 2],
            [8, 15], [11, 1], [12, 8], [12, 25], [12, 26]
        ];
        if (year >= 2026) fixed.push([10, 4]);
        const dates = fixed.map(([month, day]) => ymdUTC(year, month, day));
        const easter = gregorianEaster(year);
        dates.push(easter, addDays(easter, 1));
        return dates;
    }

    function exclusionSet(calendar) {
        const c = calendar;
        const result = new Set();
        if (!c.holidayCountry && !c.excludedRanges?.length && !c.localAnnualHolidays?.length) return result;
        // normalizeCalendar has already validated the imported territory/date snapshot.
        if (c.holidayCountry && c.holidaySnapshot) {
            for (const day of c.holidaySnapshot.dates) {
                if (day >= c.startDate && day <= c.endDate) result.add(day);
            }
        }
        for (const h of c.localAnnualHolidays) {
            for (let year = Number(c.startDate.slice(0,4)); year <= Number(c.endDate.slice(0,4)); year++) {
                const date = ymdUTC(year,h.month,h.day);
                if (validDate(date) && date >= c.startDate && date <= c.endDate) result.add(date);
            }
        }
        for (const period of c.excludedRanges) {
            const begin = period.startDate > c.startDate ? period.startDate : c.startDate;
            const end = period.endDate < c.endDate ? period.endDate : c.endDate;
            for (let day = begin; day <= end; day = addDays(day, 1)) {
                result.add(day);
            }
        }
        return result;
    }

    function rangeContainsWeekday(start, end, weekdays) {
        // Al massimo 7 controlli: in ogni settimana tutti i giorni ricorrono.
        for (let i = 0, day = start; i < 7 && day <= end; i++, day = addDays(day, 1)) {
            if (weekdays.includes(weekdayAt(dateUTC(day)))) return true;
        }
        return false;
    }

    function weeklyFramesExcluding(slot, calendar, excluded) {
        const make = (startDate, endDate) => ({
            dayAlternation: null,
            endDate,
            fromTime: slot.allDay ? null : slot.fromTime,
            repeatYearly: null,
            startDate,
            timeZone: calendar.timeZone,
            toTime: slot.allDay ? null : slot.toTime,
            weekdays: copy(slot.weekdays)
        });
        const cuts = [...excluded].filter(date =>
            slot.weekdays.includes(weekdayAt(dateUTC(date)))).sort();
        const frames = [];
        let start = calendar.startDate;
        for (const cut of cuts) {
            if (cut < start) continue;
            const end = addDays(cut, -1);
            if (start <= end && rangeContainsWeekday(start, end, slot.weekdays)) {
                frames.push(make(start, end));
            }
            start = addDays(cut, 1);
        }
        if (start <= calendar.endDate &&
            rangeContainsWeekday(start, calendar.endDate, slot.weekdays)) {
            frames.push(make(start, calendar.endDate));
        }
        return frames;
    }

    function calendarFrames(calendar) {
        const cal = normalizeCalendar(calendar);
        const excluded = exclusionSet(cal);
        const hasExclusions = Boolean(cal.holidayCountry) || cal.excludedRanges.length > 0 || cal.localAnnualHolidays.length > 0;
        const frames = [];
        for (const slot of cal.slots) {
            if (hasExclusions) {
                frames.push(...weeklyFramesExcluding(slot, cal, excluded));
            } else {
                frames.push({
                    dayAlternation: null,
                    endDate: cal.endDate,
                    fromTime: slot.allDay ? null : slot.fromTime,
                    repeatYearly: cal.repeatYearly ? true : null,
                    startDate: cal.startDate,
                    timeZone: cal.timeZone,
                    toTime: slot.allDay ? null : slot.toTime,
                    weekdays: copy(slot.weekdays)
                });
            }
        }
        for (const rule of cal.specialRules) {
            for (let year = cal.specialStartYear; year <= cal.specialEndYear; year++) {
                const date = specialDate(rule, year);
                if (!date) continue;
                // Le esclusioni hanno precedenza anche sulle ricorrenze mobili.
                if (excluded.has(date)) continue;
                if (hasExclusions && (date < cal.startDate || date > cal.endDate)) continue;
                const actual = dateUTC(date);
                frames.push({
                    dayAlternation: null,
                    endDate: date,
                    fromTime: rule.allDay ? null : rule.fromTime,
                    repeatYearly: null,
                    startDate: date,
                    timeZone: cal.timeZone,
                    toTime: rule.allDay ? null : rule.toTime,
                    weekdays: [weekdayAt(actual)]
                });
            }
        }
        if (frames.length > MAX_CALENDAR_FRAMES) {
            throw new Error(t("Calendario troppo grande: {count} restrizioni per modello (limite {limit}). Riduci periodo o fasce.", {count:frames.length, limit:MAX_CALENDAR_FRAMES}));
        }
        if (!frames.length) throw new Error(t("Il calendario non ha date attive: controlla le esclusioni e il periodo."));
        return frames;
    }

    function applyFramesToItem(item, frame) {
        const result = {
            data: copy(item.data),
            raw: item.raw ? copy(item.raw) : null,
            motors: copy(item.motors || [])
        };
        // Una restrizione WME per ogni fascia/occorrenza, NON più frame nella stessa.
        result.data.timeFrames = [copy(frame)];
        if (result.raw) result.raw.timeFrames = [copy(frame)];
        return result;
    }

    function templateKey(item) {
        const data = copy(item.data);
        delete data.timeFrames;
        return JSON.stringify({ data, motors: item.motors || [] });
    }

    function expandCalendarItems(items, calendar) {
        const frames = calendarFrames(calendar);
        const seen = new Set();
        const templates = items.filter(item => {
            const key = templateKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        if (templates.length * frames.length > MAX_CALENDAR_FRAMES) {
            throw new Error(t("Troppe restrizioni generate ({templates} × {frames}). Riduci annualità o fasce.", {templates:templates.length,frames:frames.length}));
        }
        return templates.flatMap(item => frames.map(frame => applyFramesToItem(item, frame)));
    }

    function buildCalendarOnlyUpdate(calendar, segment) {
        const original = pairedRestrictions(segment);
        if (!original.length) {
            throw new Error(t("Il segmento {id} non ha restrizioni: prima creane una in WME.", {id:segment.id}));
        }
        return {
            segmentId: segment.id,
            invert: false,
            calendarApplied: true,
            items: expandCalendarItems(original, calendar)
        };
    }

    function refreshCalendarSelects(selectedCalendarId) {
        const metricUpdater = tabPane?.querySelector?.(".rm-shell")?._rmUpdateMetrics || tabPane?._rmUpdateMetrics;
        const items = allCalendars();
        const list = $("#rm-cal-list");
        if (!list) return;
        const previous = selectedCalendarId ?? list.value;
        list.replaceChildren(new Option(t("-- Nuovo calendario --"), ""));
        for (const cal of items) list.appendChild(new Option(cal.name, cal.id));
        list.value = items.some(cal => cal.id === previous) ? previous : "";
        const linked = $("#rm-link-calendar");
        const chosen = linked.value;
        linked.replaceChildren(new Option(t("Nessun calendario — orari originali"), ""));
        for (const cal of items) linked.appendChild(new Option(cal.name, cal.id));
        const name = $("#rm-presets").value;
        const presetCalendar = name && read(name) !== null ? asPreset(read(name)).calendarId : "";
        linked.value = items.some(c => c.id === presetCalendar) ? presetCalendar : "";
        if (typeof metricUpdater === "function") metricUpdater();
    }

    function addSlotRow(slot = {
        weekdays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        allDay: true, fromTime: "08:00", toTime: "09:00"
    }) {
        const wrapper = document.createElement("div");
        wrapper.className = "rm-slot";
        const days = document.createElement("div");
        days.className = "rm-days";
        for (const [day, label] of WEEK_DAYS) {
            const item = document.createElement("label");
            const check = document.createElement("input");
            check.type = "checkbox";
            check.className = "rm-day";
            check.value = day;
            check.checked = slot.weekdays.includes(day);
            item.append(check, document.createTextNode(" " + label));
            days.appendChild(item);
        }
        const controls = document.createElement("div");
        controls.className = "rm-time-row";
        const allday = document.createElement("label");
        const allCheck = document.createElement("input");
        allCheck.type = "checkbox";
        allCheck.className = "rm-allday";
        allCheck.checked = slot.allDay;
        allday.append(allCheck, document.createTextNode(" Tutto il giorno"));
        const from = document.createElement("input");
        from.type = "time";
        from.className = "rm-from";
        from.value = slot.fromTime || "08:00";
        const to = document.createElement("input");
        to.type = "time";
        to.className = "rm-to";
        to.value = slot.toTime || "09:00";
        from.disabled = to.disabled = slot.allDay;
        allCheck.addEventListener("change", () => {
            from.disabled = to.disabled = allCheck.checked;
            previewCalendar();
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "rm-remove-slot";
        remove.textContent = "Rimuovi";
        remove.addEventListener("click", () => {
            wrapper.remove();
            previewCalendar();
        });
        const fromLabel = document.createElement("label");
        fromLabel.textContent = "Dalle";
        fromLabel.appendChild(from);
        const toLabel = document.createElement("label");
        toLabel.textContent = "Alle";
        toLabel.appendChild(to);
        const head = document.createElement("div");
        head.className = "rm-slot-head";
        const slotTitle = document.createElement("strong");
        slotTitle.className = "rm-slot-title";
        slotTitle.textContent = "Fascia settimanale";
        head.append(slotTitle, remove);
        controls.append(allday, fromLabel, toLabel);
        wrapper.append(head, days, controls);
        $("#rm-slots").appendChild(wrapper);
        translateTree(wrapper);
        wrapper.addEventListener("input", previewCalendar);
        wrapper.addEventListener("change", previewCalendar);
    }

    function addSpecialRow(rule = null) {
        const data = rule || {
            kind: "nth_weekday", ordinal: 2, weekday: "SUNDAY", month: 3,
            offsetDays: 0, allDay: true, fromTime: "08:00", toTime: "09:00"
        };
        const box = document.createElement("div");
        box.className = "rm-slot rm-special";
        box.innerHTML = `
          <div class="rm-time-row">
            <label>Ricorrenza <select class="rm-special-kind">
              <option value="nth_weekday">N-esimo giorno del mese</option>
              <option value="easter">Pasqua gregoriana (± giorni)</option>
            </select></label>
          </div>
          <div class="rm-special-nth rm-time-row">
            <label>Settimana <select class="rm-special-ordinal">
              <option value="1">Prima</option><option value="2">Seconda</option>
              <option value="3">Terza</option><option value="4">Quarta</option>
              <option value="5">Quinta</option><option value="-1">Ultima</option>
            </select></label>
            <label>Giorno <select class="rm-special-weekday"></select></label>
            <label>Mese <select class="rm-special-month"></select></label>
          </div>
          <div class="rm-special-easter rm-time-row" hidden>
            <label>Giorni da Pasqua <input type="number" min="-60" max="60" step="1"
              class="rm-special-offset" value="0" style="width:72px"></label>
            <span class="rm-info">0 = Pasqua, +1 = lunedì di Pasqua</span>
          </div>
          <div class="rm-time-row">
            <label><input type="checkbox" class="rm-special-allday"> Tutto il giorno</label>
            <label>Da <input type="time" class="rm-special-from"></label>
            <label>A <input type="time" class="rm-special-to"></label>
            <button type="button" class="rm-special-remove">Rimuovi</button>
          </div>`;
        for (const [key, label] of WEEK_DAYS) {
            box.querySelector(".rm-special-weekday").appendChild(new Option(label, key));
        }
        for (let m = 1; m <= 12; m++) {
            const label = new Intl.DateTimeFormat(localeTag(), { month: "long", timeZone: "UTC" })
                .format(new Date(Date.UTC(2024, m - 1, 1)));
            box.querySelector(".rm-special-month").appendChild(new Option(label, String(m)));
        }
        const q = sel => box.querySelector(sel);
        q(".rm-special-kind").value = data.kind;
        q(".rm-special-ordinal").value = String(data.ordinal);
        q(".rm-special-weekday").value = data.weekday;
        q(".rm-special-month").value = String(data.month);
        q(".rm-special-offset").value = String(data.offsetDays ?? 0);
        q(".rm-special-allday").checked = data.allDay;
        q(".rm-special-from").value = data.fromTime || "08:00";
        q(".rm-special-to").value = data.toTime || "09:00";
        const toggle = () => {
            const easter = q(".rm-special-kind").value === "easter";
            q(".rm-special-easter").hidden = !easter;
            q(".rm-special-nth").hidden = easter;
            q(".rm-special-from").disabled = q(".rm-special-to").disabled = q(".rm-special-allday").checked;
            previewCalendar();
        };
        q(".rm-special-kind").addEventListener("change", toggle);
        q(".rm-special-allday").addEventListener("change", toggle);
        q(".rm-special-remove").addEventListener("click", () => { box.remove(); previewCalendar(); });
        box.addEventListener("input", previewCalendar);
        box.addEventListener("change", previewCalendar);
        $("#rm-special-rows").appendChild(box);
        translateTree(box);
        toggle();
    }

    function addExcludedRow(range = {}) {
        const wrapper = document.createElement("div");
        wrapper.className = "rm-excluded-row rm-subcard";
        wrapper.innerHTML = `
          <div class="rm-stack">
            <div class="rm-field">
              <label>Motivo dell'esclusione (facoltativo)</label>
              <input type="text" class="rm-exclusion-label" maxlength="90" placeholder="Es. Vacanze natalizie o Santo Patrono">
            </div>
            <div class="rm-form-grid">
              <div class="rm-field">
                <label>Dal giorno</label>
                <input type="date" class="rm-exclusion-start">
              </div>
              <div class="rm-field">
                <label>Al giorno (vuoto = un giorno)</label>
                <input type="date" class="rm-exclusion-end">
              </div>
            </div>
            <div class="rm-buttons one-col">
              <button type="button" class="rm-exclusion-remove danger">✕ Rimuovi esclusione</button>
            </div>
          </div>`;
        wrapper.querySelector(".rm-exclusion-start").value = range.startDate || "";
        wrapper.querySelector(".rm-exclusion-end").value = range.endDate !== range.startDate ? (range.endDate || "") : "";
        wrapper.querySelector(".rm-exclusion-label").value = range.label || "";
        wrapper.querySelector(".rm-exclusion-remove").addEventListener("click", () => {
            wrapper.remove();
            previewCalendar();
        });
        wrapper.addEventListener("input", previewCalendar);
        wrapper.addEventListener("change", previewCalendar);
        $("#rm-exclusions").appendChild(wrapper);
        translateTree(wrapper);
    }

    // ISO 3166-1 / ISO 3166-2: static first-level territory names, embedded to
    // avoid network/library dependencies for the choice of country or subdivision.
    // Generated from the pycountry iso-codes catalog (source: Debian iso-codes).
    // Holiday coverage comes from Nager.Date separately; these lists are not a
    // guarantee that a particular region has a separately listed holiday.
    const ISO_COUNTRIES = {"AF":"Afghanistan","AL":"Albania","DZ":"Algeria","AS":"American Samoa","AD":"Andorra","AO":"Angola","AI":"Anguilla","AQ":"Antarctica","AG":"Antigua and Barbuda","AR":"Argentina","AM":"Armenia","AW":"Aruba","AU":"Australia","AT":"Austria","AZ":"Azerbaijan","BS":"Bahamas","BH":"Bahrain","BD":"Bangladesh","BB":"Barbados","BY":"Belarus","BE":"Belgium","BZ":"Belize","BJ":"Benin","BM":"Bermuda","BT":"Bhutan","BO":"Bolivia, Plurinational State of","BQ":"Bonaire, Sint Eustatius and Saba","BA":"Bosnia and Herzegovina","BW":"Botswana","BV":"Bouvet Island","BR":"Brazil","IO":"British Indian Ocean Territory","BN":"Brunei Darussalam","BG":"Bulgaria","BF":"Burkina Faso","BI":"Burundi","CV":"Cabo Verde","KH":"Cambodia","CM":"Cameroon","CA":"Canada","KY":"Cayman Islands","CF":"Central African Republic","TD":"Chad","CL":"Chile","CN":"China","CX":"Christmas Island","CC":"Cocos (Keeling) Islands","CO":"Colombia","KM":"Comoros","CG":"Congo","CD":"Congo, The Democratic Republic of the","CK":"Cook Islands","CR":"Costa Rica","HR":"Croatia","CU":"Cuba","CW":"Curaçao","CY":"Cyprus","CZ":"Czechia","CI":"Côte d'Ivoire","DK":"Denmark","DJ":"Djibouti","DM":"Dominica","DO":"Dominican Republic","EC":"Ecuador","EG":"Egypt","SV":"El Salvador","GQ":"Equatorial Guinea","ER":"Eritrea","EE":"Estonia","SZ":"Eswatini","ET":"Ethiopia","FK":"Falkland Islands (Malvinas)","FO":"Faroe Islands","FJ":"Fiji","FI":"Finland","FR":"France","GF":"French Guiana","PF":"French Polynesia","TF":"French Southern Territories","GA":"Gabon","GM":"Gambia","GE":"Georgia","DE":"Germany","GH":"Ghana","GI":"Gibraltar","GR":"Greece","GL":"Greenland","GD":"Grenada","GP":"Guadeloupe","GU":"Guam","GT":"Guatemala","GG":"Guernsey","GN":"Guinea","GW":"Guinea-Bissau","GY":"Guyana","HT":"Haiti","HM":"Heard Island and McDonald Islands","VA":"Holy See (Vatican City State)","HN":"Honduras","HK":"Hong Kong","HU":"Hungary","IS":"Iceland","IN":"India","ID":"Indonesia","IR":"Iran, Islamic Republic of","IQ":"Iraq","IE":"Ireland","IM":"Isle of Man","IL":"Israel","IT":"Italy","JM":"Jamaica","JP":"Japan","JE":"Jersey","JO":"Jordan","KZ":"Kazakhstan","KE":"Kenya","KI":"Kiribati","KP":"Korea, Democratic People's Republic of","KR":"Korea, Republic of","KW":"Kuwait","KG":"Kyrgyzstan","LA":"Lao People's Democratic Republic","LV":"Latvia","LB":"Lebanon","LS":"Lesotho","LR":"Liberia","LY":"Libya","LI":"Liechtenstein","LT":"Lithuania","LU":"Luxembourg","MO":"Macao","MG":"Madagascar","MW":"Malawi","MY":"Malaysia","MV":"Maldives","ML":"Mali","MT":"Malta","MH":"Marshall Islands","MQ":"Martinique","MR":"Mauritania","MU":"Mauritius","YT":"Mayotte","MX":"Mexico","FM":"Micronesia, Federated States of","MD":"Moldova, Republic of","MC":"Monaco","MN":"Mongolia","ME":"Montenegro","MS":"Montserrat","MA":"Morocco","MZ":"Mozambique","MM":"Myanmar","NA":"Namibia","NR":"Nauru","NP":"Nepal","NL":"Netherlands","NC":"New Caledonia","NZ":"New Zealand","NI":"Nicaragua","NE":"Niger","NG":"Nigeria","NU":"Niue","NF":"Norfolk Island","MK":"North Macedonia","MP":"Northern Mariana Islands","NO":"Norway","OM":"Oman","PK":"Pakistan","PW":"Palau","PS":"Palestine, State of","PA":"Panama","PG":"Papua New Guinea","PY":"Paraguay","PE":"Peru","PH":"Philippines","PN":"Pitcairn","PL":"Poland","PT":"Portugal","PR":"Puerto Rico","QA":"Qatar","RO":"Romania","RU":"Russian Federation","RW":"Rwanda","RE":"Réunion","BL":"Saint Barthélemy","SH":"Saint Helena, Ascension and Tristan da Cunha","KN":"Saint Kitts and Nevis","LC":"Saint Lucia","MF":"Saint Martin (French part)","PM":"Saint Pierre and Miquelon","VC":"Saint Vincent and the Grenadines","WS":"Samoa","SM":"San Marino","ST":"Sao Tome and Principe","SA":"Saudi Arabia","SN":"Senegal","RS":"Serbia","SC":"Seychelles","SL":"Sierra Leone","SG":"Singapore","SX":"Sint Maarten (Dutch part)","SK":"Slovakia","SI":"Slovenia","SB":"Solomon Islands","SO":"Somalia","ZA":"South Africa","GS":"South Georgia and the South Sandwich Islands","SS":"South Sudan","ES":"Spain","LK":"Sri Lanka","SD":"Sudan","SR":"Suriname","SJ":"Svalbard and Jan Mayen","SE":"Sweden","CH":"Switzerland","SY":"Syrian Arab Republic","TW":"Taiwan, Province of China","TJ":"Tajikistan","TZ":"Tanzania, United Republic of","TH":"Thailand","TL":"Timor-Leste","TG":"Togo","TK":"Tokelau","TO":"Tonga","TT":"Trinidad and Tobago","TN":"Tunisia","TM":"Turkmenistan","TC":"Turks and Caicos Islands","TV":"Tuvalu","TR":"Türkiye","UG":"Uganda","UA":"Ukraine","AE":"United Arab Emirates","GB":"United Kingdom","US":"United States","UM":"United States Minor Outlying Islands","UY":"Uruguay","UZ":"Uzbekistan","VU":"Vanuatu","VE":"Venezuela, Bolivarian Republic of","VN":"Viet Nam","VG":"Virgin Islands, British","VI":"Virgin Islands, U.S.","WF":"Wallis and Futuna","EH":"Western Sahara","YE":"Yemen","ZM":"Zambia","ZW":"Zimbabwe","AX":"Åland Islands"};
    const ISO_SUBDIVISIONS = {"AD":[["07","Andorra la Vella"],["02","Canillo"],["03","Encamp"],["08","Escaldes-Engordany"],["04","La Massana"],["05","Ordino"],["06","Sant Julià de Lòria"]],"AE":[["AZ","Abū Z̧aby"],["FU","Al Fujayrah"],["SH","Ash Shāriqah"],["DU","Dubayy"],["RK","Ra’s al Khaymah"],["UQ","Umm al Qaywayn"],["AJ","‘Ajmān"]],"AF":[["BDS","Badakhshān"],["BGL","Baghlān"],["BAL","Balkh"],["BDG","Bādghīs"],["BAM","Bāmyān"],["DAY","Dāykundī"],["FRA","Farāh"],["FYB","Fāryāb"],["GHA","Ghaznī"],["GHO","Ghōr"],["HEL","Helmand"],["HER","Herāt"],["JOW","Jowzjān"],["KAN","Kandahār"],["KHO","Khōst"],["KNR","Kunaṟ"],["KDZ","Kunduz"],["KAB","Kābul"],["KAP","Kāpīsā"],["LAG","Laghmān"],["LOG","Lōgar"],["NAN","Nangarhār"],["NIM","Nīmrōz"],["NUR","Nūristān"],["PIA","Paktiyā"],["PKA","Paktīkā"],["PAN","Panjshayr"],["PAR","Parwān"],["SAM","Samangān"],["SAR","Sar-e Pul"],["TAK","Takhār"],["URU","Uruzgān"],["WAR","Wardak"],["ZAB","Zābul"]],"AG":[["10","Barbuda"],["11","Redonda"],["03","Saint George"],["04","Saint John"],["05","Saint Mary"],["06","Saint Paul"],["07","Saint Peter"],["08","Saint Philip"]],"AL":[["01","Berat"],["09","Dibër"],["02","Durrës"],["03","Elbasan"],["04","Fier"],["05","Gjirokastër"],["06","Korçë"],["07","Kukës"],["08","Lezhë"],["10","Shkodër"],["11","Tiranë"],["12","Vlorë"]],"AM":[["AG","Aragac̣otn"],["AR","Ararat"],["AV","Armavir"],["ER","Erevan"],["GR","Geġark'unik'"],["KT","Kotayk'"],["LO","Loṙi"],["SU","Syunik'"],["TV","Tavuš"],["VD","Vayoć Jor"],["SH","Širak"]],"AO":[["BGO","Bengo"],["BGU","Benguela"],["BIE","Bié"],["CAB","Cabinda"],["CCU","Cuando Cubango"],["CNO","Cuanza-Norte"],["CUS","Cuanza-Sul"],["CNN","Cunene"],["HUA","Huambo"],["HUI","Huíla"],["LUA","Luanda"],["LNO","Lunda-Norte"],["LSU","Lunda-Sul"],["MAL","Malange"],["MOX","Moxico"],["NAM","Namibe"],["UIG","Uíge"],["ZAI","Zaire"]],"AR":[["B","Buenos Aires"],["K","Catamarca"],["H","Chaco"],["U","Chubut"],["C","Ciudad Autónoma de Buenos Aires"],["W","Corrientes"],["X","Córdoba"],["E","Entre Ríos"],["P","Formosa"],["Y","Jujuy"],["L","La Pampa"],["F","La Rioja"],["M","Mendoza"],["N","Misiones"],["Q","Neuquén"],["R","Río Negro"],["A","Salta"],["J","San Juan"],["D","San Luis"],["Z","Santa Cruz"],["S","Santa Fe"],["G","Santiago del Estero"],["V","Tierra del Fuego"],["T","Tucumán"]],"AT":[["1","Burgenland"],["2","Kärnten"],["3","Niederösterreich"],["4","Oberösterreich"],["5","Salzburg"],["6","Steiermark"],["7","Tirol"],["8","Vorarlberg"],["9","Wien"]],"AU":[["ACT","Australian Capital Territory"],["NSW","New South Wales"],["NT","Northern Territory"],["QLD","Queensland"],["SA","South Australia"],["TAS","Tasmania"],["VIC","Victoria"],["WA","Western Australia"]],"AZ":[["ABS","Abşeron"],["AST","Astara"],["AGC","Ağcabədi"],["AGM","Ağdam"],["AGS","Ağdaş"],["AGA","Ağstafa"],["AGU","Ağsu"],["BA","Bakı"],["BAL","Balakən"],["BEY","Beyləqan"],["BIL","Biləsuvar"],["BAR","Bərdə"],["CAB","Cəbrayıl"],["CAL","Cəlilabad"],["DAS","Daşkəsən"],["FUZ","Füzuli"],["GOR","Goranboy"],["GYG","Göygöl"],["GOY","Göyçay"],["GAD","Gədəbəy"],["GA","Gəncə"],["HAC","Hacıqabul"],["IMI","İmişli"],["ISM","İsmayıllı"],["KUR","Kürdəmir"],["KAL","Kəlbəcər"],["LAC","Laçın"],["LER","Lerik"],["LA","Lənkəran"],["LAN","Lənkəran"],["MAS","Masallı"],["MI","Mingəçevir"],["NA","Naftalan"],["NX","Naxçıvan"],["NEF","Neftçala"],["OGU","Oğuz"],["QAX","Qax"],["QAZ","Qazax"],["QOB","Qobustan"],["QBA","Quba"],["QBI","Qubadlı"],["QUS","Qusar"],["QAB","Qəbələ"],["SAT","Saatlı"],["SAB","Sabirabad"],["SAL","Salyan"],["SMX","Samux"],["SIY","Siyəzən"],["SM","Sumqayıt"],["TOV","Tovuz"],["TAR","Tərtər"],["UCA","Ucar"],["XA","Xankəndi"],["XAC","Xaçmaz"],["XCI","Xocalı"],["XVD","Xocavənd"],["XIZ","Xızı"],["YAR","Yardımlı"],["YE","Yevlax"],["YEV","Yevlax"],["ZAQ","Zaqatala"],["ZAN","Zəngilan"],["ZAR","Zərdab"],["SBN","Şabran"],["SMI","Şamaxı"],["SR","Şirvan"],["SUS","Şuşa"],["SA","Şəki"],["SAK","Şəki"],["SKR","Şəmkir"]],"BA":[["BRC","Brčko distrikt"],["BIH","Federacija Bosne i Hercegovine"],["SRP","Republika Srpska"]],"BB":[["01","Christ Church"],["02","Saint Andrew"],["03","Saint George"],["04","Saint James"],["05","Saint John"],["06","Saint Joseph"],["07","Saint Lucy"],["08","Saint Michael"],["09","Saint Peter"],["10","Saint Philip"],["11","Saint Thomas"]],"BD":[["A","Barishal"],["B","Chattogram"],["C","Dhaka"],["D","Khulna"],["H","Mymensingh"],["E","Rajshahi"],["F","Rangpur"],["G","Sylhet"]],"BE":[["BRU","Bruxelles-Capitale, Région de"],["VLG","Vlaams Gewest"],["WAL","wallonne, Région"]],"BF":[["01","Boucle du Mouhoun"],["02","Cascades"],["03","Centre"],["04","Centre-Est"],["05","Centre-Nord"],["06","Centre-Ouest"],["07","Centre-Sud"],["08","Est"],["09","Hauts-Bassins"],["10","Nord"],["11","Plateau-Central"],["12","Sahel"],["13","Sud-Ouest"]],"BG":[["01","Blagoevgrad"],["02","Burgas"],["08","Dobrich"],["07","Gabrovo"],["26","Haskovo"],["09","Kardzhali"],["10","Kyustendil"],["11","Lovech"],["12","Montana"],["13","Pazardzhik"],["14","Pernik"],["15","Pleven"],["16","Plovdiv"],["17","Razgrad"],["18","Ruse"],["27","Shumen"],["19","Silistra"],["20","Sliven"],["21","Smolyan"],["23","Sofia"],["22","Sofia (stolitsa)"],["24","Stara Zagora"],["25","Targovishte"],["03","Varna"],["04","Veliko Tarnovo"],["05","Vidin"],["06","Vratsa"],["28","Yambol"]],"BH":[["14","Al Janūbīyah"],["15","Al Muḩarraq"],["13","Al ‘Āşimah"],["17","Ash Shamālīyah"]],"BI":[["BB","Bubanza"],["BM","Bujumbura Mairie"],["BL","Bujumbura Rural"],["BR","Bururi"],["CA","Cankuzo"],["CI","Cibitoke"],["GI","Gitega"],["KR","Karuzi"],["KY","Kayanza"],["KI","Kirundo"],["MA","Makamba"],["MU","Muramvya"],["MY","Muyinga"],["MW","Mwaro"],["NG","Ngozi"],["RM","Rumonge"],["RT","Rutana"],["RY","Ruyigi"]],"BJ":[["AL","Alibori"],["AK","Atacora"],["AQ","Atlantique"],["BO","Borgou"],["CO","Collines"],["KO","Couffo"],["DO","Donga"],["LI","Littoral"],["MO","Mono"],["OU","Ouémé"],["PL","Plateau"],["ZO","Zou"]],"BN":[["BE","Belait"],["BM","Brunei-Muara"],["TE","Temburong"],["TU","Tutong"]],"BO":[["H","Chuquisaca"],["C","Cochabamba"],["B","El Beni"],["L","La Paz"],["O","Oruro"],["N","Pando"],["P","Potosí"],["S","Santa Cruz"],["T","Tarija"]],"BQ":[["BO","Bonaire"],["SA","Saba"],["SE","Sint Eustatius"]],"BR":[["AC","Acre"],["AL","Alagoas"],["AP","Amapá"],["AM","Amazonas"],["BA","Bahia"],["CE","Ceará"],["DF","Distrito Federal"],["ES","Espírito Santo"],["GO","Goiás"],["MA","Maranhão"],["MT","Mato Grosso"],["MS","Mato Grosso do Sul"],["MG","Minas Gerais"],["PR","Paraná"],["PB","Paraíba"],["PA","Pará"],["PE","Pernambuco"],["PI","Piauí"],["RJ","Rio de Janeiro"],["RN","Rio Grande do Norte"],["RS","Rio Grande do Sul"],["RO","Rondônia"],["RR","Roraima"],["SC","Santa Catarina"],["SE","Sergipe"],["SP","São Paulo"],["TO","Tocantins"]],"BS":[["AK","Acklins"],["BY","Berry Islands"],["BI","Bimini"],["BP","Black Point"],["CI","Cat Island"],["CO","Central Abaco"],["CS","Central Andros"],["CE","Central Eleuthera"],["FP","City of Freeport"],["CK","Crooked Island and Long Cay"],["EG","East Grand Bahama"],["EX","Exuma"],["GC","Grand Cay"],["HI","Harbour Island"],["HT","Hope Town"],["IN","Inagua"],["LI","Long Island"],["MC","Mangrove Cay"],["MG","Mayaguana"],["MI","Moore's Island"],["NP","New Providence"],["NO","North Abaco"],["NS","North Andros"],["NE","North Eleuthera"],["RI","Ragged Island"],["RC","Rum Cay"],["SS","San Salvador"],["SO","South Abaco"],["SA","South Andros"],["SE","South Eleuthera"],["SW","Spanish Wells"],["WG","West Grand Bahama"]],"BT":[["33","Bumthang"],["12","Chhukha"],["22","Dagana"],["GA","Gasa"],["13","Haa"],["44","Lhuentse"],["42","Monggar"],["11","Paro"],["43","Pema Gatshel"],["23","Punakha"],["45","Samdrup Jongkhar"],["14","Samtse"],["31","Sarpang"],["15","Thimphu"],["TY","Trashi Yangtse"],["41","Trashigang"],["32","Trongsa"],["21","Tsirang"],["24","Wangdue Phodrang"],["34","Zhemgang"]],"BW":[["CE","Central"],["CH","Chobe"],["FR","Francistown"],["GA","Gaborone"],["GH","Ghanzi"],["JW","Jwaneng"],["KG","Kgalagadi"],["KL","Kgatleng"],["KW","Kweneng"],["LO","Lobatse"],["NE","North East"],["NW","North West"],["SP","Selibe Phikwe"],["SE","South East"],["SO","Southern"],["ST","Sowa Town"]],"BY":[["BR","Bresckaja voblasć"],["HO","Gomel'skaja oblast'"],["HM","Gorod Minsk"],["HR","Grodnenskaja oblast'"],["MA","Mahilioŭskaja voblasć"],["MI","Minskaja oblast'"],["VI","Viciebskaja voblasć"]],"BZ":[["BZ","Belize"],["CY","Cayo"],["CZL","Corozal"],["OW","Orange Walk"],["SC","Stann Creek"],["TOL","Toledo"]],"CA":[["AB","Alberta"],["BC","British Columbia"],["MB","Manitoba"],["NB","New Brunswick"],["NL","Newfoundland and Labrador"],["NT","Northwest Territories"],["NS","Nova Scotia"],["NU","Nunavut"],["ON","Ontario"],["PE","Prince Edward Island"],["QC","Quebec"],["SK","Saskatchewan"],["YT","Yukon"]],"CD":[["BU","Bas-Uélé"],["HK","Haut-Katanga"],["HL","Haut-Lomami"],["HU","Haut-Uélé"],["IT","Ituri"],["KS","Kasaï"],["KC","Kasaï Central"],["KE","Kasaï Oriental"],["KN","Kinshasa"],["BC","Kongo Central"],["KG","Kwango"],["KL","Kwilu"],["LO","Lomami"],["LU","Lualaba"],["MN","Mai-Ndombe"],["MA","Maniema"],["MO","Mongala"],["NK","Nord-Kivu"],["NU","Nord-Ubangi"],["SA","Sankuru"],["SK","Sud-Kivu"],["SU","Sud-Ubangi"],["TA","Tanganyika"],["TO","Tshopo"],["TU","Tshuapa"],["EQ","Équateur"]],"CF":[["BB","Bamingui-Bangoran"],["BGF","Bangui"],["BK","Basse-Kotto"],["KB","Gribingui"],["HM","Haut-Mbomou"],["HK","Haute-Kotto"],["HS","Haute-Sangha / Mambéré-Kadéï"],["KG","Kémo-Gribingui"],["LB","Lobaye"],["MB","Mbomou"],["NM","Nana-Mambéré"],["MP","Ombella-Mpoko"],["UK","Ouaka"],["AC","Ouham"],["OP","Ouham-Pendé"],["SE","Sangha"],["VK","Vakaga"]],"CG":[["11","Bouenza"],["BZV","Brazzaville"],["8","Cuvette"],["15","Cuvette-Ouest"],["5","Kouilou"],["7","Likouala"],["2","Lékoumou"],["9","Niari"],["14","Plateaux"],["16","Pointe-Noire"],["12","Pool"],["13","Sangha"]],"CH":[["AG","Aargau"],["AR","Appenzell Ausserrhoden"],["AI","Appenzell Innerrhoden"],["BL","Basel-Landschaft"],["BS","Basel-Stadt"],["BE","Berne"],["FR","Fribourg"],["GE","Genève"],["GL","Glarus"],["GR","Graubünden"],["JU","Jura"],["LU","Luzern"],["NE","Neuchâtel"],["NW","Nidwalden"],["OW","Obwalden"],["SG","Sankt Gallen"],["SH","Schaffhausen"],["SZ","Schwyz"],["SO","Solothurn"],["TG","Thurgau"],["TI","Ticino"],["UR","Uri"],["VS","Valais"],["VD","Vaud"],["ZG","Zug"],["ZH","Zürich"]],"CI":[["AB","Abidjan"],["BS","Bas-Sassandra"],["CM","Comoé"],["DN","Denguélé"],["GD","Gôh-Djiboua"],["LC","Lacs"],["LG","Lagunes"],["MG","Montagnes"],["SM","Sassandra-Marahoué"],["SV","Savanes"],["VB","Vallée du Bandama"],["WR","Woroba"],["YM","Yamoussoukro"],["ZZ","Zanzan"]],"CL":[["AI","Aisén del General Carlos Ibañez del Campo"],["AN","Antofagasta"],["AP","Arica y Parinacota"],["AT","Atacama"],["BI","Biobío"],["CO","Coquimbo"],["AR","La Araucanía"],["LI","Libertador General Bernardo O'Higgins"],["LL","Los Lagos"],["LR","Los Ríos"],["MA","Magallanes"],["ML","Maule"],["RM","Región Metropolitana de Santiago"],["TA","Tarapacá"],["VS","Valparaíso"],["NB","Ñuble"]],"CM":[["AD","Adamaoua"],["CE","Centre"],["ES","East"],["EN","Far North"],["LT","Littoral"],["NO","North"],["NW","North-West"],["SU","South"],["SW","South-West"],["OU","West"]],"CN":[["AH","Anhui Sheng"],["BJ","Beijing Shi"],["CQ","Chongqing Shi"],["FJ","Fujian Sheng"],["GS","Gansu Sheng"],["GD","Guangdong Sheng"],["GX","Guangxi Zhuangzu Zizhiqu"],["GZ","Guizhou Sheng"],["HI","Hainan Sheng"],["HE","Hebei Sheng"],["HL","Heilongjiang Sheng"],["HA","Henan Sheng"],["HK","Hong Kong SAR"],["HB","Hubei Sheng"],["HN","Hunan Sheng"],["JS","Jiangsu Sheng"],["JX","Jiangxi Sheng"],["JL","Jilin Sheng"],["LN","Liaoning Sheng"],["MO","Macao SAR"],["NM","Nei Mongol Zizhiqu"],["NX","Ningxia Huizu Zizhiqu"],["QH","Qinghai Sheng"],["SN","Shaanxi Sheng"],["SD","Shandong Sheng"],["SH","Shanghai Shi"],["SX","Shanxi Sheng"],["SC","Sichuan Sheng"],["TW","Taiwan Sheng"],["TJ","Tianjin Shi"],["XJ","Xinjiang Uygur Zizhiqu"],["XZ","Xizang Zizhiqu"],["YN","Yunnan Sheng"],["ZJ","Zhejiang Sheng"]],"CO":[["AMA","Amazonas"],["ANT","Antioquia"],["ARA","Arauca"],["ATL","Atlántico"],["BOL","Bolívar"],["BOY","Boyacá"],["CAL","Caldas"],["CAQ","Caquetá"],["CAS","Casanare"],["CAU","Cauca"],["CES","Cesar"],["CHO","Chocó"],["CUN","Cundinamarca"],["COR","Córdoba"],["DC","Distrito Capital de Bogotá"],["GUA","Guainía"],["GUV","Guaviare"],["HUI","Huila"],["LAG","La Guajira"],["MAG","Magdalena"],["MET","Meta"],["NAR","Nariño"],["NSA","Norte de Santander"],["PUT","Putumayo"],["QUI","Quindío"],["RIS","Risaralda"],["SAP","San Andrés, Providencia y Santa Catalina"],["SAN","Santander"],["SUC","Sucre"],["TOL","Tolima"],["VAC","Valle del Cauca"],["VAU","Vaupés"],["VID","Vichada"]],"CR":[["A","Alajuela"],["C","Cartago"],["G","Guanacaste"],["H","Heredia"],["L","Limón"],["P","Puntarenas"],["SJ","San José"]],"CU":[["15","Artemisa"],["09","Camagüey"],["08","Ciego de Ávila"],["06","Cienfuegos"],["12","Granma"],["14","Guantánamo"],["11","Holguín"],["99","Isla de la Juventud"],["03","La Habana"],["10","Las Tunas"],["04","Matanzas"],["16","Mayabeque"],["01","Pinar del Río"],["07","Sancti Spíritus"],["13","Santiago de Cuba"],["05","Villa Clara"]],"CV":[["B","Ilhas de Barlavento"],["S","Ilhas de Sotavento"]],"CY":[["04","Ammochostos"],["05","Baf"],["06","Girne"],["03","Larnaka"],["01","Lefkosia"],["02","Lemesos"]],"CZ":[["64","Jihomoravský kraj"],["31","Jihočeský kraj"],["41","Karlovarský kraj"],["63","Kraj Vysočina"],["52","Královéhradecký kraj"],["51","Liberecký kraj"],["80","Moravskoslezský kraj"],["71","Olomoucký kraj"],["53","Pardubický kraj"],["32","Plzeňský kraj"],["10","Praha, Hlavní město"],["20","Středočeský kraj"],["72","Zlínský kraj"],["42","Ústecký kraj"]],"DE":[["BW","Baden-Württemberg"],["BY","Bayern"],["BE","Berlin"],["BB","Brandenburg"],["HB","Bremen"],["HH","Hamburg"],["HE","Hessen"],["MV","Mecklenburg-Vorpommern"],["NI","Niedersachsen"],["NW","Nordrhein-Westfalen"],["RP","Rheinland-Pfalz"],["SL","Saarland"],["SN","Sachsen"],["ST","Sachsen-Anhalt"],["SH","Schleswig-Holstein"],["TH","Thüringen"]],"DJ":[["AS","Ali Sabieh"],["AR","Arta"],["DI","Dikhil"],["DJ","Djibouti"],["OB","Obock"],["TA","Tadjourah"]],"DK":[["84","Hovedstaden"],["82","Midtjylland"],["81","Nordjylland"],["85","Sjælland"],["83","Syddanmark"]],"DM":[["02","Saint Andrew"],["03","Saint David"],["04","Saint George"],["05","Saint John"],["06","Saint Joseph"],["07","Saint Luke"],["08","Saint Mark"],["09","Saint Patrick"],["10","Saint Paul"],["11","Saint Peter"]],"DO":[["33","Cibao Nordeste"],["34","Cibao Noroeste"],["35","Cibao Norte"],["36","Cibao Sur"],["37","El Valle"],["38","Enriquillo"],["39","Higuamo"],["40","Ozama"],["41","Valdesia"],["42","Yuma"]],"DZ":[["01","Adrar"],["16","Alger"],["23","Annaba"],["44","Aïn Defla"],["46","Aïn Témouchent"],["05","Batna"],["07","Biskra"],["09","Blida"],["50","Bordj Badji Mokhtar"],["34","Bordj Bou Arréridj"],["10","Bouira"],["35","Boumerdès"],["08","Béchar"],["06","Béjaïa"],["52","Béni Abbès"],["02","Chlef"],["25","Constantine"],["56","Djanet"],["17","Djelfa"],["32","El Bayadh"],["57","El Meghaier"],["58","El Meniaa"],["39","El Oued"],["36","El Tarf"],["47","Ghardaïa"],["24","Guelma"],["33","Illizi"],["54","In Guezzam"],["53","In Salah"],["18","Jijel"],["40","Khenchela"],["03","Laghouat"],["28","M'sila"],["29","Mascara"],["43","Mila"],["27","Mostaganem"],["26","Médéa"],["45","Naama"],["31","Oran"],["30","Ouargla"],["51","Ouled Djellal"],["04","Oum el Bouaghi"],["48","Relizane"],["20","Saïda"],["22","Sidi Bel Abbès"],["21","Skikda"],["41","Souk Ahras"],["19","Sétif"],["11","Tamanrasset"],["14","Tiaret"],["49","Timimoun"],["37","Tindouf"],["42","Tipaza"],["38","Tissemsilt"],["15","Tizi Ouzou"],["13","Tlemcen"],["55","Touggourt"],["12","Tébessa"]],"EC":[["A","Azuay"],["B","Bolívar"],["C","Carchi"],["F","Cañar"],["H","Chimborazo"],["X","Cotopaxi"],["O","El Oro"],["E","Esmeraldas"],["W","Galápagos"],["G","Guayas"],["I","Imbabura"],["L","Loja"],["R","Los Ríos"],["M","Manabí"],["S","Morona Santiago"],["N","Napo"],["D","Orellana"],["Y","Pastaza"],["P","Pichincha"],["SE","Santa Elena"],["SD","Santo Domingo de los Tsáchilas"],["U","Sucumbíos"],["T","Tungurahua"],["Z","Zamora Chinchipe"]],"EE":[["37","Harjumaa"],["39","Hiiumaa"],["45","Ida-Virumaa"],["52","Järvamaa"],["50","Jõgevamaa"],["60","Lääne-Virumaa"],["56","Läänemaa"],["68","Pärnumaa"],["64","Põlvamaa"],["71","Raplamaa"],["74","Saaremaa"],["79","Tartumaa"],["81","Valgamaa"],["84","Viljandimaa"],["87","Võrumaa"]],"EG":[["DK","Ad Daqahlīyah"],["BA","Al Baḩr al Aḩmar"],["BH","Al Buḩayrah"],["FYM","Al Fayyūm"],["GH","Al Gharbīyah"],["ALX","Al Iskandarīyah"],["IS","Al Ismā'īlīyah"],["GZ","Al Jīzah"],["MN","Al Minyā"],["MNF","Al Minūfīyah"],["KB","Al Qalyūbīyah"],["C","Al Qāhirah"],["LX","Al Uqşur"],["WAD","Al Wādī al Jadīd"],["SUZ","As Suways"],["SHR","Ash Sharqīyah"],["ASN","Aswān"],["AST","Asyūţ"],["BNS","Banī Suwayf"],["PTS","Būr Sa‘īd"],["DT","Dumyāţ"],["JS","Janūb Sīnā'"],["KFS","Kafr ash Shaykh"],["MT","Maţrūḩ"],["KN","Qinā"],["SIN","Shamāl Sīnā'"],["SHG","Sūhāj"]],"ER":[["MA","Al Awsaţ"],["DU","Al Janūbī"],["AN","Ansabā"],["DK","Debubawi K’eyyĭḥ Baḥri"],["GB","Gash-Barka"],["SK","Semienawi K’eyyĭḥ Baḥri"]],"ES":[["AN","Andalucía"],["AR","Aragón"],["AS","Asturias, Principado de"],["CN","Canarias"],["CB","Cantabria"],["CL","Castilla y León"],["CM","Castilla-La Mancha"],["CT","Catalunya [Cataluña]"],["CE","Ceuta"],["PV","Euskal Herria"],["EX","Extremadura"],["GA","Galicia [Galicia]"],["IB","Illes Balears [Islas Baleares]"],["RI","La Rioja"],["MD","Madrid, Comunidad de"],["ML","Melilla"],["MC","Murcia, Región de"],["NC","Nafarroako Foru Komunitatea*"],["VC","Valenciana, Comunidad"]],"ET":[["AA","Addis Ababa"],["AF","Afar"],["AM","Amara"],["BE","Benshangul-Gumaz"],["DD","Dire Dawa"],["GA","Gambela Peoples"],["HA","Harari People"],["OR","Oromia"],["SI","Sidama"],["SO","Somali"],["SN","Southern Nations, Nationalities and Peoples"],["SW","Southwest Ethiopia Peoples"],["TI","Tigrai"]],"FI":[["02","Etelä-Karjala"],["03","Etelä-Pohjanmaa"],["04","Etelä-Savo"],["05","Kainuu"],["06","Kanta-Häme"],["07","Keski-Pohjanmaa"],["08","Keski-Suomi"],["09","Kymenlaakso"],["01","Landskapet Åland"],["10","Lappi"],["11","Pirkanmaa"],["12","Pohjanmaa"],["13","Pohjois-Karjala"],["14","Pohjois-Pohjanmaa"],["15","Pohjois-Savo"],["16","Päijät-Häme"],["17","Satakunta"],["18","Uusimaa"],["19","Varsinais-Suomi"]],"FJ":[["C","Central"],["E","Eastern"],["N","Northern"],["R","Rotuma"],["W","Western"]],"FM":[["TRK","Chuuk"],["KSA","Kosrae"],["PNI","Pohnpei"],["YAP","Yap"]],"FR":[["ARA","Auvergne-Rhône-Alpes"],["BFC","Bourgogne-Franche-Comté"],["BRE","Bretagne"],["CVL","Centre-Val de Loire"],["CP","Clipperton"],["20R","Corse"],["GES","Grand-Est"],["971","Guadeloupe"],["973","Guyane (française)"],["HDF","Hauts-de-France"],["974","La Réunion"],["972","Martinique"],["976","Mayotte"],["NOR","Normandie"],["NAQ","Nouvelle-Aquitaine"],["NC","Nouvelle-Calédonie"],["OCC","Occitanie"],["PDL","Pays-de-la-Loire"],["PF","Polynésie française"],["PAC","Provence-Alpes-Côte-d’Azur"],["BL","Saint-Barthélemy"],["MF","Saint-Martin"],["PM","Saint-Pierre-et-Miquelon"],["TF","Terres australes françaises"],["WF","Wallis-et-Futuna"],["IDF","Île-de-France"]],"GA":[["1","Estuaire"],["2","Haut-Ogooué"],["3","Moyen-Ogooué"],["4","Ngounié"],["5","Nyanga"],["6","Ogooué-Ivindo"],["7","Ogooué-Lolo"],["8","Ogooué-Maritime"],["9","Woleu-Ntem"]],"GB":[["ENG","England"],["NIR","Northern Ireland"],["SCT","Scotland"],["WLS","Wales [Cymru GB-CYM]"]],"GD":[["01","Saint Andrew"],["02","Saint David"],["03","Saint George"],["04","Saint John"],["05","Saint Mark"],["06","Saint Patrick"],["10","Southern Grenadine Islands"]],"GE":[["AB","Abkhazia"],["AJ","Ajaria"],["GU","Guria"],["IM","Imereti"],["KA","K'akheti"],["KK","Kvemo Kartli"],["MM","Mtskheta-Mtianeti"],["RL","Rach'a-Lechkhumi-Kvemo Svaneti"],["SZ","Samegrelo-Zemo Svaneti"],["SJ","Samtskhe-Javakheti"],["SK","Shida Kartli"],["TB","Tbilisi"]],"GH":[["AF","Ahafo"],["AH","Ashanti"],["BO","Bono"],["BE","Bono East"],["CP","Central"],["EP","Eastern"],["AA","Greater Accra"],["NE","North East"],["NP","Northern"],["OT","Oti"],["SV","Savannah"],["UE","Upper East"],["UW","Upper West"],["TV","Volta"],["WP","Western"],["WN","Western North"]],"GL":[["AV","Avannaata Kommunia"],["KU","Kommune Kujalleq"],["QT","Kommune Qeqertalik"],["SM","Kommuneqarfik Sermersooq"],["QE","Qeqqata Kommunia"]],"GM":[["B","Banjul"],["M","Central River"],["L","Lower River"],["N","North Bank"],["U","Upper River"],["W","Western"]],"GN":[["B","Boké"],["C","Conakry"],["F","Faranah"],["K","Kankan"],["D","Kindia"],["L","Labé"],["M","Mamou"],["N","Nzérékoré"]],"GQ":[["C","Région Continentale"],["I","Région Insulaire"]],"GR":[["A","Anatolikí Makedonía kai Thráki"],["I","Attikí"],["G","Dytikí Elláda"],["C","Dytikí Makedonía"],["F","Ionía Nísia"],["B","Kentrikí Makedonía"],["M","Kríti"],["L","Nótio Aigaío"],["J","Pelopónnisos"],["H","Stereá Elláda"],["E","Thessalía"],["K","Vóreio Aigaío"],["69","Ágion Óros"],["D","Ípeiros"]],"GT":[["16","Alta Verapaz"],["15","Baja Verapaz"],["04","Chimaltenango"],["20","Chiquimula"],["02","El Progreso"],["05","Escuintla"],["01","Guatemala"],["13","Huehuetenango"],["18","Izabal"],["21","Jalapa"],["22","Jutiapa"],["17","Petén"],["09","Quetzaltenango"],["14","Quiché"],["11","Retalhuleu"],["03","Sacatepéquez"],["12","San Marcos"],["06","Santa Rosa"],["07","Sololá"],["10","Suchitepéquez"],["08","Totonicapán"],["19","Zacapa"]],"GW":[["BS","Bissau"],["L","Leste"],["N","Norte"],["S","Sul"]],"GY":[["BA","Barima-Waini"],["CU","Cuyuni-Mazaruni"],["DE","Demerara-Mahaica"],["EB","East Berbice-Corentyne"],["ES","Essequibo Islands-West Demerara"],["MA","Mahaica-Berbice"],["PM","Pomeroon-Supenaam"],["PT","Potaro-Siparuni"],["UD","Upper Demerara-Berbice"],["UT","Upper Takutu-Upper Essequibo"]],"HN":[["AT","Atlántida"],["CH","Choluteca"],["CL","Colón"],["CM","Comayagua"],["CP","Copán"],["CR","Cortés"],["EP","El Paraíso"],["FM","Francisco Morazán"],["GD","Gracias a Dios"],["IN","Intibucá"],["IB","Islas de la Bahía"],["LP","La Paz"],["LE","Lempira"],["OC","Ocotepeque"],["OL","Olancho"],["SB","Santa Bárbara"],["VA","Valle"],["YO","Yoro"]],"HR":[["07","Bjelovarsko-bilogorska županija"],["12","Brodsko-posavska županija"],["19","Dubrovačko-neretvanska županija"],["21","Grad Zagreb"],["18","Istarska županija"],["04","Karlovačka županija"],["06","Koprivničko-križevačka županija"],["02","Krapinsko-zagorska županija"],["09","Ličko-senjska županija"],["20","Međimurska županija"],["14","Osječko-baranjska županija"],["11","Požeško-slavonska županija"],["08","Primorsko-goranska županija"],["03","Sisačko-moslavačka županija"],["17","Splitsko-dalmatinska županija"],["05","Varaždinska županija"],["10","Virovitičko-podravska županija"],["16","Vukovarsko-srijemska županija"],["13","Zadarska županija"],["01","Zagrebačka županija"],["15","Šibensko-kninska županija"]],"HT":[["AR","Artibonite"],["CE","Centre"],["GA","Grande’Anse"],["NI","Nippes"],["ND","Nord"],["NE","Nord-Est"],["NO","Nord-Ouest"],["OU","Ouest"],["SD","Sud"],["SE","Sud-Est"]],"HU":[["BA","Baranya"],["BZ","Borsod-Abaúj-Zemplén"],["BU","Budapest"],["BK","Bács-Kiskun"],["BE","Békés"],["BC","Békéscsaba"],["CS","Csongrád-Csanád"],["DE","Debrecen"],["DU","Dunaújváros"],["EG","Eger"],["FE","Fejér"],["GY","Győr"],["GS","Győr-Moson-Sopron"],["HB","Hajdú-Bihar"],["HE","Heves"],["HV","Hódmezővásárhely"],["JN","Jász-Nagykun-Szolnok"],["KV","Kaposvár"],["KM","Kecskemét"],["KE","Komárom-Esztergom"],["MI","Miskolc"],["NK","Nagykanizsa"],["NY","Nyíregyháza"],["NO","Nógrád"],["PE","Pest"],["PS","Pécs"],["ST","Salgótarján"],["SO","Somogy"],["SN","Sopron"],["SZ","Szabolcs-Szatmár-Bereg"],["SD","Szeged"],["SS","Szekszárd"],["SK","Szolnok"],["SH","Szombathely"],["SF","Székesfehérvár"],["TB","Tatabánya"],["TO","Tolna"],["VA","Vas"],["VE","Veszprém"],["VM","Veszprém"],["ZA","Zala"],["ZE","Zalaegerszeg"],["ER","Érd"]],"ID":[["JW","Jawa"],["KA","Kalimantan"],["ML","Maluku"],["NU","Nusa Tenggara"],["PP","Papua"],["SL","Sulawesi"],["SM","Sumatera"]],"IE":[["C","Connaught"],["L","Leinster"],["M","Munster"],["U","Ulster"]],"IL":[["M","Al Awsaţ"],["D","Al Janūbī"],["JM","Al Quds"],["Z","Ash Shamālī"],["HA","H̱efa"],["TA","Tall Abīb"]],"IN":[["AN","Andaman and Nicobar Islands"],["AP","Andhra Pradesh"],["AR","Arunāchal Pradesh"],["AS","Assam"],["BR","Bihār"],["CH","Chandīgarh"],["CG","Chhattīsgarh"],["DL","Delhi"],["DH","Dādra and Nagar Haveli and Damān and Diu"],["GA","Goa"],["GJ","Gujarāt"],["HR","Haryāna"],["HP","Himāchal Pradesh"],["JK","Jammu and Kashmīr"],["JH","Jhārkhand"],["KA","Karnātaka"],["KL","Kerala"],["LA","Ladākh"],["LD","Lakshadweep"],["MP","Madhya Pradesh"],["MH","Mahārāshtra"],["MN","Manipur"],["ML","Meghālaya"],["MZ","Mizoram"],["NL","Nāgāland"],["OD","Odisha"],["PY","Puducherry"],["PB","Punjab"],["RJ","Rājasthān"],["SK","Sikkim"],["TN","Tamil Nādu"],["TS","Telangāna"],["TR","Tripura"],["UP","Uttar Pradesh"],["UK","Uttarākhand"],["WB","West Bengal"]],"IQ":[["AN","Al Anbār"],["BA","Al Başrah"],["MU","Al Muthanná"],["QA","Al Qādisīyah"],["NA","An Najaf"],["BG","Baghdād"],["BB","Bābil"],["DQ","Dhī Qār"],["DI","Diyālá"],["KR","Herêm-î Kurdistan"],["KA","Karbalā’"],["KI","Kirkūk"],["MA","Maysān"],["NI","Nīnawá"],["WA","Wāsiţ"],["SD","Şalāḩ ad Dīn"]],"IR":[["30","Alborz"],["24","Ardabīl"],["18","Būshehr"],["14","Chahār Maḩāl va Bakhtīārī"],["10","Eşfahān"],["07","Fārs"],["27","Golestān"],["01","Gīlān"],["13","Hamadān"],["22","Hormozgān"],["08","Kermān"],["05","Kermānshāh"],["29","Khorāsān-e Jonūbī"],["09","Khorāsān-e Raẕavī"],["28","Khorāsān-e Shomālī"],["06","Khūzestān"],["17","Kohgīlūyeh va Bowyer Aḩmad"],["12","Kordestān"],["15","Lorestān"],["00","Markazī"],["02","Māzandarān"],["26","Qazvīn"],["25","Qom"],["20","Semnān"],["11","Sīstān va Balūchestān"],["23","Tehrān"],["21","Yazd"],["19","Zanjān"],["04","Āz̄ārbāyjān-e Ghārbī"],["03","Āz̄ārbāyjān-e Shārqī"],["16","Īlām"]],"IS":[["7","Austurland"],["1","Höfuðborgarsvæði"],["6","Norðurland eystra"],["5","Norðurland vestra"],["8","Suðurland"],["2","Suðurnes"],["4","Vestfirðir"],["3","Vesturland"]],"IT":[["65","Abruzzo"],["77","Basilicata"],["78","Calabria"],["72","Campania"],["45","Emilia-Romagna"],["36","Friuli Venezia Giulia"],["62","Lazio"],["42","Liguria"],["25","Lombardia"],["57","Marche"],["67","Molise"],["21","Piemonte"],["75","Puglia"],["88","Sardegna"],["82","Sicilia"],["52","Toscana"],["32","Trentino-Alto Adige"],["55","Umbria"],["23","Val d'Aoste"],["34","Veneto"]],"JM":[["13","Clarendon"],["09","Hanover"],["01","Kingston"],["12","Manchester"],["04","Portland"],["02","Saint Andrew"],["06","Saint Ann"],["14","Saint Catherine"],["11","Saint Elizabeth"],["08","Saint James"],["05","Saint Mary"],["03","Saint Thomas"],["07","Trelawny"],["10","Westmoreland"]],"JO":[["BA","Al Balqā’"],["KA","Al Karak"],["MA","Al Mafraq"],["AQ","Al ‘Aqabah"],["AM","Al ‘A̅şimah"],["AZ","Az Zarqā’"],["AT","Aţ Ţafīlah"],["IR","Irbid"],["JA","Jarash"],["MN","Ma‘ān"],["MD","Mādabā"],["AJ","‘Ajlūn"]],"JP":[["23","Aichi"],["05","Akita"],["02","Aomori"],["12","Chiba"],["38","Ehime"],["18","Fukui"],["40","Fukuoka"],["07","Fukushima"],["21","Gifu"],["10","Gunma"],["34","Hiroshima"],["01","Hokkaido"],["28","Hyogo"],["08","Ibaraki"],["17","Ishikawa"],["03","Iwate"],["37","Kagawa"],["46","Kagoshima"],["14","Kanagawa"],["39","Kochi"],["43","Kumamoto"],["26","Kyoto"],["24","Mie"],["04","Miyagi"],["45","Miyazaki"],["20","Nagano"],["42","Nagasaki"],["29","Nara"],["15","Niigata"],["44","Oita"],["33","Okayama"],["47","Okinawa"],["27","Osaka"],["41","Saga"],["11","Saitama"],["25","Shiga"],["32","Shimane"],["22","Shizuoka"],["09","Tochigi"],["36","Tokushima"],["13","Tokyo"],["31","Tottori"],["16","Toyama"],["30","Wakayama"],["06","Yamagata"],["35","Yamaguchi"],["19","Yamanashi"]],"KE":[["01","Baringo"],["02","Bomet"],["03","Bungoma"],["04","Busia"],["05","Elgeyo/Marakwet"],["06","Embu"],["07","Garissa"],["08","Homa Bay"],["09","Isiolo"],["10","Kajiado"],["11","Kakamega"],["12","Kericho"],["13","Kiambu"],["14","Kilifi"],["15","Kirinyaga"],["16","Kisii"],["17","Kisumu"],["18","Kitui"],["19","Kwale"],["20","Laikipia"],["21","Lamu"],["22","Machakos"],["23","Makueni"],["24","Mandera"],["25","Marsabit"],["26","Meru"],["27","Migori"],["28","Mombasa"],["29","Murang'a"],["30","Nairobi City"],["31","Nakuru"],["32","Nandi"],["33","Narok"],["34","Nyamira"],["35","Nyandarua"],["36","Nyeri"],["37","Samburu"],["38","Siaya"],["39","Taita/Taveta"],["40","Tana River"],["41","Tharaka-Nithi"],["42","Trans Nzoia"],["43","Turkana"],["44","Uasin Gishu"],["45","Vihiga"],["46","Wajir"],["47","West Pokot"]],"KG":[["B","Batken"],["GB","Bishkek Shaary"],["C","Chuyskaya oblast'"],["J","Dzhalal-Abadskaya oblast'"],["GO","Gorod Osh"],["Y","Issyk-Kul'skaja oblast'"],["N","Naryn"],["O","Osh"],["T","Talas"]],"KH":[["2","Baat Dambang"],["1","Banteay Mean Choăy"],["23","Kaeb"],["3","Kampong Chaam"],["4","Kampong Chhnang"],["5","Kampong Spueu"],["6","Kampong Thum"],["7","Kampot"],["8","Kandaal"],["9","Kaoh Kong"],["10","Kracheh"],["11","Mondol Kiri"],["22","Otdar Mean Chey"],["24","Pailin"],["12","Phnom Penh"],["15","Pousaat"],["18","Preah Sihanouk"],["13","Preah Vihear"],["14","Prey Veaeng"],["16","Rotanak Kiri"],["17","Siem Reab"],["19","Stoĕng Trêng"],["20","Svaay Rieng"],["21","Taakaev"],["25","Tbong Khmum"]],"KI":[["G","Gilbert Islands"],["L","Line Islands"],["P","Phoenix Islands"]],"KM":[["A","Anjouan"],["G","Grande Comore"],["M","Mohéli"]],"KN":[["N","Nevis"],["K","Saint Kitts"]],"KP":[["04","Chagang-do"],["09","Hamgyǒng-bukto"],["08","Hamgyǒng-namdo"],["06","Hwanghae-bukto"],["05","Hwanghae-namdo"],["15","Kaeseong"],["07","Kangweonto"],["14","Nampho"],["03","P'yǒngan-bukto"],["02","P'yǒngan-namdo"],["01","P'yǒngyang"],["13","Raseon"],["10","Ryanggang-do"]],"KR":[["26","Busan-gwangyeoksi"],["43","Chungcheongbuk-do"],["44","Chungcheongnam-do"],["27","Daegu-gwangyeoksi"],["30","Daejeon-gwangyeoksi"],["42","Gangwon-teukbyeoljachido"],["29","Gwangju-gwangyeoksi"],["41","Gyeonggi-do"],["47","Gyeongsangbuk-do"],["48","Gyeongsangnam-do"],["28","Incheon-gwangyeoksi"],["49","Jeju-teukbyeoljachido"],["45","Jeollabuk-do"],["46","Jeollanam-do"],["50","Sejong"],["11","Seoul-teukbyeolsi"],["31","Ulsan-gwangyeoksi"]],"KW":[["AH","Al Aḩmadī"],["FA","Al Farwānīyah"],["JA","Al Jahrā’"],["KU","Al ‘Āşimah"],["MU","Mubārak al Kabīr"],["HA","Ḩawallī"]],"KZ":[["10","Abajskaja oblast’"],["11","Akmolinskaja oblast'"],["15","Aktjubinskaja oblast'"],["19","Almatinskaja oblast'"],["75","Almaty"],["71","Astana"],["23","Atyrauskaja oblast'"],["27","Batys Qazaqstan oblysy"],["35","Karagandinskaja oblast'"],["39","Kostanajskaja oblast'"],["43","Kyzylordinskaja oblast'"],["47","Mangghystaū oblysy"],["55","Pavlodar oblysy"],["59","Severo-Kazahstanskaja oblast'"],["63","Shyghys Qazaqstan oblysy"],["79","Shymkent"],["61","Turkestankaya oblast'"],["62","Ulytauskaja oblast’"],["31","Zhambyl oblysy"],["33","Zhetisū oblysy"]],"LA":[["AT","Attapu"],["BK","Bokèo"],["BL","Bolikhamxai"],["CH","Champasak"],["HO","Houaphan"],["KH","Khammouan"],["LM","Louang Namtha"],["LP","Louangphabang"],["OU","Oudômxai"],["PH","Phôngsali"],["SL","Salavan"],["SV","Savannakhét"],["VI","Viangchan"],["VT","Viangchan"],["XA","Xaignabouli"],["XS","Xaisômboun"],["XI","Xiangkhouang"],["XE","Xékong"]],"LB":[["AK","Aakkâr"],["BI","Al Biqā‘"],["JA","Al Janūb"],["NA","An Nabaţīyah"],["AS","Ash Shimāl"],["BH","Baalbek-Hermel"],["BA","Bayrūt"],["JL","Jabal Lubnān"]],"LC":[["01","Anse la Raye"],["12","Canaries"],["02","Castries"],["03","Choiseul"],["05","Dennery"],["06","Gros Islet"],["07","Laborie"],["08","Micoud"],["10","Soufrière"],["11","Vieux Fort"]],"LI":[["01","Balzers"],["02","Eschen"],["03","Gamprin"],["04","Mauren"],["05","Planken"],["06","Ruggell"],["07","Schaan"],["08","Schellenberg"],["09","Triesen"],["10","Triesenberg"],["11","Vaduz"]],"LK":[["2","Central Province"],["5","Eastern Province"],["7","North Central Province"],["6","North Western Province"],["4","Northern Province"],["9","Sabaragamuwa Province"],["3","Southern Province"],["8","Uva Province"],["1","Western Province"]],"LR":[["BM","Bomi"],["BG","Bong"],["GP","Gbarpolu"],["GB","Grand Bassa"],["CM","Grand Cape Mount"],["GG","Grand Gedeh"],["GK","Grand Kru"],["LO","Lofa"],["MG","Margibi"],["MY","Maryland"],["MO","Montserrado"],["NI","Nimba"],["RI","River Cess"],["RG","River Gee"],["SI","Sinoe"]],"LS":[["D","Berea"],["B","Botha-Bothe"],["C","Leribe"],["E","Mafeteng"],["A","Maseru"],["F","Mohale's Hoek"],["J","Mokhotlong"],["H","Qacha's Nek"],["G","Quthing"],["K","Thaba-Tseka"]],"LT":[["AL","Alytaus apskritis"],["KU","Kauno apskritis"],["KL","Klaipėdos apskritis"],["MR","Marijampolės apskritis"],["PN","Panevėžio apskritis"],["TA","Tauragės apskritis"],["TE","Telšių apskritis"],["UT","Utenos apskritis"],["VL","Vilniaus apskritis"],["SA","Šiaulių apskritis"]],"LU":[["CA","Capellen"],["CL","Clervaux"],["DI","Diekirch"],["EC","Echternach"],["ES","Esch-sur-Alzette"],["GR","Grevenmacher"],["LU","Luxembourg"],["ME","Mersch"],["RD","Redange"],["RM","Remich"],["VD","Vianden"],["WI","Wiltz"]],"LV":[["002","Aizkraukles novads"],["007","Alūksnes novads"],["111","Augšdaugavas novads"],["015","Balvu novads"],["016","Bauskas novads"],["022","Cēsu novads"],["DGV","Daugavpils"],["112","Dienvidkurzemes Novads"],["026","Dobeles novads"],["033","Gulbenes novads"],["JEL","Jelgava"],["041","Jelgavas novads"],["042","Jēkabpils novads"],["JUR","Jūrmala"],["047","Krāslavas novads"],["050","Kuldīgas novads"],["LPX","Liepāja"],["054","Limbažu novads"],["058","Ludzas novads"],["056","Līvānu novads"],["059","Madonas novads"],["062","Mārupes novads"],["067","Ogres novads"],["068","Olaines novads"],["073","Preiļu novads"],["080","Ropažu novads"],["REZ","Rēzekne"],["077","Rēzeknes novads"],["RIX","Rīga"],["087","Salaspils novads"],["088","Saldus novads"],["089","Saulkrastu novads"],["091","Siguldas novads"],["094","Smiltenes novads"],["097","Talsu novads"],["099","Tukuma novads"],["101","Valkas novads"],["113","Valmieras Novads"],["102","Varakļānu novads"],["VEN","Ventspils"],["106","Ventspils novads"],["011","Ādažu novads"],["052","Ķekavas novads"]],"LY":[["BU","Al Buţnān"],["JA","Al Jabal al Akhḑar"],["JG","Al Jabal al Gharbī"],["JI","Al Jafārah"],["JU","Al Jufrah"],["KF","Al Kufrah"],["MJ","Al Marj"],["MB","Al Marqab"],["WA","Al Wāḩāt"],["NQ","An Nuqāţ al Khams"],["ZA","Az Zāwiyah"],["BA","Banghāzī"],["DR","Darnah"],["GT","Ghāt"],["MI","Mişrātah"],["MQ","Murzuq"],["NL","Nālūt"],["SB","Sabhā"],["SR","Surt"],["WD","Wādī al Ḩayāt"],["WS","Wādī ash Shāţi’"],["TB","Ţarābulus"]],"MA":[["05","Béni Mellal-Khénifra"],["06","Casablanca-Settat"],["12","Dakhla-Oued Ed-Dahab (EH)"],["08","Drâa-Tafilalet"],["03","Fès-Meknès"],["10","Guelmim-Oued Noun (EH-partial)"],["02","L'Oriental"],["11","Laâyoune-Sakia El Hamra (EH-partial)"],["07","Marrakech-Safi"],["04","Rabat-Salé-Kénitra"],["09","Souss-Massa"],["01","Tanger-Tétouan-Al Hoceïma"]],"MC":[["FO","Fontvieille"],["JE","Jardin Exotique"],["CL","La Colle"],["CO","La Condamine"],["GA","La Gare"],["SO","La Source"],["LA","Larvotto"],["MA","Malbousquet"],["MO","Monaco-Ville"],["MG","Moneghetti"],["MC","Monte-Carlo"],["MU","Moulins"],["PH","Port-Hercule"],["SR","Saint-Roman"],["SD","Sainte-Dévote"],["SP","Spélugues"],["VR","Vallon de la Rousse"]],"MD":[["AN","Anenii Noi"],["BS","Basarabeasca"],["BD","Bender [Tighina]"],["BR","Briceni"],["BA","Bălți"],["CA","Cahul"],["CT","Cantemir"],["CU","Chișinău"],["CM","Cimișlia"],["CR","Criuleni"],["CL","Călărași"],["CS","Căușeni"],["DO","Dondușeni"],["DR","Drochia"],["DU","Dubăsari"],["ED","Edineț"],["FL","Florești"],["FA","Fălești"],["GL","Glodeni"],["GA","Găgăuzia, Unitatea teritorială autonomă (UTAG)"],["HI","Hîncești"],["IA","Ialoveni"],["LE","Leova"],["NI","Nisporeni"],["OC","Ocnița"],["OR","Orhei"],["RE","Rezina"],["RI","Rîșcani"],["SO","Soroca"],["ST","Strășeni"],["SN","Stînga Nistrului, unitatea teritorială din"],["SI","Sîngerei"],["TA","Taraclia"],["TE","Telenești"],["UN","Ungheni"],["SD","Șoldănești"],["SV","Ștefan Vodă"]],"ME":[["01","Andrijevica"],["02","Bar"],["03","Berane"],["04","Bijelo Polje"],["05","Budva"],["06","Cetinje"],["07","Danilovgrad"],["22","Gusinje"],["08","Herceg-Novi"],["09","Kolašin"],["10","Kotor"],["11","Mojkovac"],["12","Nikšić"],["23","Petnjica"],["13","Plav"],["14","Pljevlja"],["15","Plužine"],["16","Podgorica"],["17","Rožaje"],["19","Tivat"],["24","Tuzi"],["20","Ulcinj"],["25","Zeta"],["18","Šavnik"],["21","Žabljak"]],"MG":[["T","Antananarivo"],["D","Antsiranana"],["F","Fianarantsoa"],["M","Mahajanga"],["A","Toamasina"],["U","Toliara"]],"MH":[["L","Ralik chain"],["T","Ratak chain"]],"MK":[["801","Aerodrom †"],["802","Aračinovo"],["201","Berovo"],["501","Bitola"],["401","Bogdanci"],["601","Bogovinje"],["402","Bosilovo"],["602","Brvenica"],["803","Butel †"],["313","Centar Župa"],["814","Centar †"],["303","Debar"],["304","Debrca"],["203","Delčevo"],["502","Demir Hisar"],["103","Demir Kapija"],["406","Dojran"],["503","Dolneni"],["804","Gazi Baba †"],["405","Gevgelija"],["805","Gjorče Petrov †"],["604","Gostivar"],["102","Gradsko"],["807","Ilinden"],["606","Jegunovce"],["205","Karbinci"],["808","Karpoš †"],["104","Kavadarci"],["809","Kisela Voda †"],["307","Kičevo"],["407","Konče"],["206","Kočani"],["701","Kratovo"],["702","Kriva Palanka"],["504","Krivogaštani"],["505","Kruševo"],["703","Kumanovo"],["704","Lipkovo"],["105","Lozovo"],["207","Makedonska Kamenica"],["308","Makedonski Brod"],["607","Mavrovo i Rostuše"],["506","Mogila"],["106","Negotino"],["507","Novaci"],["408","Novo Selo"],["310","Ohrid"],["208","Pehčevo"],["810","Petrovec"],["311","Plasnica"],["508","Prilep"],["209","Probištip"],["409","Radoviš"],["705","Rankovce"],["509","Resen"],["107","Rosoman"],["811","Saraj †"],["812","Sopište"],["706","Staro Nagoričane"],["312","Struga"],["410","Strumica"],["813","Studeničani"],["108","Sveti Nikole"],["608","Tearce"],["609","Tetovo"],["403","Valandovo"],["404","Vasilevo"],["101","Veles"],["301","Vevčani"],["202","Vinica"],["603","Vrapčište"],["806","Zelenikovo"],["204","Zrnovci"],["815","Čair †"],["109","Čaška"],["210","Češinovo-Obleševo"],["816","Čučer-Sandevo"],["211","Štip"],["817","Šuto Orizari †"],["605","Želino"]],"ML":[["BKO","Bamako"],["7","Gao"],["1","Kayes"],["8","Kidal"],["2","Koulikoro"],["5","Mopti"],["9","Ménaka"],["3","Sikasso"],["4","Ségou"],["10","Taoudénit"],["6","Tombouctou"]],"MM":[["07","Ayeyarwady"],["02","Bago"],["14","Chin"],["11","Kachin"],["12","Kayah"],["13","Kayin"],["03","Magway"],["04","Mandalay"],["15","Mon"],["18","Nay Pyi Taw"],["16","Rakhine"],["01","Sagaing"],["17","Shan"],["05","Tanintharyi"],["06","Yangon"]],"MN":[["073","Arhangay"],["071","Bayan-Ölgiy"],["069","Bayanhongor"],["067","Bulgan"],["037","Darhan uul"],["061","Dornod"],["063","Dornogovĭ"],["059","Dundgovĭ"],["057","Dzavhan"],["065","Govĭ-Altay"],["064","Govĭ-Sümber"],["039","Hentiy"],["043","Hovd"],["041","Hövsgöl"],["035","Orhon"],["049","Selenge"],["051","Sühbaatar"],["047","Töv"],["1","Ulaanbaatar"],["046","Uvs"],["053","Ömnögovĭ"],["055","Övörhangay"]],"MR":[["07","Adrar"],["03","Assaba"],["05","Brakna"],["08","Dakhlet Nouâdhibou"],["04","Gorgol"],["10","Guidimaka"],["01","Hodh ech Chargui"],["02","Hodh el Gharbi"],["12","Inchiri"],["14","Nouakchott Nord"],["13","Nouakchott Ouest"],["15","Nouakchott Sud"],["09","Tagant"],["11","Tiris Zemmour"],["06","Trarza"]],"MT":[["01","Attard"],["02","Balzan"],["03","Birgu"],["04","Birkirkara"],["05","Birżebbuġa"],["06","Bormla"],["07","Dingli"],["08","Fgura"],["09","Floriana"],["10","Fontana"],["11","Gudja"],["13","Għajnsielem"],["14","Għarb"],["15","Għargħur"],["16","Għasri"],["17","Għaxaq"],["12","Gżira"],["19","Iklin"],["20","Isla"],["21","Kalkara"],["22","Kerċem"],["23","Kirkop"],["24","Lija"],["25","Luqa"],["26","Marsa"],["27","Marsaskala"],["28","Marsaxlokk"],["29","Mdina"],["30","Mellieħa"],["32","Mosta"],["33","Mqabba"],["34","Msida"],["35","Mtarfa"],["36","Munxar"],["31","Mġarr"],["37","Nadur"],["38","Naxxar"],["39","Paola"],["40","Pembroke"],["41","Pietà"],["42","Qala"],["43","Qormi"],["44","Qrendi"],["45","Rabat Gozo"],["46","Rabat Malta"],["47","Safi"],["49","Saint John"],["48","Saint Julian's"],["50","Saint Lawrence"],["53","Saint Lucia's"],["51","Saint Paul's Bay"],["52","Sannat"],["54","Santa Venera"],["55","Siġġiewi"],["56","Sliema"],["57","Swieqi"],["58","Ta' Xbiex"],["59","Tarxien"],["60","Valletta"],["61","Xagħra"],["62","Xewkija"],["63","Xgħajra"],["18","Ħamrun"],["64","Żabbar"],["65","Żebbuġ Gozo"],["66","Żebbuġ Malta"],["67","Żejtun"],["68","Żurrieq"]],"MU":[["AG","Agalega Islands"],["BL","Black River"],["CC","Cargados Carajos Shoals"],["FL","Flacq"],["GP","Grand Port"],["MO","Moka"],["PA","Pamplemousses"],["PW","Plaines Wilhems"],["PL","Port Louis"],["RR","Rivière du Rempart"],["RO","Rodrigues Island"],["SA","Savanne"]],"MV":[["01","Addu City"],["03","Faadhippolhu"],["04","Felidhu Atoll"],["29","Fuvammulah"],["05","Hahdhunmathi"],["08","Kolhumadulu"],["MLE","Male"],["26","Male Atoll"],["12","Mulaku Atoll"],["02","North Ari Atoll"],["27","North Huvadhu Atoll"],["13","North Maalhosmadulu"],["24","North Miladhunmadulu"],["14","North Nilandhe Atoll"],["07","North Thiladhunmathi"],["00","South Ari Atoll"],["28","South Huvadhu Atoll"],["20","South Maalhosmadulu"],["25","South Miladhunmadulu"],["17","South Nilandhe Atoll"],["23","South Thiladhunmathi"]],"MW":[["C","Central Region"],["N","Northern Region"],["S","Southern Region"]],"MX":[["AGU","Aguascalientes"],["BCN","Baja California"],["BCS","Baja California Sur"],["CAM","Campeche"],["CHP","Chiapas"],["CHH","Chihuahua"],["CMX","Ciudad de México"],["COA","Coahuila de Zaragoza"],["COL","Colima"],["DUR","Durango"],["GUA","Guanajuato"],["GRO","Guerrero"],["HID","Hidalgo"],["JAL","Jalisco"],["MIC","Michoacán de Ocampo"],["MOR","Morelos"],["MEX","México"],["NAY","Nayarit"],["NLE","Nuevo León"],["OAX","Oaxaca"],["PUE","Puebla"],["QUE","Querétaro"],["ROO","Quintana Roo"],["SLP","San Luis Potosí"],["SIN","Sinaloa"],["SON","Sonora"],["TAB","Tabasco"],["TAM","Tamaulipas"],["TLA","Tlaxcala"],["VER","Veracruz de Ignacio de la Llave"],["YUC","Yucatán"],["ZAC","Zacatecas"]],"MY":[["01","Johor"],["02","Kedah"],["03","Kelantan"],["04","Melaka"],["05","Negeri Sembilan"],["06","Pahang"],["08","Perak"],["09","Perlis"],["07","Pulau Pinang"],["12","Sabah"],["13","Sarawak"],["10","Selangor"],["11","Terengganu"],["14","Wilayah Persekutuan Kuala Lumpur"],["15","Wilayah Persekutuan Labuan"],["16","Wilayah Persekutuan Putrajaya"]],"MZ":[["P","Cabo Delgado"],["G","Gaza"],["I","Inhambane"],["B","Manica"],["L","Maputo"],["MPM","Maputo"],["N","Nampula"],["A","Niassa"],["S","Sofala"],["T","Tete"],["Q","Zambézia"]],"NA":[["KA","//Karas"],["ER","Erongo"],["HA","Hardap"],["KE","Kavango East"],["KW","Kavango West"],["KH","Khomas"],["KU","Kunene"],["OW","Ohangwena"],["OH","Omaheke"],["OS","Omusati"],["ON","Oshana"],["OT","Oshikoto"],["OD","Otjozondjupa"],["CA","Zambezi"]],"NE":[["1","Agadez"],["2","Diffa"],["3","Dosso"],["4","Maradi"],["8","Niamey"],["5","Tahoua"],["6","Tillabéri"],["7","Zinder"]],"NG":[["AB","Abia"],["FC","Abuja Federal Capital Territory"],["AD","Adamawa"],["AK","Akwa Ibom"],["AN","Anambra"],["BA","Bauchi"],["BY","Bayelsa"],["BE","Benue"],["BO","Borno"],["CR","Cross River"],["DE","Delta"],["EB","Ebonyi"],["ED","Edo"],["EK","Ekiti"],["EN","Enugu"],["GO","Gombe"],["IM","Imo"],["JI","Jigawa"],["KD","Kaduna"],["KN","Kano"],["KT","Katsina"],["KE","Kebbi"],["KO","Kogi"],["KW","Kwara"],["LA","Lagos"],["NA","Nasarawa"],["NI","Niger"],["OG","Ogun"],["ON","Ondo"],["OS","Osun"],["OY","Oyo"],["PL","Plateau"],["RI","Rivers"],["SO","Sokoto"],["TA","Taraba"],["YO","Yobe"],["ZA","Zamfara"]],"NI":[["BO","Boaco"],["CA","Carazo"],["CI","Chinandega"],["CO","Chontales"],["AN","Costa Caribe Norte"],["AS","Costa Caribe Sur"],["ES","Estelí"],["GR","Granada"],["JI","Jinotega"],["LE","León"],["MD","Madriz"],["MN","Managua"],["MS","Masaya"],["MT","Matagalpa"],["NS","Nueva Segovia"],["RI","Rivas"],["SJ","Río San Juan"]],"NL":[["AW","Aruba"],["BQ1","Bonaire"],["CW","Curaçao"],["DR","Drenthe"],["FL","Flevoland"],["FR","Fryslân"],["GE","Gelderland"],["GR","Groningen"],["LI","Limburg"],["NB","Noord-Brabant"],["NH","Noord-Holland"],["OV","Overijssel"],["BQ2","Saba"],["BQ3","Sint Eustatius"],["SX","Sint Maarten"],["UT","Utrecht"],["ZE","Zeeland"],["ZH","Zuid-Holland"]],"NO":[["42","Agder"],["34","Innlandet"],["22","Jan Mayen (Arctic Region)"],["15","Møre og Romsdal"],["18","Nordland"],["03","Oslo"],["11","Rogaland"],["54","Romssa ja Finnmárkku"],["21","Svalbard (Arctic Region)"],["50","Trööndelage"],["38","Vestfold og Telemark"],["46","Vestland"],["30","Viken"]],"NP":[["P3","Bagmati"],["P4","Gandaki"],["P6","Karnali"],["P1","Koshi"],["P5","Lumbini"],["P2","Madhesh"],["P7","Sudurpashchim"]],"NR":[["01","Aiwo"],["02","Anabar"],["03","Anetan"],["04","Anibare"],["05","Baitsi"],["06","Boe"],["07","Buada"],["08","Denigomodu"],["09","Ewa"],["10","Ijuw"],["11","Meneng"],["12","Nibok"],["13","Uaboe"],["14","Yaren"]],"NZ":[["AUK","Auckland"],["BOP","Bay of Plenty"],["CAN","Canterbury"],["CIT","Chatham Islands Territory"],["GIS","Gisborne"],["WGN","Greater Wellington"],["HKB","Hawke's Bay"],["MWT","Manawatū-Whanganui"],["MBH","Marlborough"],["NSN","Nelson"],["NTL","Northland"],["OTA","Otago"],["STL","Southland"],["TKI","Taranaki"],["TAS","Tasman"],["WKO","Waikato"],["WTC","West Coast"]],"OM":[["DA","Ad Dākhilīyah"],["BU","Al Buraymī"],["WU","Al Wusţá"],["ZA","Az̧ Z̧āhirah"],["BJ","Janūb al Bāţinah"],["SJ","Janūb ash Sharqīyah"],["MA","Masqaţ"],["MU","Musandam"],["BS","Shamāl al Bāţinah"],["SS","Shamāl ash Sharqīyah"],["ZU","Z̧ufār"]],"PA":[["1","Bocas del Toro"],["4","Chiriquí"],["2","Coclé"],["3","Colón"],["5","Darién"],["EM","Emberá"],["KY","Guna Yala"],["6","Herrera"],["7","Los Santos"],["NT","Naso Tjër Di"],["NB","Ngäbe-Buglé"],["8","Panamá"],["10","Panamá Oeste"],["9","Veraguas"]],"PE":[["AMA","Amarumayu"],["ANC","Ancash"],["APU","Apurimaq"],["ARE","Arequipa"],["AYA","Ayacucho"],["CAJ","Cajamarca"],["CUS","Cusco"],["CAL","El Callao"],["HUV","Huancavelica"],["JUN","Hunin"],["HUC","Huánuco"],["ICA","Ica"],["LAL","La Libertad"],["LAM","Lambayeque"],["LIM","Lima"],["LMA","Lima hatun llaqta"],["LOR","Loreto"],["MDD","Madre de Dios"],["MOQ","Moquegua"],["PAS","Pasco"],["PIU","Piura"],["PUN","Puno"],["SAM","San Martin"],["TAC","Tacna"],["TUM","Tumbes"],["UCA","Ucayali"]],"PG":[["NSB","Bougainville"],["CPM","Central"],["CPK","Chimbu"],["EBR","East New Britain"],["ESW","East Sepik"],["EHG","Eastern Highlands"],["EPW","Enga"],["GPK","Gulf"],["HLA","Hela"],["JWK","Jiwaka"],["MPM","Madang"],["MRL","Manus"],["MBA","Milne Bay"],["MPL","Morobe"],["NCD","National Capital District (Port Moresby)"],["NIK","New Ireland"],["NPP","Northern"],["SHM","Southern Highlands"],["WBK","West New Britain"],["SAN","West Sepik"],["WPD","Western"],["WHM","Western Highlands"]],"PH":[["14","Autonomous Region in Muslim Mindanao (ARMM)"],["05","Bicol (Region V)"],["02","Cagayan Valley (Region II)"],["40","Calabarzon (Region IV-A)"],["13","Caraga (Region XIII)"],["03","Central Luzon (Region III)"],["07","Central Visayas (Region VII)"],["15","Cordillera Administrative Region (CAR)"],["11","Davao (Region XI)"],["08","Eastern Visayas (Region VIII)"],["01","Ilocos (Region I)"],["41","Mimaropa (Region IV-B)"],["00","National Capital Region"],["10","Northern Mindanao (Region X)"],["12","Soccsksargen (Region XII)"],["06","Western Visayas (Region VI)"],["09","Zamboanga Peninsula (Region IX)"]],"PK":[["JK","Azad Jammu and Kashmir"],["BA","Balochistan"],["GB","Gilgit-Baltistan"],["IS","Islamabad"],["KP","Khyber Pakhtunkhwa"],["PB","Punjab"],["SD","Sindh"]],"PL":[["02","Dolnośląskie"],["04","Kujawsko-Pomorskie"],["06","Lubelskie"],["08","Lubuskie"],["14","Mazowieckie"],["12","Małopolskie"],["16","Opolskie"],["18","Podkarpackie"],["20","Podlaskie"],["22","Pomorskie"],["28","Warmińsko-Mazurskie"],["30","Wielkopolskie"],["32","Zachodniopomorskie"],["10","Łódzkie"],["24","Śląskie"],["26","Świętokrzyskie"]],"PS":[["BTH","Bethlehem"],["DEB","Deir El Balah"],["GZA","Gaza"],["HBN","Hebron"],["JEN","Jenin"],["JRH","Jericho and Al Aghwar"],["JEM","Jerusalem"],["KYS","Khan Yunis"],["NBS","Nablus"],["NGZ","North Gaza"],["QQA","Qalqilya"],["RFH","Rafah"],["RBH","Ramallah"],["SLT","Salfit"],["TBS","Tubas"],["TKM","Tulkarm"]],"PT":[["01","Aveiro"],["02","Beja"],["03","Braga"],["04","Bragança"],["05","Castelo Branco"],["06","Coimbra"],["08","Faro"],["09","Guarda"],["10","Leiria"],["11","Lisboa"],["12","Portalegre"],["13","Porto"],["30","Região Autónoma da Madeira"],["20","Região Autónoma dos Açores"],["14","Santarém"],["15","Setúbal"],["16","Viana do Castelo"],["17","Vila Real"],["18","Viseu"],["07","Évora"]],"PW":[["002","Aimeliik"],["004","Airai"],["010","Angaur"],["050","Hatohobei"],["100","Kayangel"],["150","Koror"],["212","Melekeok"],["214","Ngaraard"],["218","Ngarchelong"],["222","Ngardmau"],["224","Ngatpang"],["226","Ngchesar"],["227","Ngeremlengui"],["228","Ngiwal"],["350","Peleliu"],["370","Sonsorol"]],"PY":[["16","Alto Paraguay"],["10","Alto Paraná"],["13","Amambay"],["ASU","Asunción"],["19","Boquerón"],["5","Caaguazú"],["6","Caazapá"],["14","Canindeyú"],["11","Central"],["1","Concepción"],["3","Cordillera"],["4","Guairá"],["7","Itapúa"],["8","Misiones"],["9","Paraguarí"],["15","Presidente Hayes"],["2","San Pedro"],["12","Ñeembucú"]],"QA":[["DA","Ad Dawḩah"],["KH","Al Khawr wa adh Dhakhīrah"],["WA","Al Wakrah"],["RA","Ar Rayyān"],["MS","Ash Shamāl"],["SH","Ash Shīḩānīyah"],["ZA","Az̧ Z̧a‘āyin"],["US","Umm Şalāl"]],"RO":[["AB","Alba"],["AR","Arad"],["AG","Argeș"],["BC","Bacău"],["BH","Bihor"],["BN","Bistrița-Năsăud"],["BT","Botoșani"],["BV","Brașov"],["BR","Brăila"],["B","București"],["BZ","Buzău"],["CS","Caraș-Severin"],["CJ","Cluj"],["CT","Constanța"],["CV","Covasna"],["CL","Călărași"],["DJ","Dolj"],["DB","Dâmbovița"],["GL","Galați"],["GR","Giurgiu"],["GJ","Gorj"],["HR","Harghita"],["HD","Hunedoara"],["IL","Ialomița"],["IS","Iași"],["IF","Ilfov"],["MM","Maramureș"],["MH","Mehedinți"],["MS","Mureș"],["NT","Neamț"],["OT","Olt"],["PH","Prahova"],["SM","Satu Mare"],["SB","Sibiu"],["SV","Suceava"],["SJ","Sălaj"],["TR","Teleorman"],["TM","Timiș"],["TL","Tulcea"],["VS","Vaslui"],["VN","Vrancea"],["VL","Vâlcea"]],"RS":[["00","Beograd"],["14","Borski okrug"],["11","Braničevski okrug"],["23","Jablanički okrug"],["09","Kolubarski okrug"],["KM","Kosovo-Metohija"],["08","Mačvanski okrug"],["17","Moravički okrug"],["20","Nišavski okrug"],["22","Pirotski okrug"],["10","Podunavski okrug"],["13","Pomoravski okrug"],["24","Pčinjski okrug"],["19","Rasinski okrug"],["18","Raški okrug"],["21","Toplički okrug"],["VO","Vojvodina"],["15","Zaječarski okrug"],["16","Zlatiborski okrug"],["12","Šumadijski okrug"]],"RU":[["AD","Adygeja, Respublika"],["AL","Altaj, Respublika"],["ALT","Altajskij kraj"],["AMU","Amurskaja oblast'"],["ARK","Arhangel'skaja oblast'"],["AST","Astrahanskaja oblast'"],["BA","Bashkortostan, Respublika"],["BEL","Belgorodskaja oblast'"],["BRY","Brjanskaja oblast'"],["BU","Burjatija, Respublika"],["CE","Chechenskaya Respublika"],["CHE","Chelyabinskaya oblast'"],["CHU","Chukotskiy avtonomnyy okrug"],["CU","Chuvashskaya Respublika"],["DA","Dagestan, Respublika"],["YEV","Evrejskaja avtonomnaja oblast'"],["KHA","Habarovskij kraj"],["KK","Hakasija, Respublika"],["KHM","Hanty-Mansijskij avtonomnyj okrug"],["IN","Ingushetiya, Respublika"],["IRK","Irkutskaja oblast'"],["IVA","Ivanovskaja oblast'"],["YAN","Jamalo-Neneckij avtonomnyj okrug"],["YAR","Jaroslavskaja oblast'"],["KB","Kabardino-Balkarskaja Respublika"],["KGD","Kaliningradskaja oblast'"],["KL","Kalmykija, Respublika"],["KLU","Kaluzhskaya oblast'"],["KAM","Kamchatskiy kray"],["KC","Karachayevo-Cherkesskaya Respublika"],["KR","Karelija, Respublika"],["KEM","Kemerovskaja oblast'"],["KIR","Kirovskaja oblast'"],["KO","Komi, Respublika"],["KOS","Kostromskaja oblast'"],["KDA","Krasnodarskij kraj"],["KYA","Krasnojarskij kraj"],["KGN","Kurganskaja oblast'"],["KRS","Kurskaja oblast'"],["LEN","Leningradskaja oblast'"],["LIP","Lipeckaja oblast'"],["MAG","Magadanskaja oblast'"],["ME","Marij Èl, Respublika"],["MO","Mordovija, Respublika"],["MOS","Moskovskaja oblast'"],["MOW","Moskva"],["MUR","Murmanskaja oblast'"],["NEN","Neneckij avtonomnyj okrug"],["NIZ","Nizhegorodskaya oblast'"],["NGR","Novgorodskaja oblast'"],["NVS","Novosibirskaja oblast'"],["OMS","Omskaja oblast'"],["ORE","Orenburgskaja oblast'"],["ORL","Orlovskaja oblast'"],["PNZ","Penzenskaja oblast'"],["PER","Permskij kraj"],["PRI","Primorskij kraj"],["PSK","Pskovskaja oblast'"],["RYA","Rjazanskaja oblast'"],["ROS","Rostovskaja oblast'"],["SA","Saha, Respublika"],["SAK","Sahalinskaja oblast'"],["SAM","Samarskaja oblast'"],["SPE","Sankt-Peterburg"],["SAR","Saratovskaja oblast'"],["SE","Severnaja Osetija, Respublika"],["SMO","Smolenskaja oblast'"],["STA","Stavropol'skij kraj"],["SVE","Sverdlovskaja oblast'"],["TAM","Tambovskaja oblast'"],["TA","Tatarstan, Respublika"],["TYU","Tjumenskaja oblast'"],["TOM","Tomskaja oblast'"],["TUL","Tul'skaja oblast'"],["TVE","Tverskaja oblast'"],["TY","Tyva, Respublika"],["UD","Udmurtskaja Respublika"],["ULY","Ul'janovskaja oblast'"],["VLA","Vladimirskaja oblast'"],["VGG","Volgogradskaja oblast'"],["VLG","Vologodskaja oblast'"],["VOR","Voronezhskaya oblast'"],["ZAB","Zabajkal'skij kraj"]],"RW":[["01","City of Kigali"],["02","Eastern"],["03","Northern"],["05","Southern"],["04","Western"]],"SA":[["14","'Asīr"],["11","Al Bāḩah"],["12","Al Jawf"],["03","Al Madīnah al Munawwarah"],["05","Al Qaşīm"],["08","Al Ḩudūd ash Shamālīyah"],["01","Ar Riyāḑ"],["04","Ash Sharqīyah"],["09","Jāzān"],["02","Makkah al Mukarramah"],["10","Najrān"],["07","Tabūk"],["06","Ḩā'il"]],"SB":[["CT","Capital Territory (Honiara)"],["CE","Central"],["CH","Choiseul"],["GU","Guadalcanal"],["IS","Isabel"],["MK","Makira-Ulawa"],["ML","Malaita"],["RB","Rennell and Bellona"],["TE","Temotu"],["WE","Western"]],"SC":[["01","Anse aux Pins"],["02","Anse Boileau"],["03","Anse Etoile"],["05","Anse Royale"],["04","Au Cap"],["06","Baie Lazare"],["07","Baie Sainte Anne"],["08","Beau Vallon"],["09","Bel Air"],["10","Bel Ombre"],["11","Cascade"],["16","English River"],["12","Glacis"],["13","Grand Anse Mahe"],["14","Grand Anse Praslin"],["26","Ile Perseverance I"],["27","Ile Perseverance II"],["15","La Digue"],["24","Les Mamelles"],["17","Mont Buxton"],["18","Mont Fleuri"],["19","Plaisance"],["20","Pointe Larue"],["21","Port Glaud"],["25","Roche Caiman"],["22","Saint Louis"],["23","Takamaka"]],"SD":[["NB","Blue Nile"],["DC","Central Darfur"],["DE","East Darfur"],["GD","Gedaref"],["GZ","Gezira"],["KA","Kassala"],["KH","Khartoum"],["DN","North Darfur"],["KN","North Kordofan"],["NO","Northern"],["RS","Red Sea"],["NR","River Nile"],["SI","Sennar"],["DS","South Darfur"],["KS","South Kordofan"],["DW","West Darfur"],["GK","West Kordofan"],["NW","White Nile"]],"SE":[["K","Blekinge län [SE-10]"],["W","Dalarnas län [SE-20]"],["I","Gotlands län [SE-09]"],["X","Gävleborgs län [SE-21]"],["N","Hallands län [SE-13]"],["Z","Jämtlands län [SE-23]"],["F","Jönköpings län [SE-06]"],["H","Kalmar län [SE-08]"],["G","Kronobergs län [SE-07]"],["BD","Norrbottens län [SE-25]"],["M","Skåne län [SE-12]"],["AB","Stockholms län [SE-01]"],["D","Södermanlands län [SE-04]"],["C","Uppsala län [SE-03]"],["S","Värmlands län [SE-17]"],["AC","Västerbottens län [SE-24]"],["Y","Västernorrlands län [SE-22]"],["U","Västmanlands län [SE-19]"],["O","Västra Götalands län [SE-14]"],["T","Örebro län [SE-18]"],["E","Östergötlands län [SE-05]"]],"SG":[["01","Central Singapore"],["02","North East"],["03","North West"],["04","South East"],["05","South West"]],"SH":[["AC","Ascension"],["HL","Saint Helena"],["TA","Tristan da Cunha"]],"SI":[["001","Ajdovščina"],["213","Ankaran"],["195","Apače"],["002","Beltinci"],["148","Benedikt"],["149","Bistrica ob Sotli"],["003","Bled"],["150","Bloke"],["004","Bohinj"],["005","Borovnica"],["006","Bovec"],["151","Braslovče"],["007","Brda"],["008","Brezovica"],["009","Brežice"],["152","Cankova"],["011","Celje"],["012","Cerklje na Gorenjskem"],["013","Cerknica"],["014","Cerkno"],["153","Cerkvenjak"],["196","Cirkulane"],["018","Destrnik"],["019","Divača"],["154","Dobje"],["020","Dobrepolje"],["155","Dobrna"],["021","Dobrova-Polhov Gradec"],["156","Dobrovnik"],["022","Dol pri Ljubljani"],["157","Dolenjske Toplice"],["023","Domžale"],["024","Dornava"],["025","Dravograd"],["026","Duplek"],["027","Gorenja vas-Poljane"],["028","Gorišnica"],["207","Gorje"],["029","Gornja Radgona"],["030","Gornji Grad"],["031","Gornji Petrovci"],["158","Grad"],["032","Grosuplje"],["159","Hajdina"],["161","Hodoš"],["162","Horjul"],["160","Hoče-Slivnica"],["034","Hrastnik"],["035","Hrpelje-Kozina"],["036","Idrija"],["037","Ig"],["038","Ilirska Bistrica"],["039","Ivančna Gorica"],["040","Izola"],["041","Jesenice"],["163","Jezersko"],["042","Juršinci"],["043","Kamnik"],["044","Kanal ob Soči"],["045","Kidričevo"],["046","Kobarid"],["047","Kobilje"],["049","Komen"],["164","Komenda"],["050","Koper"],["197","Kostanjevica na Krki"],["165","Kostel"],["051","Kozje"],["048","Kočevje"],["052","Kranj"],["053","Kranjska Gora"],["166","Križevci"],["054","Krško"],["055","Kungota"],["056","Kuzma"],["057","Laško"],["058","Lenart"],["059","Lendava"],["060","Litija"],["061","Ljubljana"],["062","Ljubno"],["063","Ljutomer"],["208","Log-Dragomer"],["064","Logatec"],["167","Lovrenc na Pohorju"],["065","Loška dolina"],["066","Loški Potok"],["068","Lukovica"],["067","Luče"],["069","Majšperk"],["198","Makole"],["070","Maribor"],["168","Markovci"],["071","Medvode"],["072","Mengeš"],["073","Metlika"],["074","Mežica"],["169","Miklavž na Dravskem polju"],["075","Miren-Kostanjevica"],["212","Mirna"],["170","Mirna Peč"],["076","Mislinja"],["199","Mokronog-Trebelno"],["078","Moravske Toplice"],["077","Moravče"],["079","Mozirje"],["080","Murska Sobota"],["081","Muta"],["082","Naklo"],["083","Nazarje"],["084","Nova Gorica"],["085","Novo Mesto"],["086","Odranci"],["171","Oplotnica"],["087","Ormož"],["088","Osilnica"],["089","Pesnica"],["090","Piran"],["091","Pivka"],["172","Podlehnik"],["093","Podvelka"],["092","Podčetrtek"],["200","Poljčane"],["173","Polzela"],["094","Postojna"],["174","Prebold"],["095","Preddvor"],["175","Prevalje"],["096","Ptuj"],["097","Puconci"],["100","Radenci"],["099","Radeče"],["101","Radlje ob Dravi"],["102","Radovljica"],["103","Ravne na Koroškem"],["176","Razkrižje"],["098","Rače-Fram"],["201","Renče-Vogrsko"],["209","Rečica ob Savinji"],["104","Ribnica"],["177","Ribnica na Pohorju"],["107","Rogatec"],["106","Rogaška Slatina"],["105","Rogašovci"],["108","Ruše"],["178","Selnica ob Dravi"],["109","Semič"],["110","Sevnica"],["111","Sežana"],["112","Slovenj Gradec"],["113","Slovenska Bistrica"],["114","Slovenske Konjice"],["179","Sodražica"],["180","Solčava"],["202","Središče ob Dravi"],["115","Starše"],["203","Straža"],["181","Sveta Ana"],["204","Sveta Trojica v Slovenskih goricah"],["182","Sveti Andraž v Slovenskih goricah"],["116","Sveti Jurij ob Ščavnici"],["210","Sveti Jurij v Slovenskih goricah"],["205","Sveti Tomaž"],["184","Tabor"],["010","Tišina"],["128","Tolmin"],["129","Trbovlje"],["130","Trebnje"],["185","Trnovska Vas"],["186","Trzin"],["131","Tržič"],["132","Turnišče"],["133","Velenje"],["187","Velika Polana"],["134","Velike Lašče"],["188","Veržej"],["135","Videm"],["136","Vipava"],["137","Vitanje"],["138","Vodice"],["139","Vojnik"],["189","Vransko"],["140","Vrhnika"],["141","Vuzenica"],["142","Zagorje ob Savi"],["143","Zavrč"],["144","Zreče"],["015","Črenšovci"],["016","Črna na Koroškem"],["017","Črnomelj"],["033","Šalovci"],["183","Šempeter-Vrtojba"],["118","Šentilj"],["119","Šentjernej"],["120","Šentjur"],["211","Šentrupert"],["117","Šenčur"],["121","Škocjan"],["122","Škofja Loka"],["123","Škofljica"],["124","Šmarje pri Jelšah"],["206","Šmarješke Toplice"],["125","Šmartno ob Paki"],["194","Šmartno pri Litiji"],["126","Šoštanj"],["127","Štore"],["190","Žalec"],["146","Železniki"],["191","Žetale"],["147","Žiri"],["192","Žirovnica"],["193","Žužemberk"]],"SK":[["BC","Banskobystrický kraj"],["BL","Bratislavský kraj"],["KI","Košický kraj"],["NI","Nitriansky kraj"],["PV","Prešovský kraj"],["TC","Trenčiansky kraj"],["TA","Trnavský kraj"],["ZI","Žilinský kraj"]],"SL":[["E","Eastern"],["NW","North Western"],["N","Northern"],["S","Southern"],["W","Western Area (Freetown)"]],"SM":[["01","Acquaviva"],["06","Borgo Maggiore"],["02","Chiesanuova"],["07","Città di San Marino"],["03","Domagnano"],["04","Faetano"],["05","Fiorentino"],["08","Montegiardino"],["09","Serravalle"]],"SN":[["DK","Dakar"],["DB","Diourbel"],["FK","Fatick"],["KA","Kaffrine"],["KL","Kaolack"],["KD","Kolda"],["KE","Kédougou"],["LG","Louga"],["MT","Matam"],["SL","Saint-Louis"],["SE","Sédhiou"],["TC","Tambacounda"],["TH","Thiès"],["ZG","Ziguinchor"]],"SO":[["AW","Awdal"],["BK","Bakool"],["BN","Banaadir"],["BR","Bari"],["BY","Bay"],["GA","Galguduud"],["GE","Gedo"],["HI","Hiiraan"],["JD","Jubbada Dhexe"],["JH","Jubbada Hoose"],["MU","Mudug"],["NU","Nugaal"],["SA","Sanaag"],["SD","Shabeellaha Dhexe"],["SH","Shabeellaha Hoose"],["SO","Sool"],["TO","Togdheer"],["WO","Woqooyi Galbeed"]],"SR":[["BR","Brokopondo"],["CM","Commewijne"],["CR","Coronie"],["MA","Marowijne"],["NI","Nickerie"],["PR","Para"],["PM","Paramaribo"],["SA","Saramacca"],["SI","Sipaliwini"],["WA","Wanica"]],"SS":[["EC","Central Equatoria"],["EE","Eastern Equatoria"],["JG","Jonglei"],["LK","Lakes"],["BN","Northern Bahr el Ghazal"],["UY","Unity"],["NU","Upper Nile"],["WR","Warrap"],["BW","Western Bahr el Ghazal"],["EW","Western Equatoria"]],"ST":[["02","Cantagalo"],["03","Caué"],["04","Lembá"],["05","Lobata"],["06","Mé-Zóchi"],["P","Príncipe"],["01","Água Grande"]],"SV":[["AH","Ahuachapán"],["CA","Cabañas"],["CH","Chalatenango"],["CU","Cuscatlán"],["LI","La Libertad"],["PA","La Paz"],["UN","La Unión"],["MO","Morazán"],["SM","San Miguel"],["SS","San Salvador"],["SV","San Vicente"],["SA","Santa Ana"],["SO","Sonsonate"],["US","Usulután"]],"SY":[["LA","Al Lādhiqīyah"],["QU","Al Qunayţirah"],["HA","Al Ḩasakah"],["RA","Ar Raqqah"],["SU","As Suwaydā'"],["DR","Dar'ā"],["DY","Dayr az Zawr"],["DI","Dimashq"],["ID","Idlib"],["RD","Rīf Dimashq"],["TA","Ţarţūs"],["HL","Ḩalab"],["HM","Ḩamāh"],["HI","Ḩimş"]],"SZ":[["HH","Hhohho"],["LU","Lubombo"],["MA","Manzini"],["SH","Shiselweni"]],"TD":[["BG","Bahr el Ghazal"],["BA","Batha"],["BO","Borkou"],["CB","Chari-Baguirmi"],["EE","Ennedi-Est"],["EO","Ennedi-Ouest"],["GR","Guéra"],["HL","Hadjer Lamis"],["KA","Kanem"],["LC","Lac"],["LO","Logone-Occidental"],["LR","Logone-Oriental"],["MA","Mandoul"],["ME","Mayo-Kebbi-Est"],["MO","Mayo-Kebbi-Ouest"],["MC","Moyen-Chari"],["OD","Ouaddaï"],["SA","Salamat"],["SI","Sila"],["TA","Tandjilé"],["TI","Tibesti"],["ND","Ville de Ndjamena"],["WF","Wadi Fira"]],"TG":[["C","Centrale"],["K","Kara"],["M","Maritime (Région)"],["P","Plateaux"],["S","Savanes"]],"TH":[["37","Amnat Charoen"],["15","Ang Thong"],["38","Bueng Kan"],["31","Buri Ram"],["24","Chachoengsao"],["18","Chai Nat"],["36","Chaiyaphum"],["22","Chanthaburi"],["50","Chiang Mai"],["57","Chiang Rai"],["20","Chon Buri"],["86","Chumphon"],["46","Kalasin"],["62","Kamphaeng Phet"],["71","Kanchanaburi"],["40","Khon Kaen"],["81","Krabi"],["10","Krung Thep Maha Nakhon"],["52","Lampang"],["51","Lamphun"],["42","Loei"],["16","Lop Buri"],["58","Mae Hong Son"],["44","Maha Sarakham"],["49","Mukdahan"],["26","Nakhon Nayok"],["73","Nakhon Pathom"],["48","Nakhon Phanom"],["30","Nakhon Ratchasima"],["60","Nakhon Sawan"],["80","Nakhon Si Thammarat"],["55","Nan"],["96","Narathiwat"],["39","Nong Bua Lam Phu"],["43","Nong Khai"],["12","Nonthaburi"],["13","Pathum Thani"],["94","Pattani"],["82","Phangnga"],["93","Phatthalung"],["S","Phatthaya"],["56","Phayao"],["67","Phetchabun"],["76","Phetchaburi"],["66","Phichit"],["65","Phitsanulok"],["14","Phra Nakhon Si Ayutthaya"],["54","Phrae"],["83","Phuket"],["25","Prachin Buri"],["77","Prachuap Khiri Khan"],["85","Ranong"],["70","Ratchaburi"],["21","Rayong"],["45","Roi Et"],["27","Sa Kaeo"],["47","Sakon Nakhon"],["11","Samut Prakan"],["74","Samut Sakhon"],["75","Samut Songkhram"],["19","Saraburi"],["91","Satun"],["33","Si Sa Ket"],["17","Sing Buri"],["90","Songkhla"],["64","Sukhothai"],["72","Suphan Buri"],["84","Surat Thani"],["32","Surin"],["63","Tak"],["92","Trang"],["23","Trat"],["34","Ubon Ratchathani"],["41","Udon Thani"],["61","Uthai Thani"],["53","Uttaradit"],["95","Yala"],["35","Yasothon"]],"TJ":[["DU","Dushanbe"],["KT","Khatlon"],["GB","Kŭhistoni Badakhshon"],["RA","nohiyahoi tobei jumhurí"],["SU","Sughd"]],"TL":[["AL","Aileu"],["AN","Ainaro"],["BA","Baucau"],["BO","Bobonaro"],["CO","Cova Lima"],["DI","Díli"],["ER","Ermera"],["LA","Lautein"],["LI","Likisá"],["MT","Manatuto"],["MF","Manufahi"],["OE","Oekusi-Ambenu"],["VI","Vikeke"]],"TM":[["A","Ahal"],["S","Aşgabat"],["B","Balkan"],["D","Daşoguz"],["L","Lebap"],["M","Mary"]],"TN":[["13","Ben Arous"],["23","Bizerte"],["31","Béja"],["81","Gabès"],["71","Gafsa"],["32","Jendouba"],["41","Kairouan"],["42","Kasserine"],["73","Kébili"],["12","L'Ariana"],["14","La Manouba"],["33","Le Kef"],["53","Mahdia"],["52","Monastir"],["82","Médenine"],["21","Nabeul"],["61","Sfax"],["43","Sidi Bouzid"],["34","Siliana"],["51","Sousse"],["83","Tataouine"],["72","Tozeur"],["11","Tunis"],["22","Zaghouan"]],"TO":[["01","'Eua"],["02","Ha'apai"],["03","Niuas"],["04","Tongatapu"],["05","Vava'u"]],"TR":[["01","Adana"],["02","Adıyaman"],["03","Afyonkarahisar"],["68","Aksaray"],["05","Amasya"],["06","Ankara"],["07","Antalya"],["75","Ardahan"],["08","Artvin"],["09","Aydın"],["04","Ağrı"],["10","Balıkesir"],["74","Bartın"],["72","Batman"],["69","Bayburt"],["11","Bilecik"],["12","Bingöl"],["13","Bitlis"],["14","Bolu"],["15","Burdur"],["16","Bursa"],["20","Denizli"],["21","Diyarbakır"],["81","Düzce"],["22","Edirne"],["23","Elazığ"],["24","Erzincan"],["25","Erzurum"],["26","Eskişehir"],["27","Gaziantep"],["28","Giresun"],["29","Gümüşhane"],["30","Hakkâri"],["31","Hatay"],["32","Isparta"],["76","Iğdır"],["34","İstanbul"],["35","İzmir"],["46","Kahramanmaraş"],["78","Karabük"],["70","Karaman"],["36","Kars"],["37","Kastamonu"],["38","Kayseri"],["79","Kilis"],["41","Kocaeli"],["42","Konya"],["43","Kütahya"],["39","Kırklareli"],["71","Kırıkkale"],["40","Kırşehir"],["44","Malatya"],["45","Manisa"],["47","Mardin"],["33","Mersin"],["48","Muğla"],["49","Muş"],["50","Nevşehir"],["51","Niğde"],["52","Ordu"],["80","Osmaniye"],["53","Rize"],["54","Sakarya"],["55","Samsun"],["56","Siirt"],["57","Sinop"],["58","Sivas"],["59","Tekirdağ"],["60","Tokat"],["61","Trabzon"],["62","Tunceli"],["64","Uşak"],["65","Van"],["77","Yalova"],["66","Yozgat"],["67","Zonguldak"],["17","Çanakkale"],["18","Çankırı"],["19","Çorum"],["63","Şanlıurfa"],["73","Şırnak"]],"TT":[["ARI","Arima"],["CHA","Chaguanas"],["CTT","Couva-Tabaquite-Talparo"],["DMN","Diego Martin"],["MRC","Mayaro-Rio Claro"],["PED","Penal-Debe"],["PTF","Point Fortin"],["POS","Port of Spain"],["PRT","Princes Town"],["SFO","San Fernando"],["SJL","San Juan-Laventille"],["SGE","Sangre Grande"],["SIP","Siparia"],["TOB","Tobago"],["TUP","Tunapuna-Piarco"]],"TV":[["FUN","Funafuti"],["NMG","Nanumaga"],["NMA","Nanumea"],["NIT","Niutao"],["NUI","Nui"],["NKF","Nukufetau"],["NKL","Nukulaelae"],["VAI","Vaitupu"]],"TW":[["CHA","Changhua"],["CYI","Chiayi"],["CYQ","Chiayi"],["HSQ","Hsinchu"],["HSZ","Hsinchu"],["HUA","Hualien"],["KHH","Kaohsiung"],["KEE","Keelung"],["KIN","Kinmen"],["LIE","Lienchiang"],["MIA","Miaoli"],["NAN","Nantou"],["NWT","New Taipei"],["PEN","Penghu"],["PIF","Pingtung"],["TXG","Taichung"],["TNN","Tainan"],["TPE","Taipei"],["TTT","Taitung"],["TAO","Taoyuan"],["ILA","Yilan"],["YUN","Yunlin"]],"TZ":[["01","Arusha"],["19","Coast"],["02","Dar es Salaam"],["03","Dodoma"],["27","Geita"],["04","Iringa"],["05","Kagera"],["28","Katavi"],["08","Kigoma"],["09","Kilimanjaro"],["12","Lindi"],["26","Manyara"],["13","Mara"],["14","Mbeya"],["16","Morogoro"],["17","Mtwara"],["18","Mwanza"],["29","Njombe"],["06","Pemba North"],["10","Pemba South"],["20","Rukwa"],["21","Ruvuma"],["22","Shinyanga"],["30","Simiyu"],["23","Singida"],["31","Songwe"],["24","Tabora"],["25","Tanga"],["07","Zanzibar North"],["11","Zanzibar South"],["15","Zanzibar West"]],"UA":[["43","Avtonomna Respublika Krym"],["71","Cherkaska oblast"],["74","Chernihivska oblast"],["77","Chernivetska oblast"],["12","Dnipropetrovska oblast"],["14","Donetska oblast"],["26","Ivano-Frankivska oblast"],["63","Kharkivska oblast"],["65","Khersonska oblast"],["68","Khmelnytska oblast"],["35","Kirovohradska oblast"],["30","Kyiv"],["32","Kyivska oblast"],["09","Luhanska oblast"],["46","Lvivska oblast"],["48","Mykolaivska oblast"],["51","Odeska oblast"],["53","Poltavska oblast"],["56","Rivnenska oblast"],["40","Sevastopol"],["59","Sumska oblast"],["61","Ternopilska oblast"],["05","Vinnytska oblast"],["07","Volynska oblast"],["21","Zakarpatska oblast"],["23","Zaporizka oblast"],["18","Zhytomyrska oblast"]],"UG":[["C","Central"],["E","Eastern"],["N","Northern"],["W","Western"]],"UM":[["81","Baker Island"],["84","Howland Island"],["86","Jarvis Island"],["67","Johnston Atoll"],["89","Kingman Reef"],["71","Midway Islands"],["76","Navassa Island"],["95","Palmyra Atoll"],["79","Wake Island"]],"US":[["AL","Alabama"],["AK","Alaska"],["AS","American Samoa"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["GU","Guam"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["MP","Northern Mariana Islands"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["PR","Puerto Rico"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UM","United States Minor Outlying Islands"],["UT","Utah"],["VT","Vermont"],["VI","Virgin Islands, U.S."],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]],"UY":[["AR","Artigas"],["CA","Canelones"],["CL","Cerro Largo"],["CO","Colonia"],["DU","Durazno"],["FS","Flores"],["FD","Florida"],["LA","Lavalleja"],["MA","Maldonado"],["MO","Montevideo"],["PA","Paysandú"],["RV","Rivera"],["RO","Rocha"],["RN","Río Negro"],["SA","Salto"],["SJ","San José"],["SO","Soriano"],["TA","Tacuarembó"],["TT","Treinta y Tres"]],"UZ":[["AN","Andijon"],["BU","Buxoro"],["FA","Farg‘ona"],["JI","Jizzax"],["NG","Namangan"],["NW","Navoiy"],["QA","Qashqadaryo"],["QR","Qoraqalpog‘iston Respublikasi"],["SA","Samarqand"],["SI","Sirdaryo"],["SU","Surxondaryo"],["TK","Toshkent"],["TO","Toshkent"],["XO","Xorazm"]],"VC":[["01","Charlotte"],["06","Grenadines"],["02","Saint Andrew"],["03","Saint David"],["04","Saint George"],["05","Saint Patrick"]],"VE":[["Z","Amazonas"],["B","Anzoátegui"],["C","Apure"],["D","Aragua"],["E","Barinas"],["F","Bolívar"],["G","Carabobo"],["H","Cojedes"],["Y","Delta Amacuro"],["W","Dependencias Federales"],["A","Distrito Capital"],["I","Falcón"],["J","Guárico"],["X","La Guaira"],["K","Lara"],["M","Miranda"],["N","Monagas"],["L","Mérida"],["O","Nueva Esparta"],["P","Portuguesa"],["R","Sucre"],["T","Trujillo"],["S","Táchira"],["U","Yaracuy"],["V","Zulia"]],"VN":[["44","An Giang"],["43","Bà Rịa - Vũng Tàu"],["57","Bình Dương"],["58","Bình Phước"],["40","Bình Thuận"],["31","Bình Định"],["55","Bạc Liêu"],["54","Bắc Giang"],["53","Bắc Kạn"],["56","Bắc Ninh"],["50","Bến Tre"],["04","Cao Bằng"],["59","Cà Mau"],["CT","Cần Thơ"],["30","Gia Lai"],["03","Hà Giang"],["63","Hà Nam"],["HN","Hà Nội"],["23","Hà Tĩnh"],["14","Hòa Bình"],["66","Hưng Yên"],["61","Hải Dương"],["HP","Hải Phòng"],["73","Hậu Giang"],["SG","Hồ Chí Minh"],["34","Khánh Hòa"],["47","Kiến Giang"],["28","Kon Tum"],["01","Lai Châu"],["41","Long An"],["02","Lào Cai"],["35","Lâm Đồng"],["09","Lạng Sơn"],["67","Nam Định"],["22","Nghệ An"],["18","Ninh Bình"],["36","Ninh Thuận"],["68","Phú Thọ"],["32","Phú Yên"],["24","Quảng Bình"],["27","Quảng Nam"],["29","Quảng Ngãi"],["13","Quảng Ninh"],["25","Quảng Trị"],["52","Sóc Trăng"],["05","Sơn La"],["21","Thanh Hóa"],["20","Thái Bình"],["69","Thái Nguyên"],["26","Thừa Thiên-Huế"],["46","Tiền Giang"],["51","Trà Vinh"],["07","Tuyên Quang"],["37","Tây Ninh"],["49","Vĩnh Long"],["70","Vĩnh Phúc"],["06","Yên Bái"],["71","Điện Biên"],["DN","Đà Nẵng"],["33","Đắk Lắk"],["72","Đắk Nông"],["39","Đồng Nai"],["45","Đồng Tháp"]],"VU":[["MAP","Malampa"],["PAM","Pénama"],["SAM","Sanma"],["SEE","Shéfa"],["TAE","Taféa"],["TOB","Torba"]],"WF":[["AL","Alo"],["SG","Sigave"],["UV","Uvea"]],"WS":[["AA","A'ana"],["AL","Aiga-i-le-Tai"],["AT","Atua"],["FA","Fa'asaleleaga"],["GE","Gaga'emauga"],["GI","Gagaifomauga"],["PA","Palauli"],["SA","Satupa'itea"],["TU","Tuamasaga"],["VF","Va'a-o-Fonoti"],["VS","Vaisigano"]],"YE":[["AB","Abyan"],["BA","Al Bayḑā’"],["JA","Al Jawf"],["MR","Al Mahrah"],["MW","Al Maḩwīt"],["HU","Al Ḩudaydah"],["SA","Amānat al ‘Āşimah [city]"],["SU","Arkhabīl Suquţrá"],["DA","Aḑ Ḑāli‘"],["DH","Dhamār"],["IB","Ibb"],["LA","Laḩij"],["MA","Ma’rib"],["RA","Raymah"],["SH","Shabwah"],["TA","Tāʻizz"],["SN","Şanʻā’"],["SD","Şāʻdah"],["HJ","Ḩajjah"],["HD","Ḩaḑramawt"],["AD","‘Adan"],["AM","‘Amrān"]],"ZA":[["EC","Eastern Cape"],["FS","Free State"],["GP","Gauteng"],["KZN","Kwazulu-Natal"],["LP","Limpopo"],["MP","Mpumalanga"],["NW","North-West"],["NC","Northern Cape"],["WC","Western Cape"]],"ZM":[["02","Central"],["08","Copperbelt"],["03","Eastern"],["04","Luapula"],["09","Lusaka"],["10","Muchinga"],["06","North-Western"],["05","Northern"],["07","Southern"],["01","Western"]],"ZW":[["BU","Bulawayo"],["HA","Harare"],["MA","Manicaland"],["MC","Mashonaland Central"],["ME","Mashonaland East"],["MW","Mashonaland West"],["MV","Masvingo"],["MN","Matabeleland North"],["MS","Matabeleland South"],["MI","Midlands"]]};
    let holidayLoadEpoch = 0;
    let holidayLoadTimer = null;
    let holidayLoading = false;
    let selectedHolidayCountry = "";
    let selectedHolidayRegion = "";

    function populateHolidayCountries() {
        const list = $("#rm-holiday-countries");
        if (!list) return;
        list.replaceChildren();
        let displayNames = null;
        try { displayNames = new Intl.DisplayNames([localeTag()], {type:"region"}); }
        catch (_) { /* Older browsers: use the static ISO name. */ }
        for (const [code, englishName] of Object.entries(ISO_COUNTRIES)) {
            const option = document.createElement("option");
            option.value = code;
            option.label = displayNames?.of(code) || englishName;
            option.textContent = option.label;
            list.appendChild(option);
        }
    }

    function regionOptionsFor(country) {
        const entries = ISO_SUBDIVISIONS[country] || [];
        return entries.map(([suffix, name]) => [country + "-" + suffix, name]);
    }

    function updateHolidayRegionOptions(country, keepRegion = "") {
        const regionInput = $("#rm-holiday-region");
        const list = $("#rm-holiday-regions");
        if (!list || !regionInput) return;
        list.replaceChildren();
        const options = regionOptionsFor(country);
        for (const [code, name] of options) {
            const option = document.createElement("option");
            option.value = code;
            option.label = name;
            option.textContent = name;
            list.appendChild(option);
        }
        // If editing an old/rare subdivision, retain its ISO code as editable
        // free text; never silently substitute a region from another country.
        regionInput.value = keepRegion && keepRegion.startsWith(country + "-")
            ? keepRegion : "";
        regionInput.placeholder = country ? country + "-…" : "";
        selectedHolidayCountry = country;
        selectedHolidayRegion = regionInput.value;
        const note = $("#rm-holiday-region-help");
        if (note) note.textContent = country
            ? t("Regioni disponibili: {count}. Se manca una suddivisione, inserisci il codice ISO 3166-2 manualmente.", {count:options.length})
            : t("Seleziona prima il Paese delle festività.");
    }

    function invalidateHolidayLoad() {
        holidayLoadEpoch++;
        if (holidayLoadTimer !== null) { clearTimeout(holidayLoadTimer); holidayLoadTimer = null; }
        loadedHolidaySnapshot = null;
        holidayLoading = false;
        const button = $("#rm-holiday-load");
        if (button) button.disabled = false;
        updateHolidaySnapshotStatus();
    }

    function scheduleHolidayLoad({silent = true, delay = 300} = {}) {
        // Network calls happen only for a valid territory AND a finite period.
        if (holidayLoadTimer !== null) clearTimeout(holidayLoadTimer);
        const epoch = ++holidayLoadEpoch;
        holidayLoadTimer = setTimeout(() => {
            holidayLoadTimer = null;
            if (epoch !== holidayLoadEpoch) return;
            const country = $("#rm-holiday-country")?.value?.trim().toUpperCase() || "";
            if (!/^[A-Z]{2}$/.test(country)) { updateHolidaySnapshotStatus(); previewCalendar(); return; }
            const first = $("#rm-cal-start")?.value || "";
            const last = $("#rm-cal-end")?.value || "";
            if (!validDate(first) || !validDate(last) || first > last ||
                !$("#rm-cal-ranged")?.checked) {
                const status = $("#rm-holiday-snapshot-status");
                if (status) status.textContent = t("Seleziona le date iniziale e finale per caricare automaticamente le festività.");
                previewCalendar();
                return;
            }
            loadHolidayData({silent, epoch});
        }, delay);
    }

    function changedHolidayCountry() {
        const countryInput = $("#rm-holiday-country");
        const value = countryInput.value.trim().toUpperCase();
        // If the editor is still typing, do not discard the current region.
        if (value && !/^[A-Z]{2}$/.test(value)) return;
        countryInput.value = value;
        if (value === selectedHolidayCountry) return;
        updateHolidayRegionOptions(value);
        invalidateHolidayLoad();
        previewCalendar();
        if (value) scheduleHolidayLoad();
    }

    function changedHolidayRegion() {
        const country = $("#rm-holiday-country").value.trim().toUpperCase();
        const region = $("#rm-holiday-region");
        region.value = region.value.trim().toUpperCase();
        if (region.value === selectedHolidayRegion) return;
        selectedHolidayRegion = region.value;
        invalidateHolidayLoad();
        previewCalendar();
        if (/^[A-Z]{2}$/.test(country)) scheduleHolidayLoad();
    }

    function changedHolidayPeriod() {
        invalidateHolidayLoad();
        previewCalendar();
        if (/^[A-Z]{2}$/.test($("#rm-holiday-country").value.trim().toUpperCase())) {
            scheduleHolidayLoad({delay: 450});
        }
    }

    function addLocalAnnualHolidayRow(holiday = {name:"",month:2,day:15}) {
        const row = document.createElement("div");
        row.className = "rm-local-row rm-subcard";
        const fields = document.createElement("div");
        fields.className = "rm-form-grid cols-3";
        const make = (title,type,value,cls) => {
            const holder = document.createElement("div");
            holder.className = "rm-field";
            const label = document.createElement("label");
            label.textContent = t(title);
            const input = document.createElement("input");
            input.type = type;
            input.className = cls;
            input.value = value;
            if (type === "number") { input.min = "1"; input.max = cls.includes("month") ? "12" : "31"; }
            input.addEventListener("input", previewCalendar);
            label.appendChild(input);
            holder.appendChild(label);
            return holder;
        };
        fields.append(
            make("Nome festività","text",holiday.name,"rm-local-holiday-name"),
            make("Mese","number",holiday.month,"rm-local-holiday-month"),
            make("Giorno","number",holiday.day,"rm-local-holiday-day")
        );
        const remove = document.createElement("button");
        remove.type="button"; remove.className="danger"; remove.textContent=t("✕ Rimuovi esclusione");
        remove.addEventListener("click", () => { row.remove(); previewCalendar(); });
        row.append(fields, remove);
        $("#rm-local-annual").appendChild(row);
    }

    function updateHolidaySnapshotStatus() {
        const status = $("#rm-holiday-snapshot-status");
        if (!status) return;
        const snapshot = loadedHolidaySnapshot;
        if (!snapshot) {
            const country = $("#rm-holiday-country")?.value?.trim().toUpperCase() || "";
            status.textContent = country
                ? t("Scegli un periodo preciso: le festività saranno caricate automaticamente. Se il caricamento fallisce, usa Aggiorna festività.")
                : t("Scegli il Paese e un intervallo di date per caricare automaticamente le festività. Lascia il Paese vuoto se non vuoi escluderle.");
            return;
        }
        status.textContent = t("Archivio festività: {country} {region} · {count} date",{
            country:snapshot.country,region:snapshot.region,count:snapshot.dates.length});
    }

    // A single cross-origin request from Tampermonkey, not from WME's fetch/CORS context.
    // Nager.Date v4: https://nagerholidays.com/api/v4/Holidays/{country}/{year}
    function requestPublicHolidays(country, year) {
        if (typeof GM_xmlhttpRequest !== "function") {
            return Promise.reject(new Error(t("Tampermonkey non ha concesso l'accesso alla rete. Reinstalla/aggiorna lo script e autorizza nagerholidays.com.")));
        }
        // Strictly restrict remote URLs to our hard-coded public service and validated inputs.
        if (!/^[A-Z]{2}$/.test(country) || !Number.isInteger(year) || year < 1900 || year > 2200) {
            return Promise.reject(new Error("Invalid holiday request parameters"));
        }
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (err, value) => {
                if (settled) return;
                settled = true;
                if (err) reject(err);
                else resolve(value);
            };
            try {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: `${HOLIDAY_API}/${country}/${year}`,
                    headers: {Accept: "application/json"},
                    timeout: 20000,
                    onload(response) {
                        const status = Number(response.status);
                        if (status !== 200) {
                            finish(new Error(`HTTP ${status || "?"}: ${country} ${year}`));
                            return;
                        }
                        try {
                            const data = JSON.parse(response.responseText);
                            if (!Array.isArray(data)) throw new Error(t("Risposta non valida del servizio festività."));
                            finish(null, data);
                        } catch (error) { finish(error); }
                    },
                    onerror() {
                        finish(new Error(t("Impossibile contattare il servizio delle festività. Controlla la connessione e l'autorizzazione Tampermonkey per nagerholidays.com.")));
                    },
                    ontimeout() { finish(new Error(t("Richiesta festività scaduta (timeout). Riprova."))); },
                    onabort() { finish(new Error(t("Richiesta festività annullata. Riprova."))); }
                });
            } catch (error) { finish(error); }
        });
    }

    async function loadHolidayData({silent = false, epoch = null} = {}) {
        const button = $("#rm-holiday-load");
        const country = $("#rm-holiday-country").value.trim().toUpperCase();
        const region = $("#rm-holiday-region").value.trim().toUpperCase();
        const first = $("#rm-cal-start").value;
        const last = $("#rm-cal-end").value;
        // A newer request or edit takes precedence over every previous response.
        const generation = epoch === null ? ++holidayLoadEpoch : epoch;
        const status = $("#rm-holiday-snapshot-status");
        const current = () => generation === holidayLoadEpoch &&
            country === $("#rm-holiday-country").value.trim().toUpperCase() &&
            region === $("#rm-holiday-region").value.trim().toUpperCase() &&
            first === $("#rm-cal-start").value && last === $("#rm-cal-end").value;
        try {
            if (!/^[A-Z]{2}$/.test(country)) {
                throw new Error(t("Seleziona un Paese con codice ISO a due lettere (es. IT, DE, FR)."));
            }
            if (region && (!region.startsWith(country + "-") || !/^[A-Z]{2}-[A-Z0-9-]{1,12}$/.test(region))) {
                throw new Error(t("Il codice Regione deve appartenere al Paese scelto (es. IT-25)."));
            }
            if (!$("#rm-cal-ranged").checked || !validDate(first) || !validDate(last) || first > last ||
                daysBetween(first,last)+1 > MAX_EXCLUSION_DAYS) {
                throw new Error(t("Seleziona un periodo preciso per caricare le festività."));
            }
            if (status && current()) status.textContent = t("Caricamento festività per {country} {region}…", {country,region});
            if (button) button.disabled = true;
            holidayLoading = true;
            const y1 = Number(first.slice(0,4));
            const y2 = Number(last.slice(0,4));
            const results = [];
            for (let year = y1; year <= y2; year++) {
                if (!current()) return;
                const data = await requestPublicHolidays(country, year);
                if (!current()) return;
                if (!Array.isArray(data)) throw new Error(`Invalid holiday data: ${country} ${year}`);
                for (const holiday of data) {
                    if (!validDate(holiday?.date)) continue;
                    if (Array.isArray(holiday.holidayTypes) && !holiday.holidayTypes.includes("Public")) continue;
                    const national = holiday.nationalHoliday === true;
                    const regional = Boolean(region) && Array.isArray(holiday.subdivisionCodes) &&
                        holiday.subdivisionCodes.includes(region);
                    if (national || regional) results.push(holiday.date);
                }
            }
            // Keep the previously tested Italian national-holiday dates as a
            // supplement to Nager.Date (not a checkbox or a separate mode).
            // This also preserves the 4 October holiday from 2026 onward.
            if (country === "IT") {
                for (let year = y1; year <= y2; year++) results.push(...italianHolidays(year));
            }
            const dates = [...new Set(results)].filter(date => date >= first && date <= last).sort();
            if (!dates.length) {
                throw new Error(t("Nessuna festività pubblica disponibile per il Paese e il periodo selezionati."));
            }
            if (!current()) return;
            loadedHolidaySnapshot = {country,region,firstYear:y1,lastYear:y2,dates,
                fetchedAt:new Date().toISOString(),periodStart:first,periodEnd:last};
            recordDiagnostic("info", "holiday-loaded", {holidays:dates.length});
            updateHolidaySnapshotStatus();
            previewCalendar();
            if (!silent) notify(t("Festività caricate: {count} giorni ({start}–{end}). Verifica l'eventuale assenza di feste regionali o locali.",
                {count:dates.length,start:first,end:last}),"success");
        } catch (error) {
            if (!current()) return;
            loadedHolidaySnapshot = null;
            recordDiagnostic("error", "holiday-failed");
            if (status) status.textContent = t("Impossibile scaricare le festività: {detail}", {detail:msg(error)});
            previewCalendar();
            if (!silent) notify(t("Impossibile scaricare le festività: {detail}",{detail:msg(error)}),"error");
            else errorLog("Automatic holiday import", error);
        } finally {
            // Never allow an older request to clear a newer loading status.
            if (current()) { holidayLoading = false; if (button) button.disabled = false; }
        }
    }

    function expirationDate(calendar) {
        if (calendar.endDate && !calendar.repeatYearly) return calendar.endDate;
        // A mixed calendar still has active weekly slots after special recurrences end.
        // Do not mark the whole calendar as expired in that case.
        if (calendar.specialRules?.length && !calendar.slots?.length) return ymdUTC(calendar.specialEndYear,12,31);
        return null;
    }

    function currentCivilDate(timeZone) {
        try {
            return new Intl.DateTimeFormat("sv-SE",{
                timeZone,year:"numeric",month:"2-digit",day:"2-digit"
            }).format(new Date());
        } catch (_) {
            const today = new Date();
            return ymdUTC(today.getFullYear(),today.getMonth()+1,today.getDate());
        }
    }

    function refreshExpirationAlerts() {
        const banner = $("#rm-expiry-banner");
        if (!banner) return;
        const messages = [];
        try {
            for (const cal of allCalendars()) {
                const end = expirationDate(cal);
                if (!end) continue;
                const delta = daysBetween(currentCivilDate(cal.timeZone),end);
                if (delta < 0) messages.push(t("Scaduto: {name} ({date})",{name:cal.name,date:end}));
                else if (delta <= EXPIRY_WARNING_DAYS) messages.push(t("In scadenza: {name} — {days} giorni ({date})",{name:cal.name,days:delta,date:end}));
            }
        } catch (e) { errorLog("Calendar expiry",e); }
        banner.hidden = messages.length === 0;
        const items = $("#rm-expiry-messages");
        items.replaceChildren();
        for (const message of messages) {
            const div = document.createElement("div"); div.textContent = message; items.appendChild(div);
        }
    }

    function calendarFormValues() {
        const slots = [...$("#rm-slots").children].map(row => ({
            weekdays: [...row.querySelectorAll(".rm-day:checked")].map(input => input.value),
            allDay: row.querySelector(".rm-allday").checked,
            fromTime: row.querySelector(".rm-from").value,
            toTime: row.querySelector(".rm-to").value
        }));
        const ranged = $("#rm-cal-ranged").checked;
        const specialRules = [...$("#rm-special-rows").children].map(box => ({
            kind: box.querySelector(".rm-special-kind").value,
            ordinal: Number(box.querySelector(".rm-special-ordinal").value),
            weekday: box.querySelector(".rm-special-weekday").value,
            month: Number(box.querySelector(".rm-special-month").value),
            offsetDays: Number(box.querySelector(".rm-special-offset").value),
            allDay: box.querySelector(".rm-special-allday").checked,
            fromTime: box.querySelector(".rm-special-from").value,
            toTime: box.querySelector(".rm-special-to").value
        }));
        return {
            id: editingCalendarId,
            name: $("#rm-cal-name").value,
            timeZone: $("#rm-cal-tz").value,
            startDate: ranged ? $("#rm-cal-start").value : null,
            endDate: ranged ? $("#rm-cal-end").value : null,
            repeatYearly: ranged && $("#rm-cal-repeat").checked,
            slots, specialRules,
            holidaySelectionEnabled: Boolean($("#rm-holiday-country").value.trim()),
            holidayCountry: $("#rm-holiday-country").value.trim().toUpperCase(),
            holidayRegion: $("#rm-holiday-region").value.trim().toUpperCase(),
            holidayLocality: $("#rm-holiday-locality").value.trim(),
            holidaySnapshot: loadedHolidaySnapshot ? copy(loadedHolidaySnapshot) : null,
            localAnnualHolidays: [...$("#rm-local-annual").children].map(row => ({
                name: row.querySelector(".rm-local-holiday-name").value,
                month: Number(row.querySelector(".rm-local-holiday-month").value),
                day: Number(row.querySelector(".rm-local-holiday-day").value)
            })),
            excludedRanges: [...$("#rm-exclusions").children].map(row => ({
                label: row.querySelector(".rm-exclusion-label").value,
                startDate: row.querySelector(".rm-exclusion-start").value,
                endDate: row.querySelector(".rm-exclusion-end").value
            })),
            specialStartYear: Number($("#rm-special-start-year").value),
            specialEndYear: Number($("#rm-special-end-year").value)
        };
    }

    function calendarDescription(calendar) {
        const c = normalizeCalendar(calendar);
        const rows = c.slots.map(slot => {
            const days = slot.weekdays.map(localizedWeekday).join(", ");
            return `${days}: ${slot.allDay ? t("tutto il giorno") : `${slot.fromTime}–${slot.toTime}`}`;
        });
        rows.push(c.startDate ? t("Validità {start} → {end}", {start:c.startDate, end:c.endDate})
            : t("Ogni settimana, senza scadenza"));
        if (c.repeatYearly) rows.push(t("Ripetizione annuale"));
        for (const rule of c.specialRules) {
            const ordinalLabel = rule.ordinal === -1 ? t("Ultimo") :
                t(["", "Primo", "Secondo", "Terzo", "Quarto", "Quinto"][rule.ordinal]);
            const label = rule.kind === "nth_weekday"
                ? `${ordinalLabel} ${localizedWeekday(rule.weekday)} ${new Intl.DateTimeFormat(localeTag(), {month:"long",timeZone:"UTC"}).format(new Date(Date.UTC(2024,rule.month-1,1)))}`
                : t("Pasqua {offset} giorni", {offset:(rule.offsetDays >= 0 ? "+" : "") + rule.offsetDays});
            rows.push(`${label}: ${rule.allDay ? t("tutto il giorno") : `${rule.fromTime}–${rule.toTime}`}`);
        }
        if (c.specialRules.length) {
            rows.push(t("Occorrenze generate: anni {start}–{end} (non automatiche oltre la fine)",
                {start:c.specialStartYear, end:c.specialEndYear}));
        }
        const excluded = exclusionSet(c);
        if (c.holidayCountry && c.holidaySnapshot) {
            rows.push(t("Festività nazionali e regionali: escluse"));
            rows.push(t("Archivio festività: {country} {region} · {count} date",{
                country:c.holidayCountry,region:c.holidayRegion,count:c.holidaySnapshot.dates.length}));
        }
        if (c.localAnnualHolidays.length) rows.push(t("Festività locali annuali: {count}",{count:c.localAnnualHolidays.length}));
        for (const range of c.excludedRanges) {
            const dates = range.startDate + (range.endDate !== range.startDate ? " → " + range.endDate : "") +
                (range.label ? " — " + range.label : "");
            rows.push(t("Escluso: {dates}", {dates}));
        }
        if (excluded.size) rows.push(t("Giorni esclusi nel periodo: {count}", {count:excluded.size}));
        rows.push(t("Restrizioni generate per modello: {count}", {count:calendarFrames(c).length}));
        rows.push(t("Fuso: {tz}", {tz:c.timeZone}));
        return rows.join("\n");
    }

    function previewCalendar() {
        const el = $("#rm-cal-preview");
        if (!el) return;
        try { el.textContent = calendarDescription(calendarFormValues()); }
        catch (e) { el.textContent = t("Da completare: {detail}", {detail:msg(e)}); }
    }

    function editCalendar(calendar) {
        editingCalendarId = calendar?.id || null;
        $("#rm-cal-name").value = calendar?.name || "";
        $("#rm-cal-tz").value = calendar?.timeZone || "Europe/Rome";
        $("#rm-cal-ranged").checked = Boolean(calendar?.startDate);
        $("#rm-cal-start").value = calendar?.startDate || "";
        $("#rm-cal-end").value = calendar?.endDate || "";
        $("#rm-cal-repeat").checked = Boolean(calendar?.repeatYearly);
        toggleCalendarDates();
        $("#rm-slots").replaceChildren();
        const slots = calendar?.slots || null;
        for (const slot of (slots === null ? [null] : slots)) addSlotRow(slot || undefined);
        $("#rm-special-rows").replaceChildren();
        for (const rule of calendar?.specialRules || []) addSpecialRow(rule);
        const currentYear = new Date().getFullYear();
        $("#rm-special-start-year").value = String(calendar?.specialStartYear ?? currentYear);
        $("#rm-special-end-year").value = String(calendar?.specialEndYear ?? currentYear + 4);
        $("#rm-cal-list").value = editingCalendarId || "";
        invalidateHolidayLoad();
        $("#rm-holiday-country").value = calendar?.holidayCountry || "";
        updateHolidayRegionOptions(calendar?.holidayCountry || "", calendar?.holidayRegion || "");
        $("#rm-holiday-locality").value = calendar?.holidayLocality || "";
        loadedHolidaySnapshot = calendar?.holidaySnapshot ? copy(calendar.holidaySnapshot) : null;
        updateHolidaySnapshotStatus();
        $("#rm-local-annual").replaceChildren();
        for (const holiday of calendar?.localAnnualHolidays || []) addLocalAnnualHolidayRow(holiday);
        $("#rm-exclusions").replaceChildren();
        for (const range of calendar?.excludedRanges || []) addExcludedRow(range);
        previewCalendar();
    }

    function toggleCalendarDates() {
        const on = $("#rm-cal-ranged").checked;
        for (const selector of ["#rm-cal-start", "#rm-cal-end", "#rm-cal-repeat"]) {
            $(selector).disabled = !on;
        }
        if (!on) $("#rm-cal-repeat").checked = false;
        previewCalendar();
    }

    function saveCalendar() {
        try {
            const cal = normalizeCalendar(calendarFormValues());
            const others = allCalendars().filter(item => item.id !== editingCalendarId);
            if (others.some(item => item.name.toLocaleLowerCase("it") === cal.name.toLocaleLowerCase("it"))) {
                throw new Error(t("Esiste già un calendario con questo nome."));
            }
            cal.id = editingCalendarId || newCalendarId();
            localStorage.setItem(CAL_PREFIX + cal.id, JSON.stringify(cal));
            recordDiagnostic("info", "calendar-saved");
            refreshCalendarSelects(cal.id);
            editCalendar(cal);
            notify(t("Calendario «{name}» salvato. I segmenti già modificati non si aggiornano automaticamente.", {name:cal.name}), "success");
        } catch (e) {
            notify(t("Calendario non salvato: {detail}", {detail:msg(e)}), "error");
        }
    }

    function deleteCalendar() {
        const id = editingCalendarId;
        if (!id) return notify(t("Seleziona un calendario da eliminare."), "warning");
        try {
            const cal = getCalendar(id);
            const linked = names().filter(name => asPreset(read(name)).calendarId === id);
            if (!confirm(t("Eliminare il calendario «{name}»?", {name:cal.name}) + "\n\n" + t("{count} preset collegati verranno scollegati. Le restrizioni in WME non saranno modificate.", {count:linked.length}))) return;
            const updated = linked.map(name => {
                const data = asPreset(read(name));
                data.calendarId = null;
                return [name, data];
            });
            for (const [name, value] of updated) localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(value));
            localStorage.removeItem(CAL_PREFIX + id);
            refreshCalendarSelects("");
            refreshPresets();
            editCalendar(null);
            notify(t("Calendario «{name}» eliminato.", {name:cal.name}), "success");
        } catch (e) { notify(msg(e), "error"); }
    }

    function unlinkCalendarFromPreset() {
        try {
            const name = $("#rm-presets").value;
            if (!name) throw new Error(t("Seleziona un preset dal menu."));
            const preset = asPreset(read(name));
            if (!preset.calendarId) return notify(t("Il preset non ha un calendario collegato."), "info");
            if (!confirm(t("Scollegare il calendario dal preset «{name}»? Il preset e gli orari originali saranno conservati.", {name}))) return;
            preset.calendarId = null;
            localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(preset));
            refreshPresets(name);
            refreshCalendarSelects();
            $("#rm-link-calendar").value = "";
            notify(t("Calendario scollegato dal preset «{name}».", {name}), "success");
        } catch (e) { notify(msg(e), "error"); }
    }

    function duplicatePresetWithCalendar() {
        try {
            const name = $("#rm-presets").value;
            if (!name) throw new Error(t("Seleziona il preset originale dal menu."));
            const id = $("#rm-link-calendar").value || null;
            if (id && !getCalendar(id)) throw new Error(t("Calendario non trovato."));
            const suggestion = `${name} - ${id ? getCalendar(id).name : t("senza calendario")}`;
            const entered = prompt(t("Nome del NUOVO preset (l'originale rimane invariato):"), suggestion);
            if (entered === null) return;
            const newName = entered.trim();
            if (!newName || newName === "*Clipboard*" || read(newName) !== null) {
                throw new Error(t("Nome del nuovo preset non valido o già utilizzato."));
            }
            const newPreset = asPreset(read(name));
            newPreset.calendarId = id;
            localStorage.setItem(STORAGE_PREFIX + newName, JSON.stringify(newPreset));
            refreshPresets(newName);
            $("#rm-name").value = newName;
            refreshCalendarSelects();
            notify(t("Creato preset «{newName}»; l'originale «{name}» è rimasto invariato.", {newName,name}), "success");
        } catch (e) { notify(msg(e), "error"); }
    }

    function linkCalendarToPreset() {
        try {
            const name = $("#rm-presets").value;
            if (!name) throw new Error(t("Seleziona un preset salvato dal menu."));
            const id = $("#rm-link-calendar").value || null;
            if (id && !getCalendar(id)) throw new Error(t("Calendario non trovato."));
            const preset = asPreset(read(name));
            preset.calendarId = id;
            localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(preset));
            refreshPresets(name);
            notify(id ? t("Calendario «{calendar}» collegato al preset «{name}».", {calendar:getCalendar(id).name, name}) :
                t("Calendario scollegato dal preset «{name}».", {name}), "success");
        } catch (e) { notify(msg(e), "error"); }
    }


    // Preview and conservative conflict scanner. No edits occur here.
    // Time-frame overlap checks intentionally favor warnings over false certainty.
    function canonical(value) {
        if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
        if (value && typeof value === "object") {
            return '{' + Object.keys(value).sort()
                .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
        }
        return JSON.stringify(value ?? null);
    }

    function itemFingerprint(item) {
        return canonical({data:item.data, motors:item.motors || [], rawEngines:motorRulesFromRawJson(item.raw)});
    }

    function segmentFingerprint(segment) {
        return canonical({direction:sourceDirection(segment),
            restrictions:pairedRestrictions(segment).map(itemFingerprint)});
    }

    function overlappingDirection(a, b) {
        return a === b || a === "BOTH" || b === "BOTH";
    }

    function overlappingVehicles(a, b) {
        const vehicleTypes = restriction => {
            const groups = Object.values(restriction.data.vehicleRules || {});
            const sets = groups.flatMap(group => Array.isArray(group)
                ? group.flatMap(rule => rule.vehicleTypes || []) : []);
            return sets.length ? new Set(sets) : null; // null = unrestricted/all
        };
        const left = vehicleTypes(a), right = vehicleTypes(b);
        return !left || !right || [...left].some(type => right.has(type));
    }

    function overlappingDateRange(a, b) {
        if (a.repeatYearly === true || b.repeatYearly === true) return true;
        const startA = typeof a.startDate === "string" ? a.startDate.slice(0,10) : null;
        const endA = typeof a.endDate === "string" ? a.endDate.slice(0,10) : null;
        const startB = typeof b.startDate === "string" ? b.startDate.slice(0,10) : null;
        const endB = typeof b.endDate === "string" ? b.endDate.slice(0,10) : null;
        if (endA && startB && endA < startB) return false;
        if (endB && startA && endB < startA) return false;
        // Annual repetition or day alternation needs dedicated calendar arithmetic.
        return true;
    }

    function timeAsMinutes(value) {
        if (typeof value !== "string" || !/^\d{1,2}:\d{2}$/.test(value)) return null;
        const [hour, minute] = value.split(':').map(Number);
        return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
    }

    function framesPossiblyOverlap(left, right) {
        const a = Array.isArray(left) && left.length ? left : [{}];
        const b = Array.isArray(right) && right.length ? right : [{}];
        for (const x of a) for (const y of b) {
            if (!overlappingDateRange(x, y)) continue;
            const fx = timeAsMinutes(x.fromTime), tx = timeAsMinutes(x.toTime);
            const fy = timeAsMinutes(y.fromTime), ty = timeAsMinutes(y.toTime);
            const crossesMidnight = (fx !== null && tx !== null && tx <= fx) ||
                (fy !== null && ty !== null && ty <= fy);
            const dx = Array.isArray(x.weekdays) ? x.weekdays : [];
            const dy = Array.isArray(y.weekdays) ? y.weekdays : [];
            if (!crossesMidnight && dx.length && dy.length &&
                !dx.some(day => dy.includes(day))) continue;
            if (!crossesMidnight && fx !== null && tx !== null && fy !== null && ty !== null &&
                (tx <= fy || ty <= fx)) continue;
            return true;
        }
        return false;
    }

    function overlappingRestrictions(a, b) {
        return overlappingDirection(a.data.direction, b.data.direction) &&
            overlappingVehicles(a,b) &&
            framesPossiblyOverlap(a.data.timeFrames,b.data.timeFrames);
    }

    function calculatePreviewStats(original, resulting, mode) {
        const originalCounts = new Map();
        for (const item of original) {
            const key = itemFingerprint(item);
            originalCounts.set(key, (originalCounts.get(key) || 0) + 1);
        }
        const changed = [];
        const addedItems = [];
        let kept = 0;
        for (const item of resulting) {
            const key = itemFingerprint(item);
            const remaining = originalCounts.get(key) || 0;
            if (remaining > 0) {
                originalCounts.set(key, remaining - 1);
                changed.push(false);
                kept++;
            } else {
                changed.push(true);
                addedItems.push(item);
            }
        }
        const added = changed.filter(Boolean).length;
        const remainingOriginal = new Map(originalCounts);
        const removedItems = original.filter(item => {
            const key = itemFingerprint(item);
            const left = remainingOriginal.get(key) || 0;
            if (!left) return false;
            remainingOriginal.set(key, left - 1);
            return true;
        });
        const removed = original.length - kept;
        const issues = [];
        for (let i = 0; i < resulting.length; i++) {
            for (let j = i + 1; j < resulting.length; j++) {
                if (!changed[i] && !changed[j]) continue;
                if (!overlappingRestrictions(resulting[i], resulting[j])) continue;
                issues.push(t("Possibile sovrapposizione tra restrizioni {first} e {second}.", {
                    first:i+1,second:j+1
                }));
            }
        }
        return {added,removed,kept,issues,addedItems,removedItems,conflict:issues.length > 0,
            replacement:mode === "preset" && removed > 0,
            unchanged:added === 0 && removed === 0};
    }

    function clearOperationPreview() {
        preparedPreview = null;
        const panel = $("#rm-operation-preview");
        if (panel) panel.hidden = true;
        if ($("#rm-preview-ack")) $("#rm-preview-ack").checked = false;
    }

    function newPreviewNode(tag, className, textValue) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (textValue !== undefined) node.textContent = textValue;
        return node;
    }

    function itemDescription(item, index) {
        const vehicles = [...new Set(Object.values(item.data.vehicleRules || {}).flatMap(group =>
            Array.isArray(group) ? group.flatMap(rule => rule.vehicleTypes || []) : []))];
        const desc = t("Restrizione {index}: {direction}, {vehicles}, {frames} fasce.", {
            index, direction:item.data.direction,
            vehicles: vehicles.length ? vehicles.join(', ') : t("Tutti i veicoli"),
            frames:item.data.timeFrames?.length || 0
        });
        const frameText = (item.data.timeFrames || []).map(frame => {
            const days = Array.isArray(frame.weekdays) && frame.weekdays.length
                ? frame.weekdays.map(localizedWeekday).join(", ") : "";
            const hours = frame.fromTime && frame.toTime
                ? frame.fromTime + "–" + frame.toTime : t("Tutto il giorno");
            const dates = frame.startDate || frame.endDate
                ? " [" + (frame.startDate || "…") + " → " + (frame.endDate || "…") + "]" : "";
            return (days ? days + " " : "") + hours + dates;
        }).join("; ");
        const engines = (item.motors || []).map(m =>
            [m.engineType, m.operator, m.capacityThreshold].filter(x => x !== null && x !== undefined).join(" "));
        return desc + (frameText ? " · " + frameText : "") +
            (engines.length ? " · " + engines.join(" / ") : "");
    }

    function updatePreviewToggle() {
        if (!preparedPreview) return;
        const skip = $("#rm-preview-skip")?.checked ?? true;
        const ack = $("#rm-preview-ack")?.checked ?? false;
        const applicable = preparedPreview.segments.filter(entry =>
            !entry.stats.unchanged && (!entry.stats.conflict || !skip));
        const skipped = preparedPreview.segments.filter(entry =>
            entry.stats.conflict && !entry.stats.unchanged && skip).length;
        const needsAck = applicable.some(entry => entry.stats.replacement || entry.stats.conflict);
        const countText = $("#rm-preview-eligible");
        if (countText) countText.textContent =
            t("Da modificare") + ": " + applicable.length + " · " +
            t("Saltati per conflitto") + ": " + skipped;
        const ackWrap = $("#rm-preview-ack-wrap");
        if (ackWrap) ackWrap.hidden = !needsAck;
        const button = $("#rm-preview-confirm");
        if (button) button.disabled = busy || !applicable.length || (needsAck && !ack);
    }

    function renderOperationPreview(plan) {
        const root = $("#rm-operation-preview");
        const title = $("#rm-preview-title");
        const summary = $("#rm-preview-summary");
        const list = $("#rm-preview-segments");
        if (!root || !title || !summary || !list) throw new Error("Preview UI unavailable");
        root.hidden = false;
        title.textContent = plan.title;
        list.replaceChildren();
        summary.replaceChildren();
        const issueCount = plan.segments.filter(e => e.stats.conflict).length;
        const changedCount = plan.segments.filter(e => !e.stats.unchanged).length;
        const unchangedCount = plan.segments.length - changedCount;
        for (const [label, count] of [
            [t("Segmenti selezionati"),plan.segments.length],
            [t("Da modificare"), changedCount],
            [t("Invariati"),unchangedCount],
            [t("Con possibili conflitti"),issueCount]
        ]) {
            const tile = newPreviewNode("div","rm-summary-pill");
            tile.append(newPreviewNode("div","rm-summary-label",label),
                newPreviewNode("div","rm-summary-value",String(count)));
            summary.appendChild(tile);
        }
        for (const entry of plan.segments) {
            const details = newPreviewNode("details","rm-preview-entry");
            if (entry.stats.conflict) details.classList.add("has-conflict");
            if (entry.stats.replacement) details.classList.add("has-replacement");
            const heading = newPreviewNode("summary",null,
                t("Segmento {id}",{id:entry.update.segmentId}) + " · " +
                t("Aggiunte: {count}",{count:entry.stats.added}) + " / " +
                t("Rimosse/sostituite: {count}",{count:entry.stats.removed}) +
                (entry.stats.conflict ? " ⚠" : "") +
                (entry.update.invert ? " ↔" : ""));
            details.appendChild(heading);
            const body = newPreviewNode("div","rm-preview-detail-body");
            body.appendChild(newPreviewNode("div",null,
                t("Conservate: {count}",{count:entry.stats.kept})));
            if (entry.update.invert) body.appendChild(newPreviewNode("div",null,t("Inversione FWD/REV")));
            if (entry.stats.unchanged) body.appendChild(newPreviewNode("div",null,t("Nessuna modifica")));
            if (entry.stats.replacement) body.appendChild(newPreviewNode("p","rm-preview-warning",
                t("Il preset sostituirà {count} restrizioni esistenti su questo segmento.",
                    {count:entry.stats.removed})));
            for (const issue of entry.stats.issues) {
                body.appendChild(newPreviewNode("p","rm-preview-warning", "⚠ " + issue));
            }
            const sub = newPreviewNode("details","rm-preview-rules");
            sub.appendChild(newPreviewNode("summary",null,t("Dettagli restrizioni")));
            const before = newPreviewNode("div","rm-preview-rule-section");
            before.appendChild(newPreviewNode("strong",null,t("Prima")));
            if (!entry.original.length) before.appendChild(newPreviewNode("div",null,t("Nessuna restrizione")));
            entry.original.forEach((item,i) =>
                before.appendChild(newPreviewNode("div",null,itemDescription(item,i+1))));
            const after = newPreviewNode("div","rm-preview-rule-section");
            after.appendChild(newPreviewNode("strong",null,t("Dopo")));
            if (!entry.update.items.length) after.appendChild(newPreviewNode("div",null,t("Nessuna restrizione")));
            entry.update.items.forEach((item,i) =>
                after.appendChild(newPreviewNode("div",null,itemDescription(item,i+1))));
            sub.append(before, after);
            body.appendChild(sub);
            details.appendChild(body);
            list.appendChild(details);
        }
        // Static labels in the new panel must follow the active WME locale.
        translateTree(root);
        $("#rm-preview-ack").checked = false;
        $("#rm-preview-skip").checked = true;
        updatePreviewToggle();
        root.scrollIntoView?.({behavior:"smooth",block:"start"});
    }

    async function prepareOperationPreview(mode) {
        if (busy) return;
        try { assertSdkCompatible(); } catch (e) { notify(msg(e), "error"); return; }
        clearOperationPreview();
        setBusy(true);
        try {
            let updates, title, sourceSnapshot, sourceId;
            if (mode === "preset") {
                const name = selectedName();
                if (!name) throw new Error(t("Seleziona un preset."));
                const source = read(name);
                const preset = asPreset(source);
                if (preset.restrictions.some(hasMotorcycle) && !preset.motorcycleDataCaptured) {
                    throw new Error(t("Questo preset moto è stato salvato senza i dati completi. Risalvalo dalla restrizione originale."));
                }
                const calendar = preset.calendarId ? getCalendar(preset.calendarId) : null;
                if (preset.calendarId && !calendar) {
                    throw new Error(t("Il calendario collegato al preset non esiste più. Ricollega un calendario o seleziona 'Nessun calendario'."));
                }
                const segments = await getSegments(await selectedIds());
                updates = segments.map(segment => buildUpdate(preset,segment,calendar));
                title = t("Anteprima del preset «{name}»",{name});
                sourceSnapshot = canonical({preset:source,calendar});
                sourceId = name;
            } else {
                sourceId = $("#rm-cal-list").value;
                const calendar = getCalendar(sourceId);
                if (!calendar) throw new Error(t("Seleziona un calendario già salvato."));
                const segments = await getSegments(await selectedIds());
                updates = segments.map(segment => buildCalendarOnlyUpdate(calendar,segment));
                title = t("Anteprima del calendario «{name}»",{name:calendar.name});
                sourceSnapshot = canonical(calendar);
            }
            const originalSegments = await getSegments(updates.map(u => u.segmentId));
            const entries = updates.map((update,i) => {
                const original = pairedRestrictions(originalSegments[i]);
                const stats = calculatePreviewStats(original, update.items,mode);
                return {update, stats, original, fingerprint:segmentFingerprint(originalSegments[i])};
            });
            preparedPreview = {
                mode, sourceId, sourceSnapshot, title,
                ids:updates.map(update => String(update.segmentId)).sort(),
                segments:entries
            };
            renderOperationPreview(preparedPreview);
            recordDiagnostic("info", "preview-ready", {
                segments:entries.length,
                conflicts:entries.filter(entry => entry.stats.conflict).length,
                unchanged:entries.filter(entry => entry.stats.unchanged).length
            });
            notify(t("L’anteprima non modifica la mappa. Esamina i segmenti prima di confermare."),"info");
        } catch(e) {
            clearOperationPreview();
            recordDiagnostic("error", "preview-failed");
            errorLog("Preview",e);
            notify(msg(e),"error");
        } finally {
            setBusy(false);
            updatePreviewToggle();
        }
    }

    async function executePreparedPreview() {
        if (busy || !preparedPreview) return;
        try { assertSdkCompatible(); } catch (e) { notify(msg(e), "error"); return; }
        const plan = preparedPreview;
        const skipConflicts = $("#rm-preview-skip").checked;
        const chosen = plan.segments.filter(entry =>
            !entry.stats.unchanged && (!entry.stats.conflict || !skipConflicts));
        if (!chosen.length) { notify(t("Nessun segmento applicabile con l’impostazione attuale."),"warning"); return; }
        if (chosen.some(e => e.stats.replacement || e.stats.conflict) && !$("#rm-preview-ack").checked) {
            notify(t("Seleziona la conferma dopo aver esaminato l’anteprima."),"warning"); return;
        }
        setBusy(true);
        let done = 0;
        try {
            const ids = (await selectedIds()).map(String).sort();
            if (canonical(ids) !== canonical(plan.ids)) throw new Error(t("Anteprima scaduta: la selezione, il preset, il calendario o le restrizioni in WME sono cambiati. Genera una nuova anteprima."));
            const sourceNow = plan.mode === "preset" ?
                canonical({preset:read(plan.sourceId),
                    calendar:asPreset(read(plan.sourceId)).calendarId ? getCalendar(asPreset(read(plan.sourceId)).calendarId) : null}) :
                canonical(getCalendar(plan.sourceId));
            if (sourceNow !== plan.sourceSnapshot) throw new Error(t("Anteprima scaduta: la selezione, il preset, il calendario o le restrizioni in WME sono cambiati. Genera una nuova anteprima."));
            const originals = await getSegments(plan.segments.map(e => e.update.segmentId));
            for (let i=0; i<plan.segments.length;i++) {
                if (segmentFingerprint(originals[i]) !== plan.segments[i].fingerprint) {
                    throw new Error(t("Anteprima scaduta: la selezione, il preset, il calendario o le restrizioni in WME sono cambiati. Genera una nuova anteprima."));
                }
            }
            if (chosen.some(e => e.update.items.some(item => item.motors.length)) && !$("#rm-experimental").checked) {
                throw new Error(t("Per applicare condizioni motore, abilita prima la casella sperimentale."));
            }
            for (const entry of chosen) {
                // Revalidate immediately before each update (other userscripts may edit the model).
                const fresh = (await getSegments([entry.update.segmentId]))[0];
                if (segmentFingerprint(fresh) !== entry.fingerprint) {
                    throw new Error(t("Anteprima scaduta: la selezione, il preset, il calendario o le restrizioni in WME sono cambiati. Genera una nuova anteprima."));
                }
                await applyOne(entry.update, entry.update.items.some(item => item.motors.length));
                done++;
            }
            const skipped = plan.segments.filter(e => e.stats.conflict && !e.stats.unchanged && skipConflicts).length;
            const unchanged = plan.segments.filter(e => e.stats.unchanged).length;
            recordDiagnostic("info", "apply-ok", {applied:done, skipped, unchanged});
            clearOperationPreview();
            notify(t("Applicati: {done}; ignorati per conflitti: {skipped}; invariati: {unchanged}.",
                {done,skipped,unchanged}) + " " + t("Controlla le modifiche prima di salvare la mappa."),"success");
        } catch(e) {
            recordDiagnostic("error", "apply-failed", {applied:done});
            errorLog("Preview apply",e);
            clearOperationPreview();
            notify(t("Applicazione interrotta dopo {done} segmenti. {detail}",{done,detail:msg(e)}),"error");
        } finally { setBusy(false); }
    }

    async function applyCalendarOnly() {
        await prepareOperationPreview("calendar");
    }

    function selectedName() {
        // Il campo nome viene aggiornato dalla selezione, ma consente anche nuovi nomi.
        return $("#rm-name")?.value.trim() || $("#rm-presets")?.value || "";
    }

    function refreshPresets(preferred) {
        const metricUpdater = tabPane?.querySelector?.(".rm-shell")?._rmUpdateMetrics || tabPane?._rmUpdateMetrics;
        const select = $("#rm-presets");
        if (!select) return;
        const previous = preferred ?? select.value;
        select.replaceChildren(new Option(t("-- Seleziona un preset --"), ""));
        for (const name of names()) {
            let label = name;
            try {
                const preset = asPreset(read(name));
                if (preset.sourceDirection === DIR.TWO_WAY) label += " (" + t("doppio senso") + ")";
                if (preset.calendarId) label += " 📅";
                if (preset.motorcycleConditions.some(r => r.length)) label += " 🏍 " + t("motori");
                if (preset.restrictions.some(hasMotorcycle) && !preset.motorcycleDataCaptured) {
                    label += " ⚠ " + t("da risalvare");
                }
            } catch (e) { errorLog("Preset illeggibile", name, e); }
            select.appendChild(new Option(label, name));
        }
        select.value = names().includes(previous) ? previous : "";
        if (typeof metricUpdater === "function") metricUpdater();
    }

    async function selectedIds() {
        const selected = await sdk.Editing.getSelection();
        if (!Array.isArray(selected?.ids) || !selected.ids.length) {
            throw new Error(t("Seleziona uno o più segmenti."));
        }
        if (selected.objectType && !String(selected.objectType).toLowerCase().includes("segment")) {
            throw new Error(t("La selezione non contiene segmenti."));
        }
        return selected.ids;
    }

    async function getSegments(ids) {
        const segments = await Promise.all(ids.map(id =>
            sdk.DataModel.Segments.getById({ segmentId: id })));
        if (segments.some(s => !s)) throw new Error(t("Segmento SDK non trovato."));
        return segments;
    }

    // Associa oggetti SDK e oggetti WME interni per posizione;
    // rifiuta di procedere quando la corrispondenza non è verificabile.
    function pairedRestrictions(segment) {
        const regular = segment.restrictions || [];
        const internal = rawRestrictions(segment.id);
        if (regular.length !== internal.length) {
            throw new Error(t("Restrizioni SDK/modello interno non allineate sul segmento {id}.", {id:segment.id}));
        }
        return regular.map((restriction, i) => {
            const raw = internal[i];
            if (typeof raw?.toJSON !== "function" || typeof raw?.with !== "function") {
                throw new Error(t("Restrizione interna WME non clonabile."));
            }
            const rawData = copy(raw.toJSON());
            const normalized = toRestrictionData(restriction);
            if (rawData.direction && rawData.direction !== normalized.direction) {
                throw new Error(t("Direzione della restrizione interna diversa da quella SDK."));
            }
            return {
                data: normalized,
                raw: rawData,
                motors: normalizedMotorRules(raw)
            };
        });
    }

    async function savePreset() {
        if (busy) return;
        setBusy(true);
        try {
            const name = $("#rm-name").value.trim();
            if (!name || name === "*Clipboard*") throw new Error(t("Inserisci un nome preset valido."));
            const ids = await selectedIds();
            if (ids.length !== 1) throw new Error(t("Per salvare seleziona un solo segmento."));
            const [segment] = await getSegments(ids);
            const pairs = pairedRestrictions(segment);
            if (!pairs.length) throw new Error(t("Il segmento non contiene restrizioni."));
            for (const item of pairs) {
                if (!sameMotors(item.motors, motorRulesFromRawJson(item.raw))) {
                    throw new Error(t("Il modello interno non serializza le condizioni del motore nel JSON. Salvataggio bloccato per sicurezza."));
                }
            }
            const previousPreset = read(name);
            const savedCalendar = previousPreset ? asPreset(previousPreset).calendarId : null;
            const preset = {
                formatVersion: FORMAT,
                legacy: false,
                sourceDirection: sourceDirection(segment),
                sourceDirectionLabel: ({A_TO_B:"A→B",B_TO_A:"B→A",TWO_WAY:"doppio senso"})[sourceDirection(segment)] || "direzione sconosciuta",
                motorcycleDataCaptured: true,
                restrictions: pairs.map(p => p.data),
                rawRestrictions: pairs.map(p => p.raw),
                motorcycleConditions: pairs.map(p => p.motors),
                calendarId: savedCalendar
            };
            if (read(name) !== null && !confirm(t('Sovrascrivere il preset "{name}"?', {name}))) return;
            localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(preset));
            refreshPresets(name);
            refreshCalendarSelects();
            const count = preset.motorcycleConditions.reduce((n, items) => n + items.length, 0);
            notify(t('Salvate {count} restrizioni nel preset "{name}". Regole motore: {motors}.', {count:pairs.length,name,motors:count}), "success");
            // Do not log raw presets or user-supplied names in the browser console.
            recordDiagnostic("info", "preset-saved", {restrictions:pairs.length});
        } catch (e) {
            errorLog(e);
            notify(msg(e), "error");
        } finally { setBusy(false); }
    }

    function buildUpdate(preset, segment, calendar = null) {
        const targetDirection = sourceDirection(segment);
        const invert = shouldInvert(preset.sourceDirection, targetDirection);
        const templates = preset.restrictions.map((data, i) => {
            const item = toRestrictionData(data);
            if (invert) item.direction = invertDirection(item.direction);
            const raw = preset.rawRestrictions?.[i] ? copy(preset.rawRestrictions[i]) : null;
            if (raw) raw.direction = item.direction;
            return { data: item, raw, motors: preset.motorcycleConditions[i] || [] };
        });
        const source = calendar ? expandCalendarItems(templates, calendar) : templates;
        const affected = new Set(source.map(item => item.data.direction));
        const retained = pairedRestrictions(segment)
            .filter(item => !affected.has(item.data.direction));
        return {
            segmentId: segment.id,
            invert,
            calendarApplied: Boolean(calendar),
            items: [...retained, ...source]
        };
    }

    // Richiede che un'azione venga realmente registrata: non annulla modifiche
    // precedenti e non chiama Undo quando l'azione corrente non è identificabile.
    async function rollbackOwnAction(beforeActions, segmentId) {
        const now = pageWindow.W?.model?.actionManager?.getActions?.() || [];
        if (now.length !== beforeActions.length + 1) return false;
        const last = now[now.length - 1];
        if (last?.constructor?.name !== "UpdateSegmentsRestrictions") return false;
        const subs = last.subActions || [];
        if (!subs.some(s => String(s.object?.getID?.() ?? s.object?.attributes?.id) === String(segmentId))) {
            return false;
        }
        await sdk.Editing.undo();
        return true;
    }

    function frameStamp(frame) {
        return JSON.stringify({
            startDate: frame?.startDate ?? null,
            endDate: frame?.endDate ?? null,
            fromTime: frame?.fromTime ?? null,
            toTime: frame?.toTime ?? null,
            weekdays: Array.isArray(frame?.weekdays) ? [...frame.weekdays].sort() : null
        });
    }

    async function verifyCalendarApplied(update) {
        if (!update.calendarApplied) return;
        const segment = await sdk.DataModel.Segments.getById({ segmentId: update.segmentId });
        const current = segment?.restrictions || [];
        if (current.length !== update.items.length) {
            throw new Error(t("Numero restrizioni inatteso: {actual} anziché {expected}.", {actual:current.length, expected:update.items.length}));
        }
        // I frame sono attesi nella stessa posizione dell'azione SDK, con un
        // singolo frame per ogni restrizione prodotta dal calendario.
        for (let i = 0; i < current.length; i++) {
            const desired = update.items[i].data.timeFrames || [];
            const actual = current[i].timeFrames || [];
            if (desired.length !== actual.length ||
                desired.some((frame, j) => frameStamp(frame) !== frameStamp(actual[j]))) {
                throw new Error(t("Date/orari non corrispondenti nella restrizione {index}.", {index:i+1}));
            }
        }
    }

    // Percorso sperimentale: intercetta SOLTANTO l'azione di restrizione
    // prodotta dalla chiamata SDK immediatamente seguente. Non costruisce
    // classi private né modifica lo stack delle azioni in autonomia.
    async function applyOne(update, rich) {
        const desired = update.items;
        const manager = pageWindow.W?.model?.actionManager;
        const beforeActions = manager?.getActions?.()?.slice() || [];
        const sdkData = desired.map(item => toSdkData(item.data));
        if (!rich) {
            await sdk.DataModel.Segments.updateSegment({ segmentId: update.segmentId, restrictions: sdkData });
            try {
                await verifyCalendarApplied(update);
            } catch (e) {
                const undone = await rollbackOwnAction(beforeActions, update.segmentId);
                throw new Error(`${msg(e)} ${undone ? t("Modifica annullata.") : t("Verifica e annulla l'ultima modifica in WME.")}`);
            }
            return;
        }
        if (!manager || typeof manager.add !== "function") {
            throw new Error(t("ActionManager WME non disponibile: regole motore non applicate."));
        }
        const own = Object.getOwnPropertyDescriptor(manager, "add");
        const originalAdd = manager.add;
        let patched = false;
        let intercepted = false;
        let interceptedError = null;
        try {
            manager.add = function (action, ...args) {
                if (action?.constructor?.name !== "UpdateSegmentsRestrictions") {
                    return originalAdd.call(this, action, ...args);
                }
                intercepted = true;
                try {
                    const subs = action.subActions || [];
                    const target = subs.find(sub =>
                        String(sub.object?.getID?.() ?? sub.object?.attributes?.id) === String(update.segmentId)
                    );
                    if (!target || !Array.isArray(target.newAttributes?.restrictions)) {
                        throw new Error(t("La sottoazione WME non contiene le restrizioni attese."));
                    }
                    const original = target.newAttributes.restrictions;
                    if (original.length !== desired.length) {
                        throw new Error(t("Numero restrizioni diverso nell'azione WME."));
                    }
                    const replacements = original.map((restriction, i) => {
                        const expected = desired[i];
                        if (!expected.raw) {
                            if (expected.motors.length) {
                                throw new Error(t("Mancano i dati WME completi delle regole motore."));
                            }
                            return restriction;
                        }
                        if (typeof restriction?.with !== "function") {
                            throw new Error(t("SegmentRestriction.with() non disponibile."));
                        }
                        // Il modello interno può usare un formato orario diverso.
                        // Lasciamo gli orari già normalizzati dall'azione SDK,
                        // reintegrando dal preset solo le proprietà interne del motore.
                        const sdkGenerated = restriction.toJSON?.() || {};
                        const next = restriction.with({
                            ...copy(expected.raw),
                            direction: expected.data.direction,
                            timeFrames: sdkGenerated.timeFrames ?? copy(expected.data.timeFrames)
                        });
                        if (!sameMotors(normalizedMotorRules(next), expected.motors)) {
                            throw new Error(t("La ricostruzione ha perso condizioni motociclistiche."));
                        }
                        return next;
                    });
                    target.newAttributes.restrictions = replacements;
                    patched = true;
                } catch (e) {
                    interceptedError = e;
                    throw e; // Non registrare un'azione incompleta.
                }
                return originalAdd.call(this, action, ...args);
            };
            if (manager.add === originalAdd) {
                throw new Error(t("Impossibile intercettare il gestore azioni WME."));
            }
            try {
                await sdk.DataModel.Segments.updateSegment({
                    segmentId: update.segmentId,
                    restrictions: sdkData
                });
            } finally {
                if (own) Object.defineProperty(manager, "add", own);
                else delete manager.add;
            }
        } catch (e) {
            // In caso di eccezione, non ripristinare qui un eventuale metodo
            // sostituito: viene ripristinato nel finally sottostante.
            const undone = await rollbackOwnAction(beforeActions, update.segmentId);
            throw new Error(`${msg(interceptedError || e)}${undone ? " " + t("Modifica annullata.") : " " + t("Controlla le modifiche in sospeso in WME.")}`);
        } finally {
            // Ripristino anche quando l'assegnazione dell'intercettore fallisce.
            if (own) Object.defineProperty(manager, "add", own);
            else delete manager.add;
        }
        const newActions = manager.getActions?.() || [];
        const expectedRules = desired.map(item => item.motors);
        let verified = false;
        try {
            const after = rawRestrictions(update.segmentId);
            verified = intercepted && patched && newActions.length === beforeActions.length + 1 &&
                after.length === expectedRules.length &&
                after.every((r, i) => sameMotors(normalizedMotorRules(r), expectedRules[i]));
        } catch (e) { errorLog("Verifica post-applicazione", e); }
        if (!verified) {
            const undone = await rollbackOwnAction(beforeActions, update.segmentId);
            throw new Error(t("Verifica delle condizioni motociclistiche non riuscita.") + " " +
                (undone ? t("Modifica annullata.") : t("Verifica e annulla manualmente l'ultima modifica WME.")));
        }
        try {
            await verifyCalendarApplied(update);
        } catch (e) {
            const undone = await rollbackOwnAction(beforeActions, update.segmentId);
            throw new Error(t("Calendario non verificato: {detail}", {detail:msg(e)}) + " " +
                (undone ? t("Modifica annullata.") : t("Verifica e annulla manualmente l'ultima modifica WME.")));
        }
    }

    async function applyPreset() {
        await prepareOperationPreview("preset");
    }

    function deletePreset() {
        try {
            const name = selectedName();
            if (!name || read(name) === null) throw new Error(t("Preset non trovato."));
            if (!confirm(t('Eliminare il preset "{name}"?', {name}))) return;
            localStorage.removeItem(STORAGE_PREFIX + name);
            $("#rm-name").value = "";
            refreshPresets();
            notify(t('Preset "{name}" eliminato.', {name}), "success");
        } catch (e) { notify(msg(e), "error"); }
    }

    // Esportazione unica per calendario e preset. L'importazione mantiene
    // compatibilità con i backup precedenti (oggetto nome -> preset).
    function exportPresets() {
        try {
            const presets = {};
            for (const name of names()) presets[name] = read(name);
            const data = {
                rmBackupVersion: 1,
                presets,
                calendars: allCalendars()
            };
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json"
            }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "wme-restrictions-calendars.json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            recordDiagnostic("info", "backup-exported", {presets:Object.keys(presets).length, calendars:data.calendars.length});
            notify(t("Backup di preset e calendari esportato."), "success");
        } catch (e) { notify(msg(e), "error"); }
    }

    async function importPresets(file) {
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            if (!data || Array.isArray(data) || typeof data !== "object") {
                throw new Error(t("File JSON non valido."));
            }
            const bundle = data.rmBackupVersion === 1 &&
                data.presets && typeof data.presets === "object" &&
                !Array.isArray(data.presets) && Array.isArray(data.calendars);
            const entries = Object.entries(bundle ? data.presets : data);
            const validated = entries.map(([name, value]) => {
                if (!name || name === "*Clipboard*") throw new Error(t("Nome preset non valido: {name}", {name}));
                return [name, asPreset(value)];
            });
            const calendars = bundle ? data.calendars.map(normalizeCalendar) : [];
            const ids = new Set();
            for (const c of calendars) {
                if (!c.id) throw new Error(t("Il calendario {name} non ha un identificativo valido.", {name:c.name}));
                if (ids.has(c.id)) throw new Error(t("Identificativo calendario ripetuto: {id}", {id:c.id}));
                ids.add(c.id);
            }
            if (!validated.length && !calendars.length) throw new Error(t("Backup vuoto."));
            if (!confirm(t("Importare {presets} preset e {calendars} calendari?", {presets:validated.length, calendars:calendars.length}) + "\n" +
                t("Gli elementi con lo stesso nome o ID saranno sovrascritti. Si consiglia di esportare prima un backup."))) return;
            // Tutti i dati sono stati verificati prima di modificarne alcuno.
            for (const cal of calendars) localStorage.setItem(CAL_PREFIX + cal.id, JSON.stringify(cal));
            for (const [name, value] of validated) {
                localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(value));
            }
            refreshPresets();
            refreshCalendarSelects();
            recordDiagnostic("info", "backup-imported", {presets:validated.length, calendars:calendars.length});
            notify(t("Importati {presets} preset e {calendars} calendari.", {presets:validated.length, calendars:calendars.length}), "success");
        } catch (e) {
            recordDiagnostic("error", "backup-failed");
            errorLog("Import", e);
            notify(t("Importazione non riuscita: {detail}", {detail:msg(e)}), "error");
        }
    }

    function buildInterface() {
        const style = document.createElement("style");
        style.textContent = `
          .rm-container {
            --rm-bg: #f6f8fb;
            --rm-surface: #ffffff;
            --rm-surface-2: #f1f5fb;
            --rm-text: var(--primary-text-color, #1f2937);
            --rm-muted: #667085;
            --rm-border: #d8e2f0;
            --rm-border-strong: #b7c8e3;
            --rm-primary: #1890ff;
            --rm-primary-soft: #eaf4ff;
            --rm-success: #238b45;
            --rm-warning: #c58b00;
            --rm-danger: #d9534f;
            background: var(--rm-bg);
            color: var(--rm-text);
            font-size: 13px;
            line-height: 1.45;
            padding: 14px;
            border-radius: 22px;
          }
          .rm-container * { box-sizing: border-box; }
          .rm-shell { display: flex; flex-direction: column; gap: 14px; }
          .rm-hero {
            background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
            border: 1px solid var(--rm-border);
            border-radius: 22px;
            padding: 16px 18px;
            box-shadow: 0 10px 28px rgba(25, 52, 89, 0.06);
          }
          .rm-hero-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }
          .rm-title-wrap { display: flex; align-items: center; gap: 12px; }
          .rm-app-icon {
            width: 42px; height: 42px; border-radius: 14px;
            background: linear-gradient(135deg, #1890ff 0%, #7a5cff 100%);
            color: #fff; display: inline-flex; align-items: center; justify-content: center;
            font-size: 22px; flex: 0 0 auto;
            box-shadow: 0 12px 24px rgba(24, 144, 255, 0.22);
          }
          .rm-hero h2 { margin: 0; font-size: 24px; line-height: 1.15; }
          .rm-subtitle { margin: 4px 0 0; color: var(--rm-muted); }
          .rm-version-chip {
            align-self: flex-start;
            padding: 7px 12px; border-radius: 999px;
            background: var(--rm-primary-soft); color: var(--rm-primary);
            border: 1px solid #cde4ff; font-weight: 700; white-space: nowrap;
          }
          .rm-hero-metrics {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 10px; margin-top: 14px;
          }
          .rm-metric {
            background: var(--rm-surface-2);
            border: 1px solid var(--rm-border);
            border-radius: 18px; padding: 10px 12px;
          }
          .rm-metric-label { color: var(--rm-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
          .rm-metric-value { margin-top: 3px; font-weight: 700; }
          .rm-nav {
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
            background: var(--rm-surface); border: 1px solid var(--rm-border);
            border-radius: 18px; padding: 6px; box-shadow: 0 6px 18px rgba(25, 52, 89, 0.05);
          }
          .rm-nav-btn {
            border: 1px solid transparent; background: transparent; color: var(--rm-muted);
            border-radius: 14px; padding: 10px 12px; min-height: 44px;
            font-weight: 700; cursor: pointer;
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          }
          .rm-nav-btn.is-active {
            background: var(--rm-primary-soft); color: var(--rm-primary);
            border-color: #cde4ff;
            box-shadow: inset 0 0 0 1px rgba(24, 144, 255, .06);
          }
          .rm-panel { display: none; }
          .rm-panel.is-active { display: block; }
          .rm-grid { display: grid; gap: 14px; }
          .rm-grid.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .rm-grid.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .rm-card {
            background: var(--rm-surface);
            border: 1px solid var(--rm-border);
            border-radius: 22px;
            padding: 16px;
            box-shadow: 0 10px 24px rgba(25, 52, 89, 0.05);
          }
          .rm-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
          .rm-card-title { margin: 0; font-size: 17px; line-height: 1.2; }
          .rm-card-subtitle { margin: 4px 0 0; color: var(--rm-muted); font-size: 12px; }
          .rm-card-badge {
            padding: 6px 10px; border-radius: 999px; background: var(--rm-surface-2);
            border: 1px solid var(--rm-border); font-size: 11px; font-weight: 700; color: var(--rm-muted);
            white-space: nowrap;
          }
          .rm-field { margin: 0; }
          .rm-field + .rm-field { margin-top: 12px; }
          .rm-field label, .rm-inline-label {
            display: block; margin-bottom: 6px; font-weight: 700; color: var(--rm-text);
          }
          .rm-field-note { color: var(--rm-muted); font-size: 12px; margin-top: 4px; }
          .rm-container input[type=text],
          .rm-container input[type=date],
          .rm-container input[type=time],
          .rm-container input[type=number],
          .rm-container select,
          .rm-container textarea {
            width: 100%; min-height: 42px; padding: 10px 12px;
            border-radius: 14px; border: 1px solid var(--rm-border-strong);
            background: #fff; color: var(--rm-text); outline: none;
          }
          .rm-container input:focus,
          .rm-container select:focus,
          .rm-container textarea:focus {
            border-color: var(--rm-primary);
            box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.12);
          }
          .rm-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
          .rm-form-grid.cols-3 { grid-template-columns: repeat(3, minmax(0,1fr)); }
          .rm-stack { display: grid; gap: 12px; }
          .rm-buttons {
            display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px;
          }
          .rm-buttons.one-col { grid-template-columns: 1fr; }
          .rm-buttons.three-col { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .rm-container button {
            min-height: 46px; padding: 11px 14px; cursor: pointer; width: 100%;
            border-radius: 14px; border: 1px solid var(--rm-border-strong); background: #fff;
            color: var(--rm-text); font-weight: 700; line-height: 1.25; text-align: center;
            white-space: normal; word-break: break-word;
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            box-shadow: 0 1px 0 rgba(17,24,39,.02);
          }
          .rm-container button:hover:not(:disabled) { border-color: #95b7e5; background: #f8fbff; }
          .rm-container button:disabled { opacity: .6; cursor: wait; }
          .rm-container button.primary {
            background: var(--rm-primary); color: #fff; border-color: var(--rm-primary);
            box-shadow: 0 10px 18px rgba(24, 144, 255, 0.20);
          }
          .rm-container button.primary:hover:not(:disabled) { background: #1182ea; }
          .rm-container button.ghost { background: var(--rm-surface-2); }
          .rm-container button.danger { color: var(--rm-danger); border-color: #f0c5c2; background: #fff7f6; }
          .rm-container button.warning { color: #8d6100; border-color: #eed89f; background: #fff8e8; }
          .rm-inline-toggle {
            display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;
            padding: 12px 14px; border-radius: 16px; background: var(--rm-surface-2); border: 1px solid var(--rm-border);
          }
          .rm-inline-toggle label,
          .rm-days label,
          .rm-time-row label,
          .rm-cal-dates label,
          .rm-compact-check {
            display: inline-flex; gap: 6px; align-items: center; font-weight: 500; margin: 0;
          }
          .rm-cal-panel { display: grid; gap: 14px; }
          .rm-section-title { margin: 0; font-size: 14px; font-weight: 800; }
          .rm-section-note { margin: 0; color: var(--rm-muted); font-size: 12px; }
          .rm-subcard {
            border: 1px solid var(--rm-border); border-radius: 18px; padding: 14px; background: #fbfcff;
          }
          .rm-cal-dates { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: end; }
          .rm-slot {
            border: 1px solid var(--rm-border);
            border-radius: 18px; padding: 12px; background: #fff; margin: 0;
            display: grid; gap: 10px;
          }
          .rm-slot + .rm-slot { margin-top: 10px; }
          .rm-slot-head { display:flex; justify-content:space-between; align-items:center; gap:8px; }
          .rm-slot-title { font-weight: 800; }
          .rm-days { display:flex; flex-wrap:wrap; gap:10px 12px; }
          .rm-time-row { display:grid; grid-template-columns: 1fr 1fr auto; gap:10px; align-items:end; }
          .rm-time-range { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
          .rm-special-grid { display:grid; gap:10px; }
          .rm-expiry-banner { border-color:#e5bd6c; background:#fffaf0; }
          .rm-expiry-banner #rm-expiry-messages { display:grid;gap:6px;margin:10px 0; }
          .rm-expiry-banner #rm-expiry-open { max-width:200px; }
          .rm-local-row { display:grid;gap:10px;margin:10px 0; }
          .rm-exclusions-grid { display:grid; gap:10px; margin-top:10px; }
          .rm-excluded-row { background:#fff; border-color:var(--rm-border-strong); }
          .rm-excluded-row .rm-field label { font-weight:600; }
          .rm-exclude-heading { display:flex; flex-direction:column; gap:8px; }
          .rm-exclude-option { display:flex; gap:9px; align-items:flex-start; }
          .rm-exclude-option input { margin-top:3px; flex:0 0 auto; }
          .rm-cal-preview {
            padding: 12px 14px; white-space: pre-line; border: 1px solid var(--rm-border);
            border-radius: 16px; font-size: 12px; background: #fff;
          }
          .rm-preset-summary {
            display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px;
          }
          .rm-summary-pill {
            background: var(--rm-surface-2); border: 1px solid var(--rm-border);
            border-radius: 16px; padding: 10px 12px;
          }
          .rm-summary-label { color: var(--rm-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
          .rm-summary-value { font-weight: 700; margin-top: 4px; }
          .rm-experimental {
            padding: 14px; border: 1px solid #f0d086; border-radius: 18px; background: #fff8e8;
          }
          .rm-backup-box {
            padding: 14px; border: 1px dashed var(--rm-border-strong); border-radius: 18px; background: #fcfdff;
          }
          #rm-status {
            padding: 14px 16px; overflow-wrap:anywhere; background:#fff;
            border:1px solid var(--rm-border); border-radius:18px; min-height: 54px;
            box-shadow: 0 6px 18px rgba(25, 52, 89, 0.04);
          }
          #rm-status[data-type=error] { color: var(--rm-danger); border-color: #f0c5c2; background: #fff7f6; }
          #rm-status[data-type=success] { color: var(--rm-success); border-color: #bce3c7; background: #f4fbf6; }
          #rm-status[data-type=warning] { color: var(--rm-warning); border-color: #eed89f; background: #fff8e8; }
          .rm-info { font-size: 12px; color: var(--rm-muted); margin: 0; }
          .rm-container [hidden] { display:none !important; }

          .rm-preview-card {
            border: 1px solid #bcd6f5; background: #fff;
            border-radius: 19px; padding: 14px;
            box-shadow: 0 12px 22px rgba(24, 81, 150, 0.09);
          }
          .rm-preview-card h3 { margin: 0 0 6px; font-size: 17px; overflow-wrap:anywhere; }
          .rm-preview-card p { margin: 6px 0 12px; }
          .rm-preview-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
          .rm-preview-list { display:grid; gap:8px; margin-top:12px; max-height:380px; overflow-y:auto; }
          .rm-preview-entry { border:1px solid var(--rm-border); border-radius:12px; background:#f8fbff; }
          .rm-preview-entry.has-conflict { border-color:#e2a251; background:#fff8ea; }
          .rm-preview-entry.has-replacement:not(.has-conflict) { border-color:#d5c080; }
          .rm-preview-entry > summary { cursor:pointer; padding:11px; overflow-wrap:anywhere; font-weight:650; }
          .rm-preview-detail-body { padding: 4px 11px 12px; display:grid; gap:6px; overflow-wrap:anywhere; }
          .rm-preview-detail-body p { margin:2px 0; }
          .rm-preview-warning { color:#915d14; }
          .rm-preview-rules summary { cursor:pointer; font-weight:600; }
          .rm-preview-rules div { padding:5px 0 0 10px; font-size:12px; }
          .rm-preview-rule-section { margin-top:8px; border-left:2px solid var(--rm-border); padding-left:8px; }
          .rm-preview-rule-section strong { font-size:12px; }
          .rm-preview-choice { display:flex; align-items:flex-start; gap:8px; margin:12px 0; }
          .rm-preview-choice input { flex:0 0 auto; margin-top:3px; }
          .rm-preview-buttons { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
          .rm-preview-buttons button { min-width:0; }
          /* Mobile-first: measure the actual WME sidebar, not the browser viewport. */
          .rm-container {
            width: 100%; max-width: 100%; min-width: 0;
            padding: 10px; border-radius: 14px;
            container-type: inline-size;
            overflow-wrap: normal;
          }
          .rm-container .rm-shell,
          .rm-container .rm-panel,
          .rm-container .rm-grid,
          .rm-container .rm-card,
          .rm-container .rm-subcard,
          .rm-container .rm-field,
          .rm-container .rm-card-header > div,
          .rm-container .rm-title-wrap > div,
          .rm-container .rm-summary-pill {
            min-width: 0; max-width: 100%;
          }
          .rm-container .rm-grid,
          .rm-container .rm-grid.cols-2,
          .rm-container .rm-grid.cols-3,
          .rm-container .rm-form-grid,
          .rm-container .rm-form-grid.cols-3,
          .rm-container .rm-buttons,
          .rm-container .rm-buttons.three-col,
          .rm-container .rm-cal-dates,
          .rm-container .rm-preset-summary,
          .rm-container .rm-time-row,
          .rm-container .rm-time-range {
            grid-template-columns: minmax(0, 1fr);
          }
          .rm-container .rm-hero,
          .rm-container .rm-card { padding: 13px; border-radius: 17px; }
          .rm-container .rm-subcard,
          .rm-container .rm-slot { padding: 11px; border-radius: 14px; }
          .rm-container .rm-hero-top,
          .rm-container .rm-card-header {
            flex-direction: column; align-items: stretch;
          }
          .rm-container .rm-card-badge,
          .rm-container .rm-version-chip { align-self: flex-start; }
          .rm-container .rm-title-wrap { min-width: 0; }
          .rm-container .rm-hero h2 { font-size: 20px; line-height: 1.18; }
          .rm-container .rm-app-icon { width: 38px; height: 38px; font-size: 20px; }
          .rm-container .rm-hero-metrics { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
          .rm-container .rm-metric { min-width: 0; padding: 8px; }
          .rm-container .rm-metric-value { overflow-wrap: anywhere; }
          .rm-container .rm-nav {
            grid-template-columns: repeat(3, minmax(0,1fr));
            gap: 3px; padding: 4px; border-radius: 14px;
          }
          .rm-container .rm-nav-btn {
            min-width: 0; padding: 9px 2px;
            flex-direction: column; gap: 3px;
            white-space: normal; word-break: normal;
            font-size: 11px; line-height: 1.15;
          }
          .rm-nav-icon { font-size: 16px; }
          .rm-nav-label { white-space: nowrap; }
          .rm-container input[type=text],
          .rm-container input[type=date],
          .rm-container input[type=time],
          .rm-container input[type=number],
          .rm-container select,
          .rm-container textarea { min-width: 0; max-width: 100%; }
          .rm-container .rm-time-row label {
            display: flex; flex-direction: column; align-items: flex-start;
            min-width: 0; max-width: 100%; gap: 5px;
          }
          .rm-container .rm-time-row label:has(> input[type=checkbox]) {
            flex-direction: row; align-items: center;
          }
          .rm-container .rm-slot-head { flex-wrap: wrap; }
          .rm-container .rm-slot-head .rm-remove-slot {
            width: auto; min-height: 34px; padding: 7px 10px;
          }
          .rm-container .rm-buttons { gap: 8px; margin-top: 10px; }
          .rm-container button { min-width: 0; max-width: 100%; }
          .rm-container .rm-cal-preview { overflow-wrap: anywhere; }
          .rm-container .rm-days { gap: 7px 11px; }
          .rm-container .rm-inline-toggle { display: grid; grid-template-columns: minmax(0,1fr); }
          .rm-container .rm-inline-toggle label {
            min-width: 0; overflow-wrap: break-word;
          }
          .rm-container .rm-special .rm-time-row > .rm-info { overflow-wrap: anywhere; }
          .rm-container .rm-special .rm-time-row select,
          .rm-container .rm-special .rm-time-row input[type=time],
          .rm-container .rm-special .rm-time-row input[type=number] { width: 100% !important; }
          .rm-container .rm-special .rm-time-row .rm-special-remove { margin-top: 4px; }
          .rm-container .rm-preset-summary { display: none; }
          .rm-container .rm-metric-label,
          .rm-container .rm-summary-label { overflow-wrap: break-word; }
          .rm-container #rm-status { font-size: 12px; padding: 10px 12px; min-height: 0; }
          /* WME Studio or manually widened WME sidebar: progressively enhance. */
          @container (min-width: 470px) {
            .rm-container .rm-hero h2 { font-size: 23px; }
            .rm-container .rm-buttons:not(.one-col) { grid-template-columns: repeat(2,minmax(0,1fr)); }
            .rm-container .rm-form-grid,
            .rm-container .rm-cal-dates,
            .rm-container .rm-time-range { grid-template-columns: repeat(2,minmax(0,1fr)); }
            .rm-container .rm-nav-btn { flex-direction: row; gap: 6px; font-size: 12px; }
            .rm-container .rm-hero-metrics { grid-template-columns: repeat(4,minmax(0,1fr)); }
            .rm-container .rm-preset-summary { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); }
          }
          @container (min-width: 680px) {
            .rm-container .rm-special .rm-special-nth { grid-template-columns: repeat(3,minmax(0,1fr)); }
            .rm-container .rm-time-row { grid-template-columns: repeat(3,minmax(0,1fr)); }
            .rm-container .rm-hero-top { flex-direction: row; }
          }
          @container (min-width: 900px) {
            .rm-container .rm-grid.cols-2 { grid-template-columns: repeat(2,minmax(0,1fr)); }
            .rm-container .rm-grid.cols-3 { grid-template-columns: repeat(3,minmax(0,1fr)); }
          }
          /* Avoid a two-column form becoming too narrow inside a wide two-card layout. */
          @container (min-width: 900px) and (max-width: 1160px) {
            .rm-container .rm-form-grid { grid-template-columns: minmax(0,1fr); }
            .rm-container .rm-cal-dates { grid-template-columns: minmax(0,1fr); }
          }
          .rm-maintenance-output {
            white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px 12px;
            border: 1px solid var(--rm-border); border-radius: 12px;
            background: var(--rm-surface-2); color: var(--rm-text);
            font: 11px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace;
            max-height: 210px; overflow-y: auto;
          }
          #rm-sdk-compat[data-type="error"] { border-color: var(--rm-danger); }
          #rm-sdk-compat[data-type="warning"] { border-color: var(--rm-warning); }
          #rm-sdk-compat[data-type="success"] { border-color: var(--rm-success); }
        `;
        tabPane.appendChild(style);

        const container = document.createElement("div");
        container.className = "rm-container";
        container.innerHTML = `
          <div class="rm-shell">
            <section class="rm-hero">
              <div class="rm-hero-top">
                <div class="rm-title-wrap">
                  <div class="rm-app-icon">🛣️</div>
                  <div>
                    <h2>Restriction Manager</h2>
                    <p class="rm-subtitle">Preset, calendari e restrizioni in un pannello più semplice e moderno.</p>
                  </div>
                </div>
                <div class="rm-version-chip">v2.9.0</div>
              </div>
              <div class="rm-hero-metrics">
                <div class="rm-metric"><div class="rm-metric-label">Preset</div><div class="rm-metric-value" id="rm-metric-presets">—</div></div>
                <div class="rm-metric"><div class="rm-metric-label">Calendari</div><div class="rm-metric-value" id="rm-metric-calendars">—</div></div>
                <div class="rm-metric"><div class="rm-metric-label">Motori moto</div><div class="rm-metric-value">Supportati</div></div>
                <div class="rm-metric"><div class="rm-metric-label">Backup</div><div class="rm-metric-value">JSON locale</div></div>
              </div>
            </section>

            <div id="rm-expiry-banner" class="rm-card rm-expiry-banner" hidden>
              <div class="rm-card-header">
                <div><h3 class="rm-card-title">⚠ Scadenze calendari</h3>
                  <p class="rm-card-subtitle">Le scadenze riguardano i calendari salvati, non le restrizioni già pubblicate: non vengono modificate automaticamente.</p></div>
              </div>
              <div id="rm-expiry-messages"></div>
              <button type="button" id="rm-expiry-open">Apri calendari</button>
            </div>
            <nav class="rm-nav" aria-label="Sezioni pannello">
              <button type="button" class="rm-nav-btn is-active" data-target="rm-panel-presets"><span class="rm-nav-icon" aria-hidden="true">🧩</span><span class="rm-nav-label">Preset</span></button>
              <button type="button" class="rm-nav-btn" data-target="rm-panel-calendars"><span class="rm-nav-icon" aria-hidden="true">📅</span><span class="rm-nav-label">Calendari</span></button>
              <button type="button" class="rm-nav-btn" data-target="rm-panel-tools"><span class="rm-nav-icon" aria-hidden="true">⚙️</span><span class="rm-nav-label">Strumenti</span></button>
            </nav>

            <section class="rm-preview-card" id="rm-operation-preview" hidden aria-label="Anteprima modifiche">
              <h3 id="rm-preview-title">Anteprima modifiche</h3>
              <p class="rm-info">L’anteprima non modifica la mappa. Esamina i segmenti prima di confermare.</p>
              <div class="rm-preview-grid" id="rm-preview-summary"></div>
              <div id="rm-preview-segments" class="rm-preview-list"></div>
              <label class="rm-preview-choice">
                <input type="checkbox" id="rm-preview-skip" checked>
                <span>Escludi i segmenti con possibili conflitti (consigliato)</span>
              </label>
              <label class="rm-preview-choice" id="rm-preview-ack-wrap" hidden>
                <input type="checkbox" id="rm-preview-ack">
                <span>Ho controllato l’anteprima e accetto le sostituzioni o sovrapposizioni segnalate.</span>
              </label>
              <div class="rm-info" id="rm-preview-eligible"></div>
              <div class="rm-preview-buttons">
                <button id="rm-preview-cancel" type="button">Annulla anteprima</button>
                <button id="rm-preview-confirm" type="button" class="primary">Conferma applicazione</button>
              </div>
              <p class="rm-info">Controlli di conflitto indicativi: verificare sempre date, fasce, veicoli e direzioni in WME.</p>
            </section>

            <div id="rm-status" role="status" aria-live="polite">Restriction Manager pronto.</div>

            <section class="rm-panel is-active" id="rm-panel-presets">
              <div class="rm-grid cols-2">
                <article class="rm-card">
                  <div class="rm-card-header">
                    <div>
                      <h3 class="rm-card-title">Gestione preset</h3>
                      <p class="rm-card-subtitle">Crea, seleziona e applica preset di restrizioni ai segmenti selezionati.</p>
                    </div>
                    <span class="rm-card-badge">Preset</span>
                  </div>
                  <div class="rm-form-grid">
                    <div class="rm-field">
                      <label for="rm-name">Nome preset</label>
                      <input id="rm-name" type="text" placeholder="Nome del preset">
                    </div>
                    <div class="rm-field">
                      <label for="rm-presets">Preset salvati</label>
                      <select id="rm-presets"></select>
                    </div>
                  </div>
                  <div class="rm-preset-summary">
                    <div class="rm-summary-pill">
                      <div class="rm-summary-label">Uso rapido</div>
                      <div class="rm-summary-value">Salva / Applica / Elimina</div>
                    </div>
                    <div class="rm-summary-pill">
                      <div class="rm-summary-label">Compatibilità</div>
                      <div class="rm-summary-value">Direzioni A↔B e regole moto</div>
                    </div>
                  </div>
                  <div class="rm-buttons">
                    <button id="rm-save">💾 Salva preset</button>
                    <button id="rm-delete" class="danger">🗑️ Elimina preset</button>
                  </div>
                  <div class="rm-buttons one-col">
                    <button id="rm-apply" class="primary">🚀 Applica ai segmenti selezionati</button>
                  </div>
                </article>

                <article class="rm-card">
                  <div class="rm-card-header">
                    <div>
                      <h3 class="rm-card-title">Calendario collegato</h3>
                      <p class="rm-card-subtitle">Applica un calendario salvato al preset selezionato senza toccare direzioni e veicoli.</p>
                    </div>
                    <span class="rm-card-badge">Collegamento</span>
                  </div>
                  <div class="rm-field">
                    <label for="rm-link-calendar">Calendario da usare con il preset</label>
                    <select id="rm-link-calendar"></select>
                    <div class="rm-field-note">Se scegli “nessun calendario”, il preset mantiene i suoi orari originali.</div>
                  </div>
                  <div class="rm-buttons one-col">
                    <button id="rm-link-save" class="primary">🔗 Salva collegamento al preset selezionato</button>
                  </div>
                  <div class="rm-buttons">
                    <button id="rm-link-unlink" class="ghost">⛓️‍💥 Scollega calendario dal preset</button>
                    <button id="rm-link-duplicate" class="ghost">📄 Copia preset con questo calendario</button>
                  </div>
                </article>
              </div>
            </section>

            <section class="rm-panel" id="rm-panel-calendars">
              <div class="rm-grid cols-2">
                <article class="rm-card">
                  <div class="rm-card-header">
                    <div>
                      <h3 class="rm-card-title">Libreria calendari</h3>
                      <p class="rm-card-subtitle">Calendari locali e riutilizzabili. Non sono gli Scheduler comunitari delle zone scolastiche.</p>
                    </div>
                    <span class="rm-card-badge">Calendari</span>
                  </div>
                  <div class="rm-form-grid">
                    <div class="rm-field">
                      <label for="rm-cal-list">Calendari salvati</label>
                      <select id="rm-cal-list"></select>
                    </div>
                    <div class="rm-field">
                      <label for="rm-cal-name">Nome calendario</label>
                      <input type="text" id="rm-cal-name" placeholder="Esempio: Orari accesso scuola">
                    </div>
                  </div>
                  <div class="rm-form-grid">
                    <div class="rm-field">
                      <label for="rm-cal-tz">Fuso orario (IANA)</label>
                      <input type="text" id="rm-cal-tz" value="Europe/Rome">
                    </div>
                    <div class="rm-field">
                      <label class="rm-inline-label">Intervallo di validità</label>
                      <div class="rm-inline-toggle">
                        <label><input type="checkbox" id="rm-cal-ranged"> Limita a un intervallo di date</label>
                        <label class="rm-compact-check"><input type="checkbox" id="rm-cal-repeat" disabled> Ripeti ogni anno</label>
                      </div>
                    </div>
                  </div>
                  <div class="rm-cal-dates">
                    <div class="rm-field">
                      <label for="rm-cal-start">Data iniziale</label>
                      <input type="date" id="rm-cal-start" disabled>
                    </div>
                    <div class="rm-field">
                      <label for="rm-cal-end">Data finale</label>
                      <input type="date" id="rm-cal-end" disabled>
                    </div>
                    <div class="rm-subcard">
                      <h4 class="rm-section-title">Sintesi rapida</h4>
                      <p class="rm-section-note">Puoi usare solo fasce settimanali, solo ricorrenze mobili oppure entrambe.</p>
                    </div>
                  </div>

                  <div class="rm-subcard">
                    <div class="rm-exclude-heading">
                      <div>
                        <h4 class="rm-section-title">🚫 Giorni esclusi</h4>
                        <p class="rm-section-note">Le restrizioni NON saranno attive durante festività e vacanze. Imposta prima un intervallo preciso di validità; con esclusioni attive non usare «Ripeti ogni anno».</p>
                      </div>
                    </div>
                    <div class="rm-exclude-heading">
                      <div>
                        <h4 class="rm-section-title">🌍 Festività per territorio</h4>
                        <p class="rm-section-note">Scegli Paese, eventuale Regione e un periodo preciso: le festività vengono caricate automaticamente. Se non vuoi escluderle, lascia il Paese vuoto.</p>
                      </div>
                    </div>
                    <div class="rm-form-grid cols-3">
                      <div class="rm-field"><label for="rm-holiday-country">Paese delle festività (ISO)</label>
                        <input id="rm-holiday-country" type="text" maxlength="2" list="rm-holiday-countries" value="" placeholder="IT, FR, DE…">
                        <datalist id="rm-holiday-countries"></datalist>
                      </div>
                      <div class="rm-field"><label for="rm-holiday-region">Regione / suddivisione (ISO 3166-2, facoltativa)</label>
                        <input id="rm-holiday-region" type="text" list="rm-holiday-regions" placeholder="">
                        <datalist id="rm-holiday-regions"></datalist>
                        <p class="rm-info" id="rm-holiday-region-help">Seleziona prima il Paese delle festività.</p>
                      </div>
                      <div class="rm-field"><label for="rm-holiday-locality">Località (nome, facoltativo)</label>
                        <input id="rm-holiday-locality" type="text" maxlength="90" placeholder="Brescia">
                      </div>
                    </div>
                    <div class="rm-buttons one-col">
                      <button type="button" id="rm-holiday-load">🌐 Aggiorna festività del Paese e della Regione</button>
                    </div>
                    <p class="rm-info" id="rm-holiday-snapshot-status">Scegli il Paese e un intervallo di date per caricare automaticamente le festività. Lascia il Paese vuoto se non vuoi escluderle.</p>
                    <p class="rm-info">I dati festivi sono informativi: verifica gli ordinamenti locali e il calendario scolastico ufficiale. Le chiusure scolastiche vanno inserite a parte.</p>
                    <div class="rm-subcard">
                      <h4 class="rm-section-title">Festività locali annuali</h4>
                      <p class="rm-section-note">I santi patroni e i giorni di chiusura comunali non vengono recuperati automaticamente: inseriscili qui o nei periodi esclusi.</p>
                      <div id="rm-local-annual" class="rm-stack"></div>
                      <div class="rm-buttons one-col"><button type="button" id="rm-local-add">+ Aggiungi festività locale</button></div>
                    </div>
                    <div id="rm-exclusions" class="rm-exclusions-grid"></div>
                    <div class="rm-buttons one-col">
                      <button type="button" id="rm-exclusion-add">+ Aggiungi data o periodo escluso</button>
                    </div>
                    <p class="rm-info" style="margin-top:10px;">Per le scuole inserisci manualmente vacanze regionali, chiusure dell'istituto e Santo Patrono. Le date escluse hanno precedenza su tutte le fasce e ricorrenze.</p>
                  </div>

                  <div class="rm-subcard">
                    <div class="rm-card-header" style="margin-bottom:10px;">
                      <div>
                        <h4 class="rm-section-title">Fasce orarie e giorni</h4>
                        <p class="rm-section-note">Ogni fascia genera una restrizione distinta quando necessario.</p>
                      </div>
                      <button type="button" id="rm-cal-add-slot">+ Aggiungi fascia oraria</button>
                    </div>
                    <div id="rm-slots" class="rm-stack"></div>
                  </div>
                </article>

                <article class="rm-card rm-cal-panel">
                  <div class="rm-card-header">
                    <div>
                      <h3 class="rm-card-title">Date mobili e applicazione</h3>
                      <p class="rm-card-subtitle">Ricorrenze annuali come Pasqua, Pasquetta o la seconda domenica di marzo.</p>
                    </div>
                    <span class="rm-card-badge">Ricorrenze</span>
                  </div>

                  <div class="rm-subcard">
                    <h4 class="rm-section-title">Ricorrenze annuali su date mobili</h4>
                    <p class="rm-section-note">Ogni occorrenza genera una restrizione distinta e va rinnovata al termine delle annualità.</p>
                    <div class="rm-form-grid">
                      <div class="rm-field">
                        <label for="rm-special-start-year">Anno iniziale</label>
                        <input type="number" id="rm-special-start-year" min="2000" max="2099" step="1">
                      </div>
                      <div class="rm-field">
                        <label for="rm-special-end-year">Anno finale</label>
                        <input type="number" id="rm-special-end-year" min="2000" max="2099" step="1">
                      </div>
                    </div>
                    <div id="rm-special-rows" class="rm-special-grid"></div>
                    <div class="rm-buttons one-col">
                      <button type="button" id="rm-special-add">+ Aggiungi ricorrenza mobile</button>
                    </div>
                  </div>

                  <div>
                    <h4 class="rm-section-title" style="margin-bottom:8px;">Anteprima calendario</h4>
                    <div class="rm-cal-preview" id="rm-cal-preview"></div>
                  </div>

                  <div class="rm-buttons">
                    <button id="rm-cal-new" class="ghost">🆕 Nuovo</button>
                    <button id="rm-cal-duplicate" class="ghost">📄 Duplica</button>
                    <button id="rm-cal-save" class="primary">💾 Salva calendario</button>
                    <button id="rm-cal-delete" class="danger">🗑️ Elimina calendario</button>
                  </div>
                  <div class="rm-buttons one-col">
                    <button id="rm-cal-apply" class="primary">📅 Applica SOLO il calendario alle restrizioni selezionate</button>
                  </div>
                  <p class="rm-info">“Solo calendario” cambia gli orari delle restrizioni esistenti senza cambiare veicoli o direzioni. Modificare qui un calendario non aggiorna automaticamente le restrizioni già salvate su WME.</p>
                </article>
              </div>
            </section>

            <section class="rm-panel" id="rm-panel-tools">
              <div class="rm-grid cols-2">
                <article class="rm-card">
                  <div class="rm-card-header">
                    <div>
                      <h3 class="rm-card-title">Opzioni avanzate</h3>
                      <p class="rm-card-subtitle">Usa queste opzioni solo quando ti servono le condizioni motore delle motociclette.</p>
                    </div>
                    <span class="rm-card-badge">Avanzate</span>
                  </div>
                  <div class="rm-experimental">
                    <label class="rm-inline-label"><input type="checkbox" id="rm-experimental"> Abilita applicazione sperimentale delle condizioni motore</label>
                    <p class="rm-info">Utilizza un’interfaccia interna WME non supportata dallo SDK. Anche la selezione multipla procede un segmento per volta: in caso di errore gli aggiornamenti precedenti potrebbero essere già applicati. Verifica sempre prima di salvare.</p>
                  </div>
                </article>

                <article class="rm-card">
                  <div class="rm-card-header">
                    <div>
                      <h3 class="rm-card-title">Backup e manutenzione</h3>
                      <p class="rm-card-subtitle">Esporta o importa preset e calendari in un unico file JSON.</p>
                    </div>
                    <span class="rm-card-badge">Backup</span>
                  </div>
                  <div class="rm-backup-box">
                    <div class="rm-buttons">
                      <button id="rm-export">⬇️ Esporta JSON</button>
                      <button id="rm-import">⬆️ Importa JSON</button>
                    </div>
                    <input id="rm-file" type="file" accept=".json,application/json" hidden>
                    <p class="rm-info">Il backup include preset, collegamenti ai calendari e libreria calendari.</p>
                  </div>
                </article>
              </div>
              <article class="rm-card" id="rm-maintenance-card">
                <div class="rm-card-header">
                  <div>
                    <h3 class="rm-card-title">Controllo compatibilità SDK</h3>
                    <p class="rm-card-subtitle">Verifica versioni e funzioni necessarie, senza modificare la mappa.</p>
                  </div>
                  <span class="rm-card-badge">SDK</span>
                </div>
                <pre id="rm-sdk-compat" class="rm-maintenance-output" aria-live="polite"></pre>
                <div class="rm-buttons one-col"><button type="button" id="rm-sdk-recheck">🔎 Ricontrolla SDK</button></div>
              </article>
              <article class="rm-card" id="rm-diagnostics-card">
                <div class="rm-card-header">
                  <div>
                    <h3 class="rm-card-title">Registro diagnostico</h3>
                    <p class="rm-card-subtitle">Ultimi eventi tecnici, salvati solo nel browser. Non includono dati dei segmenti, nomi di preset o coordinate.</p>
                  </div>
                  <span class="rm-card-badge">Log</span>
                </div>
                <pre id="rm-diag-events" class="rm-maintenance-output" aria-live="polite"></pre>
                <div class="rm-buttons">
                  <button type="button" id="rm-diag-export">⬇️ Esporta diagnosi JSON</button>
                  <button type="button" id="rm-diag-clear" class="ghost">🗑️ Cancella registro</button>
                </div>
              </article>
              <article class="rm-card">
                <div class="rm-card-header">
                  <div>
                    <h3 class="rm-card-title">Stato e note</h3>
                    <p class="rm-card-subtitle">Messaggi operativi e promemoria d’uso.</p>
                  </div>
                  <span class="rm-card-badge">Stato</span>
                </div>
                <p class="rm-info" style="margin-top:10px;">I preset sono locali al browser. Le condizioni motore vengono salvate dal modello interno WME. Il backup JSON include anche la libreria calendari. Dopo l’applicazione verifica sempre il risultato prima di salvare in WME.</p>
              </article>
            </section>
          </div>
        `;
        tabPane.appendChild(container);

        const navButtons = [...container.querySelectorAll('.rm-nav-btn')];
        const panels = [...container.querySelectorAll('.rm-panel')];
        const setPanel = (id) => {
            for (const btn of navButtons) btn.classList.toggle('is-active', btn.dataset.target === id);
            for (const panel of panels) panel.classList.toggle('is-active', panel.id === id);
        };
        navButtons.forEach(btn => btn.addEventListener('click', () => setPanel(btn.dataset.target)));
        $("#rm-expiry-open").addEventListener("click", () => setPanel("rm-panel-calendars"));

        const updateMetrics = () => {
            const p = names().length;
            const c = calendarIds().length;
            const presetMetric = $('#rm-metric-presets');
            const calMetric = $('#rm-metric-calendars');
            if (presetMetric) presetMetric.textContent = String(p);
            if (calMetric) calMetric.textContent = String(c);
            refreshExpirationAlerts();
        };
        container._rmUpdateMetrics = updateMetrics;
        tabPane._rmUpdateMetrics = updateMetrics;

        $("#rm-sdk-recheck").addEventListener("click", () => {
            inspectSdkCompatibility();
            notify(t(sdkCompatibility.ready ? "SDK compatibile per le operazioni standard" : "SDK: mancano funzioni necessarie"),
                sdkCompatibility.ready ? "info" : "error");
        });
        $("#rm-diag-export").addEventListener("click", exportDiagnostics);
        $("#rm-diag-clear").addEventListener("click", clearDiagnostics);
        renderDiagnostics();
        $("#rm-preview-skip").addEventListener("change", updatePreviewToggle);
        $("#rm-preview-ack").addEventListener("change", updatePreviewToggle);
        $("#rm-preview-cancel").addEventListener("click", clearOperationPreview);
        $("#rm-preview-confirm").addEventListener("click", executePreparedPreview);
        for (const selector of ["#rm-name", "#rm-presets", "#rm-cal-list", "#rm-link-calendar"]) {
            $(selector).addEventListener("change", clearOperationPreview);
        }
        $("#rm-name").addEventListener("input", clearOperationPreview);
        $("#rm-presets").addEventListener("change", () => {
            $("#rm-name").value = $("#rm-presets").value;
            refreshCalendarSelects();
        });
        $("#rm-save").addEventListener("click", savePreset);
        $("#rm-apply").addEventListener("click", applyPreset);
        $("#rm-delete").addEventListener("click", deletePreset);
        $("#rm-export").addEventListener("click", exportPresets);
        $("#rm-import").addEventListener("click", () => $("#rm-file").click());
        $("#rm-file").addEventListener("change", e => {
            importPresets(e.target.files?.[0]);
            e.target.value = "";
        });
        $("#rm-link-save").addEventListener("click", linkCalendarToPreset);
        $("#rm-link-unlink").addEventListener("click", unlinkCalendarFromPreset);
        $("#rm-link-duplicate").addEventListener("click", duplicatePresetWithCalendar);
        $("#rm-cal-list").addEventListener("change", () => {
            try { editCalendar(getCalendar($("#rm-cal-list").value)); }
            catch (e) { notify(msg(e), "error"); }
        });
        $("#rm-cal-ranged").addEventListener("change", () => { toggleCalendarDates(); changedHolidayPeriod(); });
        $("#rm-holiday-load").addEventListener("click", () => {
            invalidateHolidayLoad();
            loadHolidayData({silent:false});
        });
        $("#rm-local-add").addEventListener("click", () => {
            if ($("#rm-local-annual").children.length >= MAX_LOCAL_ANNUAL_HOLIDAYS) {
                notify(t("Massimo {count} periodi esclusi.",{count:MAX_LOCAL_ANNUAL_HOLIDAYS}),"warning");
                return;
            }
            addLocalAnnualHolidayRow(); previewCalendar();
        });
        populateHolidayCountries();
        $("#rm-holiday-country").addEventListener("input", changedHolidayCountry);
        $("#rm-holiday-country").addEventListener("change", changedHolidayCountry);
        $("#rm-holiday-region").addEventListener("input", changedHolidayRegion);
        $("#rm-holiday-region").addEventListener("change", changedHolidayRegion);
        $("#rm-holiday-locality").addEventListener("input", previewCalendar);
        updateHolidayRegionOptions("", "");
        $("#rm-exclusion-add").addEventListener("click", () => {
            if ($("#rm-exclusions").children.length >= MAX_CUSTOM_EXCLUSIONS) {
                notify(t("Massimo {count} periodi esclusi.", {count:MAX_CUSTOM_EXCLUSIONS}), "warning");
                return;
            }
            addExcludedRow();
            previewCalendar();
        });
        for (const id of ["rm-cal-name", "rm-cal-tz"]) {
            $("#" + id).addEventListener("input", previewCalendar);
            $("#" + id).addEventListener("change", previewCalendar);
        }
        for (const id of ["rm-cal-start", "rm-cal-end", "rm-cal-repeat"]) {
            $("#" + id).addEventListener("input", changedHolidayPeriod);
            $("#" + id).addEventListener("change", changedHolidayPeriod);
        }
        $("#rm-special-add").addEventListener("click", () => {
            if ($("#rm-special-rows").children.length >= 8) {
                notify(t("Massimo 8 ricorrenze speciali."), "warning");
                return;
            }
            addSpecialRow();
            previewCalendar();
        });
        for (const id of ["rm-special-start-year", "rm-special-end-year"]) {
            $("#" + id).addEventListener("input", previewCalendar);
        }
        $("#rm-cal-add-slot").addEventListener("click", () => {
            if ($("#rm-slots").children.length >= 20) {
                notify(t("Massimo 20 fasce per calendario."), "warning");
                return;
            }
            addSlotRow();
            previewCalendar();
        });
        $("#rm-cal-new").addEventListener("click", () => {
            setPanel('rm-panel-calendars');
            editCalendar(null);
        });
        $("#rm-cal-duplicate").addEventListener("click", () => {
            try {
                const data = calendarFormValues();
                data.id = null;
                data.name = data.name.trim() ? data.name.trim() + " " + t("(copia)") : "";
                setPanel('rm-panel-calendars');
                editCalendar(data);
            } catch (e) { notify(msg(e), "error"); }
        });
        $("#rm-cal-save").addEventListener("click", saveCalendar);
        $("#rm-cal-delete").addEventListener("click", deleteCalendar);
        $("#rm-cal-apply").addEventListener("click", applyCalendarOnly);
        refreshPresets();
        refreshCalendarSelects();
        editCalendar(null);
        updateMetrics();
    }

    // In produzione e Beta il Promise SDK_INITIALIZED potrebbe non essere
    // visibile nello stesso momento in cui compare getWmeSdk. Per questo
    // aspettiamo direttamente la factory pubblica dello SDK.
    async function waitForSdkFactory() {
        for (let attempt = 0; attempt < 120; attempt++) {
            if (typeof pageWindow.getWmeSdk === "function") return true;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return typeof pageWindow.getWmeSdk === "function";
    }

    async function start() {
        try {
            if (document.readyState === "loading") {
                await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
            }

            const available = await waitForSdkFactory();
            if (!available) {
                recordDiagnostic("error", "sdk-missing");
                console.warn("[Restriction Manager] SDK WME non esposto dalla pagina. Avvio annullato senza popup.", {
                    host: location.hostname,
                    sdkInitialized: typeof pageWindow.SDK_INITIALIZED,
                    getWmeSdk: typeof pageWindow.getWmeSdk,
                    wmeModel: typeof pageWindow.W?.model,
                    documentReadyState: document.readyState
                });
                return;
            }

            if (!pageWindow.SDK_INITIALIZED) {
                log("SDK_INITIALIZED non presente: uso la factory getWmeSdk disponibile.");
            }

            sdk = pageWindow.getWmeSdk({ scriptId: SCRIPT_ID, scriptName: SCRIPT_NAME, mode: "async" });
            const report = inspectSdkCompatibility();
            if (!report.ready) {
                throw new Error(t("SDK WME presente, ma moduli necessari non disponibili.") + " " + report.missing.join(", "));
            }
            const side = await sdk.Sidebar.registerScriptTab();
            if (!side?.tabPane || !side?.tabLabel) {
                throw new Error(t("La scheda WME non è stata restituita dallo SDK."));
            }
            tabPane = side.tabPane;
            side.tabLabel.textContent = "Restriction Manager";
            await updateLanguage(true);
            buildInterface();
            translateTree(tabPane);
            window.addEventListener("focus", () => updateLanguage());
            document.addEventListener("visibilitychange", () => { if (!document.hidden) updateLanguage(); });
            // Lightweight fallback for locale changes that do not reload WME.
            setInterval(() => { if (!document.hidden) updateLanguage(); }, 4000);
            recordDiagnostic("info", "startup-ok");
            renderDiagnostics();
            log("Versione " + SCRIPT_VERSION + " inizializzata su", location.hostname);
        } catch (e) {
            recordDiagnostic("error", "startup-failed");
            errorLog("Errore durante l'avvio. Dettagli:", e);
            // Evitiamo alert() bloccanti a ogni apertura di WME Beta.
            // Se la scheda è stata già creata, mostriamo l'errore al suo interno.
            notify(t("Errore di inizializzazione: {detail}", {detail:msg(e)}), "error");
        }
    }

    start();
})();
