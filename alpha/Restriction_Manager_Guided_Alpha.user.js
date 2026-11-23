// ==UserScript==
// @name         Restriction Manager — Guided Creator Alpha
// @namespace    https://github.com/1cman/wme-restriction-manager/alpha
// @version      4.0.0-alpha.11
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
    const VERSION = "4.0.0-alpha.11";
    const ID = "rm-guided-alpha";
    // Design vocabulary only: these are NOT SDK enum values or country permissions.
    const SCOPES = ["left", "center", "right", "segment"];
    const LANES = ["lane_none", "express", "fast", "hov", "public_transport", "carpool_toll_free"];
    // VehicleType and defaultType are documented SDK types. These lists are NOT
    // an eligibility matrix: local WME permissions and supported combinations
    // must be verified separately before any write path is enabled.
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
    const VEHICLE_TYPES = [
        "BUS", "CAV", "CLEAN_FUEL", "EV", "HAZARDOUS_MATERIALS",
        "HOV_2", "HOV_3", "HYBRID", "MOTORCYCLE", "PRIVATE",
        "PUBLIC_TRANSPORTATION", "RV", "TAXI", "TOWING_VEHICLE", "TRUCK"
    ];
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
        restriction_kind:["Che tipo di restrizione vuoi creare?","Which restriction would you like to create?","Quel type de restriction souhaitez-vous créer ?","¿Qué tipo de restricción quieres crear?","Welche Beschränkung möchtest du erstellen?","Que tipo de restrição queres criar?"],
        BLOCKED:["Transito vietato (con eventuali eccezioni)","No entry (with optional exceptions)","Accès interdit (avec exceptions éventuelles)","Acceso prohibido (con excepciones opcionales)","Durchfahrt verboten (mit möglichen Ausnahmen)","Passagem proibida (com exceções opcionais)"],
        ALLOWED:["Transito consentito (solo ai veicoli autorizzati)","Access allowed (authorized traffic only)","Accès autorisé (véhicules autorisés uniquement)","Acceso permitido (solo vehículos autorizados)","Zufahrt erlaubt (nur berechtigte Fahrzeuge)","Acesso permitido (apenas veículos autorizados)"],
        TOLL:["Transito a pedaggio (con possibili esenzioni)","Toll road (with optional exemptions)","Accès à péage (avec exemptions éventuelles)","Acceso con peaje (con posibles exenciones)","Mautpflichtig (mit möglichen Ausnahmen)","Via com portagem (com possíveis isenções)"],
        vehicle_step:["Per quali veicoli vuoi definire un'eccezione?","Which vehicles should receive an exception?","Quels véhicules reçoivent une exception ?","¿Qué vehículos tendrán una excepción?","Welche Fahrzeuge sollen eine Ausnahme erhalten?","Que veículos devem ter uma excezione?"], 
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
        blocked_only_selected:["Transito vietato esclusivamente ai tipi di veicolo selezionati; gli altri restano autorizzati.","Only selected vehicle types are blocked; others remain allowed.","Seuls les types sélectionnés sont interdits ; les autres sont autorisés.","Solo se prohíben los tipos seleccionados; el resto está permitido.","Nur gewählte Fahrzeugarten gesperrt; andere erlaubt.","Apenas os tipos selecionados proibidos; os restantes permitidos."],
        motor_ban_all:["Tutte le motociclette selezionate sono vietate, senza distinzioni di motore.","All selected motorcycles are prohibited regardless of engine.","Toutes les motos sélectionnées sont interdites, sans condition moteur.","Todas las motos seleccionadas están prohibidas, sin condición de motor.","Alle gewählten Motorräder sind unabhängig vom Motor gesperrt.","Todas as motas selecionadas são proibidas independentemente do motor."],
        motor_ban_conditional:["Solo le motociclette che soddisfano le condizioni motore indicate saranno vietate (anteprima sperimentale).","Only motorcycles matching engine conditions are prohibited (experimental preview).","Seules les motos correspondant aux conditions moteur sont interdites (aperçu).","Solo motos con las condiciones de motor indicadas están prohibidas (vista previa).","Nur Motorräder mit den Motorbedingungen sind gesperrt (Vorschau).","Só as motas com as condições do motor são proibidas (pré-visualização)."],
        toll_preview:["Veicoli esentati dal pedaggio","Vehicles exempt from toll","Véhicules exonérés de péage","Vehículos exentos de peaje","Von der Maut ausgenommene Fahrzeuge","Veículos isentos de portagem"],
        all_vehicle_types:["Qualsiasi categoria che soddisfi le condizioni avanzate (da verificare nel WME nativo)","Any vehicle type meeting advanced criteria (verify in native WME)","Toute catégorie répondant aux conditions avancées (à vérifier dans WME)","Cualquier tipo que cumpla las condiciones avanzadas (verificar en WME)","Alle Typen, die die Bedingungen erfüllen (in WME prüfen)","Qualquer categoria que cumpra as condições (verificar no WME)"],
        others_blocked:["Ogni altro traffico rimane vietato.","All other traffic remains prohibited.","Toute autre circulation reste interdite.","El resto del tráfico sigue prohibido.","Alle anderen Fahrzeuge bleiben gesperrt.","Todo o restante tráfego continua proibido."],
        criteria_unverified:["La combinazione tra categorie, pass e occupanti è ancora una bozza: AND/OR e compatibilità locali non verificati.","Combining vehicle types, permits and occupancy is still a draft: AND/OR and local eligibility are unverified.","Combinaison des critères à vérifier (ET/OU et règles locales).","Combinación de criterios sin verificar (Y/O y normas locales).","Kombination der Kriterien noch ungeprüft (UND/ODER, Länderregeln).","Combinação de critérios por verificar (E/OU e regras locais)."],
        vehicles_toll:["Seleziona almeno un tipo di veicolo esente dal pedaggio.","Select at least one vehicle type to exempt from the toll.","Choisissez au moins un type de véhicule exempté du péage.","Selecciona al menos un tipo de vehículo exento del peaje.","Wähle mindestens eine von der Maut befreite Fahrzeugart.","Seleciona pelo menos um tipo de veículo isento da portagem."],
        vehicles_unknown:["Le categorie sono tratte dallo SDK: non è ancora verificato se siano disponibili per questo Paese o tipo di restrizione. Nessuna modifica sarà effettuata.","Vehicle types come from the SDK: local availability for this country and restriction is not yet verified. Nothing will be changed.","Types issus du SDK : disponibilité locale non vérifiée. Aucune modification ne sera effectuée.","Tipos del SDK: disponibilidad local no verificada. No se realizarán cambios.","Fahrzeugarten aus dem SDK: lokale Verfügbarkeit noch nicht geprüft. Keine Änderungen.","Tipos do SDK: disponibilidade local não verificada. Sem alterações."],
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
        motorcycle_enable:["Specifica il tipo di motore (sperimentale)","Specify engine type (experimental)","Préciser le type de moteur (expérimental)","Especificar tipo de motor (experimental)","Motortyp angeben (experimentell)","Especificar tipo de motor (experimental)"],
        motorcycle_engine:["Tipo di motore / codice WME","Engine type / WME code","Type de moteur / code WME","Tipo de motor / código WME","Motortyp / WME-Code","Tipo de motor / código WME"],
        motorcycle_engine_hint:["Inserisci il codice rilevato nel pannello WME; se disponibile sono suggeriti i valori già presenti sul segmento. Nessun codice viene considerato automaticamente valido.","Enter the code shown in WME; existing values on the segment may be suggested. No code is presumed valid.","Saisissez le code WME; des valeurs existantes peuvent être proposées, sans validation.","Introduce el código WME; se sugieren valores existentes, sin validación.","WME-Code eingeben; vorhandene Werte werden vorgeschlagen, aber nicht validiert.","Introduza o código WME; são sugeridos valores existentes, sem validação."],
        motorcycle_engine_error:["Indica un tipo di motore oppure disattiva la condizione sperimentale.","Enter an engine type or disable the experimental condition.","Indiquez un type de moteur ou désactivez l'option.","Introduce un tipo de motor o desactiva la opción.","Motortyp eingeben oder die Option deaktivieren.","Indique um tipo de motor ou desative a opção."],
        motorcycle_unchecked:["Nessuna specifica sul motore","No engine type specified","Aucun type de moteur précisé","Sin tipo de motor","Kein Motortyp angegeben","Nenhum tipo de motor especificado"],
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
    // Labels for all 15 documented SDK VehicleType values.
    const vehicleLabels = {
        BUS:["Autobus","Bus","Bus","Autobús","Bus","Autocarro"],
        CAV:["Veicolo connesso/autonomo","Connected/automated vehicle","Véhicule connecté/autonome","Vehículo conectado/autónomo","Vernetztes/autonomes Fahrzeug","Veículo conectado/autónomo"],
        CLEAN_FUEL:["Veicolo a combustibile pulito","Clean-fuel vehicle","Véhicule à carburant propre","Vehículo de combustible limpio","Fahrzeug mit sauberem Kraftstoff","Veículo a combustível limpo"],
        EV:["Veicolo elettrico","Electric vehicle","Véhicule électrique","Vehículo eléctrico","Elektrofahrzeug","Veículo elétrico"],
        HAZARDOUS_MATERIALS:["Trasporto merci pericolose","Hazardous materials","Transport de matières dangereuses","Mercancías peligrosas","Gefahrguttransport","Materiais perigosos"],
        HOV_2:["HOV 2+","HOV 2+","HOV 2+","HOV 2+","HOV 2+","HOV 2+"],
        HOV_3:["HOV 3+","HOV 3+","HOV 3+","HOV 3+","HOV 3+","HOV 3+"],
        HYBRID:["Veicolo ibrido","Hybrid vehicle","Véhicule hybride","Vehículo híbrido","Hybridfahrzeug","Veículo híbrido"],
        MOTORCYCLE:["Motocicletta","Motorcycle","Moto","Motocicleta","Motorrad","Motociclo"],
        PRIVATE:["Auto privata","Private car","Voiture particulière","Coche particular","Privat-Pkw","Automóvel particular"],
        PUBLIC_TRANSPORTATION:["Trasporto pubblico","Public transportation","Transport public","Transporte público","Öffentlicher Verkehr","Transporte público"],
        RV:["Camper","Recreational vehicle","Camping-car","Autocaravana","Wohnmobil","Autocaravana"],
        TAXI:["Taxi","Taxi","Taxi","Taxi","Taxi","Táxi"],
        TOWING_VEHICLE:["Veicolo con rimorchio","Towing vehicle","Véhicule tracteur","Vehículo con remolque","Zugfahrzeug","Veículo com reboque"],
        TRUCK:["Autocarro","Truck","Camion","Camión","Lkw","Camião"]
    };
    const nativeLabels = new Set(["aggiungi restrizioni","aggiungi restrizione","add restrictions","add restriction","ajouter des restrictions","ajouter une restriction","añadir restricciones","agregar restricciones","añadir restricción","beschränkungen hinzufügen","beschränkung hinzufügen","adicionar restrições","adicionar restrição"]);
    function normalizeLabel(value) {
        return String(value || "").normalize("NFKC").replace(/^[+\s]+/,"").replace(/\s+/g," ").trim().toLowerCase();
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
    function nextWizardStep(step,intent,types=[]) {
        if(step===4&&intent==="BLOCKED")return types.includes("MOTORCYCLE")?5:7;
        if(step===5&&intent==="BLOCKED")return 7;
        if(step===7&&intent==="BLOCKED")return 6;
        return step<6?step+1:null;
    }
    function previousWizardStep(step,intent,types=[]) {
        if(step===6&&intent==="BLOCKED")return 7;
        if(step===7&&intent==="BLOCKED")return types.includes("MOTORCYCLE")?5:4;
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
    // Pure draft matching the stable v3.2 calendar's day/date/time vocabulary.
    // No native WME SDK serialization occurs in this prototype.
    function normalizeRedSchedule(schedule) {
        if(!schedule||typeof schedule!=="object")throw Error("Invalid schedule");
        const dateOk=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
            !Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
        const start=schedule.startDate||null,end=schedule.endDate||null;
        if((start&&!dateOk(start))||(end&&!dateOk(end))||(start&&end&&start>end))
            throw Error("Invalid dates");
        const days=schedule.weekdays;
        if(!Array.isArray(days)||!days.length||
            days.some(day=>!WEEKDAYS.includes(day))||new Set(days).size!==days.length)
            throw Error("Invalid weekdays");
        if(typeof schedule.allDay!=="boolean")throw Error("Invalid all-day setting");
        if(!Array.isArray(schedule.slots))throw Error("Invalid time slots");
        const raw=schedule.allDay?[{fromTime:null,toTime:null}]:schedule.slots;
        if(!raw.length||raw.length>MAX_DRAFT_TIME_FRAMES)throw Error("SAFE12 draft limit");
        const frames=raw.map(slot=>{
            if(!schedule.allDay){
                const re=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
                if(!re.test(slot?.fromTime)||!re.test(slot?.toTime)||
                   slot.fromTime>=slot.toTime)throw Error("Invalid time range");
            }
            return {startDate:start,endDate:end,weekdays:[...days],
                fromTime:slot.fromTime,toTime:slot.toTime,
                timeZone:null,verified:false};
        });
        return {timeFrames:frames,verified:false};
    }
    // Like v3.2, read engineType from the private model only when already present;
    // this DOES NOT infer a complete list of supported engine enum values.
    function observedMotorTypes(page,segmentId) {
        try {
            const segment=page?.W?.model?.segments?.getObjectById?.(segmentId);
            const restrictions=segment?.attributes?.restrictions;
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
        module.exports = {availableDirections,countryIdentity,normalizeDraft,normalizeAdvanced,readPermits,normalizeLabel,readContext,selectedVehicleTypes,hasAllowedCriteria,normalizeVehicleRules,nextWizardStep,previousWizardStep,normalizeMotorDraft,normalizeRedSchedule,observedMotorTypes,WEEKDAYS,sortPermits,normalizePermitSearch,filterPermits,SCOPES,LANES,RESTRICTION_TYPES,DEFAULT_TYPES,VEHICLE_TYPES,OVERRIDE_TYPES,RESTRICTION_COLORS};
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
        // Exact localized label, visible native button only; fail closed on ambiguity.
        const candidates = [...document.querySelectorAll('button,[role="button"],wz-button')]
            .filter(el => !el.closest("#"+ID+"-root,#"+ID+"-dialog") && el.id !== ID+"-native" && !el.closest('[role="dialog"],dialog') &&
                el.getClientRects().length && !el.disabled && el.getAttribute("aria-disabled") !== "true" &&
                nativeLabels.has(normalizeLabel(el.innerText || el.getAttribute("aria-label") || el.textContent)));
        const outer = candidates.filter(el => !candidates.some(other => other !== el && other.contains(el)));
        return outer.length === 1 ? outer[0] : null;
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
        nativeButton=button(tr("launch"),openWizard);
        nativeButton.id=ID+"-native";
        nativeButton.style.display="block";
        nativeButton.style.margin="6px 0";
        anchor.insertAdjacentElement("afterend",nativeButton);
        return true;
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
            const key=JSON.stringify([lang,context?.segment.id,context?.country,availableDirections(context?.segment),context?.segment.restrictions?.length,injected]);
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
        const draft={direction:availableDirections(current.segment).at(-1),scope:null,lane:"lane_none",restrictionType:"BLOCKED",vehicleTypes:[]};
        const advanced={minPassengers:null,permitIds:[]};
        const vehicleRules=Object.create(null);
        const motorDraft={enabled:false,conditions:[]};
        const redSchedule={
            startDate:"",endDate:"",weekdays:[...WEEKDAYS],allDay:true,
            slots:[{fromTime:"08:00",toTime:"18:00"}]
        };
        const motorSuggestions=observedMotorTypes(page,current.segment.id);
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
            const destination=nextWizardStep(step,draft.restrictionType,draft.vehicleTypes);
            if(destination===null)return;
            step=destination;
            render();
        }
        function render(){
            dialog.replaceChildren(node("h2",tr("launch")),node("p",tr("country")+": "+(current.country?.name || tr("unknown"))),node("p",tr("test")));
            if(step===0) dialog.append(node("h3",tr("direction")),options(availableDirections(current.segment),draft.direction,v=>draft.direction=v));
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
            if(step===2) dialog.append(node("h3",tr("lane")),options(LANES,draft.lane,v=>draft.lane=v),node("p",tr("pending")));
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
                    draft.restrictionType==="ALLOWED"?"allowed_step":"vehicle_step")));
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
                    const toggleLabel=node("label"),toggle=node("input");
                    toggle.type="checkbox";toggle.checked=motorDraft.enabled;
                    toggleLabel.style.cssText="display:flex;align-items:center;gap:8px;margin:10px 0;";
                    toggle.addEventListener("change",()=>{
                        motorDraft.enabled=toggle.checked;
                        if(!motorDraft.enabled)motorDraft.conditions=[];
                        render();
                    });
                    toggleLabel.append(toggle,document.createTextNode(tr("motorcycle_enable")));
                    dialog.append(toggleLabel);
                    if(motorDraft.enabled){
                        const nameLabel=node("label",tr("motorcycle_engine"));
                        nameLabel.style.cssText="display:block;font-weight:600;";
                        const input=node("input");
                        input.type="text";input.maxLength=64;
                        input.value=motorDraft.engineType;
                        input.autocomplete="off";
                        input.setAttribute("list",ID+"-observed-engine-types");
                        input.style.cssText="display:block;margin:6px 0;padding:8px;"+
                            "width:100%;box-sizing:border-box;border:1px solid #9ca3af;border-radius:6px;";
                        input.addEventListener("input",()=>{
                            motorDraft.engineType=input.value;
                            refreshNext();
                        });
                        const suggestions=node("datalist");
                        suggestions.id=ID+"-observed-engine-types";
                        for(const value of motorSuggestions){
                            const option=node("option");option.value=value;suggestions.append(option);
                        }
                        nameLabel.append(input,suggestions);
                        dialog.append(nameLabel,node("p",tr("motorcycle_engine_hint")));
                        if(!motorDraft.engineType.trim())
                            dialog.append(node("p",tr("motorcycle_engine_error")));
                    }else dialog.append(node("p",tr("motorcycle_unchecked")));
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
            if(step===7&&draft.restrictionType==="BLOCKED"){
                dialog.append(node("h3",tr("red_schedule")),node("p",tr("red_schedule_intro")));
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
                }
                if(!isScheduleValid()){
                    const error=node("p",tr("schedule_invalid"));
                    error.setAttribute("role","alert");
                    error.style.cssText="color:#b91c1c;font-weight:600;";
                    dialog.append(error);
                }
            }
            if(step===6) {
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
                }else if(draft.restrictionType==="BLOCKED"){
                    const checked=normalizeDraft(draft,current.segment);
                    const schedule=normalizeRedSchedule(redSchedule);
                    const motor=normalizeMotorDraft(motorDraft,
                        checked.vehicleTypes.includes("MOTORCYCLE"));
                    dialog.append(node("h3",tr("summary")),
                        node("p",tr(checked.direction)+" · "+tr(checked.scope)+" · "+tr(checked.lane)),
                        node("p",tr("rule_preview")+": "+tr("allowed_default")+
                            " (SDK "+checked.defaultType+")"),
                        node("p",tr("blocked_preview")+" (SDK "+checked.overrideType+"): "+
                            (checked.vehicleTypes.length?
                                checked.vehicleTypes.map(type=>vehicleLabels[type]?.[LANGS.indexOf(lang)]||type).join(", "):
                                tr("no_exceptions"))));
                    if(checked.vehicleTypes.includes("MOTORCYCLE")){
                        dialog.append(node("p",tr("motorcycle_engine")+": "+
                            (motor.engineType||tr("motorcycle_unchecked"))),
                            node("p",tr("motorcycle_intro")));
                    }
                    dialog.append(node("h4",tr("schedule_summary")));
                    for(const frame of schedule.timeFrames){
                        const dates=(frame.startDate||tr("no_condition"))+" → "+
                            (frame.endDate||tr("no_condition"));
                        const days=frame.weekdays.map(day=>tr(day)).join(", ");
                        const hours=frame.fromTime===null?tr("schedule_all_day"):
                            frame.fromTime+"–"+frame.toTime;
                        dialog.append(node("p",dates+" · "+days+" · "+hours));
                    }
                    dialog.append(node("p",tr("red_schedule_intro")));
                }else{
                const conditions=normalizeAdvanced(advanced,current.permits);
                const checked=normalizeDraft(draft,current.segment,conditions);
                const exceptionLabel=checked.restrictionIntent==="ALLOWED"?"allowed_preview":
                    checked.restrictionIntent==="BLOCKED"?"blocked_preview":"toll_preview";
                dialog.append(node("h3",tr("summary")),
                    node("p",tr(checked.direction)+" · "+tr(checked.scope)+" · "+tr(checked.lane)),
                    node("p",tr("rule_preview")+": "+
                        tr(checked.defaultType==="BLOCKED"?"allowed_default":"toll_default")+
                        " (SDK "+checked.defaultType+")"),
                    node("p",tr(exceptionLabel)+" (SDK "+checked.overrideType+"): "+
                        (checked.vehicleTypes.length?
                            checked.vehicleTypes.map(type=>vehicleLabels[type]?.[LANGS.indexOf(lang)]||type).join(", "):
                            checked.restrictionIntent==="ALLOWED"?tr("all_vehicle_types"):tr("no_exceptions"))),
                    node("p",tr("occupancy")+": "+(conditions.minPassengers===null?tr("no_condition"):conditions.minPassengers)),
                    node("p",tr("country_permits")+": "+(conditions.permitIds.length?
                      conditions.permitIds.map(id=>current.permits?.find(p=>p.id===id)?.name||id).join(", "):tr("no_condition"))));
                if(checked.restrictionIntent==="ALLOWED")dialog.append(
                    node("p",tr("others_blocked")),node("p",tr("criteria_unverified")));
                dialog.append(node("p",tr("plate_note")),node("p",tr("vehicles_unknown")));
                }
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
