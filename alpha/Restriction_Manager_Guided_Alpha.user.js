// ==UserScript==
// @name         Restriction Manager — Guided Creator Alpha
// @namespace    https://github.com/1cman/wme-restriction-manager/alpha
// @version      4.0.0-alpha.32
// @description  Read-only prototype for guided segment and lane restrictions. Separate from the stable script.
// @match        https://www.waze.com/editor*
// @match        https://www.waze.com/*/editor*
// @match        https://beta.waze.com/editor*
// @match        https://beta.waze.com/*/editor*
// @exclude      https://www.waze.com/editor/sdk/*
// @exclude      https://beta.waze.com/editor/sdk/*
// @exclude      https://www.waze.com/*/editor/sdk/*
// @exclude      https://beta.waze.com/*/editor/sdk/*
// @grant        unsafeWindow
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    "use strict";
    const VERSION = "4.0.0-alpha.32";
    const ID = "rm-guided-alpha";
    // Design vocabulary only: these are NOT SDK enum values or country permissions.
    const SCOPES = ["left", "center", "right", "segment"];
    const LANES = ["lane_none", "express", "fast", "hov", "public_transport", "carpool_toll_free"];
    // Published SDK scope names. The wizard mapping is still a design proposal.
    const LANE_SCOPE_CANDIDATES = Object.freeze({
        segment:"WHOLE_SEGMENT",left:"LEFT_LANE",
        center:"MIDDLE_LANE",right:"RIGHT_LANE"
    });
    // Editor-requested wizard shortlist (NOT the complete SDK catalogue).
    // These four categories are the ONLY selectable types in new restriction drafts.
    // This does not imply other SDK types never exist in WME or client routing.
    // Local WME eligibility remains unverified until live validation.
    // Wizard intents are deliberately separate from SDK defaultType enums.
    // "ALLOWED" is an editor intent, NOT an SDK RESTRICTION_TYPE.
    const RESTRICTION_TYPES = ["BLOCKED", "ALLOWED", "TOLL"];
    const WEEKDAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
    const MAX_DRAFT_TIME_FRAMES = 12; // Stable 3.2 SAFE12 guardrail, for read-only draft only.
    // Draft UI identifiers, not verified native SDK enum values.
    const MOTOR_ENGINE_TYPES = ["FUEL","ELECTRIC"];
    const MOTOR_COMPARATORS = ["ALL","LT","LTE"];
    // BLOCKED without selected types = all blocked. With selected types, default
    // changes to FREE, with explicit BLOCKED rules for the targeted types.
    const DEFAULT_TYPES = Object.freeze({BLOCKED:"BLOCKED",ALLOWED:"BLOCKED",TOLL:"TOLL"});
    const VEHICLE_TYPES = Object.freeze(["PRIVATE", "EV", "MOTORCYCLE", "TAXI"]);
    // The published write contract includes types beyond the wizard shortlist.
    const SDK_ADDABLE_VEHICLE_TYPES = ["PRIVATE","EV","MOTORCYCLE","TAXI","PUBLIC_TRANSPORTATION"];
    const SDK_MIN_PASSENGERS = [0,2,3,4];
    const SDK_TIME_FRAME_FIELDS = ["startDate","endDate","fromTime","toTime","weekdays","timeZone",
        "repeatYearly","dayAlternation"];
    const SDK_RESTRICTION_FIELDS = ["defaultType","description","direction","laneScope","laneType",
        "timeFrames","vehicleRules","disposition","driveProfiles","editable","isExpired"];
    const SDK_VEHICLE_RULE_FIELDS = ["licensePlateRule","licensePlateNumber","minPassengers",
        "numPassengers","subscriptions","vehicleTypes"];
    const PRESERVATION_PATH_FIELDS = new Set([...SDK_RESTRICTION_FIELDS,...SDK_VEHICLE_RULE_FIELDS,
        ...SDK_TIME_FRAME_FIELDS,"daysOfMonth","FREE","BLOCKED","TOLL"]);
    const OVERRIDE_TYPES = Object.freeze({BLOCKED:"FREE",ALLOWED:"FREE",TOLL:"FREE"});
    // Visual cues inspired by WME restriction categories (not exact sampled native colors).
    // Only the restriction-kind step uses these colors; selection semantics stay unchanged.
    const RESTRICTION_COLORS = Object.freeze({
        BLOCKED: {background:"#FDE8E7", active:"#F8CBC7", border:"#D93933"},
        ALLOWED: {background:"#E5F4E8", active:"#C6E9CE", border:"#258B4C"},
        TOLL:    {background:"#E5F2FF", active:"#C9E2FC", border:"#1E7ACD"}
    });
    const LANGS = ["it", "en", "fr", "es", "de", "pt"];
    const labels = {
        launch:["Crea restrizione guidata","Create guided restriction","Créer une restriction guidée","Crear restricción guiada","Beschränkung geführt erstellen","Criar restrição guiada"],
        test:["Alpha di sola lettura: nessuna modifica alla mappa o ai preset.","Read-only alpha: no map or preset changes.","Alpha en lecture seule : aucune modification de la carte ou des préréglages.","Alfa de solo lectura: sin cambios en el mapa ni en los preajustes.","Schreibgeschützte Alpha: keine Karten- oder Vorlagenänderungen.","Alfa só de leitura: sem alterações no mapa ou nas predefinições."],
        select:["Seleziona un solo segmento.","Select exactly one segment.","Sélectionnez un seul segment.","Selecciona un solo segmento.","Wähle genau ein Segment.","Seleciona apenas um segmento."],
        country:["Paese del segmento","Segment country","Pays du segment","País del segmento","Land des Segments","País do segmento"],
        unknown:["Non rilevato","Not detected","Non détecté","No detectado","Nicht erkannt","Não detetado"],
        observed:["Restrizioni esistenti (lettura SDK)","Existing restrictions (SDK read)","Restrictions existantes (lecture SDK)","Restricciones existentes (lectura SDK)","Vorhandene Beschränkungen (SDK)","Restrições existentes (leitura SDK)"],
        inspection_title:["Verifica tecnica (lettura SDK)","Technical inspection (SDK read-only)","Inspection technique (lecture SDK)","Inspección técnica (lectura SDK)","Technische Prüfung (SDK-Lesemodus)","Inspeção técnica (leitura SDK)"],
        inspection_scope:["Ambiti corsia osservati","Observed lane scopes","Portées de voie observées","Ámbitos de carril observados","Beobachtete Fahrstreifenbereiche","Âmbitos de via observados"],
        inspection_lane:["Tipologie corsia osservate","Observed lane types","Types de voie observés","Tipos de carril observados","Beobachtete Fahrstreifentypen","Tipos de via observados"],
        inspection_defaults:["Regole principali osservate","Observed default restriction kinds","Types de restrictions observées","Tipos de restricciones observadas","Beobachtete Standardbeschränkungen","Tipos de restrição observados"],
        inspection_zone:["Fusi orari osservati nelle restrizioni","Time zones observed in restrictions","Fuseaux horaires observés","Zonas horarias observadas","Beobachtete Zeitzonen","Fusos horários observados"],
        inspection_editable:["Restrizioni modificabili / non modificabili / sconosciute","Editable / non-editable / unknown restrictions","Restrictions modifiables / non / inconnues","Restricciones editables / no / desconocidas","Bearbeitbare / gesperrte / unbekannte Beschränkungen","Restrições editáveis / não / desconhecidas"],
        inspection_none:["Nessun valore disponibile","No values available","Aucune valeur disponible","Sin valores disponibles","Keine Werte verfügbar","Sem valores disponíveis"],
        inspection_warn:["Questi valori provengono solo da restrizioni già presenti sul segmento. NON certificano le opzioni disponibili per crearne una nuova, né verificano le API interne, la lingua o il fuso orario del segmento.","These values come only from existing segment restrictions. They do NOT certify support for new rules or verify private APIs, UI locale or segment time zone.","Valeurs des restrictions existantes uniquement ; aucune garantie de prise en charge de nouvelles règles.","Solo valores de restricciones existentes; no garantizan compatibilidad para nuevas reglas.","Nur Werte vorhandener Beschränkungen; keine Garantie für neue Regeln.","Apenas valores de restrições existentes; não garantem suporte para regras novas."],
        inspection_snapshot:["Controllo variazioni delle restrizioni SDK","SDK restriction change check","Contrôle des modifications SDK","Comprobación de cambios SDK","SDK-Beschränkungsänderungen prüfen","Verificação de alterações SDK"],
        inspection_changed:["Le restrizioni SDK del segmento sono cambiate durante la procedura. Ricomincia per aggiornare la bozza.","Segment SDK restrictions changed during the wizard. Restart to refresh the draft.","Les restrictions SDK ont changé ; recommencez.","Las restricciones SDK cambiaron; reinicia.","SDK-Beschränkungen geändert; bitte neu starten.","Restrições SDK alteradas; reinicie."],
        conversion_title:["Verifica di conversione SDK (anteprima)","SDK conversion review (preview)","Contrôle de conversion SDK (aperçu)","Revisión de conversión SDK (vista previa)","SDK-Konvertierungsprüfung (Vorschau)","Revisão de conversão SDK (prévia)"],
        conversion_default:["Regola generale prevista","Planned default rule","Règle générale prévue","Regla general prevista","Vorgesehene Grundregel","Regra geral prevista"],
        conversion_overrides:["Regole per i veicoli previste","Planned vehicle rules","Règles de véhicules prévues","Reglas de vehículos previstas","Vorgesehene Fahrzeugregeln","Regras de veículos previstas"],
        conversion_direction:["Direzione scelta (bozza)","Selected direction (draft)","Sens choisi (brouillon)","Dirección elegida (borrador)","Gewählte Richtung (Entwurf)","Direção escolhida (rascunho)"],
        conversion_frames:["Periodi proposti","Proposed time periods","Périodes proposées","Periodos propuestos","Vorgesehene Zeiträume","Períodos propostos"],
        conversion_toll:["Attributo pedaggio da predisporre","Toll attribute to plan","Attribut péage prévu","Atributo peaje previsto","Geplantes Maut-Attribut","Atributo portagem previsto"],
        conversion_no_override:["Nessuna regola specifica per veicoli","No vehicle-specific rules","Aucune règle par véhicule","Sin reglas para vehículos","Keine fahrzeugspezifischen Regeln","Sem regras específicas de veículos"],
        conversion_blocked:["Salvataggio non disponibile: conversione SDK ancora da verificare.","Saving unavailable: SDK conversion is not fully verified.","Enregistrement indisponible : conversion SDK à vérifier.","Guardado no disponible: conversión SDK pendiente.","Speichern nicht verfügbar: SDK-Konvertierung ungeprüft.","Gravação indisponível: conversão SDK por verificar."],
        conversion_blockers:["Verifiche ancora necessarie","Outstanding verification steps","Vérifications nécessaires","Verificaciones pendientes","Noch ausstehende Prüfungen","Verificações pendentes"],
        conversion_sdk_contract:["Formato di scrittura completo delle restrizioni e regole veicolo non ancora verificato.","Complete SDK write contract for restrictions and vehicle rules unverified.","Format d'écriture SDK des règles à vérifier.","Formato SDK de escritura de reglas sin verificar.","SDK-Schreibformat für Regeln ungeprüft.","Formato SDK para gravação de regras não verificado."],
        conversion_schedule:["Conversione calendari/fuso orario del segmento non verificata.","Calendar serialization and segment time zone unverified.","Calendrier et fuseau horaire du segment à vérifier.","Calendario y zona horaria del segmento sin verificar.","Kalender und Segmentzeitzone ungeprüft.","Calendário e fuso horário do segmento por verificar."],
        conversion_lane:["Valori laneScope/laneType e autorizzazioni locali da verificare per la scrittura.","laneScope/laneType values and local write eligibility need validation.","laneScope/laneType et droits locaux à vérifier.","laneScope/laneType y permisos locales sin verificar.","laneScope/laneType und lokale Berechtigungen ungeprüft.","laneScope/laneType e permissões locais por verificar."],
        conversion_safe12:["Controllo SAFE12 completo sull'operazione non ancora eseguito.","Full SAFE12 operation budget has not run.","Contrôle complet SAFE12 non exécuté.","Control completo SAFE12 no ejecutado.","Vollständige SAFE12-Prüfung noch nicht durchgeführt.","Verificação completa SAFE12 não executada."],
        conversion_preserve:["Conservazione delle restrizioni esistenti da verificare senza modifiche o perdite.","Existing restriction preservation has not been verified.","Préservation des restrictions existantes à vérifier.","Conservación de restricciones existentes sin verificar.","Erhalt bestehender Beschränkungen ungeprüft.","Preservação das restrições existentes por verificar."],
        conversion_conditions:["Combinazione e precedenza delle condizioni pass/occupanti da verificare.","Permit/occupancy condition combination and precedence unverified.","Conditions permis/occupants à vérifier.","Combinación permiso/ocupantes sin verificar.","Kombination von Berechtigungen/Insassen ungeprüft.","Combinação de autorizações/ocupantes por verificar."],
        conversion_engine:["Codici SDK dei motori e condizioni sperimentali non verificati.","Experimental engine rules and SDK codes unverified.","Codes moteur expérimentaux non vérifiés.","Códigos de motor experimentales sin verificar.","Experimentelle Motorcodes ungeprüft.","Códigos experimentais de motor por verificar."],
        conversion_toll_atomic:["Impostazione pedaggio per entrambi i sensi ed esenzione da applicare con controllo unitario.","Both-direction toll flag and exemption need coordinated verification.","Péage bidirectionnel et exemption à vérifier ensemble.","Peaje bidireccional y exención necesitan revisión conjunta.","Maut in beiden Richtungen und Befreiung gemeinsam prüfen.","Portagem nos dois sentidos e isenção exigem verificação conjunta."],
        conversion_unknown:["Verifica dei dati SDK esistenti incompleta.","Existing SDK data review is incomplete.","Vérification des données SDK existantes incomplète.","Revisión de los datos SDK existentes incompleta.","Prüfung vorhandener SDK-Daten unvollständig.","Verificação dos dados SDK existentes incompleta."],
        conversion_overbudget:["Stima SAFE12 oltre il limite: rivedere il calendario.","SAFE12 estimate exceeds the limit; revise the schedule.","Estimation SAFE12 au-dessus de la limite.","Estimación SAFE12 sobre el límite.","SAFE12-Schätzung überschreitet das Limit.","Estimativa SAFE12 acima do limite."],
        conversion_country:["Disponibilità e permessi locali del Paese/segmento da verificare.","Country/segment rule eligibility and permissions unverified.","Éligibilité du pays/segment à vérifier.","Elegibilidad del país/segmento sin verificar.","Zulässigkeit für Land/Segment ungeprüft.","Elegibilidade do país/segmento por verificar."],
        preservation_title:["Controllo conservazione restrizioni esistenti","Existing restrictions preservation audit","Audit de conservation des restrictions existantes","Auditoría de conservación de restricciones existentes","Prüfung der Erhaltung vorhandener Beschränkungen","Auditoria de preservação das restrições existentes"],
        preservation_status:["Esito controllo","Inspection result","Résultat du contrôle","Resultado del control","Prüfergebnis","Resultado da verificação"],
        preservation_none:["Nessuna restrizione esistente da conservare","No existing restrictions to preserve","Aucune restriction existante à conserver","No hay restricciones que conservar","Keine bestehenden Beschränkungen zu erhalten","Sem restrições existentes para preservar"],
        preservation_roundtrip:["Sono presenti restrizioni da conservare; serve una conversione di andata e ritorno verificata.","Existing restrictions require a verified read/write round trip.","Les restrictions existantes nécessitent une conversion aller-retour vérifiée.","Las restricciones existentes requieren conversión de ida y vuelta verificada.","Bestehende Beschränkungen brauchen einen geprüften Roundtrip.","As restrições existentes exigem conversão de ida e volta verificada."],
        preservation_unknown:["Dati insufficienti o non serializzabili: non è possibile confermare la conservazione.","Incomplete or unserializable data: preservation cannot be confirmed.","Données incomplètes ou non sérialisables : conservation non confirmée.","Datos incompletos o no serializables: conservación no confirmada.","Unvollständige oder nicht serialisierbare Daten: Erhaltung ungeprüft.","Dados incompletos ou não serializáveis: preservação não confirmada."],
        preservation_noneditable:["Restrizioni non modificabili","Non-editable restrictions","Restrictions non modifiables","Restricciones no editables","Nicht bearbeitbare Beschränkungen","Restrições não editáveis"],
        preservation_editable_unknown:["Restrizioni con modificabilità sconosciuta","Restrictions with unknown editability","Restrictions à éditabilité inconnue","Restricciones con editabilidad desconocida","Beschränkungen mit unbekannter Bearbeitbarkeit","Restrições com editabilidade desconhecida"],
        preservation_opaque:["Restrizioni con regole veicolo non ancora convertite","Restrictions with unconverted vehicle rules","Restrictions avec règles de véhicules non converties","Restricciones con reglas de vehículos sin convertir","Beschränkungen mit unkonvertierten Fahrzeugregeln","Restrições com regras de veículos não convertidas"],
        preservation_legacy:["Restrizioni con campi precedenti/deprecati","Restrictions with legacy/deprecated fields","Restrictions avec champs dépréciés","Restricciones con campos obsoletos","Beschränkungen mit veralteten Feldern","Restrições com campos legados"],
        preservation_incomplete:["Restrizioni con struttura insufficiente","Restrictions with incomplete structure","Restrictions avec structure incomplète","Restricciones con estructura incompleta","Beschränkungen mit unvollständiger Struktur","Restrições com estrutura incompleta"],
        preservation_frames:["Definizioni temporali già presenti","Existing time-frame definitions","Définitions temporelles existantes","Definiciones temporales existentes","Bestehende Zeitdefinitionen","Definições de tempo existentes"],
        preservation_warning:["Controllo in sola lettura. La conservazione richiede una verifica di andata e ritorno.","Read-only check. Preservation requires round-trip verification.","Contrôle en lecture seule. La conservation exige une vérification aller-retour.","Comprobación de solo lectura. La conservación requiere verificar la ida y vuelta.","Prüfung im Lesemodus. Der Erhalt erfordert eine Hin- und Rückprüfung.","Verificação só de leitura. A conservação exige uma verificação de ida e volta."],
        preservation_row_review:["Dati da verificare","Data to verify","Données à vérifier","Datos por verificar","Daten prüfen","Dados a verificar"],
        preservation_row_roundtrip:["Verifica di andata e ritorno richiesta","Round-trip verification required","Vérification aller-retour requise","Se requiere verificar la ida y vuelta","Hin- und Rückprüfung erforderlich","Verificação de ida e volta necessária"],
        preservation_field_outside:["Campi fuori dal modello pubblico","Fields outside the public model","Champs hors du modèle public","Campos fuera del modelo público","Felder außerhalb des öffentlichen Modells","Campos fora do modelo público"],
        preservation_field_shape:["Struttura da verificare","Shape to verify","Structure à vérifier","Estructura por verificar","Struktur prüfen","Estrutura a verificar"],
        preservation_field_alias:["Dato precedente assente dal campo attuale o discordante","Legacy data missing from or different in the current field","Donnée héritée absente du champ actuel ou différente","Dato anterior ausente o distinto en el campo actual","Altdaten fehlen im aktuellen Feld oder weichen ab","Dado antigo ausente ou diferente no campo atual"],
        preservation_alias_unknown:["Confronto tra i campi precedenti e attuali non verificabile","Legacy and current fields could not be compared","Comparaison des champs anciens et actuels impossible","No se pudieron comparar los campos antiguos y actuales","Alte und aktuelle Felder konnten nicht verglichen werden","Não foi possível comparar os campos antigos e atuais"],
        preservation_field_permission:["Modificabilità da verificare","Editability to verify","Modifiabilité à vérifier","Editabilidad por verificar","Bearbeitbarkeit prüfen","Editabilidade a verificar"],
        preservation_snapshot_undefined:["Valore non definito nello SDK","Undefined SDK value","Valeur SDK indéfinie","Valor SDK indefinido","Nicht definierter SDK-Wert","Valor SDK indefinido"],
        preservation_snapshot_accessor:["Proprietà con accesso dinamico","Accessor property","Propriété avec accesseur","Propiedad con un método de acceso","Zugriffseigenschaft","Propriedade com método de acesso"],
        preservation_snapshot_alias:["Alias SDK deprecato con accesso dinamico","Deprecated SDK accessor","Alias SDK obsolète avec accesseur","Alias SDK obsoleto con método de acceso","Veralteter SDK-Alias mit Zugriffsmethode","Alias SDK obsoleto com método de acesso"],
        preservation_snapshot_cycle:["Riferimento circolare","Circular reference","Référence circulaire","Referencia circular","Zirkulärer Verweis","Referência circular"],
        preservation_snapshot_object:["Oggetto con prototipo non confrontabile","Object with an unsupported prototype","Objet avec un prototype non pris en charge","Objeto con prototipo no compatible","Objekt mit nicht unterstütztem Prototyp","Objeto com protótipo incompatível"],
        preservation_snapshot_array:["Elenco non confrontabile per elementi mancanti o proprietà aggiuntive","Array with missing items or additional properties","Liste avec éléments manquants ou propriétés supplémentaires","Lista con elementos ausentes o propiedades adicionales","Liste mit fehlenden Elementen oder zusätzlichen Eigenschaften","Lista com elementos em falta ou propriedades adicionais"],
        preservation_snapshot_unsupported:["Struttura non confrontabile","Unsupported data structure","Structure de données non comparable","Estructura de datos no comparable","Nicht vergleichbare Datenstruktur","Estrutura de dados não comparável"],
        conversion_preservation_gate:["Verifica di conservazione delle restrizioni esistenti non superata.","Existing restriction preservation has not passed verification.","Vérification de conservation non réussie.","Validación de conservación pendiente.","Erhaltung bestehender Beschränkungen ungeprüft.","Verificação de preservação ainda não concluída."],
        existing_list:["Restrizioni già presenti sul segmento","Existing segment restrictions","Restrictions déjà présentes sur le segment","Restricciones existentes en el segmento","Vorhandene Segmentbeschränkungen","Restrições já presentes no segmento"],
        existing_none:["Nessuna restrizione presente","No existing restrictions","Aucune restriction présente","No hay restricciones","Keine bestehenden Beschränkungen","Nenhuma restrição existente"],
        existing_unknown:["Impossibile leggere l'elenco: controllo del conflitto non disponibile.","Unable to read the list: conflict check unavailable.","Liste indisponible : analyse impossible.","No se puede leer la lista; comprobación no disponible.","Liste nicht verfügbar; Konfliktprüfung unmöglich.","Lista indisponível: verificação de conflitos impossível."],
        existing_rule:["Restrizione","Restriction","Restriction","Restricción","Beschränkung","Restrição"],
        existing_kind:["Regola generale","Default rule","Règle générale","Regla general","Grundregel","Regra geral"],
        existing_direction:["Direzione","Direction","Direction","Dirección","Richtung","Direção"],
        existing_scope:["Ambito corsia","Lane scope","Portée de voie","Ámbito de carril","Fahrstreifenbereich","Âmbito de via"],
        existing_lane:["Tipo di corsia","Lane type","Type de voie","Tipo de carril","Fahrstreifentyp","Tipo de via"],
        existing_times:["Validità temporale","Time validity","Validité temporelle","Validez temporal","Zeitliche Gültigkeit","Validade temporal"],
        existing_weekdays:["Giorni SDK","SDK weekdays","Jours SDK","Días SDK","SDK-Wochentage","Dias SDK"],
        existing_repeat_yearly:["Ripetizione annuale","Repeats yearly","Répétition annuelle","Repetición anual","Jährliche Wiederholung","Repetição anual"],
        existing_day_alternation:["Alternanza dei giorni","Day alternation","Alternance des jours","Alternancia de días","Wechsel der Tage","Alternância de dias"],
        existing_calendar_review:["Validità da verificare nel pannello WME","Check time validity in the WME panel","Vérifier la validité dans le panneau WME","Comprueba la validez en el panel de WME","Gültigkeit im WME-Panel prüfen","Verificar a validade no painel do WME"],
        existing_rules:["Tipi di regole veicolo (non convertite)","Vehicle rule groups (unconverted)","Groupes de règles véhicule (non converties)","Grupos de reglas de vehículo (sin convertir)","Fahrzeugregelgruppen (nicht konvertiert)","Grupos de regras de veículo (não convertidos)"],
        existing_editability:["Modificabilità","Editability","Modifiabilité","Modificabilidad","Bearbeitbarkeit","Editabilidade"],
        existing_expired:["Scaduta","Expired","Expirée","Caducada","Abgelaufen","Expirada"],
        existing_description:["Descrizione","Description","Description","Descripción","Beschreibung","Descrição"],
        existing_yes:["Sì","Yes","Oui","Sí","Ja","Sim"],
        existing_no:["No","No","Non","No","Nein","Não"],
        edit_native:["Modifica nel pannello WME","Edit in native WME panel","Modifier dans WME","Editar en el panel WME","Im WME-Panel bearbeiten","Editar no painel WME"],
        edit_native_hint:["Apre il pannello originale di WME: la procedura guidata non modifica restrizioni esistenti.","Opens the original WME editor; the wizard does not change existing restrictions.","Ouvre l'éditeur natif WME, sans modification guidée.","Abre el editor nativo WME, sin cambiar reglas existentes.","Öffnet den nativen WME-Editor ohne Regeländerung.","Abre o editor nativo WME sem alterar as regras."],
        conflict_title:["Controllo preventivo conflitti (sola lettura)","Conflict preflight (read-only)","Précontrôle des conflits (lecture seule)","Comprobación de conflictos (solo lectura)","Konfliktprüfung (nur lesbar)","Verificação de conflitos (só leitura)"],
        conflict_potential:["Possibile conflitto","Potential conflict","Conflit possible","Posible conflicto","Möglicher Konflikt","Possível conflito"],
        conflict_overlap:["Sovrapposizione da valutare","Overlap requires review","Chevauchement à examiner","Solapamiento por revisar","Überlappung prüfen","Sobreposição a avaliar"],
        conflict_unknown:["Da verificare","Needs verification","À vérifier","Por verificar","Zu überprüfen","Por verificar"],
        conflict_separate:["Nessuna sovrapposizione rilevata nel confronto verificabile","No overlap found in the verifiable comparison","Aucun chevauchement dans la comparaison vérifiable","Sin solapamiento en la comparación verificable","Keine Überschneidung im prüfbaren Vergleich","Sem sobreposição na comparação verificável"],
        conflict_absent:["Nessuna restrizione esistente da confrontare","No existing restrictions to compare","Aucune restriction à comparer","No hay restricciones que comparar","Keine bestehenden Beschränkungen zum Vergleich","Sem restrições para comparar"],
        conflict_uncertain:["Il controllo non interpreta ancora tutti i profili veicolo, pass, motori, targhe, i giorni SDK numerici o le ricorrenze. Un risultato favorevole non autorizza il salvataggio.","The check cannot yet interpret all vehicle rules, permits, engines, plates, numeric SDK weekdays or recurrences. A favorable result never permits saving.","Profils véhicule, permis, moteurs, plaques et calendriers partiellement inconnus. Aucune écriture.","Reglas de vehículo, permisos, motores, matrículas y calendarios parcialmente desconocidos. Sin guardado.","Fahrzeugregeln, Berechtigungen, Motoren, Kennzeichen und Kalender nicht vollständig geprüft. Kein Speichern.","Regras de veículos, autorizações, motores, matrículas e calendários ainda parcialmente desconhecidos. Sem gravação."],
        conflict_reason_direction:["Direzioni separate","Separate directions","Directions distinctes","Direcciones separadas","Getrennte Richtungen","Direções separadas"],
        conflict_reason_lane:["Corsie separate","Separate lanes","Voies distinctes","Carriles separados","Getrennte Fahrstreifen","Vias separadas"],
        conflict_reason_time:["Periodi non sovrapposti","Non-overlapping periods","Périodes distinctes","Periodos no superpuestos","Zeitlich getrennt","Períodos sem sobreposição"],
        conflict_reason_common:["Direzione/corsia/orario potenzialmente coincidenti","Direction/lane/time may coincide","Direction/voie/horaire peuvent coïncider","Dirección/carril/horario pueden coincidir","Richtung/Spur/Zeit können übereinstimmen","Direção/via/horário podem coincidir"],
        conflict_reason_unknown:["Dati o condizioni SDK insufficienti per escludere sovrapposizioni","SDK data or conditions insufficient to exclude overlaps","Données SDK insuffisantes","Datos SDK insuficientes","SDK-Daten reichen nicht aus","Dados SDK insuficientes"],
        conflict_reason_vehicle:["Possibili effetti diversi per uno o più tipi di veicolo","Potentially different effects for one or more vehicle classes","Effets potentiellement différents selon le véhicule","Posibles efectos diferentes por tipo de vehículo","Möglicherweise unterschiedliche Wirkungen je Fahrzeugart","Possíveis efeitos diferentes por tipo de veículo"],
        vehicle_conflict_title:["Confronto per tipo di veicolo (anteprima)","Vehicle-by-vehicle comparison (preview)","Comparaison par véhicule (aperçu)","Comparación por vehículo (vista previa)","Fahrzeugvergleich (Vorschau)","Comparação por tipo de veículo (prévia)"],
        vehicle_existing_effect:["Regola presente","Existing effect","Effet existant","Efecto existente","Bestehende Wirkung","Efeito existente"],
        vehicle_proposed_effect:["Nuova regola","Proposed effect","Nouvel effet","Nuevo efecto","Neue Regelwirkung","Nova regra"],
        vehicle_same:["Stesso effetto previsto","Same proposed effect","Même effet prévu","Mismo efecto previsto","Gleiche vorgesehene Wirkung","Mesmo efeito previsto"],
        vehicle_different:["Possibile incompatibilità","Potential incompatibility","Incompatibilité possible","Posible incompatibilidad","Mögliche Unvereinbarkeit","Possível incompatibilidade"],
        vehicle_conditional:["Condizioni ulteriori da verificare","Additional conditions need verification","Conditions supplémentaires à vérifier","Condiciones adicionales por verificar","Zusätzliche Bedingungen prüfen","Condições adicionais a verificar"],
        vehicle_unknown:["Regola veicolo non interpretabile","Vehicle rule not interpretable","Règle véhicule non interprétable","Regla de vehículo no interpretable","Fahrzeugregel nicht interpretierbar","Regra de veículo não interpretável"],
        vehicle_compare_caution:["Il confronto riguarda solo le quattro categorie, senza garantire che siano mutuamente esclusive (es. Auto private ed elettriche). Non interpreta ancora combinazioni AND/OR, pass, motori, targhe o precedenza fra restrizioni. Nessun esito autorizza il salvataggio.","Only four categories are compared, without assuming they are mutually exclusive (e.g., private and electric). AND/OR conditions, permits, engines, plates and rule precedence remain unverified. No result authorizes saving.","Quatre catégories comparées, sans présumer de leur exclusivité ; conditions et priorité non vérifiées.","Se comparan cuatro categorías sin asumir que son excluyentes; condiciones y precedencia no verificadas.","Vier Kategorien ohne Annahme ihrer Exklusivität; Bedingungen und Vorrang ungeprüft.","Quatro categorias sem assumir exclusividade; condições e precedência não verificadas."],
        vehicle_compare_unmodeled:["Sono presenti categorie native diverse dalle quattro selezionabili: il confronto non può escludere interazioni.","Existing native rules include other vehicle types: interactions cannot be excluded.","D’autres catégories natives sont présentes ; interactions inconnues.","Existen otras categorías nativas; interacciones desconocidas.","Andere native Fahrzeugarten vorhanden; Wechselwirkungen ungeklärt.","Existem outras categorias nativas; interações desconhecidas."],
        native_conditions_title:["Dettaglio condizioni native (diagnostica)","Native condition details (diagnostic)","Détail des conditions natives (diagnostic)","Detalle de condiciones nativas (diagnóstico)","Native Bedingungsdetails (Diagnose)","Detalhes das condições nativas (diagnóstico)"],
        native_conditions_intro:["Lettura di campi già presenti nel modello SDK. Non deduce precedenze AND/OR o autorizzazioni reali: i valori dei pass e delle targhe non vengono mostrati.","Reading fields already in the SDK model. Does not infer AND/OR precedence or actual permission. Permit IDs and plate values are not displayed.","Champs SDK observés, sans déduire les priorités ; valeurs de permis et plaques masquées.","Campos SDK observados, sin deducir precedencia; permisos y matrículas ocultos.","SDK-Felder ohne Ableitung von Prioritäten; Ausweise und Kennzeichen verborgen.","Campos SDK observados, sem inferir prioridades; autorizações e matrículas ocultadas."],
        native_group:["Gruppo regola","Rule group","Groupe de règle","Grupo de regla","Regelgruppe","Grupo de regra"],
        native_types:["Categorie rilevate","Observed vehicle categories","Catégories observées","Categorías observadas","Beobachtete Fahrzeugarten","Categorias observadas"],
        native_passes:["Numero di pass rilevati","Observed permit count","Nombre de permis observés","Número de permisos detectados","Anzahl erkannter Berechtigungen","Quantidade de autorizações detetadas"],
        native_occupants:["Occupanti minimi riportati","Reported minimum occupants","Occupants minimaux déclarés","Ocupantes mínimos indicados","Gemeldete Mindestinsassen","Ocupantes mínimos indicados"],
        native_occupants_uncertain:["Minimo occupanti da verificare","Minimum occupancy needs review","Minimum d’occupants à vérifier","Mínimo de ocupantes por verificar","Mindestinsassenzahl prüfen","Mínimo de ocupantes a verificar"],
        native_plate:["Condizione targa presente (valore nascosto)","License-plate condition present (value hidden)","Condition plaque présente (valeur masquée)","Condición matrícula presente (valor oculto)","Kennzeichenbedingung vorhanden (Wert verborgen)","Condição de matrícula presente (valor ocultado)"],
        native_engine:["Condizione motore presente (non interpretata)","Engine condition present (not interpreted)","Condition moteur présente (non interprétée)","Condición de motor presente (sin interpretar)","Motorbedingung vorhanden (nicht interpretiert)","Condição de motor presente (não interpretada)"],
        native_other_fields:["Campi non riconosciuti (solo nomi)","Unrecognized fields (names only)","Champs inconnus (noms uniquement)","Campos desconocidos (solo nombres)","Unbekannte Felder (nur Namen)","Campos desconhecidos (apenas nomes)"],
        native_uncertain:["Valori o combinazioni ancora da verificare","Values or combinations still unverified","Valeurs ou combinaisons à vérifier","Valores o combinaciones sin verificar","Werte oder Kombinationen ungeprüft","Valores ou combinações por verificar"],
        native_profiles_equal:["Campi legacy e attuali equivalenti","Legacy and current fields match","Champs anciens et actuels équivalents","Campos antiguos y actuales equivalentes","Alte und neue Felder übereinstimmend","Campos antigos e atuais equivalentes"],
        native_profiles_differ:["Campi precedenti e attuali diversi","Legacy and current fields differ","Champs anciens et actuels différents","Campos antiguos y actuales distintos","Alte und aktuelle Felder unterscheiden sich","Campos antigos e atuais diferentes"],
        native_engine_review:["Condizioni motore da verificare nel pannello nativo WME.","Check engine conditions in the native WME panel.","Vérifier les conditions de motorisation dans le panneau WME natif.","Comprueba las condiciones de motor en el panel nativo de WME.","Motorbedingungen im WME-eigenen Dialog prüfen.","Verificar as condições de motor no painel nativo do WME."],
        native_engine_check:["Conta le condizioni motore nel modello interno","Count engine conditions in the internal model","Compter les conditions moteur dans le modèle interne","Contar las condiciones de motor en el modelo interno","Motorbedingungen im internen Modell zählen","Contar as condições de motor no modelo interno"],
        native_engine_count:["Condizioni motore rilevate sul segmento (modello interno)","Engine conditions observed on the segment (internal model)","Conditions de motorisation détectées sur le segment (modèle interne)","Condiciones de motor detectadas en el segmento (modelo interno)","Erkannte Motorbedingungen auf dem Segment (internes Modell)","Condições de motor detetadas no segmento (modelo interno)"],
        native_engine_row_count:["Condizioni motore","Engine conditions","Conditions moteur","Condiciones de motor","Motorbedingungen","Condições de motor"],
        native_engine_unavailable:["Conteggio motori dal modello interno non disponibile.","Engine count from the internal model is unavailable.","Nombre de conditions moteur indisponible dans le modèle interne.","Recuento de condiciones de motor del modelo interno no disponible.","Anzahl der Motorbedingungen aus dem internen Modell nicht verfügbar.","Contagem de condições de motor do modelo interno indisponível."],
        native_engine_match:["Lettura diretta e JSON interno coincidono","Direct read and internal JSON match","Lecture directe et JSON interne identiques","La lectura directa y el JSON interno coinciden","Direkt gelesene Daten und internes JSON stimmen überein","A leitura direta e o JSON interno coincidem"],
        native_engine_difference:["Differenza tra lettura diretta e JSON interno","Direct read and internal JSON differ","Écart entre la lecture directe et le JSON interne","Diferencia entre la lectura directa y el JSON interno","Direkt gelesene Daten und internes JSON weichen ab","Diferença entre a leitura direta e o JSON interno"],
        native_engine_unpaired:["Associazione alla restrizione SDK non verificabile","Association with the SDK restriction could not be verified","Association avec la restriction SDK non vérifiable","No se pudo comprobar la asociación con la restricción del SDK","Zuordnung zur SDK-Beschränkung nicht überprüfbar","Não foi possível verificar a associação à restrição do SDK"],
        native_engine_uncompared:["Confronto tra lettura diretta e JSON interno non disponibile","Comparison of direct read and internal JSON unavailable","Comparaison entre la lecture directe et le JSON interne indisponible","Comparación entre lectura directa y JSON interno no disponible","Vergleich der direkt gelesenen Daten mit dem internen JSON nicht verfügbar","Comparação entre a leitura direta e o JSON interno indisponível"],
        next:["Avanti","Next","Suivant","Siguiente","Weiter","Seguinte"],
        back:["Indietro","Back","Retour","Atrás","Zurück","Voltar"],
        close:["Chiudi","Close","Fermer","Cerrar","Schließen","Fechar"],
        direction:["In quale direzione?","Which direction?","Dans quel sens ?","¿En qué sentido?","Welche Richtung?","Em que sentido?"],
        FWD:["Da A verso B","A to B","De A vers B","De A a B","A nach B","De A para B"],
        REV:["Da B verso A","B to A","De B vers A","De B a A","B nach A","De B para A"],
        BOTH:["Entrambe le direzioni","Both directions","Les deux sens","Ambos sentidos","Beide Richtungen","Ambos os sentidos"],
        scope:["A cosa si applica?","What does it apply to?","À quoi s'applique-t-elle ?","¿A qué se aplica?","Worauf gilt sie?","A que se aplica?"],
        choose_scope:["Seleziona una corsia o l’intero segmento per applicare la restrizione.","Select a lane or the entire segment before continuing.","Sélectionnez une voie ou le segment entier avant de continuer.","Selecciona un carril o el segmento completo antes de continuar.","Wähle einen Fahrstreifen oder das gesamte Segment, bevor du fortfährst.","Seleciona uma via ou o segmento inteiro antes de continuar."],
        segment:["Intero Segmento","Entire segment","Segment entier","Segmento completo","Gesamtes Segment","Segmento inteiro"],
        left:["Corsia sinistra","Left lane","Voie gauche","Carril izquierdo","Linker Fahrstreifen","Via esquerda"],
        center:["Corsia centrale","Center lane","Voie centrale","Carril central","Mittlerer Fahrstreifen","Via central"],
        right:["Corsia destra","Right lane","Voie droite","Carril derecho","Rechter Fahrstreifen","Via direita"],
        lane:["Tipologia di corsia richiesta","Requested lane type","Type de voie souhaité","Tipo de carril solicitado","Gewünschter Fahrstreifentyp","Tipo de via pretendido"],
        lane_none:["Nessuno","None","Aucun","Ninguno","Keine","Nenhum"],
        express:["Express","Express","Express","Express","Express","Express"],
        fast:["Fast","Fast","Fast","Fast","Fast","Fast"],
        hov:["HOV","HOV","HOV","HOV","HOV","HOV"],
        public_transport:["Mezzi pubblici","Public transport","Transports publics","Transporte público","Öffentlicher Verkehr","Transportes públicos"],
        carpool_toll_free:["No pedaggio per carpool","Toll-free carpool","Péage gratuit pour covoiturage","Sin peaje para vehículos compartidos","Mautfrei für Fahrgemeinschaften","Sem portagem para boleias"],
        pending:["Opzioni dimostrative: disponibilità per Paese, segmento e direzione ancora da verificare nel pannello nativo.","Design options only: country, segment and direction eligibility still requires native WME verification.","Options de conception : disponibilité à vérifier dans WME.","Opciones de diseño: disponibilidad aún por verificar en WME.","Entwurfsoptionen: Verfügbarkeit in WME noch zu prüfen.","Opções de desenho: disponibilidade ainda por verificar no WME."],
        lane_check:["Verifica preliminare corsia (sola lettura)","Lane preflight (read-only)","Précontrôle de voie (lecture seule)","Comprobación de carril (solo lectura)","Fahrstreifen-Vorabprüfung (nur lesbar)","Verificação de via (só leitura)"],
        lane_candidate:["Valore SDK candidato per l'ambito","Candidate SDK scope value","Valeur SDK candidate","Valor SDK candidato de ámbito","Möglicher SDK-Bereichswert","Valor SDK candidato para âmbito"],
        lane_evidence:["Ambito osservato in restrizioni esistenti","Scope observed in existing restrictions","Portée observée sur restrictions existantes","Ámbito observado en restricciones existentes","Bereich in bestehenden Beschränkungen beobachtet","Âmbito observado em restrições existentes"],
        lane_special_pending:["La tipologia speciale scelta non ha ancora una conversione SDK verificata.","Selected special lane type does not yet have a verified SDK mapping.","Le type de voie spécial n'a pas encore de correspondance SDK vérifiée.","El carril especial todavía no tiene una correspondencia SDK verificada.","Für den besonderen Fahrstreifentyp fehlt eine geprüfte SDK-Zuordnung.","O tipo de via especial ainda não tem correspondência SDK verificada."],
        lane_none_requested:["Nessuna tipologia speciale richiesta","No special lane type requested","Aucun type spécial demandé","No se solicitó carril especial","Kein spezieller Fahrstreifentyp gewünscht","Nenhum tipo especial solicitado"],
        lane_observed_types:["Tipi di corsia già presenti sul segmento (solo confronto)","Lane types already on segment (comparison only)","Types de voies déjà présents sur le segment (comparaison)","Tipos de carril presentes en el segmento (comparación)","Bestehende Fahrstreifentypen des Segments (nur Vergleich)","Tipos de via já existentes no segmento (comparação)"],
        lane_orientation:["Sinistra/centro/destra vanno interpretati rispetto alla direzione di marcia selezionata; la corrispondenza nativa resta da verificare.","Left/center/right are relative to chosen travel direction; native mapping still needs verification.","Gauche/centre/droite selon le sens choisi ; à vérifier dans WME.","Izquierda/centro/derecha según la dirección elegida; verificar en WME.","Links/Mitte/Rechts bezogen auf die Fahrtrichtung; Prüfung in WME ausstehend.","Esquerda/centro/direita conforme o sentido escolhido; a verificar no WME."],
        lane_caution:["Valori proposti, non autorizzati per l'applicazione. Un valore già osservato NON dimostra la disponibilità per nuove restrizioni.","Proposed values, not authorized for edits. Seeing a value in existing restrictions does NOT prove new-rule eligibility.","Valeurs proposées, non autorisées en écriture ; présence observée ≠ admissibilité.","Valores propuestos, sin permiso de escritura; observar no prueba disponibilidad.","Vorgeschlagene Werte ohne Schreibfreigabe; Beobachtung beweist keine Verwendbarkeit.","Valores propostos sem autorização de escrita; observação não comprova elegibilidade."],
        restriction_kind:["Che tipo di restrizione vuoi creare?","Which restriction would you like to create?","Quel type de restriction souhaitez-vous créer ?","¿Qué tipo de restricción quieres crear?","Welche Beschränkung möchtest du erstellen?","Que tipo de restrição queres criar?"],
        BLOCKED:["Transito vietato (con eventuali eccezioni)","No entry (with optional exceptions)","Accès interdit (avec exceptions éventuelles)","Acceso prohibido (con excepciones opcionales)","Durchfahrt verboten (mit möglichen Ausnahmen)","Passagem proibida (com exceções opcionais)"],
        ALLOWED:["Transito consentito (solo ai veicoli autorizzati)","Access allowed (authorized traffic only)","Accès autorisé (véhicules autorisés uniquement)","Acceso permitido (solo vehículos autorizados)","Zufahrt erlaubt (nur berechtigte Fahrzeuge)","Acesso permitido (apenas veículos autorizados)"],
        TOLL:["Transito esente da pedaggio","Toll-free passage exemption","Exemption de péage","Tránsito exento de peaje","Mautbefreite Durchfahrt","Trânsito isento de portagem"],
        vehicle_step:["Per quali veicoli vuoi definire un'eccezione?","Which vehicles should receive an exception?","Quels véhicules reçoivent une exception ?","¿Qué vehículos tendrán una excepción?","Welche Fahrzeuge sollen eine Ausnahme erhalten?","Que veículos devem ter uma exceção?"], 
        blocked_vehicle_step:["A quali veicoli vuoi vietare il transito?","Which vehicles should be prohibited?","Quels véhicules doivent être interdits ?","¿Qué vehículos quieres prohibir?","Welche Fahrzeugarten sollen gesperrt werden?","Que veículos pretende proibir?"],
        vehicles_optional:["Nessuna selezione = transito vietato a TUTTI. Seleziona uno o più tipi di veicolo per vietare il transito SOLO a quelli scelti; gli altri restano autorizzati.","No selection = ALL vehicles prohibited. Select vehicle types to prohibit ONLY those types; others remain allowed.","Aucun choix : TOUS les véhicules interdits. Sinon seuls les types choisis sont interdits.","Sin selección: TODOS prohibidos. Con selección, solo se prohíben los tipos elegidos.","Ohne Auswahl: ALLE Fahrzeuge gesperrt. Mit Auswahl nur die gewählten Arten.","Sem seleção: TODOS proibidos. Com seleção apenas os tipos escolhidos."],
        vehicles_allowed:["Seleziona almeno un tipo di veicolo autorizzato. Tutte le altre categorie rimangono vietate; pass e occupanti si impostano nel passaggio successivo.","Select at least one allowed vehicle type. All other traffic stays blocked; permits and occupancy are configured next.","Choisissez au moins un type de véhicule autorisé. Les autres restent interdits ; permis et occupants à l'étape suivante.","Selecciona al menos un tipo de vehículo autorizado. Los demás siguen prohibidos; permisos y ocupantes se configuran después.","Wähle mindestens eine zugelassene Fahrzeugart. Alle anderen bleiben gesperrt; Berechtigungen und Insassen folgen.","Selecione pelo menos um tipo de veículo autorizado. Os restantes ficam bloqueados; autorizações e ocupantes seguem-se."],
        allowed_step:["Quali veicoli vuoi autorizzare?","Which vehicles should be allowed?","Quels véhicules souhaitez-vous autoriser ?","¿Qué vehículos quieres autorizar?","Welche Fahrzeuge sollen zugelassen werden?","Que veículos pretende autorizar?"],
        allowed_required:["Seleziona almeno un tipo di veicolo autorizzato per proseguire.","Select at least one allowed vehicle type to continue.","Sélectionnez au moins un type de véhicule autorisé pour continuer.","Selecciona al menos un tipo de vehículo autorizado para continuar.","Wähle mindestens eine zugelassene Fahrzeugart, um fortzufahren.","Selecione pelo menos um tipo de veículo autorizado para continuar."],
        allowed_default:["Transito vietato per impostazione predefinita","Access blocked by default","Accès interdit par défaut","Acceso prohibido por defecto","Zufahrt standardmäßig gesperrt","Passagem proibida por predefinição"],
        toll_default:["Transito a pedaggio per impostazione predefinita","Toll by default","Péage par défaut","Peaje por defecto","Standardmäßig mautpflichtig","Portagem por predefinição"],
        allowed_preview:["Criteri per il transito consentito","Allowed traffic criteria","Critères d'accès autorisé","Criterios de acceso permitido","Kriterien für die erlaubte Zufahrt","Critérios de acesso permitido"],
        blocked_preview:["Veicoli ai quali è vietato il transito","Vehicles prohibited from passing","Véhicules interdits de circulation","Vehículos con circulación prohibida","Gesperrte Fahrzeugarten","Veículos proibidos de circular"],
        blocked_everyone:["Transito vietato a tutti i veicoli","All vehicles prohibited","Circulation interdite à tous les véhicules","Tránsito prohibido a todos los vehículos","Durchfahrt für alle Fahrzeuge verboten","Passagem proibida para todos os veículos"],
        blocked_selected_base:["Transito consentito agli altri veicoli per impostazione predefinita","Other vehicle types allowed by default","Les autres véhicules sont autorisés par défaut","Otros vehículos permitidos por defecto","Andere Fahrzeugarten standardmäßig erlaubt","Outros veículos permitidos por predefinição"],
        blocked_only_selected:["Transito vietato esclusivamente ai tipi di veicolo selezionati; gli altri restano autorizzati.","Only selected vehicle types are blocked; others remain allowed.","Seuls les types sélectionnés sont interdits ; les autres sont autorisés.","Solo se prohíben los tipos seleccionados; el resto está permitido.","Nur gewählte Fahrzeugarten gesperrt; andere erlaubt.","Apenas os tipos selecionados proibidos; os restantes permitidos."],
        motor_ban_all:["Tutte le motociclette selezionate sono vietate, senza distinzioni di motore.","All selected motorcycles are prohibited regardless of engine.","Toutes les motos sélectionnées sont interdites, sans condition moteur.","Todas las motos seleccionadas están prohibidas, sin condición de motor.","Alle gewählten Motorräder sind unabhängig vom Motor gesperrt.","Todas as motas selecionadas são proibidas independentemente do motor."],
        motor_ban_conditional:["Solo le motociclette che soddisfano le condizioni motore indicate saranno vietate (anteprima sperimentale).","Only motorcycles matching engine conditions are prohibited (experimental preview).","Seules les motos correspondant aux conditions moteur sont interdites (aperçu).","Solo motos con las condiciones de motor indicadas están prohibidas (vista previa).","Nur Motorräder mit den Motorbedingungen sind gesperrt (Vorschau).","Só as motas com as condições do motor são proibidas (pré-visualização)."],
        toll_preview:["Veicoli esentati dal pedaggio","Vehicles exempt from toll","Véhicules exonérés de péage","Vehículos exentos de peaje","Von der Maut ausgenommene Fahrzeuge","Veículos isentos de portagem"],
        toll_vehicle_step:["Quali veicoli vuoi esentare dal pedaggio?","Which vehicles should be exempt from tolls?","Quels véhicules exempter du péage ?","¿Qué vehículos quieres eximir del peaje?","Welche Fahrzeuge sollen von der Maut befreit werden?","Que veículos pretende isentar da portagem?"],
        toll_schedule:["Date e fasce orarie dell'esenzione dal pedaggio","Toll exemption dates and times","Dates et horaires d'exemption de péage","Fechas y horarios de exención del peaje","Daten und Uhrzeiten der Mautbefreiung","Datas e horários da isenção de portagem"],
        green_schedule:["Date e fasce orarie del transito consentito","Dates and times of permitted traffic","Dates et horaires de circulation autorisée","Fechas y horarios del tráfico permitido","Zeiten der erlaubten Durchfahrt","Datas e horários da circulação autorizada"],
        green_schedule_intro:["Questi orari riguardano i veicoli autorizzati e le loro condizioni individuali (pass, occupanti). Fuori dai periodi indicati non è definita alcuna autorizzazione da questa bozza. Da verificare in WME.","This schedule applies to authorized vehicle classes and their individual permit/occupancy conditions. Outside these windows this draft grants no permission. Verify in native WME.","Le calendrier concerne les véhicules autorisés et leurs conditions ; à vérifier dans WME.","El calendario se aplica a los vehículos autorizados y sus condiciones; verificar en WME.","Der Zeitplan gilt für die zugelassenen Fahrzeuge und deren Bedingungen; in WME prüfen.","O calendário aplica-se aos veículos autorizados e às respetivas condições; verificar no WME."],
        budget_heading:["Controllo preliminare SAFE12","Preliminary SAFE12 check","Vérification préliminaire SAFE12","Comprobación preliminar SAFE12","Vorläufige SAFE12-Prüfung","Verificação preliminar SAFE12"],
        budget_existing:["Restrizioni già presenti","Existing restrictions","Restrictions existantes","Restricciones existentes","Bestehende Beschränkungen","Restrições existentes"],
        budget_existing_frames:["Definizioni temporali già presenti","Existing time-frame definitions","Définitions horaires existantes","Definiciones temporales existentes","Bestehende Zeitdefinitionen","Definições temporais existentes"],
        budget_new:["Restrizioni proposte","Proposed restrictions","Restrictions proposées","Restricciones propuestas","Vorgeschlagene Beschränkungen","Restrições propostas"],
        budget_total:["Totale previsto restrizioni / fasce","Projected total restrictions / frames","Total prévu restrictions / plages","Total previsto restricciones / intervalos","Geplante Gesamtzahl Beschränkungen / Zeitfenster","Total previsto restrições / intervalos"],
        budget_within:["La stima rientra nel limite SAFE12. Non autorizza ancora il salvataggio: struttura SDK, fuso orario, permessi e calendari avanzati restano da verificare.","Estimate is within SAFE12. Saving is still not authorized: SDK shape, time zone, permissions and advanced calendars remain unverified.","Estimation dans la limite SAFE12 ; écriture non autorisée.","Estimación dentro de SAFE12; escritura no autorizada.","Schätzung innerhalb SAFE12; Speichern weiterhin nicht erlaubt.","Estimativa dentro de SAFE12; gravação ainda não autorizada."],
        budget_over:["La stima supera SAFE12: prima dell'applicazione occorre ridurre gli elementi o rivedere l'operazione.","Estimate exceeds SAFE12; reduce elements or revise the operation before applying.","Estimation au-dessus de SAFE12 : réduire les éléments.","Estimación supera SAFE12: reduce elementos.","SAFE12 überschritten: Elemente reduzieren.","Estimativa ultrapassa SAFE12: reduza os elementos."],
        budget_unknown:["Stima non disponibile: dati delle restrizioni esistenti assenti o incompleti. Nessuna ipotesi sui valori mancanti.","Estimate unavailable: existing restriction data missing or incomplete. No assumptions about missing values.","Estimation indisponible : données des restrictions incomplètes.","Estimación no disponible: faltan datos.","Schätzung nicht verfügbar: Bestandsdaten fehlen.","Estimativa indisponível: dados existentes incompletos."],
        budget_assumption:["Conteggio conservativo: si mantengono le restrizioni presenti e si ipotizza una nuova restrizione per ogni fascia. I limiti vanno ricontrollati sul piano di modifica completo della stabile.","Conservative assumption: retain existing restrictions and add one new restriction per time frame. Recheck against the stable full-operation plan.","Hypothèse prudente : conserver les restrictions et ajouter une restriction par plage.","Supuesto conservador: conservar restricciones y añadir una por franja.","Vorsichtige Annahme: bestehende Regeln plus eine neue Regel je Zeitfenster.","Hipótese prudente: manter restrições e adicionar uma por intervalo."],
        toll_schedule_intro:["Le fasce orarie si applicano all'esenzione dei veicoli scelti. Gli altri restano soggetti al pedaggio. Nessuna modifica viene effettuata in questa Alpha.","Time ranges apply to selected vehicle exemptions. Others remain subject to toll. This Alpha makes no edits.","Les horaires s'appliquent aux véhicules exemptés. Les autres paient le péage. Aucune modification.","Los horarios se aplican a los vehículos exentos. Los demás pagan peaje. Sin cambios en esta Alpha.","Zeitfenster gelten für die befreiten Fahrzeuge. Andere bleiben mautpflichtig. Keine Bearbeitung.","Os horários aplicam-se aos veículos isentos. Outros pagam portagem. Sem alterações."],
        toll_auto_flag:["Strada a pedaggio: attivazione prevista automaticamente","Toll road: automatic activation planned","Route à péage : activation automatique prévue","Vía de peaje: activación automática prevista","Mautstraße: automatische Aktivierung vorgesehen","Estrada com portagem: ativação automática prevista"],
        toll_both_directions:["L'attributo Strada a pedaggio sarà impostato su ENTRAMBE le direzioni del segmento, anche se l'esenzione riguarda un solo senso.","The toll-road flag will apply to BOTH segment directions, even if the exemption is one-way.","Le péage s'appliquera aux DEUX sens du segment, même si l'exemption est unidirectionnelle.","El peaje se aplicará a AMBOS sentidos, incluso con exención unidireccional.","Das Maut-Attribut gilt für BEIDE Fahrtrichtungen, selbst bei einseitiger Befreiung.","A portagem aplica-se aos DOIS sentidos do segmento, mesmo com isenção num sentido."],
        toll_activation_pending:["Anteprima: hasToll = true. Verrà predisposto insieme all'esenzione al momento dell'applicazione guidata; questa Alpha non modifica WME.","Preview: hasToll = true. Intended for guided application together with exemption; this Alpha does not edit WME.","Aperçu : hasToll = true ; aucune modification dans cette Alpha.","Vista previa: hasToll = true; esta Alpha no modifica WME.","Vorschau: hasToll = true; diese Alpha bearbeitet WME nicht.","Pré-visualização: hasToll = true; esta Alpha não altera o WME."],
        toll_nonexempt:["Gli altri veicoli restano soggetti al pedaggio.","All other vehicles remain subject to toll.","Les autres véhicules restent soumis au péage.","Los demás vehículos pagan peaje.","Andere Fahrzeuge bleiben mautpflichtig.","Os outros veículos continuam sujeitos a portagem."],
        all_vehicle_types:["Qualsiasi categoria che soddisfi le condizioni avanzate (da verificare nel WME nativo)","Any vehicle type meeting advanced criteria (verify in native WME)","Toute catégorie répondant aux conditions avancées (à vérifier dans WME)","Cualquier tipo que cumpla las condiciones avanzadas (verificar en WME)","Alle Typen, die die Bedingungen erfüllen (in WME prüfen)","Qualquer categoria que cumpra as condições (verificar no WME)"],
        others_blocked:["Ogni altro traffico rimane vietato.","All other traffic remains prohibited.","Toute autre circulation reste interdite.","El resto del tráfico sigue prohibido.","Alle anderen Fahrzeuge bleiben gesperrt.","Todo o restante tráfego continua proibido."],
        criteria_unverified:["La combinazione tra categorie, pass e occupanti è ancora una bozza: AND/OR e compatibilità locali non verificati.","Combining vehicle types, permits and occupancy is still a draft: AND/OR and local eligibility are unverified.","Combinaison des critères à vérifier (ET/OU et règles locales).","Combinación de criterios sin verificar (Y/O y normas locales).","Kombination der Kriterien noch ungeprüft (UND/ODER, Länderregeln).","Combinação de critérios por verificar (E/OU e regras locais)."],
        vehicles_toll:["Seleziona almeno un tipo di veicolo esente dal pedaggio.","Select at least one vehicle type to exempt from the toll.","Choisissez au moins un type de véhicule exempté du péage.","Selecciona al menos un tipo de vehículo exento del peaje.","Wähle mindestens eine von der Maut befreite Fahrzeugart.","Seleciona pelo menos um tipo de veículo isento da portagem."],
        vehicles_unknown:["Elenco limitato a quattro categorie: Auto private, Veicoli elettrici, Motociclette e Taxi. La disponibilità locale delle combinazioni resta da verificare. Nessuna modifica alla mappa.","List limited to four categories: private cars, electric vehicles, motorcycles and taxis. Local rule eligibility is unverified. No map changes.","Liste limitée à quatre catégories : voitures privées, véhicules électriques, motos et taxis. Compatibilité locale non vérifiée. Aucune modification.","Lista limitada a cuatro categorías: coches particulares, vehículos eléctricos, motocicletas y taxis. Compatibilidad local sin verificar. Sin cambios.","Liste auf vier Kategorien begrenzt: private Pkw, Elektrofahrzeuge, Motorräder und Taxis. Lokale Zulässigkeit ungeprüft. Keine Änderungen.","Lista limitada a quatro categorias: automóveis particulares, veículos elétricos, motociclos e táxis. Disponibilidade local por verificar. Sem alterações."],
        select_vehicle:["Seleziona almeno un veicolo per questo tipo di restrizione.","Select at least one vehicle for this restriction type.","Sélectionnez au moins un véhicule pour ce type de restriction.","Selecciona al menos un vehículo para este tipo de restricción.","Wähle mindestens eine Fahrzeugart für diese Beschränkung.","Seleciona pelo menos um veículo para este tipo de restrição."],
        rule_preview:["Regola principale","Default behavior","Règle principale","Regla principal","Grundregel","Regra principal"],
        vehicle_preview:["Eccezione per i veicoli selezionati","Exception for selected vehicles","Exception pour les véhicules choisis","Excepción para vehículos seleccionados","Ausnahme für gewählte Fahrzeuge","Exceção para os veículos selecionados"],
        no_exceptions:["Nessuna eccezione","No exceptions","Aucune exception","Sin excepciones","Keine Ausnahmen","Sem exceções"],
        summary:["Riepilogo di prova","Test summary","Résumé de test","Resumen de prueba","Testübersicht","Resumo de teste"],
        advanced:["Condizioni avanzate (anteprima)","Advanced conditions (preview)","Conditions avancées (aperçu)","Condiciones avanzadas (vista previa)","Erweiterte Bedingungen (Vorschau)","Condições avançadas (pré-visualização)"],
        advanced_allowed_intro:["Per ogni tipo di veicolo scegli se sono necessari un pass o un numero minimo di occupanti. Senza condizioni aggiuntive, il veicolo è autorizzato direttamente.","For each vehicle type, choose whether a permit or minimum occupancy is required. With neither selected, access is unconditional.","Pour chaque véhicule, choisissez permis ou occupants. Sans condition, accès direct.","Para cada tipo de vehículo, selecciona permiso u ocupantes. Sin condiciones, acceso directo.","Für jeden Fahrzeugtyp Berechtigung oder Insassen wählen. Ohne Bedingungen direkte Zulassung.","Para cada veículo, selecione autorização ou ocupantes. Sem condições, acesso direto."],
        requires_pass:["Richiede un pass","Requires a permit","Permis obligatoire","Requiere un permiso","Berechtigung erforderlich","Requer autorização"],
        requires_occupancy:["Richiede un numero minimo di occupanti","Requires minimum occupancy","Occupants minimum requis","Requiere ocupantes mínimos","Mindestinsassen erforderlich","Requer ocupação mínima"],
        direct_access:["Autorizzato direttamente, senza condizioni aggiuntive","Authorized directly, no extra conditions","Autorisé directement, sans condition","Autorizado directamente, sin condiciones","Direkt berechtigt, ohne weitere Bedingungen","Autorizado diretamente, sem condições"],
        vehicle_occupancy:["Occupanti minimi per questo veicolo","Minimum occupants for this vehicle","Occupants minimum pour ce véhicule","Ocupantes mínimos para este vehículo","Mindestinsassen für dieses Fahrzeug","Ocupantes mínimos para este veículo"],
        missing_vehicle_pass:["Seleziona almeno un pass per questo veicolo.","Select at least one permit for this vehicle.","Sélectionnez au moins un permis pour ce véhicule.","Selecciona al menos un permiso para este vehículo.","Wähle mindestens eine Berechtigung für dieses Fahrzeug.","Selecione pelo menos uma autorização para este veículo."],
        missing_vehicle_occupancy:["Indica almeno 2 occupanti per questo veicolo.","Enter at least 2 occupants for this vehicle.","Saisissez au moins 2 occupants pour ce véhicule.","Indica al menos 2 ocupantes para este vehículo.","Mindestens 2 Insassen für dieses Fahrzeug eingeben.","Indique pelo menos 2 ocupantes para este veículo."],
        vehicle_rules_summary:["Condizioni per ciascun veicolo autorizzato","Conditions for each authorized vehicle","Conditions pour chaque véhicule autorisé","Condiciones para cada vehículo autorizado","Bedingungen für jedes zugelassene Fahrzeug","Condições por veículo autorizado"],
        both_conditions:["Per questo veicolo sono richiesti sia il pass sia il numero minimo di occupanti (combinazione da verificare in WME).","Both permit and occupancy are required for this vehicle (verify in WME).","Permis et occupants requis pour ce véhicule (à vérifier dans WME).","Permiso y ocupantes requeridos para este vehículo (verificar en WME).","Berechtigung und Insassen erforderlich (in WME prüfen).","Autorização e ocupação exigidas para este veículo (verificar no WME)."],
        occupancy:["Occupanti minimi (facoltativo)","Minimum occupants (optional)","Occupants minimum (facultatif)","Ocupantes mínimos (opcional)","Mindestinsassen (optional)","Ocupantes mínimos (opcional)"],
        occupancy_help:["Vuoto = nessun vincolo. Altrimenti inserisci un intero da 2 in su.","Blank = no limit. Otherwise enter an integer of at least 2.","Vide = aucune limite. Sinon entier à partir de 2.","Vacío = sin límite. Introduce entero de 2 o más.","Leer = keine Begrenzung. Sonst ganze Zahl ab 2.","Vazio = sem limite. Introduz inteiro a partir de 2."],
        occupancy_error:["Il numero di occupanti deve essere un intero di almeno 2.","Occupants must be an integer of at least 2.","Le nombre doit être un entier à partir de 2.","El número debe ser entero de 2 o más.","Ganze Zahl ab 2 erforderlich.","Necessário inteiro a partir de 2."],
        country_permits:["Pass disponibili nell'elenco del Paese","Permits listed for the segment country","Permis listés pour ce pays","Permisos listados para el país","Berechtigungen des Landes","Autorizações listadas para o país"],
        permit_search:["Cerca un pass","Search for a permit","Rechercher un permis","Buscar un permiso","Berechtigung suchen","Pesquisar uma autorização"],
        permit_search_placeholder:["Digita il nome del pass...","Type a permit name...","Saisissez un nom de permis...","Escribe el nombre del permiso...","Name der Berechtigung eingeben...","Introduza o nome da autorização..."],
        permit_search_empty:["Nessun pass corrispondente","No matching permits","Aucun permis correspondant","No se encontraron permisos","Keine passenden Berechtigungen","Nenhuma autorização correspondente"],
        permit_selected_count:["Pass selezionati","Selected permits","Permis sélectionnés","Permisos seleccionados","Ausgewählte Berechtigungen","Autorizações selecionadas"],
        permits_missing:["Elenco pass non disponibile tramite SDK.","SDK permit list unavailable.","Liste de permis SDK indisponible.","Lista SDK no disponible.","SDK-Liste nicht verfügbar.","Lista SDK indisponível."],
        permits_empty:["Nessun pass restituito dallo SDK.","No permits returned by the SDK.","Aucun permis retourné.","El SDK no devuelve permisos.","Keine Berechtigungen gefunden.","Nenhuma autorização devolvida."],
        permit_note:["La presenza nell'elenco non prova che il pass sia utilizzabile nella restrizione.","Listing does not prove the permit can be used here.","La liste ne garantit pas l'admissibilité.","La lista no garantiza compatibilidad.","Listeneintrag garantiert keine Verwendbarkeit.","A lista não garante elegibilidade."],
        plate_note:["Regole sulle targhe: non selezionabili in questa Alpha; verificare disponibilità per Paese e opzioni native.","License plate rules: unavailable in this Alpha pending country and native WME verification.","Plaques : indisponibles avant vérification par pays dans WME.","Matrículas: no disponibles hasta verificar el país en WME.","Kennzeichenregeln: bis zur Prüfung des Landes in WME nicht verfügbar.","Regras de matrícula: indisponíveis até verificação por país no WME."],
        no_condition:["Nessuna","None","Aucune","Ninguna","Keine","Nenhuma"],
        motorcycle_step:["Condizioni sperimentali per motociclette","Experimental motorcycle engine conditions","Conditions moteur expérimentales pour motos","Condiciones experimentales para motocicletas","Experimentelle Motorrad-Motorbedingungen","Condições experimentais de motor para motos"],
        motor_select_fuel:["Carburante","Fuel powered","À carburant","Combustible","Verbrennungsmotor","Combustível"],
        motor_select_electric:["Completamente elettrico","Fully electric","Entièrement électrique","Completamente eléctrico","Rein elektrisch","Completamente elétrico"],
        motor_limit_cc:["Cilindrata (cc)","Displacement (cc)","Cylindrée (cm³)","Cilindrada (cc)","Hubraum (cm³)","Cilindrada (cc)"],
        motor_limit_kw:["Potenza erogata (kW)","Power output (kW)","Puissance (kW)","Potencia (kW)","Leistung (kW)","Potência (kW)"],
        motor_compare_all:["Tutti","All","Tous","Todos","Alle","Todos"],
        motor_compare_lt:["Inferiore a (<)","Less than (<)","Inférieur à (<)","Menor que (<)","Kleiner als (<)","Menor que (<)"],
        motor_compare_lte:["Minore o uguale a (≤)","Less than or equal to (≤)","Inférieur ou égal à (≤)","Menor o igual que (≤)","Kleiner oder gleich (≤)","Menor ou igual a (≤)"],
        motor_select_required:["Seleziona almeno una tipologia di motore.","Select at least one engine type.","Sélectionnez au moins un type de moteur.","Selecciona al menos un tipo de motor.","Wähle mindestens einen Motortyp.","Selecione pelo menos um tipo de motor."],
        motor_threshold_required:["Inserisci un valore numerico positivo per la soglia selezionata.","Enter a positive number for the selected threshold.","Saisissez un nombre positif.","Introduce un número positivo.","Einen positiven Wert eingeben.","Introduza um número positivo."],
        motor_experimental_note:["Questi tipi di motore e confronti riproducono l'interfaccia nativa come bozza. Codici interni e valori supportati da verificare prima di un'applicazione reale.","These engine types and comparisons are a draft of the native UI; SDK codes and supported combinations are unverified.","Types et comparateurs provisoires : vérifier les codes SDK.","Tipos y comparadores provisionales: verificar los códigos SDK.","Entwurf der nativen UI; SDK-Codes noch zu prüfen.","Tipos e comparações provisórios; códigos SDK por verificar."],
        motorcycle_intro:["Facoltativo, solo per le motociclette a cui vietare il transito. Senza condizioni motore, tutte le motociclette selezionate saranno vietate. Questa Alpha non crea ancora regole reali; la stabile 3.2.0 conserva le condizioni motore esistenti.","Optional, for prohibited motorcycles only. Without engine conditions, all selected motorcycles are blocked. Alpha is read-only; stable 3.2.0 preserves existing motor rules.","Facultatif, motos interdites uniquement. Sans condition moteur, toutes sont interdites. Alpha en lecture seule.","Opcional, solo motos prohibidas. Sin condiciones de motor, se prohíben todas. Alpha de solo lectura.","Optional nur für gesperrte Motorräder. Ohne Motorbedingung sind alle gesperrt. Alpha schreibgeschützt.","Opcional, apenas para motos proibidas. Sem condições do motor, todas ficam proibidas. Alpha de leitura."],
        motorcycle_enable:["Limita il divieto in base al motore (sperimentale)","Limit the prohibition by engine (experimental)","Limiter l'interdiction selon le moteur (expérimental)","Limitar la prohibición por motor (experimental)","Verbot nach Motor einschränken (experimentell)","Limitar a proibição pelo motor (experimental)"],
        motorcycle_engine:["Tipo di motore / codice WME","Engine type / WME code","Type de moteur / code WME","Tipo de motor / código WME","Motortyp / WME-Code","Tipo de motor / código WME"],
        motorcycle_engine_hint:["Inserisci il codice rilevato nel pannello WME; se disponibile sono suggeriti i valori già presenti sul segmento. Nessun codice viene considerato automaticamente valido.","Enter the code shown in WME; existing values on the segment may be suggested. No code is presumed valid.","Saisissez le code WME; des valeurs existantes peuvent être proposées, sans validation.","Introduce el código WME; se sugieren valores existentes, sin validación.","WME-Code eingeben; vorhandene Werte werden vorgeschlagen, aber nicht validiert.","Introduza o código WME; são sugeridos valores existentes, sem validação."],
        motorcycle_engine_error:["Indica un tipo di motore oppure disattiva la condizione sperimentale.","Enter an engine type or disable the experimental condition.","Indiquez un type de moteur ou désactivez l'option.","Introduce un tipo de motor o desactiva la opción.","Motortyp eingeben oder die Option deaktivieren.","Indique um tipo de motor ou desative a opção."],
        motorcycle_unchecked:["Vietate tutte le motociclette selezionate, indipendentemente dal motore","All selected motorcycles prohibited, regardless of engine","Toutes les motos sélectionnées interdites, indépendamment du moteur","Todas las motos seleccionadas prohibidas, independientemente del motor","Alle ausgewählten Motorräder gesperrt, unabhängig vom Motor","Todas as motas selecionadas proibidas, independentemente do motor"],
        red_schedule:["Date e fasce orarie del divieto","Restriction dates and time ranges","Dates et plages horaires de l'interdiction","Fechas y horarios de la prohibición","Daten und Zeitfenster des Verbots","Datas e horários da proibição"],
        red_schedule_intro:["Il calendario riguarda il divieto rosso e le sue esenzioni. È una bozza: fuso orario del segmento, ricorrenze speciali e festività andranno verificati prima di modificare WME.","This calendar applies to the red prohibition and its exemptions. Draft only: segment time zone, special recurrences and holidays require verification.","Ce calendrier s'applique à l'interdiction rouge. Fuseau horaire et jours fériés non vérifiés.","El calendario corresponde a la prohibición roja. Zona horaria y festivos pendientes de verificar.","Dieser Kalender gilt für das rote Verbot. Zeitzone und Feiertage noch ungeprüft.","O calendário aplica-se à proibição vermelha. Fuso horário e feriados por verificar."],
        schedule_start:["Data di inizio (facoltativa)","Start date (optional)","Date de début (facultative)","Fecha de inicio (opcional)","Startdatum (optional)","Data de início (opcional)"],
        schedule_end:["Data di fine (facoltativa)","End date (optional)","Date de fin (facultative)","Fecha de fin (opcional)","Enddatum (optional)","Data de fim (opcional)"],
        schedule_days:["Giorni della settimana","Days of the week","Jours de la semaine","Días de la semana","Wochentage","Dias da semana"],
        schedule_all_day:["Tutto il giorno","All day","Toute la journée","Todo el día","Ganztägig","Todo o dia"],
        schedule_add_slot:["Aggiungi fascia oraria","Add time range","Ajouter une plage horaire","Añadir horario","Zeitfenster hinzufügen","Adicionar horário"],
        schedule_remove_slot:["Rimuovi fascia","Remove time range","Supprimer la plage","Eliminar horario","Zeitfenster entfernen","Remover horário"],
        schedule_from:["Dalle","From","De","Desde","Von","Das"],
        schedule_to:["Alle","To","À","Hasta","Bis","Até"],
        schedule_overnight:["La fascia inizia nei giorni selezionati e termina il giorno successivo.","The range starts on the selected days and ends the following day.","La plage commence les jours sélectionnés et se termine le lendemain.","La franja empieza los días seleccionados y termina al día siguiente.","Das Zeitfenster beginnt an den ausgewählten Tagen und endet am Folgetag.","O intervalo começa nos dias selecionados e termina no dia seguinte."],
        schedule_next_day:["giorno successivo","next day","lendemain","día siguiente","Folgetag","dia seguinte"],
        schedule_invalid:["Controlla le date, i giorni e gli orari: serve una fascia valida e non si può superare il limite di 12 fasce.","Check dates, days and time ranges; valid times and at most 12 ranges are required.","Vérifiez dates, jours et horaires ; maximum 12 plages.","Comprueba fechas, días y horarios; máximo 12 rangos.","Daten, Wochentage und Zeiten prüfen; höchstens 12 Zeitfenster.","Verifique datas, dias e horários; máximo 12 intervalos."],
        schedule_summary:["Calendario proposto (sola lettura)","Proposed schedule (read-only)","Calendrier proposé (lecture seule)","Calendario propuesto (solo lectura)","Vorgeschlagener Zeitplan (nur lesbar)","Calendário proposto (só de leitura)"],
        MONDAY:["Lun","Mon","Lun","Lun","Mo","Seg"],
        TUESDAY:["Mar","Tue","Mar","Mar","Di","Ter"],
        WEDNESDAY:["Mer","Wed","Mer","Mié","Mi","Qua"],
        THURSDAY:["Gio","Thu","Jeu","Jue","Do","Qui"],
        FRIDAY:["Ven","Fri","Ven","Vie","Fr","Sex"],
        SATURDAY:["Sab","Sat","Sam","Sáb","Sa","Sáb"],
        SUNDAY:["Dom","Sun","Dim","Dom","So","Dom"],
        changed:["La selezione è cambiata. Chiudi e riapri la procedura.","Selection changed. Close and reopen the wizard.","La sélection a changé. Rouvrez l'assistant.","La selección ha cambiado. Vuelve a abrir el asistente.","Auswahl geändert. Assistent erneut öffnen.","A seleção mudou. Reabre o assistente."],
        anchor:["Pulsante nel pannello WME","Button in WME panel","Bouton dans WME","Botón en WME","Schaltfläche in WME","Botão no WME"],
        found:["Rilevato","Detected","Détecté","Detectado","Erkannt","Detetado"],
        fallback:["Non rilevato: usa questa scheda.","Not detected: use this tab.","Non détecté : utilisez cet onglet.","No detectado: usa esta pestaña.","Nicht erkannt: diesen Tab verwenden.","Não detetado: usa este separador."]
    };
    // Labels for the four user-selected wizard options, in UI order.
    const vehicleLabels = {
        PRIVATE:["Auto private","Private cars","Voitures particulières","Coches particulares","Private Pkw","Automóveis particulares"],
        EV:["Veicoli elettrici","Electric vehicles","Véhicules électriques","Vehículos eléctricos","Elektrofahrzeuge","Veículos elétricos"],
        MOTORCYCLE:["Motociclette","Motorcycles","Motos","Motocicletas","Motorräder","Motociclos"],
        TAXI:["Taxi","Taxis","Taxis","Taxis","Taxis","Táxis"]
    };
    // The native action changes when a selected segment already has restrictions.
    // Treat ADD and EDIT as distinct actions; never click either native control.
    const nativeAddLabels = new Set([
        "aggiungi restrizioni","aggiungi restrizione",
        "add restrictions","add restriction",
        "ajouter des restrictions","ajouter une restriction",
        "añadir restricciones","agregar restricciones","añadir restricción",
        "beschränkungen hinzufügen","beschränkung hinzufügen",
        "adicionar restrições","adicionar restrição"
    ]);
    const nativeEditLabels = new Set([
        "modifica restrizioni","modifica restrizione",
        "edit restrictions","edit restriction",
        "modifier les restrictions","modifier la restriction",
        "editar restricciones","modificar restricciones","editar restricción","modificar restricción",
        "beschränkungen bearbeiten","beschränkung bearbeiten",
        "editar restrições","modificar restrições","editar restrição"
    ]);
    function normalizeLabel(value) {
        return String(value || "").normalize("NFKC").replace(/^[+\s]+/,"").replace(/\s+/g," ").trim().toLowerCase();
    }
    function nativeRestrictionAction(value) {
        const normalized=normalizeLabel(value);
        return nativeAddLabels.has(normalized)?"add":
            nativeEditLabels.has(normalized)?"edit":null;
    }
    function availableDirections(segment) {
        const a = segment?.isAtoB === true || segment?.isTwoWay === true;
        const b = segment?.isBtoA === true || segment?.isTwoWay === true;
        return [...(a ? ["FWD"] : []), ...(b ? ["REV"] : []), ...(a && b ? ["BOTH"] : [])];
    }
    function countryIdentity(address) {
        const c = address?.country;
        if (!c || (typeof c.id !== "number" && typeof c.id !== "string")) return null;
        return {id:c.id, name:typeof c.name === "string" ? c.name : String(c.id), code:typeof c.code === "string" ? c.code : null};
    }
    function selectedVehicleTypes(types) {
        if (!Array.isArray(types) || types.some(type => !VEHICLE_TYPES.includes(type))) throw new Error("Invalid vehicle selection");
        return VEHICLE_TYPES.filter(type => types.includes(type));
    }
    // SDK semantics: BLOCKED defaults can have FREE vehicle rules; TOLL can have FREE
    // exemptions. The green ALLOWED wizard intent is a BLOCKED default plus a FREE
    // whitelist; it must never turn into SDK defaultType FREE (which would allow all).
    function hasAllowedCriteria(draft) {
        // A whitelist requires a vehicle category; passes/occupancy can only refine it.
        return selectedVehicleTypes(draft.vehicleTypes).length>0;
    }
    function sortPermits(permits,locale="en") {
        const collator=new Intl.Collator(LANGS.includes(locale)?locale:"en",
            {sensitivity:"base",numeric:true});
        return [...permits].sort((a,b)=>
            collator.compare(a.name,b.name)||String(a.id).localeCompare(String(b.id)));
    }
    function normalizePermitSearch(value) {
        return String(value??"").normalize("NFD")
            .replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase().trim().replace(/\s+/g," ");
    }
    function filterPermits(permits,search,locale="en") {
        const term=normalizePermitSearch(search);
        const sorted=sortPermits(permits,locale);
        return term?sorted.filter(permit=>normalizePermitSearch(permit.name).includes(term)):sorted;
    }
    function inspectLaneDraft(draft,restrictions) {
        if(!SCOPES.includes(draft?.scope))throw Error("Invalid lane scope");
        if(!LANES.includes(draft?.lane))throw Error("Invalid special lane type");
        const readAvailable=Array.isArray(restrictions);
        const rows=readAvailable?restrictions:[];
        const candidate=LANE_SCOPE_CANDIDATES[draft.scope];
        const observedScope=rows.some(r=>
            r?.laneScope===candidate||r?.disposition===candidate);
        const observedLaneTypes=[...new Set(rows
            .map(r=>r?.laneType)
            .filter(value=>typeof value==="string"&&value.trim()))].sort();
        return {
            designScope:draft.scope,
            laneScopeCandidate:candidate,
            observedScope,readAvailable,
            designLaneType:draft.lane,
            sdkLaneType:null,
            laneTypeStatus:draft.lane==="lane_none"?"NONE_REQUESTED":"UNMAPPED",
            observedLaneTypes,
            verified:false
        };
    }
    function normalizeDraft(draft, segment) {
        if (!availableDirections(segment).includes(draft.direction)) throw new Error("Direction unavailable");
        if (!SCOPES.includes(draft.scope)) throw new Error("Invalid scope");
        if (!LANES.includes(draft.lane)) throw new Error("Invalid lane design option");
        // Scope and lane labels are not yet verified SDK enum values.
        if (!RESTRICTION_TYPES.includes(draft.restrictionType)) throw new Error("Invalid restriction intent");
        const vehicleTypes = selectedVehicleTypes(draft.vehicleTypes);
        if (draft.restrictionType==="TOLL" && !vehicleTypes.length) {
            throw new Error("TOLL requires explicit vehicle exemption rules");
        }
        if (draft.restrictionType==="ALLOWED" && !hasAllowedCriteria(draft)) {
            throw new Error("ALLOWED requires at least one authorized vehicle type");
        }
        return {
            direction:draft.direction, scope:draft.scope, lane:draft.lane,
            restrictionIntent:draft.restrictionType,
            defaultType:draft.restrictionType==="BLOCKED"&&vehicleTypes.length?
                "FREE":DEFAULT_TYPES[draft.restrictionType],
            overrideType:draft.restrictionType==="BLOCKED"&&vehicleTypes.length?
                "BLOCKED":OVERRIDE_TYPES[draft.restrictionType],
            vehicleTypes,verified:false
        };
    }
    function normalizeAdvanced(advanced,permits) {
        const minPassengers=advanced?.minPassengers??null;
        if(minPassengers!==null&&(!Number.isSafeInteger(minPassengers)||minPassengers<2))throw Error("Invalid occupancy");
        if(!Array.isArray(advanced?.permitIds))throw Error("Invalid permits");
        const permitIds=[...new Set(advanced.permitIds)];
        const allowed=new Set((permits||[]).map(p=>p.id));
        if(permitIds.some(id=>typeof id!=="string"||!allowed.has(id)))throw Error("Unrecognized country permit");
        return {minPassengers,permitIds,verified:false};
    }
    // Read-only whitelist draft: every selected vehicle has its own rules.
    // No conditions means directly allowed; conditions on a different vehicle
    // never imply a requirement for this one.
    // Planned toll flag mutation, deliberately NEVER executed in the read-only Alpha.
    // SDK segment toll updates set BOTH traffic directions; do not invoke here.
    function normalizeTollActivationDraft(draft,segmentIds) {
        if(draft?.restrictionIntent!=="TOLL")throw Error("Toll intent required");
        if(!Array.isArray(segmentIds)||!segmentIds.length||
           segmentIds.some(id=>!Number.isSafeInteger(id)||id<=0)||
           new Set(segmentIds).size!==segmentIds.length)
            throw Error("Invalid toll target segments");
        return {segmentIds:[...segmentIds],hasToll:true,directions:"BOTH",
            required:true,applied:false,verified:false};
    }
    // Count the complete list of retained and generated restrictions for each
    // segment, following the stable SAFE12 limits for the whole operation.
    function countSafe12Operation(restrictionsBySegment) {
        if(!Array.isArray(restrictionsBySegment)||!restrictionsBySegment.length)return null;
        let restrictions=0,timeFrames=0;
        for(const segmentRestrictions of restrictionsBySegment){
            if(!Array.isArray(segmentRestrictions))return null;
            for(const restriction of segmentRestrictions){
                if(!Array.isArray(restriction?.timeFrames))return null;
                for(const frame of restriction.timeFrames){
                    if(!frame||typeof frame!=="object"||Array.isArray(frame))return null;
                    timeFrames++;
                }
                restrictions++;
            }
        }
        if(!Number.isSafeInteger(restrictions)||!Number.isSafeInteger(timeFrames))return null;
        return {restrictions,timeFrames,overLimit:restrictions>MAX_DRAFT_TIME_FRAMES||
            timeFrames>MAX_DRAFT_TIME_FRAMES};
    }
    // The single-segment draft assumes one new restriction per time frame.
    function estimateSafe12Budget(existingRestrictions, proposedTimeFrames) {
        const unknown={
            status:"UNKNOWN",existingRestrictions:null,existingFrames:null,
            proposedRestrictions:null,proposedFrames:null,
            projectedRestrictions:null,projectedFrames:null,
            limit:MAX_DRAFT_TIME_FRAMES,verified:false
        };
        if(!Array.isArray(proposedTimeFrames)||!proposedTimeFrames.length)return unknown;
        const existing=countSafe12Operation([existingRestrictions]);
        if(!existing)return unknown;
        const proposed=Array.from(proposedTimeFrames,frame=>({timeFrames:[frame]}));
        const projected=countSafe12Operation([[...existingRestrictions,...proposed]]);
        if(!projected)return unknown;
        return {
            status:projected.overLimit?"OVER":"WITHIN_ESTIMATE",
            existingRestrictions:existing.restrictions,existingFrames:existing.timeFrames,
            proposedRestrictions:proposed.length,proposedFrames:proposedTimeFrames.length,
            projectedRestrictions:projected.restrictions,projectedFrames:projected.timeFrames,
            limit:MAX_DRAFT_TIME_FRAMES,
            verified:false
        };
    }
    function nextWizardStep(step,intent,types=[]) {
        if(step===4&&intent==="BLOCKED")return types.includes("MOTORCYCLE")?5:7;
        if(step===4&&intent==="TOLL")return 7;
        if(step===5&&(intent==="BLOCKED"||intent==="ALLOWED"))return 7;
        if(step===7&&RESTRICTION_TYPES.includes(intent))return 6;
        return step<6?step+1:null;
    }
    function previousWizardStep(step,intent,types=[]) {
        if(step===6&&RESTRICTION_TYPES.includes(intent))return 7;
        if(step===7&&intent==="BLOCKED")return types.includes("MOTORCYCLE")?5:4;
        if(step===7&&intent==="ALLOWED")return 5;
        if(step===7&&intent==="TOLL")return 4;
        return step>0?step-1:null;
    }
    function normalizeMotorDraft(value,hasMotorcycle) {
        // Pure experimental draft. FUEL/ELECTRIC and ALL/LT/LTE are only UI
        // design identifiers and must never be serialized as native SDK values.
        if(!hasMotorcycle){
            if(value?.enabled)throw Error("Motorcycle type not selected");
            return {mode:"ALL_MOTORCYCLES",conditions:[],verified:false};
        }
        if(!value?.enabled)return {mode:"ALL_MOTORCYCLES",conditions:[],verified:false};
        if(!Array.isArray(value.conditions)||!value.conditions.length)
            throw Error("Select at least one motorcycle engine");
        const unique=new Set();
        const conditions=value.conditions.map(c=>{
            if(!MOTOR_ENGINE_TYPES.includes(c?.engineType)||
               !MOTOR_COMPARATORS.includes(c?.operator)||
               unique.has(c.engineType))throw Error("Invalid motorcycle engine condition");
            unique.add(c.engineType);
            const threshold=c.capacityThreshold??null;
            if(c.operator==="ALL"&&threshold!==null)
                throw Error("ALL engine condition cannot have threshold");
            if(c.operator!=="ALL"&&(!Number.isFinite(threshold)||
               threshold<=0||(c.engineType==="FUEL"&&!Number.isSafeInteger(threshold))))
                throw Error("Invalid motorcycle engine threshold");
            return {engineType:c.engineType,operator:c.operator,capacityThreshold:threshold};
        });
        return {mode:"MATCHING_ENGINES",conditions,verified:false};
    }
    function isScheduleTime(value) {
        return typeof value==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    }
    function isScheduleDate(value) {
        return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
            !Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
    }
    function isSdkPlateRule(value) {
        return typeof value==="string"&&/^ENDS_WITH_(?:[0-9]|EVEN|ODD)$/.test(value);
    }
    function crossesMidnight(frame) {
        return Boolean(frame.fromTime&&frame.toTime&&frame.fromTime>frame.toTime);
    }
    // Pure draft matching the stable v3.2 calendar's day/date/time vocabulary.
    // No native WME SDK serialization occurs in this prototype.
    function normalizeRedSchedule(schedule) {
        if(!schedule||typeof schedule!=="object")throw Error("Invalid schedule");
        const start=schedule.startDate||null,end=schedule.endDate||null;
        if((start&&!isScheduleDate(start))||(end&&!isScheduleDate(end))||(start&&end&&start>end))
            throw Error("Invalid dates");
        const days=schedule.weekdays;
        if(!Array.isArray(days)||!days.length||
            days.some(day=>!WEEKDAYS.includes(day))||new Set(days).size!==days.length)
            throw Error("Invalid weekdays");
        if(typeof schedule.allDay!=="boolean")throw Error("Invalid all-day setting");
        if(!Array.isArray(schedule.slots))throw Error("Invalid time slots");
        const raw=schedule.allDay?[{fromTime:null,toTime:null}]:schedule.slots;
        if(!raw.length||raw.length>MAX_DRAFT_TIME_FRAMES)throw Error("SAFE12 draft limit");
        const frames=Array.from(raw,slot=>{
            if(!schedule.allDay&&(!isScheduleTime(slot?.fromTime)||!isScheduleTime(slot?.toTime)||
               slot.fromTime===slot.toTime))throw Error("Invalid time range");
            return {startDate:start,endDate:end,weekdays:[...days],
                fromTime:slot.fromTime,toTime:slot.toTime,
                timeZone:null,verified:false};
        });
        return {timeFrames:frames,verified:false};
    }
    function internalSegmentRestrictions(page,segmentId) {
        return page?.W?.model?.segments?.getObjectById?.(segmentId)?.attributes?.restrictions;
    }
    // Like v3.2, read engineType from the private model only when already present;
    // this DOES NOT infer a complete list of supported engine enum values.
    function observedMotorTypes(page,segmentId) {
        try {
            const restrictions=internalSegmentRestrictions(page,segmentId);
            if(!Array.isArray(restrictions))return [];
            const names=new Set();
            for(const restriction of restrictions){
                const profiles=restriction?.getDriveProfileList?.("BLOCKED")?.getDriveProfiles?.()||[];
                for(const profile of profiles)
                    for(const item of profile?.getEngineCapacities?.()||[]){
                        const attr=item?.attributes||item;
                        if(attr?.vehicleType==="MOTORCYCLE"&&typeof attr.engineType==="string"&&attr.engineType.trim())
                            names.add(attr.engineType.trim());
                    }
            }
            return [...names].sort((a,b)=>a.localeCompare(b));
        }catch(_){return [];}
    }
    function readInternalEngineProfiles(restriction) {
        if(typeof restriction?.getDriveProfileList!=="function")return null;
        const list=restriction.getDriveProfileList("BLOCKED");
        if(list===null)return [];
        const profiles=list?.getDriveProfiles?.();
        if(!Array.isArray(profiles))return null;
        const items=[];
        for(const profile of profiles){
            const conditions=profile?.getEngineCapacities?.();
            if(!Array.isArray(conditions))return null;
            for(const condition of conditions){
                if(!condition||typeof condition!=="object"||Array.isArray(condition))return null;
            }
            items.push(conditions);
        }
        return items;
    }
    function readInternalEngineRows(page,segmentId) {
        try{
            const restrictions=internalSegmentRestrictions(page,segmentId);
            if(!Array.isArray(restrictions))return null;
            const rows=Array.from(restrictions,restriction=>{
                try{return {restriction,profiles:readInternalEngineProfiles(restriction)};}
                catch(_){return {restriction,profiles:null};}
            });
            const count=rows.every(row=>row.profiles!==null)?countEngineProfiles(rows.flatMap(row=>row.profiles)):null;
            return {rows,count};
        }catch(_){return null;}
    }
    function countEngineProfiles(profiles) {
        if(!profiles)return null;
        const count=profiles.reduce((total,conditions)=>total+conditions.length,0);
        return Number.isSafeInteger(count)?count:null;
    }
    function countInternalEngineConditions(page,segmentId) {
        return readInternalEngineRows(page,segmentId)?.count??null;
    }
    // Use the stable's public/private read comparison. Only status and counts
    // leave this function, and its findings do not change the preservation gate.
    function inspectInternalEnginePreservation(page,segment) {
        const read=readInternalEngineRows(page,segment?.id);
        const native=read?.rows;
        const sdk=segment?.restrictions;
        const count=read?.count??null;
        if(!Array.isArray(sdk))return {count,rows:[]};
        const unpaired=Array.from(sdk,(_,index)=>({index:index+1,count:null,status:"UNPAIRED"}));
        if(!native||native.length!==sdk.length)return {count,rows:unpaired};
        const raw=native.map(row=>{
            try{return row.restriction?.toJSON?.()??null;}catch(_){return null;}
        });
        // Missing private identity fields limit pairing to what both models
        // expose. A match must be unique in both directions.
        const matches=(internal,visible)=>{
            const requiredDirection=visible?.direction;
            if(!internal||!["FWD","REV","BOTH"].includes(requiredDirection)||
               internal.direction!==requiredDirection)return false;
            const scope=internal.laneScope??internal.disposition;
            if(internal.disposition!=null&&internal.disposition!==scope)return false;
            return (internal.defaultType==null||internal.defaultType===visible.defaultType)&&
                (scope==null||scope===(visible.laneScope??visible.disposition))&&
                (internal.laneType==null||internal.laneType===visible.laneType);
        };
        const stamp=data=>{
            if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Missing engine condition");
            const {vehicleType,engineType,operator}=data;
            if(![vehicleType,engineType,operator].every(value=>
                (typeof value==="string"&&value.length>0)||Number.isFinite(value)))
                throw Error("Invalid engine condition");
            const value=data.capacityThreshold;
            const threshold=typeof value==="string"&&value.trim()?Number(value):value;
            if(threshold!=null&&!Number.isFinite(threshold))throw Error("Invalid engine threshold");
            return JSON.stringify({vehicleType,engineType,operator,capacityThreshold:threshold});
        };
        const comparison=(profiles,record)=>{
            if(!profiles)return "UNAVAILABLE";
            try{
                const rules=record.driveProfiles??record.vehicleRules;
                if(rules!=null&&(typeof rules!=="object"||Array.isArray(rules)))return "UNAVAILABLE";
                const blocked=rules?.BLOCKED??[];
                if(!Array.isArray(blocked))return "UNAVAILABLE";
                const json=Array.from(blocked,profile=>{
                    if(!profile||typeof profile!=="object"||Array.isArray(profile))throw Error("Invalid profile");
                    const items=profile.engineCapacities??[];
                    if(!Array.isArray(items))throw Error("Invalid engine conditions");
                    return Array.from(items,stamp).sort();
                });
                const direct=profiles.map(items=>Array.from(items,item=>stamp(item.attributes??item)).sort());
                return JSON.stringify(direct)===JSON.stringify(json)?"MATCH":"DIFFERENT";
            }catch(_){return "UNAVAILABLE";}
        };
        const rows=unpaired.map((fallback,index)=>{
            try{
                // An unreadable private identity could also match this SDK row.
                if(raw.some(record=>!record||!["FWD","REV","BOTH"].includes(record.direction)))return fallback;
                const candidates=raw.map((record,i)=>matches(record,sdk[index])?i:-1).filter(i=>i!==-1);
                if(candidates.length!==1)return fallback;
                const [position]=candidates;
                if(sdk.filter(visible=>matches(raw[position],visible)).length!==1)return fallback;
                const profiles=native[position].profiles;
                return {index:index+1,count:countEngineProfiles(profiles),status:comparison(profiles,raw[position])};
            }catch(_){return fallback;}
        });
        return {count,rows};
    }
    function normalizeVehicleRules(types,rules,permits) {
        const chosen=selectedVehicleTypes(types);
        if(!chosen.length)throw Error("No authorized vehicle types");
        if(!rules||typeof rules!=="object"||Array.isArray(rules))throw Error("Invalid vehicle rules");
        if(Object.keys(rules).some(type=>!chosen.includes(type)))
            throw Error("Conditions for an unselected vehicle");
        const validPermits=new Set((permits||[]).map(p=>p.id));
        const vehicles=chosen.map(vehicleType=>{
            const rule=rules[vehicleType]??{
                requiresPass:false,requiresOccupancy:false,permitIds:[],minPassengers:null
            };
            if(typeof rule.requiresPass!=="boolean"||typeof rule.requiresOccupancy!=="boolean"||
               !Array.isArray(rule.permitIds))throw Error("Invalid vehicle conditions");
            const permitIds=[...new Set(rule.permitIds)];
            if(permitIds.some(id=>typeof id!=="string"||!validPermits.has(id)))
                throw Error("Unrecognized vehicle permit");
            if(rule.requiresPass&&!permitIds.length)throw Error("Missing vehicle permit");
            if(!rule.requiresPass&&permitIds.length)throw Error("Inactive permit has IDs");
            const minPassengers=rule.minPassengers??null;
            if(rule.requiresOccupancy&&(!Number.isSafeInteger(minPassengers)||minPassengers<2))
                throw Error("Invalid vehicle occupancy");
            if(!rule.requiresOccupancy&&minPassengers!==null)throw Error("Inactive occupancy has value");
            return {vehicleType,
                access:rule.requiresPass||rule.requiresOccupancy?"CONDITIONAL":"DIRECT",
                requiresPass:rule.requiresPass,requiresOccupancy:rule.requiresOccupancy,
                permitIds,minPassengers};
        });
        return {vehicles,verified:false};
    }
    // Only audit documented SDK read-model fields. Never treat a
    // SegmentRestriction object as an addable SegmentRestrictionData object.
    // Read only. Data exposed here is taken from the selected SDK Segment.
    // No implicit conversion of vehicle rules or native calendars is attempted.
    function inspectNativeTimeFrame(frame) {
        const validObject=frame&&typeof frame==="object"&&!Array.isArray(frame);
        const data=validObject?frame:{};
        const asString=value=>typeof value==="string"?value:null;
        const {startDate,endDate,fromTime,toTime,weekdays,timeZone,repeatYearly}=data;
        const alternation=data.dayAlternation??data.daysOfMonth??null;
        const reviewRequired=!validObject||Object.keys(data).some(key=>
            key!=="daysOfMonth"&&!SDK_TIME_FRAME_FIELDS.includes(key))||
            (repeatYearly!=null&&repeatYearly!==false)||alternation!==null||
            [startDate,endDate].some(value=>value!=null&&!isScheduleDate(value))||
            (startDate!=null&&endDate!=null&&startDate>endDate)||
            !Array.isArray(weekdays)||!weekdays.length||
            Array.from(weekdays).some(day=>!WEEKDAYS.includes(day))||
            ((fromTime!=null||toTime!=null)&&(!isScheduleTime(fromTime)||!isScheduleTime(toTime)||fromTime>=toTime))||
            (timeZone!=null&&(typeof timeZone!=="string"||!timeZone));
        const alternationAgrees=!Object.hasOwn(data,"dayAlternation")||
            !Object.hasOwn(data,"daysOfMonth")||data.dayAlternation===data.daysOfMonth;
        return {
            startDate:asString(startDate),endDate:asString(endDate),
            fromTime:asString(fromTime),toTime:asString(toTime),
            weekdays:Array.isArray(weekdays)?Array.from(weekdays,asString):
                typeof weekdays==="number"?String(weekdays):asString(weekdays),
            timeZone:asString(timeZone),repeatYearly:typeof repeatYearly==="boolean"?repeatYearly:null,
            dayAlternation:alternationAgrees&&["EVEN_DAYS","ODD_DAYS"].includes(alternation)?
                alternation:null,
            reviewRequired
        };
    }
    function listExistingRestrictions(segment) {
        if(!Array.isArray(segment?.restrictions))
            return {available:false,entries:[],verified:false};
        const primitive=value=>(typeof value==="string"||typeof value==="number")?
            String(value):null;
        return {available:true,verified:false,
            entries:segment.restrictions.map((r,index)=>{
                const frames=Array.isArray(r?.timeFrames)?
                    Array.from(r.timeFrames,inspectNativeTimeFrame):[];
                const groups=r?.vehicleRules&&typeof r.vehicleRules==="object"&&
                    !Array.isArray(r.vehicleRules)?Object.keys(r.vehicleRules).sort():[];
                return {
                    index:index+1,
                    defaultType:primitive(r?.defaultType),
                    direction:primitive(r?.direction),
                    laneScope:primitive(r?.laneScope??r?.disposition),
                    laneType:primitive(r?.laneType),
                    editable:r?.editable===true?true:r?.editable===false?false:null,
                    expired:r?.isExpired===true?true:r?.isExpired===false?false:null,
                    description:typeof r?.description==="string"?r.description.slice(0,200):null,
                    frames,framesKnown:Array.isArray(r?.timeFrames),
                    ruleGroups:groups,verified:false
                };
            })
        };
    }
    // SDK VehicleRule documents minPassengers and its deprecated alias.
    // AddableVehicleRule lists 0, 2, 3 and 4. Keep zero uncertain until its
    // meaning in existing native rules is checked in WME.
    function inspectNativeVehicleCondition(rule) {
        const unknown={status:"UNKNOWN",types:[],passCount:null,
            minPassengers:null,occupancyFields:[],occupancyStatus:"NOT_REPORTED",
            hasPlate:false,hasEngine:false,
            unknownFields:[],conditions:[],verified:false};
        if(!rule||typeof rule!=="object"||Array.isArray(rule))return unknown;
        const passengerKeys=["minPassengers","numPassengers"];
        const occupancyFields=passengerKeys.filter(key=>Object.hasOwn(rule,key));
        const keys=new Set([
            "vehicleTypes","subscriptions",...passengerKeys,
            "licensePlateNumber","licensePlateRule","engineType",
            "capacityThreshold","operator","engineCapacities"
        ]);
        const unknownFields=Object.keys(rule).filter(key=>!keys.has(key)).sort();
        const types=Array.isArray(rule.vehicleTypes)&&
            rule.vehicleTypes.length&&rule.vehicleTypes.every(x=>
                typeof x==="string"&&x.trim())?[...new Set(rule.vehicleTypes)]:[];
        let invalid=!types.length||unknownFields.length>0;
        const conditions=[];
        let passCount=null,minPassengers=null,hasEngine=false;
        let occupancyStatus="NOT_REPORTED";
        if(Object.prototype.hasOwnProperty.call(rule,"subscriptions")&&
           rule.subscriptions!=null){
            if(!Array.isArray(rule.subscriptions)||rule.subscriptions.some(x=>
                typeof x!=="string"))invalid=true;
            else {
                passCount=rule.subscriptions.length;
                if(passCount)conditions.push("PASS");
            }
        }
        if(occupancyFields.length){
            const value=rule[occupancyFields[0]];
            if(!SDK_MIN_PASSENGERS.includes(value)||
               occupancyFields.some(key=>rule[key]!==value)){
                occupancyStatus="UNKNOWN";
                invalid=true;
            }else if(value===0){
                occupancyStatus="ZERO";
                invalid=true;
            }else{
                occupancyStatus="MINIMUM";
                minPassengers=value;
                conditions.push("OCCUPANCY");
            }
        }
        // An empty legacy licensePlateNumber was documented in DriveProfileAttributes.
        const currentPlate=rule.licensePlateRule??null;
        const legacyPlate=rule.licensePlateNumber===""?null:rule.licensePlateNumber??null;
        const plates=[currentPlate,legacyPlate];
        const hasPlate=plates.some(value=>value!==null&&value!=="");
        if(hasPlate)conditions.push("PLATE");
        if(plates.some(value=>value!==null&&!isSdkPlateRule(value))||
           (Object.hasOwn(rule,"licensePlateRule")&&Object.hasOwn(rule,"licensePlateNumber")&&
            currentPlate!==legacyPlate))invalid=true;
        for(const field of ["engineType","capacityThreshold","operator","engineCapacities"]){
            const value=rule[field];
            if(value==null)continue;
            if(field==="engineCapacities"&&Array.isArray(value)&&value.length===0)
                continue;
            hasEngine=true;
        }
        if(hasEngine)conditions.push("ENGINE");
        // A public motorcycle rule can omit engine conditions visible in WME.
        const engineUncertain=types.includes("MOTORCYCLE")&&!conditions.length;
        return {
            status:invalid||engineUncertain?"UNKNOWN":conditions.length?"CONDITIONAL":"UNCONDITIONAL",
            types,passCount,minPassengers,occupancyFields,occupancyStatus,hasPlate,hasEngine,
            unknownFields,conditions,verified:false
        };
    }
    // Exact snapshots reject opaque data. A diagnostic caller can inspect
    // the readable own data and receives only redacted paths and reason keys.
    function copyNativeData(value,report) {
        const ancestors=new WeakSet();
        const reject=(path,reason="preservation_snapshot_unsupported")=>{
            if(!report)throw Error("Unsupported native data");
            report({field:path||"SegmentRestriction",reason});
            return undefined;
        };
        const copy=(item,depth,path)=>{
            if(item===null||typeof item==="string"||typeof item==="boolean"||
               Number.isFinite(item))return item;
            if(item===undefined)return reject(path,"preservation_snapshot_undefined");
            if(typeof item!=="object"||depth>25)return reject(path);
            if(ancestors.has(item))return reject(path,"preservation_snapshot_cycle");
            let descriptors,isArray,plain=true;
            try{
                descriptors=Object.getOwnPropertyDescriptors(item);
                isArray=Array.isArray(item);
                if(!isArray){
                    const prototype=Object.getPrototypeOf(item);
                    if(prototype){
                        const ctor=Object.getOwnPropertyDescriptor(prototype,"constructor")?.value;
                        plain=Object.getPrototypeOf(prototype)===null&&typeof ctor==="function"&&
                            Object.getOwnPropertyDescriptor(ctor,"name")?.value==="Object";
                    }
                }
            }catch(_){return reject(path);}
            if(!plain)reject(path,"preservation_snapshot_object");
            const keys=Reflect.ownKeys(descriptors);
            const property=(descriptor,field)=>{
                if(!descriptor)return reject(field,"preservation_snapshot_array");
                if(!("value" in descriptor)){
                    const alias=/^(?:disposition|driveProfiles|timeFrames\[\d+\]\.daysOfMonth|(?:vehicleRules|driveProfiles)\.(?:BLOCKED|FREE|TOLL)\[\d+\]\.(?:numPassengers|licensePlateNumber))$/.test(field);
                    return reject(field,alias?"preservation_snapshot_alias":"preservation_snapshot_accessor");
                }
                return copy(descriptor.value,depth+1,field);
            };
            const length=descriptors.length?.value;
            if(isArray&&keys.length!==length+1)return reject(path,"preservation_snapshot_array");
            ancestors.add(item);
            let result;
            if(isArray){
                result=Array.from({length},(_,index)=>property(descriptors[index],path+"["+index+"]"));
            }else{
                if(keys.some(key=>typeof key==="symbol"))reject(path);
                result=Object.fromEntries(keys.filter(key=>typeof key==="string").sort().map(key=>{
                    const token=PRESERVATION_PATH_FIELDS.has(key)?key:"[…]";
                    return [key,property(descriptors[key],path?path+"."+token:token)];
                }));
            }
            ancestors.delete(item);
            return result;
        };
        return copy(value,0,"");
    }
    function nativeDataSnapshot(value) {
        return JSON.stringify(copyNativeData(value));
    }
    function compareLegacyVehicleRules(current,legacy) {
        if(legacy==null)return "ABSENT";
        if(typeof legacy!=="object"||Array.isArray(legacy))return "UNKNOWN";
        try{
            const snapshot=nativeDataSnapshot(legacy);
            if(snapshot==="{}")return "ABSENT";
            return nativeDataSnapshot(current)===snapshot?"SAME":"DIFFERENT";
        }
        catch(_){return "UNKNOWN";}
    }
    function inspectNativeVehicleRules(restriction) {
        const groups=restriction?.vehicleRules;
        if(!groups||typeof groups!=="object"||Array.isArray(groups))
            return {available:false,legacyComparison:"UNKNOWN",rows:[],verified:false};
        const rows=[];
        for(const group of Object.keys(groups).sort()){
            if(!Array.isArray(groups[group])){
                rows.push({group,index:1,...inspectNativeVehicleCondition(null)});
                continue;
            }
            groups[group].forEach((rule,index)=>
                rows.push({group,index:index+1,...inspectNativeVehicleCondition(rule)}));
        }
        return {available:true,
            legacyComparison:compareLegacyVehicleRules(
                groups,restriction?.driveProfiles),
            rows,verified:false};
    }
    // Alpha 21: conservative semantic comparison for the four editor-supported
    // categories. This is NOT a routing-engine evaluator: categories may
    // intersect, and the relative precedence of multiple restrictions is unknown.
    function reviewVehicleConflictEffects(existing,normalized,proposal={}) {
        const types=[...VEHICLE_TYPES];
        const unknown=()=>Object.fromEntries(types.map(type=>[type,"UNKNOWN"]));
        const isRuleObject=value=>value!==null&&typeof value==="object"&&
            !Array.isArray(value);
        const native=unknown();
        let nativeKnown=false,unmodeledNativeTypes=false;
        if(isRuleObject(existing)&&
           ["BLOCKED","FREE","TOLL"].includes(existing.defaultType)&&
           isRuleObject(existing.vehicleRules)){
            const overrides=existing.vehicleRules;
            const expected=existing.defaultType==="FREE"?"BLOCKED":"FREE";
            const keys=Object.keys(overrides);
            const allowed=keys.every(key=>key===expected&&Array.isArray(overrides[key]));
            // A legacy profile that carries data not present in vehicleRules
            // is an additional unknown effect; never silently ignore it.
            const legacyComparison=compareLegacyVehicleRules(
                overrides,existing.driveProfiles);
            const legacyOpaque=legacyComparison==="DIFFERENT"||
                legacyComparison==="UNKNOWN";
            if(allowed&&!legacyOpaque&&
               !(existing.defaultType!=="BLOCKED"&&!keys.length)){
                for(const type of types)native[type]=existing.defaultType;
                nativeKnown=true;
                const seenTypes=new Set();
                for(const row of overrides[expected]||[]){
                    if(!isRuleObject(row)||!Array.isArray(row.vehicleTypes)||
                       !row.vehicleTypes.length){
                        nativeKnown=false;break;
                    }
                    const raw=row.vehicleTypes;
                    if(raw.some(type=>typeof type!=="string"||!type.trim())){
                        nativeKnown=false;break;
                    }
                    if(raw.some(type=>!types.includes(type)))
                        unmodeledNativeTypes=true;
                    // Only independently recognizable, unconditional profile
                    // objects can be considered simple overrides. Permit,
                    // occupancy, plate and engine values remain conditional.
                    const condition=inspectNativeVehicleCondition(row);
                    for(const type of raw.filter(type=>types.includes(type))){
                        if(seenTypes.has(type)){
                            // Multiple rules for the same type may combine by
                            // precedence/OR/AND, which is not yet verified.
                            native[type]=native[type]==="UNKNOWN"||condition.status==="UNKNOWN"?
                                "UNKNOWN":"CONDITIONAL";
                            continue;
                        }
                        seenTypes.add(type);
                        native[type]=condition.status==="UNCONDITIONAL"?expected:
                            condition.status==="CONDITIONAL"?"CONDITIONAL":"UNKNOWN";
                    }
                }
            }
        }
        if(!nativeKnown||unmodeledNativeTypes){
            for(const type of types)native[type]="UNKNOWN";
        }
        const planned=unknown();
        const chosen=normalized.vehicleTypes||[];
        if(["BLOCKED","FREE","TOLL"].includes(normalized.defaultType)){
            for(const type of types)planned[type]=normalized.defaultType;
            if(normalized.restrictionIntent==="BLOCKED"){
                for(const type of chosen){
                    planned[type]=type==="MOTORCYCLE"&&proposal.motorDraft?.enabled?
                        "CONDITIONAL":"BLOCKED";
                }
            }else if(normalized.restrictionIntent==="TOLL"){
                for(const type of chosen)planned[type]="FREE";
            }else if(normalized.restrictionIntent==="ALLOWED"){
                for(const type of chosen){
                    const rule=proposal.vehicleRules?.[type];
                    if(!rule||typeof rule!=="object"){
                        planned[type]="UNKNOWN";
                    }else if(rule.requiresPass===true||rule.requiresOccupancy===true){
                        planned[type]="CONDITIONAL";
                    }else if(rule.requiresPass===false&&rule.requiresOccupancy===false){
                        planned[type]="FREE";
                    }else planned[type]="UNKNOWN";
                }
            }
        }
        const rows=types.map(type=>{
            const oldEffect=native[type],newEffect=planned[type];
            const relation=oldEffect==="UNKNOWN"||newEffect==="UNKNOWN"?"UNKNOWN":
                oldEffect==="CONDITIONAL"||newEffect==="CONDITIONAL"?"CONDITIONAL":
                oldEffect===newEffect?"SAME":"DIFFERENT";
            return {vehicleType:type,existingEffect:oldEffect,proposedEffect:newEffect,
                relation,verified:false};
        });
        return {
            status:rows.some(r=>r.relation==="DIFFERENT")?"POSSIBLE_DIFFERENCE":
                rows.some(r=>r.relation==="UNKNOWN")?"UNKNOWN":
                rows.some(r=>r.relation==="CONDITIONAL")?"CONDITIONAL":
                "SAME_EFFECT",
            rows,unmodeledNativeTypes,verified:false,saveAllowed:false
        };
    }
    function previewRestrictionConflicts(draft,segment,schedule,proposal={}) {
        const listed=listExistingRestrictions(segment);
        if(!listed.available)return {status:"UNKNOWN",items:[],verified:false,saveAllowed:false};
        const normalized=normalizeDraft(draft,segment);
        const proposed=normalizeRedSchedule(schedule).timeFrames;
        const targetScope=LANE_SCOPE_CANDIDATES[normalized.scope];
        const directionSet=value=>value==="BOTH"?["FWD","REV"]:
            value==="FWD"||value==="REV"?[value]:null;
        const windowOverlap=(existing,planned)=>{
            // Compare simple civil-time windows on this segment only. The
            // draft time zone and endpoint inclusivity still require WME review.
            // The morning portion can overlap even on another weekday/date.
            if(existing.reviewRequired||crossesMidnight(planned))return null;
            if((existing.endDate&&planned.startDate&&existing.endDate<planned.startDate)||
               (planned.endDate&&existing.startDate&&planned.endDate<existing.startDate))return false;
            if(!existing.weekdays.some(day=>planned.weekdays.includes(day)))return false;
            if(planned.fromTime===null||existing.fromTime===null)return true;
            if(existing.fromTime===planned.toTime||planned.fromTime===existing.toTime)return null;
            return existing.fromTime<planned.toTime&&planned.fromTime<existing.toTime;
        };
        const items=listed.entries.map(entry=>{
            const base={index:entry.index,status:"UNKNOWN",reason:"conflict_reason_unknown",
                verified:false};
            const left=directionSet(normalized.direction),right=directionSet(entry.direction);
            if(!left||!right)return base;
            if(!left.some(x=>right.includes(x)))
                return {...base,status:"SEPARATE",reason:"conflict_reason_direction"};
            const native=segment.restrictions[entry.index-1];
            if(native.laneScope!=null&&native.disposition!=null&&
               native.laneScope!==native.disposition)return base;
            if(!entry.laneScope||!targetScope)return base;
            const known=new Set(Object.values(LANE_SCOPE_CANDIDATES));
            if(!known.has(entry.laneScope))return base;
            if(entry.laneScope!=="WHOLE_SEGMENT"&&targetScope!=="WHOLE_SEGMENT"&&
                entry.laneScope!==targetScope)
                return {...base,status:"SEPARATE",reason:"conflict_reason_lane"};
            // A special lane may overlap, but cannot be declared physically
            // distinct merely because its type label differs.
            const vehicleReview=reviewVehicleConflictEffects(native,normalized,proposal);
            const withVehicles={...base,vehicleReview};
            if(!entry.framesKnown||!entry.frames.length)return withVehicles;
            let uncertain=false,hit=false;
            for(const previous of entry.frames){
                for(const next of proposed){
                    const result=windowOverlap(previous,next);
                    if(result===true)hit=true;
                    if(result===null)uncertain=true;
                }
            }
            if(!hit&&!uncertain)
                return {...base,status:"SEPARATE",reason:"conflict_reason_time"};
            if(!hit)return withVehicles;
            if(!["BLOCKED","FREE","TOLL"].includes(entry.defaultType))
                return withVehicles;
            const different=vehicleReview.status==="POSSIBLE_DIFFERENCE";
            // A mismatch for a specific class elevates risk even when the
            // top-level default restriction kinds happen to match.
            return {...withVehicles,
                status:different||entry.defaultType!==normalized.defaultType?
                    "POTENTIAL_CONFLICT":"OVERLAP_REVIEW",
                reason:different?"conflict_reason_vehicle":"conflict_reason_common"};
        });
        const status=!items.length?"NONE":
            items.some(x=>x.status==="POTENTIAL_CONFLICT")?"POTENTIAL_CONFLICT":
            items.some(x=>x.status==="OVERLAP_REVIEW")?"OVERLAP_REVIEW":
            items.some(x=>x.status==="UNKNOWN")?"UNKNOWN":"SEPARATE";
        return {status,items,verified:false,saveAllowed:false};
    }
    // Report paths only. These checks neither construct update objects nor
    // determine whether WME preserves native rules after an update.
    function inspectRestrictionUpdateShape(rule,failedFields) {
        const issues=[];
        const flag=(field,reason="preservation_field_shape")=>issues.push({field,reason});
        const record=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
        const outside=(value,allowed)=>Object.getOwnPropertyNames(value).some(key=>!allowed.includes(key));
        const check=(prefix,fields)=>{
            for(const [field,valid] of fields){
                if(!valid)flag(prefix+field);
            }
        };
        const isReadable=path=>![...failedFields].some(field=>field===path||
            field.startsWith(path+".")||field.startsWith(path+"[")||
            path.startsWith(field+".")||path.startsWith(field+"["));
        const checkAlias=(value,prefix,legacy,current)=>{
            if(!Object.hasOwn(value,legacy)||!isReadable(prefix+legacy)||!isReadable(prefix+current))return;
            const oldValue=legacy==="licensePlateNumber"&&value[legacy]===""?null:value[legacy];
            if(oldValue!==value[current])flag(prefix+legacy+" / "+current,"preservation_field_alias");
        };
        if(outside(rule,SDK_RESTRICTION_FIELDS))
            flag("SegmentRestriction","preservation_field_outside");
        if(rule.editable!==true)flag("editable","preservation_field_permission");
        check("",[
            ["defaultType",["BLOCKED","FREE","TOLL"].includes(rule.defaultType)],
            ["description",rule.description===null||typeof rule.description==="string"],
            ["direction",["FWD","REV","BOTH"].includes(rule.direction)],
            ["laneScope",Object.values(LANE_SCOPE_CANDIDATES).includes(rule.laneScope)],
            ["laneType",rule.laneType===null||["BUS","EXPRESS","FAST","HOT","HOV"].includes(rule.laneType)]
        ]);
        checkAlias(rule,"","disposition","laneScope");
        if(isReadable("driveProfiles")&&isReadable("vehicleRules")){
            const legacy=compareLegacyVehicleRules(rule.vehicleRules,rule.driveProfiles);
            if(legacy==="DIFFERENT")flag("driveProfiles / vehicleRules","preservation_field_alias");
            if(legacy==="UNKNOWN")flag("driveProfiles / vehicleRules","preservation_alias_unknown");
        }

        if(!record(rule.vehicleRules))flag("vehicleRules");
        else{
            const expected=rule.defaultType==="FREE"?"BLOCKED":"FREE";
            const group=rule.vehicleRules[expected];
            if(outside(rule.vehicleRules,[expected]))flag("vehicleRules");
            if(!Array.isArray(group)&&(group!==undefined||rule.defaultType!=="BLOCKED"))
                flag("vehicleRules."+expected);
            if(Array.isArray(group)){
                if(!group.length&&rule.defaultType!=="BLOCKED")flag("vehicleRules."+expected);
                for(const [index,row] of group.entries()){
                    const path="vehicleRules."+expected+"["+index+"]";
                    if(!record(row)){flag(path);continue;}
                    if(outside(row,SDK_VEHICLE_RULE_FIELDS))flag(path,"preservation_field_outside");
                    check(path+".",[
                        ["minPassengers",SDK_MIN_PASSENGERS.includes(row.minPassengers)],
                        ["licensePlateRule",row.licensePlateRule===null||isSdkPlateRule(row.licensePlateRule)],
                        ["subscriptions",Array.isArray(row.subscriptions)&&row.subscriptions.every(id=>typeof id==="string")],
                        ["vehicleTypes",Array.isArray(row.vehicleTypes)&&
                            row.vehicleTypes.every(type=>SDK_ADDABLE_VEHICLE_TYPES.includes(type))]
                    ]);
                    checkAlias(row,path+".","numPassengers","minPassengers");
                    checkAlias(row,path+".","licensePlateNumber","licensePlateRule");
                    if(Array.isArray(row.vehicleTypes)&&row.vehicleTypes.includes("MOTORCYCLE"))
                        flag(path,"native_engine_review");
                }
            }
        }
        if(!Array.isArray(rule.timeFrames))flag("timeFrames");
        else for(const [index,frame] of rule.timeFrames.entries()){
            const path="timeFrames["+index+"]";
            if(!record(frame)){flag(path);continue;}
            if(outside(frame,[...SDK_TIME_FRAME_FIELDS,"daysOfMonth"]))
                flag(path,"preservation_field_outside");
            check(path+".",[
                ["startDate",frame.startDate===null||isScheduleDate(frame.startDate)],
                ["endDate",frame.endDate===null||isScheduleDate(frame.endDate)],
                ["fromTime",frame.fromTime===null||isScheduleTime(frame.fromTime)],
                ["toTime",frame.toTime===null||isScheduleTime(frame.toTime)],
                ["weekdays",frame.weekdays===null||Array.isArray(frame.weekdays)&&
                    frame.weekdays.every(day=>WEEKDAYS.includes(day))],
                ["timeZone",frame.timeZone===null||typeof frame.timeZone==="string"],
                ["repeatYearly",frame.repeatYearly===null||typeof frame.repeatYearly==="boolean"],
                ["dayAlternation",[null,"EVEN_DAYS","ODD_DAYS"].includes(frame.dayAlternation)]
            ]);
            checkAlias(frame,path+".","daysOfMonth","dayAlternation");
        }
        return issues;
    }
    function auditRestrictionPreservation(segment) {
        const unknown={
            status:"UNKNOWN",count:null,frameCount:null,nonEditable:null,
            editabilityUnknown:null,opaqueVehicleRules:null,legacyFields:null,
            incomplete:null,entries:[],writeReady:false,verified:false
        };
        const rows=segment?.restrictions;
        if(!Array.isArray(rows))return unknown;
        const snapshotAvailable=restrictionSnapshot(segment)!==null;
        const entries=[];
        let frameCount=0,nonEditable=0,editabilityUnknown=0,
            opaqueVehicleRules=0,legacyFields=0,incomplete=0;
        for(let index=0;index<rows.length;index++){
            const native=Object.getOwnPropertyDescriptor(rows,index)?.value;
            const issues=[];
            const r=snapshotAvailable?native:copyNativeData(native,issue=>{
                if(!issues.some(other=>other.field===issue.field&&other.reason===issue.reason))issues.push(issue);
            });
            entries.push({index:index+1,issues});
            if(!r||typeof r!=="object"||Array.isArray(r)){
                if(!issues.length)issues.push({field:"SegmentRestriction",reason:"preservation_unknown"});
                incomplete++;continue;
            }
            const failedFields=new Set(issues.map(issue=>issue.field));
            issues.push(...inspectRestrictionUpdateShape(r,failedFields)
                .filter(issue=>!failedFields.has(issue.field)));
            if(r.editable===false)nonEditable++;
            else if(r.editable!==true)editabilityUnknown++;
            if(!Array.isArray(r.timeFrames)||!["BLOCKED","FREE","TOLL"].includes(r.defaultType)||
               !r.vehicleRules||typeof r.vehicleRules!=="object"||
               Array.isArray(r.vehicleRules)){
                incomplete++;
            }
            if(Array.isArray(r.timeFrames))frameCount+=r.timeFrames.length;
            if(r.vehicleRules&&typeof r.vehicleRules==="object"&&
               Object.keys(r.vehicleRules).length>0)opaqueVehicleRules++;
            if(r.disposition!=null||r.driveProfiles!=null)legacyFields++;
        }
        if(!snapshotAvailable||!Number.isSafeInteger(frameCount))return {...unknown,entries};
        return {
            status:incomplete?"UNKNOWN":rows.length?"REQUIRES_ROUNDTRIP":"NO_EXISTING",
            count:rows.length,frameCount,nonEditable,editabilityUnknown,
            opaqueVehicleRules,legacyFields,incomplete,entries,
            writeReady:false,verified:false
        };
    }
    // Deterministic conversion REVIEW, not SegmentRestrictionData and not a
    // Segments.updateSegment payload. Only the top-level rule pairing is
    // supported by the published SDK docs. Everything else fails closed.
    function reviewSdkConversion(draft,segment,schedule,vehicleRules,permits,motorDraft,country) {
        const normalized=normalizeDraft(draft,segment);
        const dateDraft=normalizeRedSchedule(schedule);
        let vehicleConditionRows=[];
        let motorMode=null;
        if(normalized.restrictionIntent==="ALLOWED"){
            const rows=normalizeVehicleRules(normalized.vehicleTypes,vehicleRules,permits);
            vehicleConditionRows=rows.vehicles.map(row=>({
                vehicleType:row.vehicleType,ruleType:"FREE",access:row.access,
                requiresPass:row.requiresPass,requiresOccupancy:row.requiresOccupancy,
                permitCount:row.permitIds.length,minPassengers:row.minPassengers
            }));
        }else if(normalized.restrictionIntent==="BLOCKED"){
            const motor=normalizeMotorDraft(motorDraft,
                normalized.vehicleTypes.includes("MOTORCYCLE"));
            motorMode=normalized.vehicleTypes.includes("MOTORCYCLE")?motor.mode:null;
            vehicleConditionRows=normalized.vehicleTypes.map(type=>({
                vehicleType:type,ruleType:"BLOCKED",
                access:"PROHIBITED",
                engineFilter:type==="MOTORCYCLE"?motor.mode:null
            }));
        }else{
            vehicleConditionRows=normalized.vehicleTypes.map(type=>({
                vehicleType:type,ruleType:"FREE",access:"TOLL_EXEMPT"
            }));
        }
        const budget=estimateSafe12Budget(segment?.restrictions,dateDraft.timeFrames);
        const preservation=auditRestrictionPreservation(segment);
        const blockers=["conversion_sdk_contract","conversion_schedule",
            "conversion_lane","conversion_safe12","conversion_country"];
        if(preservation.status==="UNKNOWN")
            blockers.push("conversion_unknown");
        if(preservation.status==="REQUIRES_ROUNDTRIP")
            blockers.push("conversion_preserve");
        if(preservation.status!=="NO_EXISTING")
            blockers.push("conversion_preservation_gate");
        if(budget.status==="OVER")blockers.push("conversion_overbudget");
        if(normalized.restrictionIntent==="ALLOWED"&&
           vehicleConditionRows.some(row=>row.requiresPass||row.requiresOccupancy))
            blockers.push("conversion_conditions");
        if(motorMode==="MATCHING_ENGINES")
            blockers.push("conversion_engine");
        if(normalized.restrictionIntent==="TOLL")
            blockers.push("conversion_toll_atomic");
        // Do not infer segment timezone from the user's browser or UI language.
        // Do not copy/write private or noneditable existing restrictions.
        return {
            status:"BLOCKED",saveAllowed:false,verified:false,sdkWritePayload:null,
            restrictionIntent:normalized.restrictionIntent,
            defaultType:normalized.defaultType,
            overrideType:vehicleConditionRows.length?normalized.overrideType:null,
            directionDesign:normalized.direction,
            laneScopeDesign:normalized.scope,laneTypeDesign:normalized.lane,
            vehicleConditionRows,
            proposedFrameCount:dateDraft.timeFrames.length,
            plannedHasToll:normalized.restrictionIntent==="TOLL"?true:null,
            existingRestrictionCount:Array.isArray(segment?.restrictions)?
                segment.restrictions.length:null,
            budgetStatus:budget.status,preservation,blockers:[...new Set(blockers)]
        };
    }
    async function readPermits(sdk,country) {
        if(!country||typeof sdk?.DataModel?.Countries?.getById!=="function")return null;
        const countryId=Number(country.id);
        if(!Number.isSafeInteger(countryId)||countryId<0)return null;
        try{
            const data=await sdk.DataModel.Countries.getById({countryId});
            if(!Array.isArray(data?.restrictionSubscriptions))return null;
            const list=data.restrictionSubscriptions.filter(p=>
                typeof p?.id==="string"&&p.id.trim()&&typeof p?.name==="string"&&p.name.trim());
            const unique=new Map();
            for(const p of list)if(!unique.has(p.id))unique.set(p.id,{id:p.id,name:p.name});
            return [...unique.values()];
        }catch(_){return null;}
    }
    // Observe existing SDK fields ONLY. Values are evidence that a segment uses
    // them, never evidence that WME allows creating that combination here.
    function inspectRestrictionCapabilities(segment) {
        const restrictions=Array.isArray(segment?.restrictions)?segment.restrictions:null;
        const rows=restrictions||[];
        const strings=list=>[...new Set(list.filter(x=>typeof x==="string"&&x.trim()))].sort();
        const lanes=strings(rows.map(r=>r?.laneType));
        const scopes=strings(rows.map(r=>r?.laneScope??r?.disposition));
        const defaults=strings(rows.map(r=>r?.defaultType));
        const timeZones=strings(rows.flatMap(r=>
            Array.isArray(r?.timeFrames)?r.timeFrames.map(t=>t?.timeZone):[]));
        const editable={yes:0,no:0,unknown:0};
        for(const r of rows){
            if(r?.editable===true)editable.yes++;
            else if(r?.editable===false)editable.no++;
            else editable.unknown++;
        }
        return {available:!!restrictions,count:restrictions?.length??null,
            laneScopes:scopes,laneTypes:lanes,defaultTypes:defaults,timeZones,
            editable,verified:false};
    }
    // Compare all SDK restriction fields, including unrecognized fields.
    function restrictionSnapshot(segment) {
        if(!segment||!Array.isArray(segment.restrictions))return null;
        try{
            return nativeDataSnapshot({
                id:segment.id??null,isAtoB:segment.isAtoB??null,
                isBtoA:segment.isBtoA??null,isTwoWay:segment.isTwoWay??null,
                restrictions:segment.restrictions
            });
        }catch(_){return null;}
    }
    async function readContext(sdk) {
        const sel = await sdk.Editing.getSelection();
        if (!Array.isArray(sel?.ids) || sel.ids.length !== 1 || !String(sel.objectType || "").toLowerCase().includes("segment")) return null;
        const segment = await sdk.DataModel.Segments.getById({segmentId:sel.ids[0]});
        if (!segment) return null;
        let address = null;
        try { address = await sdk.DataModel.Segments.getAddress({segmentId:segment.id}); } catch (_) {}
        const country=countryIdentity(address);
        return {segment,country,permits:await readPermits(sdk,country)};
    }
    // Expose pure functions only in Node, not in the WME page.
    if (typeof module === "object" && module.exports && typeof document === "undefined") {
        module.exports = {availableDirections,countryIdentity,inspectRestrictionCapabilities,restrictionSnapshot,countSafe12Operation,estimateSafe12Budget,inspectLaneDraft,reviewSdkConversion,auditRestrictionPreservation,listExistingRestrictions,previewRestrictionConflicts,reviewVehicleConflictEffects,inspectNativeVehicleCondition,inspectNativeVehicleRules,compareLegacyVehicleRules,LANE_SCOPE_CANDIDATES,normalizeTollActivationDraft,normalizeDraft,normalizeAdvanced,readPermits,normalizeLabel,nativeRestrictionAction,readContext,selectedVehicleTypes,hasAllowedCriteria,normalizeVehicleRules,nextWizardStep,previousWizardStep,normalizeMotorDraft,normalizeRedSchedule,observedMotorTypes,countInternalEngineConditions,inspectInternalEnginePreservation,WEEKDAYS,sortPermits,normalizePermitSearch,filterPermits,SCOPES,LANES,RESTRICTION_TYPES,DEFAULT_TYPES,VEHICLE_TYPES,OVERRIDE_TYPES,RESTRICTION_COLORS};
        return;
    }
    const page = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    if (document.getElementById(ID+"-root")) return;
    let sdk, pane, context, nativeButton, dialog, lang = "en", refreshing = false;
    const tr = key => labels[key]?.[LANGS.indexOf(lang)] || labels[key]?.[1] || key;
    const node = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
    function button(text, handler) { const b = node("button",text); b.type="button"; b.addEventListener("click",handler); b.style.cssText="padding:8px 12px;border:1px solid #9ca3af;border-radius:6px;background:#eff6ff;color:#174c86;cursor:pointer;font:inherit;"; return b; }
    function removeNative() { nativeButton?.remove(); nativeButton = null; }
    function findNativeAnchor() {
        // The native panel uses "Add restrictions" when empty, "Edit restrictions"
        // when the segment has existing rules. Never invoke the native action.
        // Match exact localized labels only, and fail closed on ambiguous matches.
        const visible=el=>!el.closest("#"+ID+"-root,#"+ID+"-dialog") &&
            el.id!==ID+"-native"&&!el.closest('[role="dialog"],dialog') &&
            el.getClientRects().length>0 &&
            !el.disabled&&el.getAttribute("aria-disabled")!=="true";
        const recognized=el=>nativeRestrictionAction(
            el.innerText||el.getAttribute("aria-label")||el.textContent);
        const controls=[...document.querySelectorAll(
            'button,[role="button"],wz-button,a,[role="link"]'
        )].filter(el=>visible(el)&&recognized(el));
        const outer=controls.filter(el=>!controls.some(other=>
            other!==el&&other.contains(el)));
        if(outer.length===1)return outer[0];
        if(outer.length>1)return null;
        // Some WME builds render "Modifica restrizioni" as a click target
        // without an explicit button role. Anchor beside its exact text leaf.
        const textLeaves=[...document.querySelectorAll('span,strong,div,p')]
            .filter(el=>visible(el)&&recognized(el)&&
                ![...el.children].some(child=>recognized(child)));
        return textLeaves.length===1?textLeaves[0]:null;
    }
    function placeNative() {
        if (!context || !availableDirections(context.segment).length) { removeNative(); return false; }
        const anchor = findNativeAnchor();
        if (!anchor?.parentElement) { removeNative(); return false; }
        if (nativeButton?.isConnected && nativeButton.previousElementSibling === anchor) {
            if (nativeButton.textContent !== tr("launch")) nativeButton.textContent=tr("launch");
            return true;
        }
        removeNative();
        nativeButton=button(tr("launch"),event=>{
            // An unlabelled WME click target may wrap the "Edit restrictions"
            // text; never let our click bubble into its native edit handler.
            event.stopPropagation();
            openWizard();
        });
        nativeButton.addEventListener("pointerdown",event=>event.stopPropagation());
        nativeButton.addEventListener("mousedown",event=>event.stopPropagation());
        nativeButton.id=ID+"-native";
        nativeButton.style.display="block";
        nativeButton.style.margin="6px 0";
        anchor.insertAdjacentElement("afterend",nativeButton);
        return true;
    }
    function nativeEditActionAvailable(){
        const anchor=findNativeAnchor();
        return anchor&&nativeRestrictionAction(
            anchor.innerText||anchor.getAttribute("aria-label")||anchor.textContent
        )==="edit";
    }
    function openNativeEditRestrictions(){
        // A direct, explicit user gesture only; never simulate a map edit.
        const anchor=findNativeAnchor();
        if(!anchor||nativeRestrictionAction(
            anchor.innerText||anchor.getAttribute("aria-label")||anchor.textContent
        )!=="edit")return;
        if(dialog?.open)dialog.close();
        anchor.click();
    }
    function renderExistingRestrictionList(segment,expanded=false){
        const data=listExistingRestrictions(segment);
        const wrap=node("details");
        wrap.open=expanded;
        wrap.style.cssText="border:1px solid #cbd5e1;border-radius:8px;"+
            "margin-top:10px;padding:9px;background:#f8fafc;";
        const heading=node("summary",tr("existing_list")+
            " · "+(data.available?data.entries.length:tr("unknown")));
        heading.style.cssText="font-weight:600;cursor:pointer;";
        wrap.append(heading);
        if(!data.available){
            wrap.append(node("p",tr("existing_unknown")));
            return wrap;
        }
        if(!data.entries.length){
            wrap.append(node("p",tr("existing_none")));
            return wrap;
        }
        let motorCheckPlaced=false;
        for(const entry of data.entries){
            const item=node("details");
            item.open=data.entries.length===1;
            item.style.cssText="border:1px solid #e2e8f0;border-radius:6px;"+
                "padding:8px;margin:7px 0;background:#fff;";
            const title=node("summary",
                tr("existing_rule")+" "+entry.index+" · "+
                (entry.defaultType||tr("unknown"))+" · "+
                (entry.direction||tr("unknown")));
            title.style.cssText="font-weight:600;cursor:pointer;";
            item.append(title);
            const field=(label,value)=>{
                const p=node("p",tr(label)+": "+
                    (value===null||value===undefined||value===""?
                        tr("unknown"):String(value)));
                p.style.cssText="margin:5px 0;overflow-wrap:anywhere;";
                item.append(p);
            };
            field("existing_kind",entry.defaultType);
            field("existing_direction",entry.direction);
            field("existing_scope",entry.laneScope);
            field("existing_lane",entry.laneType);
            field("existing_editability",entry.editable===null?null:
                tr(entry.editable?"existing_yes":"existing_no"));
            if(entry.expired!==null)
                field("existing_expired",tr(entry.expired?"existing_yes":"existing_no"));
            if(entry.description)
                field("existing_description",entry.description);
            field("existing_rules",entry.ruleGroups.join(", ")||tr("inspection_none"));
            const diagnostics=inspectNativeVehicleRules(
                segment.restrictions[entry.index-1]);
            const nativeDetails=node("details");
            nativeDetails.style.cssText="border:1px solid #e2e8f0;padding:7px;"+
                "border-radius:6px;margin:9px 0;background:#f8fafc;";
            const nativeTitle=node("summary",tr("native_conditions_title"));
            nativeTitle.style.cssText="font-weight:600;cursor:pointer;";
            nativeDetails.append(nativeTitle,node("p",tr("native_conditions_intro")));
            if(diagnostics.legacyComparison==="SAME")
                nativeDetails.append(node("p",tr("native_profiles_equal")));
            if(diagnostics.legacyComparison==="DIFFERENT")
                nativeDetails.append(node("p",tr("native_profiles_differ")));
            if(diagnostics.legacyComparison==="UNKNOWN")
                nativeDetails.append(node("p",tr("preservation_alias_unknown")));
            for(const rule of diagnostics.rows){
                const line=node("div");
                line.style.cssText="margin:8px 0;padding:7px;border-left:3px solid "+
                    (rule.status==="UNKNOWN"?"#b45309":"#64748b")+";"+
                    "background:#fff;border-radius:4px;font-size:12px;";
                const addText=text=>line.append(node("p",text));
                addText(tr("native_group")+": "+rule.group+" #"+rule.index+
                    " · "+(rule.status==="UNKNOWN"?tr("native_uncertain"):rule.status));
                addText(tr("native_types")+": "+
                    (rule.types.join(", ")||tr("unknown")));
                if(rule.passCount!==null)
                    addText(tr("native_passes")+": "+rule.passCount);
                if(rule.occupancyFields.length){
                    const fields=" ("+rule.occupancyFields.join(" / ")+")";
                    if(rule.occupancyStatus==="MINIMUM")
                        addText(tr("native_occupants")+": "+rule.minPassengers+fields);
                    else if(rule.occupancyStatus==="ZERO")
                        addText(tr("native_occupants_uncertain")+": 0"+fields);
                    else
                        addText(tr("native_occupants_uncertain")+fields);
                }
                if(rule.hasPlate)addText(tr("native_plate"));
                if(rule.hasEngine)addText(tr("native_engine"));
                else if(rule.types.includes("MOTORCYCLE"))addText(tr("native_engine_review"));
                if(rule.unknownFields.length)
                    addText(tr("native_other_fields")+": "+
                        rule.unknownFields.join(", "));
                if(rule.status==="UNKNOWN"&&!rule.unknownFields.length)
                    addText(tr("native_uncertain"));
                nativeDetails.append(line);
            }
            if(!motorCheckPlaced&&diagnostics.rows.some(rule=>rule.types.includes("MOTORCYCLE"))){
                const result=node("div");
                result.setAttribute("role","status");
                nativeDetails.append(button(tr("native_engine_check"),()=>{
                    const review=inspectInternalEnginePreservation(page,segment);
                    result.replaceChildren(node("p",review.count===null?tr("native_engine_unavailable"):
                        tr("native_engine_count")+": "+review.count));
                    for(const row of review.rows){
                        const counts=row.count===null?"":tr("native_engine_row_count")+": "+row.count+" · ";
                        const status={MATCH:"native_engine_match",DIFFERENT:"native_engine_difference",
                            UNPAIRED:"native_engine_unpaired",UNAVAILABLE:"native_engine_uncompared"}[row.status];
                        result.append(node("p",tr("existing_rule")+" "+row.index+" · "+counts+tr(status)));
                    }
                }),result);
                motorCheckPlaced=true;
            }
            item.append(nativeDetails);
            if(!entry.framesKnown)
                field("existing_times",tr("unknown"));
            else if(!entry.frames.length)
                field("existing_times",tr("inspection_none"));
            else{
                const subtitle=node("p",tr("existing_times")+": "+entry.frames.length);
                subtitle.style.cssText="font-weight:600;margin:8px 0 4px;";
                item.append(subtitle);
                for(const [i,frame] of entry.frames.entries()){
                    const dates=(frame.startDate||"…")+" → "+(frame.endDate||"…");
                    const times=(frame.fromTime||"…")+" – "+(frame.toTime||"…");
                    const weekdays=Array.isArray(frame.weekdays)?
                        frame.weekdays.join(", "):frame.weekdays;
                    const p=node("p",(i+1)+". "+dates+" · "+times+
                        " · "+tr("existing_weekdays")+": "+(weekdays||tr("unknown"))+
                        " · "+(frame.timeZone||tr("unknown"))+
                        (frame.repeatYearly?" · "+tr("existing_repeat_yearly"):"")+
                        (frame.dayAlternation?" · "+tr("existing_day_alternation")+": "+frame.dayAlternation:"")+
                        (frame.reviewRequired?" · "+tr("existing_calendar_review"):""));
                    p.style.cssText="margin:4px 0 4px 10px;overflow-wrap:anywhere;font-size:12px;";
                    item.append(p);
                }
            }
            wrap.append(item);
        }
        if(nativeEditActionAvailable()){
            const edit=button(tr("edit_native"),openNativeEditRestrictions);
            edit.style.marginTop="8px";
            wrap.append(edit);
        }
        const help=node("p",tr("edit_native_hint"));
        help.style.cssText="font-size:12px;color:#475569;margin-top:7px;";
        wrap.append(help);
        return wrap;
    }
    function renderConflictPreflight(draft,segment,schedule,proposal={}){
        const report=previewRestrictionConflicts(draft,segment,schedule,proposal);
        const wrap=node("section");
        wrap.style.cssText="border:1px solid #cbd5e1;border-radius:8px;"+
            "padding:10px;margin-top:12px;background:#f8fafc;";
        const heading=node("h4",tr("conflict_title"));
        heading.style.cssText="margin:2px 0 8px;";
        wrap.append(heading);
        const textOf=status=>status==="POTENTIAL_CONFLICT"?"conflict_potential":
            status==="OVERLAP_REVIEW"?"conflict_overlap":
            status==="SEPARATE"?"conflict_separate":
            status==="NONE"?"conflict_absent":"conflict_unknown";
        const colorOf=status=>status==="POTENTIAL_CONFLICT"?"#b91c1c":
            status==="SEPARATE"||status==="NONE"?"#286244":"#92400e";
        const headline=node("p",tr(textOf(report.status)));
        headline.setAttribute("role","status");
        headline.style.cssText="font-weight:700;color:"+colorOf(report.status)+";";
        wrap.append(headline);
        for(const item of report.items){
            const p=node("p",tr("existing_rule")+" "+item.index+": "+
                tr(textOf(item.status))+" — "+tr(item.reason));
            p.style.cssText="padding:6px 8px;margin:5px 0;background:#fff;"+
                "border-left:3px solid "+colorOf(item.status)+";border-radius:4px;";
            wrap.append(p);
            if(item.vehicleReview&&item.status!=="SEPARATE"){
                const details=node("details");
                details.style.cssText="padding:7px 9px;margin:2px 0 10px;"+
                    "border:1px solid #e2e8f0;border-radius:6px;background:#fff;";
                const header=node("summary",tr("vehicle_conflict_title"));
                header.style.cssText="font-weight:600;cursor:pointer;";
                details.append(header);
                for(const result of item.vehicleReview.rows){
                    const name=vehicleLabels[result.vehicleType]?.[LANGS.indexOf(lang)]||
                        result.vehicleType;
                    const description=result.relation==="DIFFERENT"?"vehicle_different":
                        result.relation==="SAME"?"vehicle_same":
                        result.relation==="CONDITIONAL"?"vehicle_conditional":
                        "vehicle_unknown";
                    const line=node("p",name+" — "+
                        tr("vehicle_existing_effect")+": "+result.existingEffect+
                        " · "+tr("vehicle_proposed_effect")+": "+result.proposedEffect+
                        " · "+tr(description));
                    line.style.cssText="padding:5px 0;margin:4px 0;"+
                        "border-bottom:1px solid #f1f5f9;font-size:12px;";
                    details.append(line);
                }
                const nativeData=inspectNativeVehicleRules(
                    segment.restrictions?.[item.index-1]);
                if(nativeData.rows.some(row=>row.status!=="UNCONDITIONAL")||
                   nativeData.legacyComparison==="DIFFERENT"||
                   nativeData.legacyComparison==="UNKNOWN"){
                    const summary=node("p",tr("native_conditions_title")+": "+
                        nativeData.rows.map(row=>row.group+" #"+row.index+
                            " ("+row.status+")").join(", "));
                    summary.style.cssText="font-size:12px;color:#92400e;";
                    details.append(summary);
                }
                if(item.vehicleReview.unmodeledNativeTypes){
                    const warning=node("p",tr("vehicle_compare_unmodeled"));
                    warning.style.cssText="color:#92400e;font-weight:600;";
                    details.append(warning);
                }
                const caveat=node("p",tr("vehicle_compare_caution"));
                caveat.style.cssText="font-size:12px;color:#7c2d12;";
                details.append(caveat);
                wrap.append(details);
            }
        }
        const note=node("p",tr("conflict_uncertain"));
        note.style.cssText="font-size:12px;color:#7c2d12;margin-top:10px;";
        wrap.append(note);
        return wrap;
    }
    function renderPanel() {
        const root = pane.querySelector("#"+ID+"-root");
        if (!root) return;
        root.replaceChildren(node("h3","Guided Creator "+VERSION),node("p",tr("test")));
        if (!context) { root.append(node("p",tr("select"))); return; }
        root.append(node("p",tr("country")+": "+(context.country?.name || tr("unknown"))));
        root.append(node("p",tr("observed")+": "+(Array.isArray(context.segment.restrictions)?context.segment.restrictions.length:tr("unknown"))));
        const launch=button(tr("launch"),openWizard);
        launch.disabled=!availableDirections(context.segment).length;
        root.append(launch,node("p",tr("anchor")+": "+(nativeButton?.isConnected?tr("found"):tr("fallback"))));
        root.append(renderExistingRestrictionList(context.segment,true));
        const inspection=inspectRestrictionCapabilities(context.segment);
        const details=node("details");
        details.style.cssText="margin-top:10px;padding:10px;border:1px solid #d1d5db;"+
            "border-radius:8px;background:#f8fafc;font-size:12px;";
        const summary=node("summary",tr("inspection_title"));
        summary.style.cssText="cursor:pointer;font-weight:600;";
        details.append(summary);
        const list=(label,values)=>{
            const field=node("p",tr(label)+": "+(values.length?values.join(", "):tr("inspection_none")));
            field.style.cssText="margin:7px 0;overflow-wrap:anywhere;";
            details.append(field);
        };
        list("inspection_scope",inspection.laneScopes);
        list("inspection_lane",inspection.laneTypes);
        list("inspection_defaults",inspection.defaultTypes);
        list("inspection_zone",inspection.timeZones);
        const counts=inspection.editable;
        details.append(node("p",tr("inspection_editable")+": "+
            [counts.yes,counts.no,counts.unknown].join(" / ")));
        const snap=restrictionSnapshot(context.segment);
        details.append(node("p",tr("inspection_snapshot")+": "+
            (snap===null?tr("unknown"):tr("found"))));
        const note=node("p",tr("inspection_warn"));
        note.style.cssText="color:#92400e;font-weight:600;margin:8px 0 0;";
        details.append(note);root.append(details);
    }
    let lastKey="";
    async function refresh() {
        if (refreshing || document.hidden) return;
        refreshing=true;
        try {
            const l=await sdk.Settings.getLocale();
            const candidate=String(l?.localeCode || "en").toLowerCase().split(/[-_]/)[0];
            lang=LANGS.includes(candidate)?candidate:"en";
            context=await readContext(sdk);
            const injected=placeNative();
            const key=JSON.stringify([lang,context?.segment.id,context?.country,
                availableDirections(context?.segment),restrictionSnapshot(context?.segment),injected]);
            if (key!==lastKey) { lastKey=key; renderPanel(); }
        } catch (_) { context=null; removeNative(); if(lastKey!=="error"){lastKey="error";renderPanel();} }
        finally { refreshing=false; }
    }
    async function openWizard() {
        let current;
        try { current=await readContext(sdk); } catch (_) {return;}
        if (!current || !availableDirections(current.segment).length) return;
        if (dialog?.open) dialog.close();
        dialog?.remove();
        dialog=node("dialog"); dialog.id=ID+"-dialog";
        dialog.style.cssText="width:min(480px,90vw);max-height:85vh;overflow:auto;border:1px solid #9ca3af;border-radius:14px;padding:20px;background:#fff;color:#202938;font:14px/1.5 system-ui;";
        document.body.append(dialog);
        let step=0;
        const baselineSnapshot=restrictionSnapshot(current.segment);
        const draft={direction:availableDirections(current.segment).at(-1),scope:null,lane:"lane_none",restrictionType:"BLOCKED",vehicleTypes:[]};
        const advanced={minPassengers:null,permitIds:[]};
        const vehicleRules=Object.create(null);
        const motorDraft={enabled:false,conditions:[]};
        const redSchedule={
            startDate:"",endDate:"",weekdays:[...WEEKDAYS],allDay:true,
            slots:[{fromTime:"08:00",toTime:"18:00"}]
        };
        const emptyRule=()=>({
            requiresPass:false,requiresOccupancy:false,permitIds:[],minPassengers:null
        });
        const options = (keys,value,onChange) => {
            const box=node("div");
            for(const k of keys) {
                const label=node("label"),input=node("input");
                input.type="radio";input.name=ID+"-choice";input.value=k;input.checked=k===value;
                input.addEventListener("change",()=>{onChange(k);render();});
                const colors = keys===RESTRICTION_TYPES ? RESTRICTION_COLORS[k] : null;
                if (colors) {
                    const selected=input.checked;
                    label.dataset.restrictionType=k;
                    label.style.cssText="display:flex;align-items:center;gap:9px;margin:6px 0;padding:10px 12px;"+
                        "border:2px solid "+(selected?colors.border:"transparent")+";border-radius:8px;"+
                        "background:"+(selected?colors.active:colors.background)+";"+
                        "font-weight:600;cursor:pointer;";
                    input.style.accentColor=colors.border;
                    input.style.margin="0";
                    input.style.flexShrink="0";
                } else {
                    label.style.cssText="display:block;padding:8px 0;";
                }
                label.append(input,document.createTextNode(" "+tr(k)));box.append(label);
            }
            return box;
        };
        function isAdvancedValid(){
            try {
                if(draft.restrictionType==="ALLOWED")
                    normalizeVehicleRules(draft.vehicleTypes,vehicleRules,current.permits);
                else if(draft.restrictionType==="BLOCKED")
                    normalizeMotorDraft(motorDraft,draft.vehicleTypes.includes("MOTORCYCLE"));
                else normalizeAdvanced(advanced,current.permits);
                return true;
            }catch(_){return false;}
        }
        function isScheduleValid(){
            try {normalizeRedSchedule(redSchedule);return true;}catch(_){return false;}
        }
        function renderScheduleSummary(schedule,intro){
            dialog.append(node("h4",tr("schedule_summary")));
            for(const frame of schedule.timeFrames){
                const dates=(frame.startDate||tr("no_condition"))+" → "+
                    (frame.endDate||tr("no_condition"));
                const days=frame.weekdays.map(day=>tr(day)).join(", ");
                const hours=frame.fromTime===null?tr("schedule_all_day"):
                    frame.fromTime+"–"+frame.toTime+
                    (crossesMidnight(frame)?" ("+tr("schedule_next_day")+")":"");
                dialog.append(node("p",dates+" · "+days+" · "+hours));
            }
            dialog.append(node("p",tr(intro)));
        }
        function refreshNext(){
            const next=dialog.querySelector('[data-guided-next="true"]');
            if(next&&step===5)next.disabled=!isAdvancedValid();
        }
        // Separate picker instance for each vehicle that actually requires a pass.
        // It keeps the same alphabetic, accent-insensitive autocomplete semantics.
        function vehiclePermitPicker(type,rule){
            const wrapper=node("div");
            if(current.permits===null){
                wrapper.append(node("p",tr("permits_missing")));
            }else if(!current.permits.length){
                wrapper.append(node("p",tr("permits_empty")));
            }else{
                const searchLabel=node("label",tr("permit_search"));
                searchLabel.style.cssText="display:block;font-weight:600;margin-top:8px;";
                const search=node("input");
                search.type="search";search.autocomplete="off";
                search.placeholder=tr("permit_search_placeholder");
                search.id=ID+"-pass-query-"+type;
                search.style.cssText="display:block;width:100%;box-sizing:border-box;"+
                    "padding:7px;margin:6px 0;border:1px solid #9ca3af;border-radius:6px;";
                search.setAttribute("role","combobox");
                search.setAttribute("aria-autocomplete","list");
                search.setAttribute("aria-controls",ID+"-pass-suggest-"+type);
                search.setAttribute("aria-expanded","false");
                searchLabel.append(search);
                const suggestions=node("div");
                suggestions.id=ID+"-pass-suggest-"+type;
                suggestions.setAttribute("role","listbox");
                suggestions.style.cssText="max-height:130px;overflow:auto;"+
                    "border:1px solid #cbd5e1;border-radius:6px;display:none;";
                const list=node("div");
                list.style.cssText="max-height:120px;overflow:auto;"+
                    "border:1px solid #cbd5e1;border-radius:6px;padding:4px;";
                const count=node("p");
                count.setAttribute("aria-live","polite");
                count.style.cssText="font-size:12px;margin:5px 0;";
                const warning=node("p");
                warning.setAttribute("role","alert");
                warning.style.cssText="font-size:12px;color:#b91c1c;font-weight:600;";
                let matches=[],active=-1;
                const togglePermit=id=>{
                    rule.permitIds=rule.permitIds.includes(id)?
                        rule.permitIds.filter(value=>value!==id):
                        [...rule.permitIds,id];
                    draw();
                    refreshNext();
                };
                function draw(){
                    matches=filterPermits(current.permits,search.value,lang);
                    if(active>=Math.min(matches.length,8))active=-1;
                    warning.textContent=rule.permitIds.length?"":tr("missing_vehicle_pass");
                    warning.hidden=!!rule.permitIds.length;
                    count.textContent=tr("permit_selected_count")+": "+rule.permitIds.length;
                    list.replaceChildren();
                    if(!matches.length)list.append(node("p",tr("permit_search_empty")));
                    for(const permit of matches){
                        const item=node("label"),check=node("input");
                        item.style.cssText="display:flex;align-items:center;gap:7px;"+
                            "padding:4px;cursor:pointer;";
                        check.type="checkbox";check.checked=rule.permitIds.includes(permit.id);
                        check.addEventListener("change",()=>togglePermit(permit.id));
                        item.append(check,document.createTextNode(permit.name));
                        list.append(item);
                    }
                    suggestions.replaceChildren();
                    const top=normalizePermitSearch(search.value)?matches.slice(0,8):[];
                    suggestions.style.display=top.length?"block":"none";
                    search.setAttribute("aria-expanded",top.length?"true":"false");
                    search.removeAttribute("aria-activedescendant");
                    top.forEach((permit,index)=>{
                        const option=button(
                            (rule.permitIds.includes(permit.id)?"✓ ":"+ ")+permit.name,
                            ()=>{togglePermit(permit.id);search.focus();}
                        );
                        option.id=ID+"-pass-option-"+type+"-"+index;
                        option.setAttribute("role","option");
                        option.setAttribute("aria-selected",String(rule.permitIds.includes(permit.id)));
                        option.style.cssText="display:block;width:100%;text-align:left;"+
                            "background:"+(active===index?"#dbeafe":"#fff")+";"+
                            "color:#202938;border:0;padding:6px 8px;cursor:pointer;";
                        suggestions.append(option);
                    });
                    if(active>=0&&top.length)
                        search.setAttribute("aria-activedescendant",ID+"-pass-option-"+type+"-"+active);
                }
                search.addEventListener("input",()=>{active=-1;draw();});
                search.addEventListener("keydown",event=>{
                    if(event.key==="Escape"&&search.value){
                        search.value="";active=-1;draw();event.preventDefault();
                        return;
                    }
                    if(!normalizePermitSearch(search.value)||!matches.length)return;
                    const n=Math.min(matches.length,8);
                    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
                        active=event.key==="ArrowDown"?(active+1)%n:
                            (active<=0?n-1:active-1);
                        draw();event.preventDefault();
                    }else if(event.key==="Enter"){
                        togglePermit(matches[active<0?0:active].id);
                        event.preventDefault();
                    }
                });
                wrapper.append(searchLabel,suggestions,count,list,warning);
                draw();
                return wrapper;
            }
            const missing=node("p",tr("missing_vehicle_pass"));
            missing.style.color="#b91c1c";
            wrapper.append(missing);
            return wrapper;
        }
        async function advance() {
            // Guard progress here as well as in the button state: no implicit scope.
            if (step === 1 && !SCOPES.includes(draft.scope)) return;
            if (step === 2 && !LANES.includes(draft.lane)) return;
            if (step === 3 && !RESTRICTION_TYPES.includes(draft.restrictionType)) return;
            if (step===4 && (draft.restrictionType==="TOLL"||draft.restrictionType==="ALLOWED")
                && !selectedVehicleTypes(draft.vehicleTypes).length)return;
            if(step===5){
                try{
                    if(draft.restrictionType==="ALLOWED")
                        normalizeVehicleRules(draft.vehicleTypes,vehicleRules,current.permits);
                    else if(draft.restrictionType==="BLOCKED")
                        normalizeMotorDraft(motorDraft,draft.vehicleTypes.includes("MOTORCYCLE"));
                    else normalizeAdvanced(advanced,current.permits);
                    normalizeDraft(draft,current.segment);
                }catch(_){return;}
            }
            if(step===7){
                try{normalizeRedSchedule(redSchedule);}catch(_){return;}
            }
            let fresh;
            try {fresh=await readContext(sdk);} catch (_) {}
            if (!fresh || fresh.segment.id!==current.segment.id ||
                 JSON.stringify(fresh.country)!==JSON.stringify(current.country) ||
                 JSON.stringify(fresh.permits)!==JSON.stringify(current.permits) ||
                 !availableDirections(fresh.segment).includes(draft.direction)) {
                dialog.replaceChildren(node("p",tr("changed")),button(tr("close"),()=>dialog.close()));return;
            }
            // Never keep reviewing a stale draft after another edit changed
            // the selected segment's restrictions or one of its directions.
            const latestSnapshot=restrictionSnapshot(fresh.segment);
            if(baselineSnapshot!==latestSnapshot){
                dialog.replaceChildren(
                    node("p",tr("inspection_changed")),
                    button(tr("close"),()=>dialog.close()));
                return;
            }
            const destination=nextWizardStep(step,draft.restrictionType,draft.vehicleTypes);
            if(destination===null)return;
            step=destination;
            render();
        }
        function render(){
            dialog.replaceChildren(node("h2",tr("launch")),node("p",tr("country")+": "+(current.country?.name || tr("unknown"))),node("p",tr("test")));
            if(step===0) {
                dialog.append(renderExistingRestrictionList(current.segment,true));
                dialog.append(node("h3",tr("direction")),
                    options(availableDirections(current.segment),draft.direction,v=>draft.direction=v));
            }
            if(step===1) {
                dialog.append(node("h3",tr("scope")),options(SCOPES,draft.scope,v=>{draft.scope=v;}));
                if (!SCOPES.includes(draft.scope)) {
                    const warning=node("p",tr("choose_scope"));
                    warning.setAttribute("role","alert");
                    warning.style.cssText="color:#c62828;font-weight:600;margin:10px 0;";
                    dialog.append(warning);
                }
                dialog.append(node("p",tr("pending")));
            }
            if(step===2) {
                dialog.append(node("h3",tr("lane")),options(LANES,draft.lane,v=>draft.lane=v));
                const laneCheck=inspectLaneDraft(draft,current.segment.restrictions);
                const report=node("div");
                report.style.cssText="border:1px solid #cbd5e1;padding:10px;"+
                    "border-radius:8px;background:#f8fafc;margin-top:10px;";
                report.append(node("h4",tr("lane_check")),
                    node("p",tr("lane_candidate")+": "+laneCheck.laneScopeCandidate),
                    node("p",tr("lane_evidence")+": "+
                        (laneCheck.readAvailable?
                            (laneCheck.observedScope?tr("found"):tr("inspection_none")):
                            tr("unknown"))));
                report.append(node("p",laneCheck.laneTypeStatus==="UNMAPPED"?
                    tr("lane_special_pending"):tr("lane_none_requested")));
                report.append(node("p",tr("lane_observed_types")+": "+
                    (laneCheck.observedLaneTypes.join(", ")||tr("inspection_none"))));
                report.append(node("p",tr("lane_orientation")),
                    node("p",tr("lane_caution")));
                dialog.append(report);
            }
            if(step===3) {
                dialog.append(node("h3",tr("restriction_kind")),
                    options(RESTRICTION_TYPES,draft.restrictionType,v=>{
                        draft.restrictionType=v;
                        draft.vehicleTypes=[];
                        advanced.minPassengers=null;
                        advanced.permitIds=[];
                        motorDraft.enabled=false;motorDraft.conditions=[];
                        redSchedule.startDate="";redSchedule.endDate="";
                        redSchedule.weekdays=[...WEEKDAYS];redSchedule.allDay=true;
                        redSchedule.slots=[{fromTime:"08:00",toTime:"18:00"}];
                        for(const key of Object.keys(vehicleRules))delete vehicleRules[key];
                    }),node("p",tr("pending")));
            }
            if(step===4) {
                dialog.append(node("h3",tr(draft.restrictionType==="BLOCKED"?"blocked_vehicle_step":
                    draft.restrictionType==="ALLOWED"?"allowed_step":"toll_vehicle_step")));
                const helpKey = draft.restrictionType==="BLOCKED"?"vehicles_optional":
                    draft.restrictionType==="ALLOWED"?"vehicles_allowed":"vehicles_toll";
                dialog.append(node("p",tr(helpKey)));
                const all = node("div");
                all.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:6px;";
                for (const type of VEHICLE_TYPES) {
                    const label=node("label"),input=node("input");
                    input.type="checkbox";input.value=type;input.checked=draft.vehicleTypes.includes(type);
                    input.addEventListener("change",()=>{
                        draft.vehicleTypes=input.checked?
                            [...new Set([...draft.vehicleTypes,type])]:
                            draft.vehicleTypes.filter(value=>value!==type);
                        if(input.checked)vehicleRules[type]=emptyRule();
                        else delete vehicleRules[type]; // Never retain hidden conditions on deselection.
                        if(type==="MOTORCYCLE"&&!input.checked){
                            motorDraft.enabled=false;motorDraft.conditions=[];
                        }
                        render();
                    });
                    label.style.cssText="display:flex;align-items:start;gap:6px;font-size:12px;padding:5px 0;";
                    label.append(input,document.createTextNode(vehicleLabels[type]?.[LANGS.indexOf(lang)]||type));
                    all.append(label);
                }
                dialog.append(all);
                if(draft.restrictionType==="TOLL"){
                    dialog.append(node("p",tr("toll_auto_flag")));
                    dialog.append(node("p",tr("toll_both_directions")));
                    dialog.append(node("p",tr("toll_activation_pending")));
                }
                if((draft.restrictionType==="TOLL"||draft.restrictionType==="ALLOWED") && !draft.vehicleTypes.length) {
                    const warning=node("p",tr(draft.restrictionType==="ALLOWED"?"allowed_required":"select_vehicle"));
                    warning.setAttribute("role","alert");warning.style.cssText="color:#c62828;font-weight:600;";
                    dialog.append(warning);
                }
                dialog.append(node("p",tr("vehicles_unknown")));
            }
            if(step===5) {
                if(draft.restrictionType==="BLOCKED"){
                    dialog.append(node("h3",tr("motorcycle_step")),node("p",tr("motorcycle_intro")));
                    const enableLabel=node("label"),enable=node("input");
                    enableLabel.style.cssText="display:flex;align-items:center;gap:8px;"+
                        "margin:12px 0;font-weight:600;cursor:pointer;";
                    enable.type="checkbox";enable.checked=motorDraft.enabled;
                    enable.addEventListener("change",()=>{
                        motorDraft.enabled=enable.checked;
                        motorDraft.conditions=[];
                        render();
                    });
                    enableLabel.append(enable,document.createTextNode(tr("motorcycle_enable")));
                    dialog.append(enableLabel);
                    if(!motorDraft.enabled){
                        const note=node("p",tr("motor_ban_all"));
                        note.style.cssText="padding:10px;background:#fee2e2;color:#7f1d1d;border-radius:7px;";
                        dialog.append(note);
                    }else{
                        for(const engine of MOTOR_ENGINE_TYPES){
                            const match=motorDraft.conditions.find(c=>c.engineType===engine);
                            const card=node("div");
                            card.style.cssText="background:#fee2e2;padding:12px;"+
                                "border-radius:8px;margin:9px 0;";
                            const selectLabel=node("label"),check=node("input");
                            selectLabel.style.cssText="display:flex;gap:8px;align-items:center;"+
                                "font-weight:600;cursor:pointer;";
                            check.type="checkbox";check.checked=!!match;
                            check.addEventListener("change",()=>{
                                if(check.checked)motorDraft.conditions.push({
                                    engineType:engine,operator:"ALL",capacityThreshold:null
                                });
                                else motorDraft.conditions=motorDraft.conditions.filter(c=>c.engineType!==engine);
                                render();
                            });
                            selectLabel.append(check,document.createTextNode(
                                tr(engine==="FUEL"?"motor_select_fuel":"motor_select_electric")));
                            card.append(selectLabel);
                            if(match){
                                const caption=node("label",
                                    tr(engine==="FUEL"?"motor_limit_cc":"motor_limit_kw"));
                                caption.style.cssText="display:block;margin-top:8px;font-size:12px;";
                                const comparator=node("select");
                                comparator.style.cssText="display:block;max-width:100%;padding:7px;"+
                                    "border:1px solid #fca5a5;border-radius:6px;margin:5px 0;";
                                for(const value of MOTOR_COMPARATORS){
                                    const option=node("option",tr(value==="ALL"?"motor_compare_all":
                                        value==="LT"?"motor_compare_lt":"motor_compare_lte"));
                                    option.value=value;option.selected=match.operator===value;
                                    comparator.append(option);
                                }
                                comparator.addEventListener("change",()=>{
                                    match.operator=comparator.value;
                                    match.capacityThreshold=null;
                                    render();
                                });
                                caption.append(comparator);card.append(caption);
                                if(match.operator!=="ALL"){
                                    const threshold=node("input");
                                    threshold.type="number";
                                    threshold.min=engine==="FUEL"?"1":"0.01";
                                    threshold.step=engine==="FUEL"?"1":"any";
                                    threshold.placeholder=engine==="FUEL"?"cc":"kW";
                                    threshold.value=match.capacityThreshold===null?"":
                                        String(match.capacityThreshold);
                                    threshold.style.cssText="width:125px;padding:7px;"+
                                        "border:1px solid #fca5a5;border-radius:6px;";
                                    threshold.addEventListener("change",()=>{
                                        match.capacityThreshold=threshold.value.trim()===""?
                                            null:Number(threshold.value);
                                        render();
                                    });
                                    card.append(threshold);
                                    if(!Number.isFinite(match.capacityThreshold)||
                                        match.capacityThreshold<=0||
                                        (engine==="FUEL"&&!Number.isSafeInteger(match.capacityThreshold))){
                                        const error=node("p",tr("motor_threshold_required"));
                                        error.setAttribute("role","alert");
                                        error.style.cssText="color:#991b1b;font-weight:600;";
                                        card.append(error);
                                    }
                                }
                            }
                            dialog.append(card);
                        }
                        if(!motorDraft.conditions.length){
                            const warning=node("p",tr("motor_select_required"));
                            warning.setAttribute("role","alert");
                            warning.style.cssText="color:#b91c1c;font-weight:600;";
                            dialog.append(warning);
                        }
                        dialog.append(node("p",tr("motor_ban_conditional")),
                            node("p",tr("motor_experimental_note")));
                    }
                }else if(draft.restrictionType==="ALLOWED"){
                    dialog.append(node("h3",tr("advanced")),node("p",tr("advanced_allowed_intro")));
                    for(const type of selectedVehicleTypes(draft.vehicleTypes)){
                        const rule=vehicleRules[type]??(vehicleRules[type]=emptyRule());
                        const card=node("div");
                        card.style.cssText="border:1px solid #cbd5e1;border-radius:9px;"+
                            "padding:12px;margin:10px 0;background:#f8fafc;";
                        const title=node("h4",vehicleLabels[type]?.[LANGS.indexOf(lang)]||type);
                        title.style.cssText="margin:0 0 8px;color:#243447;";
                        card.append(title);
                        function toggleRequirement(key,text){
                            const label=node("label"),check=node("input");
                            label.style.cssText="display:flex;align-items:center;gap:8px;"+
                                "margin:7px 0;cursor:pointer;";
                            check.type="checkbox";check.checked=rule[key];
                            check.addEventListener("change",()=>{
                                rule[key]=check.checked;
                                if(key==="requiresPass")rule.permitIds=[];
                                if(key==="requiresOccupancy")rule.minPassengers=null;
                                render();
                            });
                            label.append(check,document.createTextNode(text));
                            return label;
                        }
                        card.append(
                            toggleRequirement("requiresPass",tr("requires_pass")),
                            toggleRequirement("requiresOccupancy",tr("requires_occupancy"))
                        );
                        if(!rule.requiresPass&&!rule.requiresOccupancy){
                            const info=node("p",tr("direct_access"));
                            info.style.cssText="color:#17603c;font-weight:600;margin:8px 0;";
                            card.append(info);
                        }
                        if(rule.requiresPass){
                            const subTitle=node("h5",tr("country_permits"));
                            subTitle.style.cssText="margin:10px 0 5px;";
                            card.append(subTitle,vehiclePermitPicker(type,rule));
                        }
                        if(rule.requiresOccupancy){
                            const label=node("label",tr("vehicle_occupancy"));
                            label.style.cssText="display:block;margin-top:10px;font-weight:600;";
                            const input=node("input");
                            input.type="number";input.min="2";input.step="1";
                            input.value=rule.minPassengers===null?"":String(rule.minPassengers);
                            input.style.cssText="display:block;width:115px;padding:7px;"+
                                "margin:5px 0;border:1px solid #9ca3af;border-radius:6px;";
                            input.addEventListener("change",()=>{
                                rule.minPassengers=input.value.trim()===""?null:Number(input.value);
                                render();
                            });
                            label.append(input);card.append(label);
                            if(!Number.isSafeInteger(rule.minPassengers)||rule.minPassengers<2){
                                const warning=node("p",tr("missing_vehicle_occupancy"));
                                warning.style.cssText="color:#b91c1c;font-weight:600;";
                                warning.setAttribute("role","alert");
                                card.append(warning);
                            }
                        }
                        if(rule.requiresPass&&rule.requiresOccupancy)
                            card.append(node("p",tr("both_conditions")));
                        dialog.append(card);
                    }
                    dialog.append(node("p",tr("permit_note")),node("p",tr("plate_note")),
                        node("p",tr("criteria_unverified")));
                }else{
                dialog.append(node("h3",tr("advanced")));
                const occ=node("label",tr("occupancy")),number=node("input");
                occ.style.cssText="display:block;font-weight:600;margin:12px 0;";
                number.type="number";number.min="2";number.step="1";
                number.value=advanced.minPassengers===null?"":String(advanced.minPassengers);
                number.style.cssText="display:block;width:110px;padding:6px;margin:5px 0;border:1px solid #9ca3af;border-radius:6px;";
                number.addEventListener("change",()=>{
                    advanced.minPassengers=number.value.trim()===""?null:Number(number.value);render();
                });
                occ.append(number);dialog.append(occ,node("p",tr("occupancy_help")),node("h4",tr("country_permits")));
                if(current.permits===null)dialog.append(node("p",tr("permits_missing")));
                else if(!current.permits.length)dialog.append(node("p",tr("permits_empty")));
                else {
                    // Sort pass choices alphabetically in the WME interface language.
                    const sorted=sortPermits(current.permits,lang);
                    const searchLabel=node("label",tr("permit_search"));
                    searchLabel.style.cssText="display:block;font-weight:600;margin:6px 0;";
                    const search=node("input");
                    search.type="search";search.autocomplete="off";
                    search.placeholder=tr("permit_search_placeholder");
                    search.id=ID+"-permit-search";
                    search.style.cssText="display:block;width:100%;box-sizing:border-box;padding:8px;"+
                        "margin:5px 0;border:1px solid #9ca3af;border-radius:7px;";
                    search.setAttribute("role","combobox");
                    search.setAttribute("aria-autocomplete","list");
                    search.setAttribute("aria-controls",ID+"-permit-suggestions");
                    search.setAttribute("aria-expanded","false");
                    searchLabel.append(search);
                    const suggestions=node("div");
                    suggestions.id=ID+"-permit-suggestions";
                    suggestions.setAttribute("role","listbox");
                    suggestions.style.cssText="display:none;max-height:145px;overflow:auto;"+
                        "border:1px solid #9ca3af;border-radius:7px;margin-bottom:8px;";
                    const box=node("div");
                    box.style.cssText="max-height:155px;overflow:auto;border:1px solid #d1d5db;"+
                        "padding:6px;border-radius:7px;";
                    const count=node("p");
                    count.setAttribute("aria-live","polite");
                    count.style.cssText="margin:5px 0;color:#4b5563;font-size:12px;";
                    let activeIndex=-1;
                    let matches=[];
                    const togglePermit=id=>{
                        advanced.permitIds=advanced.permitIds.includes(id)?
                            advanced.permitIds.filter(value=>value!==id):
                            [...advanced.permitIds,id];
                    };
                    const updatePicker=()=>{
                        const query=normalizePermitSearch(search.value);
                        matches=filterPermits(sorted,query,lang);
                        box.replaceChildren();
                        count.textContent=tr("permit_selected_count")+": "+advanced.permitIds.length;
                        if(!matches.length){
                            box.append(node("p",tr("permit_search_empty")));
                        }else{
                            for(const permit of matches){
                                const item=node("label"),check=node("input");
                                item.style.cssText="display:flex;align-items:center;gap:8px;margin:5px 0;cursor:pointer;";
                                check.type="checkbox";check.value=permit.id;
                                check.checked=advanced.permitIds.includes(permit.id);
                                check.addEventListener("change",()=>{
                                    togglePermit(permit.id);
                                    updatePicker();
                                });
                                item.append(check,document.createTextNode(permit.name));box.append(item);
                            }
                        }
                        suggestions.replaceChildren();
                        const choices=query?matches.slice(0,8):[];
                        if(activeIndex>=choices.length)activeIndex=-1;
                        suggestions.style.display=choices.length?"block":"none";
                        search.setAttribute("aria-expanded",choices.length?"true":"false");
                        if(activeIndex<0)search.removeAttribute("aria-activedescendant");
                        for(const [index,permit] of choices.entries()){
                            const option=button(
                                (advanced.permitIds.includes(permit.id)?"✓ ":"+ ")+permit.name,
                                ()=>{
                                    togglePermit(permit.id);
                                    search.value="";
                                    activeIndex=-1;
                                    updatePicker();
                                    search.focus();
                                });
                            option.id=ID+"-permit-suggestion-"+index;
                            option.setAttribute("role","option");
                            option.setAttribute("aria-selected",String(advanced.permitIds.includes(permit.id)));
                            option.style.cssText="display:block;width:100%;text-align:left;padding:7px 9px;"+
                                "background:"+(index===activeIndex?"#dbeafe":"#fff")+";"+
                                "border:0;border-radius:0;cursor:pointer;color:#202938;font:inherit;";
                            suggestions.append(option);
                        }
                        if(activeIndex>=0)search.setAttribute("aria-activedescendant",
                            ID+"-permit-suggestion-"+activeIndex);
                    };
                    search.addEventListener("input",()=>{activeIndex=-1;updatePicker();});
                    search.addEventListener("keydown",event=>{
                        if(event.key==="Escape"&&search.value){
                            search.value="";activeIndex=-1;updatePicker();event.preventDefault();return;
                        }
                        if(!normalizePermitSearch(search.value)||!matches.length)return;
                        const total=Math.min(matches.length,8);
                        if(event.key==="ArrowDown"||event.key==="ArrowUp"){
                            activeIndex=event.key==="ArrowDown"?(activeIndex+1)%total:
                                (activeIndex<=0?total-1:activeIndex-1);
                            updatePicker();
                            event.preventDefault();
                        }else if(event.key==="Enter"){
                            const selected=matches[activeIndex<0?0:activeIndex];
                            if(selected){
                                togglePermit(selected.id);
                                search.value="";activeIndex=-1;updatePicker();
                                event.preventDefault();
                            }
                        }
                    });
                    dialog.append(searchLabel,suggestions,count,box);
                    updatePicker();
                }
                dialog.append(node("p",tr("permit_note")),node("p",tr("plate_note")));
                if(draft.restrictionType==="ALLOWED"&&!hasAllowedCriteria(draft)){
                    const warning=node("p",tr("allowed_required"));
                    warning.setAttribute("role","alert");
                    warning.style.cssText="color:#c62828;font-weight:600;";
                    dialog.append(warning);
                }
                if(draft.restrictionType==="ALLOWED")dialog.append(node("p",tr("criteria_unverified")));
                if(advanced.minPassengers!==null&&
                    (!Number.isSafeInteger(advanced.minPassengers)||advanced.minPassengers<2)){
                    const error=node("p",tr("occupancy_error"));
                    error.style.color="#c62828";error.setAttribute("role","alert");dialog.append(error);
                }
                }
            }
            if(step===7&&RESTRICTION_TYPES.includes(draft.restrictionType)){
                const scheduleTitle=draft.restrictionType==="ALLOWED"?"green_schedule":
                    draft.restrictionType==="TOLL"?"toll_schedule":"red_schedule";
                const scheduleIntro=draft.restrictionType==="ALLOWED"?"green_schedule_intro":
                    draft.restrictionType==="TOLL"?"toll_schedule_intro":"red_schedule_intro";
                dialog.append(node("h3",tr(scheduleTitle)),node("p",tr(scheduleIntro)));
                const dates=node("div");
                dates.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;";
                for(const field of ["startDate","endDate"]){
                    const label=node("label",tr(field==="startDate"?"schedule_start":"schedule_end"));
                    label.style.cssText="display:block;font-weight:600;";
                    const input=node("input");input.type="date";input.value=redSchedule[field];
                    input.style.cssText="display:block;box-sizing:border-box;width:100%;"+
                        "padding:7px;border:1px solid #9ca3af;border-radius:6px;";
                    input.addEventListener("change",()=>{redSchedule[field]=input.value;render();});
                    label.append(input);dates.append(label);
                }
                dialog.append(dates,node("h4",tr("schedule_days")));
                const days=node("div");
                days.style.cssText="display:flex;flex-wrap:wrap;gap:5px;";
                for(const day of WEEKDAYS){
                    const label=node("label"),input=node("input");
                    label.style.cssText="display:flex;gap:4px;align-items:center;"+
                        "padding:5px;border:1px solid #cbd5e1;border-radius:6px;";
                    input.type="checkbox";input.checked=redSchedule.weekdays.includes(day);
                    input.addEventListener("change",()=>{
                        redSchedule.weekdays=input.checked?[...redSchedule.weekdays,day]:
                            redSchedule.weekdays.filter(value=>value!==day);
                        redSchedule.weekdays=WEEKDAYS.filter(value=>redSchedule.weekdays.includes(value));
                        render();
                    });
                    label.append(input,document.createTextNode(tr(day)));days.append(label);
                }
                dialog.append(days);
                const label=node("label"),allDay=node("input");
                label.style.cssText="display:flex;align-items:center;gap:8px;margin:12px 0;";
                allDay.type="checkbox";allDay.checked=redSchedule.allDay;
                allDay.addEventListener("change",()=>{redSchedule.allDay=allDay.checked;render();});
                label.append(allDay,document.createTextNode(tr("schedule_all_day")));dialog.append(label);
                if(!redSchedule.allDay){
                    for(const [index,slot] of redSchedule.slots.entries()){
                        const row=node("div");row.style.cssText="display:flex;gap:8px;flex-wrap:wrap;"+
                            "align-items:end;margin:8px 0;";
                        for(const prop of ["fromTime","toTime"]){
                            const field=node("label",tr(prop==="fromTime"?"schedule_from":"schedule_to"));
                            field.style.cssText="display:block;font-weight:600;";
                            const input=node("input");input.type="time";input.value=slot[prop];
                            input.style.cssText="display:block;padding:7px;"+
                                "border:1px solid #9ca3af;border-radius:6px;";
                            input.addEventListener("change",()=>{
                                redSchedule.slots[index][prop]=input.value;render();
                            });
                            field.append(input);row.append(field);
                        }
                        if(redSchedule.slots.length>1)
                            row.append(button(tr("schedule_remove_slot"),()=>{
                                redSchedule.slots.splice(index,1);render();
                            }));
                        dialog.append(row);
                    }
                    const add=button(tr("schedule_add_slot"),()=>{
                        if(redSchedule.slots.length<MAX_DRAFT_TIME_FRAMES){
                            redSchedule.slots.push({fromTime:"08:00",toTime:"18:00"});
                            render();
                        }
                    });
                    add.disabled=redSchedule.slots.length>=MAX_DRAFT_TIME_FRAMES;
                    dialog.append(add);
                    if(redSchedule.slots.some(crossesMidnight))
                        dialog.append(node("p",tr("schedule_overnight")));
                }
                if(isScheduleValid()){
                    dialog.append(renderConflictPreflight(draft,current.segment,redSchedule,{vehicleRules,motorDraft}));
                }
                if(!isScheduleValid()){
                    const error=node("p",tr("schedule_invalid"));
                    error.setAttribute("role","alert");
                    error.style.cssText="color:#b91c1c;font-weight:600;";
                    dialog.append(error);
                }
            }
            if(step===6) {
                const schedule=normalizeRedSchedule(redSchedule);
                if(draft.restrictionType==="ALLOWED"){
                    const checked=normalizeDraft(draft,current.segment);
                    const conditions=normalizeVehicleRules(
                        checked.vehicleTypes,vehicleRules,current.permits
                    );
                    dialog.append(
                        node("h3",tr("summary")),
                        node("p",tr(checked.direction)+" · "+tr(checked.scope)+" · "+tr(checked.lane)),
                        node("p",tr("rule_preview")+": "+tr("allowed_default")+
                            " (SDK "+checked.defaultType+")"),
                        node("h4",tr("vehicle_rules_summary"))
                    );
                    for(const rule of conditions.vehicles){
                        const box=node("div");
                        box.style.cssText="padding:8px 10px;margin:6px 0;border-radius:6px;"+
                            "border-left:4px solid "+(rule.access==="DIRECT"?"#258B4C":"#1E7ACD")+";"+
                            "background:#f1f5f9;";
                        box.append(node("strong",vehicleLabels[rule.vehicleType]?.[LANGS.indexOf(lang)]||rule.vehicleType));
                        if(rule.access==="DIRECT")box.append(node("p",tr("direct_access")));
                        if(rule.requiresPass){
                            const names=rule.permitIds.map(id=>
                                current.permits?.find(p=>p.id===id)?.name||id);
                            box.append(node("p",tr("country_permits")+": "+names.join(", ")));
                        }
                        if(rule.requiresOccupancy)
                            box.append(node("p",tr("vehicle_occupancy")+": "+rule.minPassengers));
                        if(rule.requiresPass&&rule.requiresOccupancy)
                            box.append(node("p",tr("both_conditions")));
                        dialog.append(box);
                    }
                    dialog.append(node("p",tr("others_blocked")),
                        node("p",tr("criteria_unverified")),
                        node("p",tr("plate_note")),
                        node("p",tr("vehicles_unknown")));
                    renderScheduleSummary(schedule,"green_schedule_intro");
                }else if(draft.restrictionType==="BLOCKED"){
                    const checked=normalizeDraft(draft,current.segment);
                    const motor=normalizeMotorDraft(motorDraft,
                        checked.vehicleTypes.includes("MOTORCYCLE"));
                    dialog.append(node("h3",tr("summary")),
                        node("p",tr(checked.direction)+" · "+tr(checked.scope)+" · "+tr(checked.lane)));
                    if(!checked.vehicleTypes.length){
                        dialog.append(node("p",tr("blocked_everyone")+" (SDK BLOCKED)"));
                    }else{
                        dialog.append(
                            node("p",tr("rule_preview")+": "+tr("blocked_selected_base")+
                                " (SDK "+checked.defaultType+")"),
                            node("p",tr("blocked_preview")+" (SDK "+checked.overrideType+"): "+
                                checked.vehicleTypes.map(type=>
                                    vehicleLabels[type]?.[LANGS.indexOf(lang)]||type).join(", ")),
                            node("p",tr("blocked_only_selected")));
                    }
                    if(checked.vehicleTypes.includes("MOTORCYCLE")){
                        if(motor.mode==="ALL_MOTORCYCLES"){
                            dialog.append(node("p",tr("motor_ban_all")));
                        }else{
                            dialog.append(node("p",tr("motor_ban_conditional")));
                            for(const entry of motor.conditions){
                                const engine=tr(entry.engineType==="FUEL"?"motor_select_fuel":"motor_select_electric");
                                const cmp=entry.operator==="ALL"?tr("motor_compare_all"):
                                    entry.operator==="LT"?"<":"≤";
                                const unit=entry.engineType==="FUEL"?"cc":"kW";
                                const description=entry.operator==="ALL"?engine+" · "+cmp:
                                    engine+" · "+cmp+" "+entry.capacityThreshold+" "+unit;
                                dialog.append(node("p",description));
                            }
                            dialog.append(node("p",tr("motor_experimental_note")));
                        }
                    }
                    renderScheduleSummary(schedule,"red_schedule_intro");
                }else if(draft.restrictionType==="TOLL"){
                    const checked=normalizeDraft(draft,current.segment);
                    const flag=normalizeTollActivationDraft(checked,[current.segment.id]);
                    dialog.append(
                        node("h3",tr("summary")),
                        node("p",tr(checked.direction)+" · "+tr(checked.scope)+" · "+tr(checked.lane)),
                        node("p",tr("rule_preview")+": "+tr("toll_default")+
                            " (SDK "+checked.defaultType+")"),
                        node("p",tr("toll_preview")+" (SDK "+checked.overrideType+"): "+
                            checked.vehicleTypes.map(type=>
                                vehicleLabels[type]?.[LANGS.indexOf(lang)]||type).join(", ")),
                        node("p",tr("toll_nonexempt")),
                        node("h4",tr("toll_auto_flag")),
                        node("p",tr("toll_activation_pending")),
                        node("p",tr("toll_both_directions")),
                        node("p","hasToll: "+String(flag.hasToll)+
                            " · "+tr("toll_activation_pending"))
                    );
                    renderScheduleSummary(schedule,"toll_schedule_intro");
                    dialog.append(node("p",tr("vehicles_unknown")));
                }
                // Conservative budget only: not an SDK write plan and NOT
                // a pass from the stable v3.2 SAFE12 full-operation validator.
                const estimate=estimateSafe12Budget(
                    current.segment.restrictions,schedule.timeFrames
                );
                const budgetBox=node("section");
                budgetBox.style.cssText="padding:10px;margin-top:14px;border:1px solid #cbd5e1;"+
                    "border-radius:8px;background:#f8fafc;";
                budgetBox.append(node("h4",tr("budget_heading")));
                if(estimate.status==="UNKNOWN"){
                    budgetBox.append(node("p",tr("budget_unknown")));
                }else{
                    budgetBox.append(
                        node("p",tr("budget_existing")+": "+estimate.existingRestrictions),
                        node("p",tr("budget_existing_frames")+": "+estimate.existingFrames),
                        node("p",tr("budget_new")+": "+estimate.proposedRestrictions),
                        node("p",tr("budget_total")+": "+
                            estimate.projectedRestrictions+" / "+estimate.projectedFrames+
                            " (max "+estimate.limit+")")
                    );
                    const warning=node("p",
                        tr(estimate.status==="OVER"?"budget_over":"budget_within"));
                    warning.style.cssText="font-weight:600;color:"+
                        (estimate.status==="OVER"?"#b91c1c":"#475569")+";";
                    if(estimate.status==="OVER")warning.setAttribute("role","alert");
                    budgetBox.append(warning);
                }
                const assumption=node("p",tr("budget_assumption"));
                assumption.style.cssText="font-size:12px;color:#475569;";
                budgetBox.append(assumption);
                dialog.append(budgetBox);
                // Repeat the lane preflight at the final review, regardless of
                // whether the editor went through the red, green or blue path.
                const laneReport=inspectLaneDraft(draft,current.segment.restrictions);
                const laneBox=node("section");
                laneBox.style.cssText="padding:10px;margin-top:12px;"+
                    "border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;";
                laneBox.append(node("h4",tr("lane_check")),
                    node("p",tr("lane_candidate")+": "+laneReport.laneScopeCandidate),
                    node("p",tr("lane_evidence")+": "+
                        (laneReport.readAvailable?
                            (laneReport.observedScope?tr("found"):tr("inspection_none")):
                            tr("unknown"))),
                    node("p",laneReport.laneTypeStatus==="UNMAPPED"?
                        tr("lane_special_pending"):tr("lane_none_requested")),
                    node("p",tr("lane_caution")));
                dialog.append(laneBox);
                dialog.append(renderExistingRestrictionList(current.segment,false));
                dialog.append(renderConflictPreflight(draft,current.segment,redSchedule,{vehicleRules,motorDraft}));
                // Read-only design review. Never pass this object to updateSegment.
                const conversion=reviewSdkConversion(
                    draft,current.segment,redSchedule,vehicleRules,
                    current.permits,motorDraft,current.country
                );
                const details=node("details");
                details.style.cssText="border:1px solid #cbd5e1;border-radius:8px;"+
                    "padding:10px;margin-top:12px;background:#f8fafc;";
                const heading=node("summary",tr("conversion_title"));
                heading.style.cssText="font-weight:600;cursor:pointer;";
                details.append(heading);
                const put=(key,value)=>details.append(node("p",tr(key)+": "+value));
                put("conversion_default",conversion.defaultType);
                put("conversion_direction",conversion.directionDesign);
                put("conversion_overrides",conversion.overrideType?
                    conversion.overrideType+" · "+conversion.vehicleConditionRows.map(
                        row=>row.vehicleType).join(", "):
                    tr("conversion_no_override"));
                put("conversion_frames",String(conversion.proposedFrameCount));
                if(conversion.plannedHasToll===true)
                    put("conversion_toll","hasToll: true ("+tr("toll_both_directions")+")");
                const blocked=node("p",tr("conversion_blocked"));
                blocked.style.cssText="font-weight:600;color:#991b1b;";
                blocked.setAttribute("role","status");
                details.append(blocked,node("h4",tr("conversion_blockers")));
                const reasons=node("ul");
                reasons.style.cssText="padding-left:22px;line-height:1.5;";
                for(const reason of conversion.blockers){
                    reasons.append(node("li",tr(reason)));
                }
                details.append(reasons,node("h4",tr("preservation_title")));
                const audit=conversion.preservation;
                const auditMessage=audit.status==="NO_EXISTING"?"preservation_none":
                    audit.status==="REQUIRES_ROUNDTRIP"?"preservation_roundtrip":
                    "preservation_unknown";
                details.append(node("p",tr("preservation_status")+": "+tr(auditMessage)));
                if(audit.count!==null){
                    const entries=[
                        ["budget_existing",audit.count],
                        ["preservation_frames",audit.frameCount],
                        ["preservation_noneditable",audit.nonEditable],
                        ["preservation_editable_unknown",audit.editabilityUnknown],
                        ["preservation_opaque",audit.opaqueVehicleRules],
                        ["preservation_legacy",audit.legacyFields],
                        ["preservation_incomplete",audit.incomplete]
                    ];
                    for(const [key,count] of entries){
                        details.append(node("p",tr(key)+": "+count));
                    }
                }
                for(const entry of audit.entries){
                    const title=tr("existing_rule")+" "+entry.index+" · ";
                    if(!entry.issues.length){
                        details.append(node("p",title+tr("preservation_row_roundtrip")));
                        continue;
                    }
                    const row=node("details");
                    row.append(node("summary",title+tr("preservation_row_review")));
                    const findings=node("ul");
                    for(const issue of entry.issues){
                        findings.append(node("li",issue.field+" · "+tr(issue.reason)));
                    }
                    row.append(findings);
                    details.append(row);
                }
                const preservationWarning=node("p",tr("preservation_warning"));
                preservationWarning.style.cssText="color:#991b1b;font-weight:600;";
                details.append(preservationWarning);
                dialog.append(details);
            }
            const footer=node("div");footer.style.cssText="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;";
            footer.append(button(tr("close"),()=>dialog.close()));
            if(step>0)footer.append(button(tr("back"),()=>{
                const previous=previousWizardStep(step,draft.restrictionType,draft.vehicleTypes);
                if(previous!==null){step=previous;render();}
            }));
            if(step!==6){
                const next=button(tr("next"),advance);
                next.dataset.guidedNext="true";
                next.disabled=(step===1&&!SCOPES.includes(draft.scope))||
                    (step===2&&!LANES.includes(draft.lane))||
                    (step===4&&(draft.restrictionType==="TOLL"||draft.restrictionType==="ALLOWED")&&!draft.vehicleTypes.length) ||
                    (step===5&&!isAdvancedValid())||
                    (step===7&&!isScheduleValid());
                footer.append(next);
            }
            dialog.append(footer);
        }
        render();
        dialog.showModal();
    }
    async function start(){
        for(let i=0;i<120 && typeof page.getWmeSdk!=="function";i++)await new Promise(r=>setTimeout(r,500));
        if(typeof page.getWmeSdk!=="function")return;
        sdk=page.getWmeSdk({scriptId:ID,scriptName:"Restriction Manager Guided Alpha",mode:"async"});
        const tab=await sdk.Sidebar.registerScriptTab();
        pane=tab.tabPane;tab.tabLabel.textContent="RM Guided Alpha";
        const root=node("div");root.id=ID+"-root";root.style.padding="12px";pane.append(root);
        await refresh();
        setInterval(refresh,1200);
    }
    start().catch(e=>console.warn("[RM Guided Alpha] Startup failed:",e?.message || "Unavailable"));
})();
