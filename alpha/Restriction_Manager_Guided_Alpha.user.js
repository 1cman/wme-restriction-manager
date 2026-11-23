// ==UserScript==
// @name         Restriction Manager — Guided Creator Alpha
// @namespace    https://github.com/1cman/wme-restriction-manager/alpha
// @version      4.0.0-alpha.6
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
    const VERSION = "4.0.0-alpha.6";
    const ID = "rm-guided-alpha";
    // Design vocabulary only: these are NOT SDK enum values or country permissions.
    const SCOPES = ["left", "center", "right", "segment"];
    const LANES = ["lane_none", "express", "fast", "hov", "public_transport", "carpool_toll_free"];
    // VehicleType and defaultType are documented SDK types. These lists are NOT
    // an eligibility matrix: local WME permissions and supported combinations
    // must be verified separately before any write path is enabled.
    const RESTRICTION_TYPES = ["BLOCKED", "FREE", "TOLL"];
    const VEHICLE_TYPES = [
        "BUS", "CAV", "CLEAN_FUEL", "EV", "HAZARDOUS_MATERIALS",
        "HOV_2", "HOV_3", "HYBRID", "MOTORCYCLE", "PRIVATE",
        "PUBLIC_TRANSPORTATION", "RV", "TAXI", "TOWING_VEHICLE", "TRUCK"
    ];
    const OVERRIDE_TYPES = Object.freeze({BLOCKED:"FREE",FREE:"BLOCKED",TOLL:"FREE"});
    // Visual cues inspired by WME restriction categories (not exact sampled native colors).
    // Only the restriction-kind step uses these colors; selection semantics stay unchanged.
    const RESTRICTION_COLORS = Object.freeze({
        BLOCKED: {background:"#FDE8E7", active:"#F8CBC7", border:"#D93933"},
        FREE:    {background:"#E5F4E8", active:"#C6E9CE", border:"#258B4C"},
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
        FREE:["Transito consentito (con divieti per veicoli scelti)","Access allowed (with blocks for selected vehicles)","Accès autorisé (sauf véhicules choisis)","Acceso permitido (salvo vehículos seleccionados)","Zufahrt erlaubt (außer gewählte Fahrzeuge)","Acesso permitido (exceto veículos selecionados)"],
        TOLL:["Transito a pedaggio (con possibili esenzioni)","Toll road (with optional exemptions)","Accès à péage (avec exemptions éventuelles)","Acceso con peaje (con posibles exenciones)","Mautpflichtig (mit möglichen Ausnahmen)","Via com portagem (com possíveis isenções)"],
        vehicle_step:["Per quali veicoli vuoi definire un'eccezione?","Which vehicles should receive an exception?","Quels véhicules reçoivent une exception ?","¿Qué vehículos tendrán una excepción?","Welche Fahrzeuge sollen eine Ausnahme erhalten?","Que veículos devem ter uma exceção?"],
        vehicles_optional:["Nessuna selezione: il divieto vale per tutti. Le categorie selezionate saranno esentate dal divieto.","No selection: all vehicles are blocked. Selected types will be allowed through.","Aucun choix : tous les véhicules sont bloqués. Les types choisis seront autorisés.","Sin selección: se prohíbe el acceso a todos. Los tipos elegidos estarán exentos.","Keine Auswahl: alle Fahrzeuge sind gesperrt. Ausgewählte Arten sind ausgenommen.","Sem seleção: todos os veículos são bloqueados. Os tipos selecionados ficam isentos."],
        vehicles_blocked:["Seleziona almeno un tipo di veicolo da vietare: gli altri restano autorizzati.","Select at least one vehicle type to block; others remain allowed.","Choisissez au moins un type de véhicule interdit ; les autres restent autorisés.","Selecciona al menos un tipo de vehículo prohibido; los demás siguen autorizados.","Wähle mindestens eine zu sperrende Fahrzeugart; andere bleiben erlaubt.","Seleciona pelo menos um tipo de veículo a proibir; os outros continuam permitidos."],
        vehicles_toll:["Seleziona almeno un tipo di veicolo esente dal pedaggio.","Select at least one vehicle type to exempt from the toll.","Choisissez au moins un type de véhicule exempté du péage.","Selecciona al menos un tipo de vehículo exento del peaje.","Wähle mindestens eine von der Maut befreite Fahrzeugart.","Seleciona pelo menos um tipo de veículo isento da portagem."],
        vehicles_unknown:["Le categorie sono tratte dallo SDK: non è ancora verificato se siano disponibili per questo Paese o tipo di restrizione. Nessuna modifica sarà effettuata.","Vehicle types come from the SDK: local availability for this country and restriction is not yet verified. Nothing will be changed.","Types issus du SDK : disponibilité locale non vérifiée. Aucune modification ne sera effectuée.","Tipos del SDK: disponibilidad local no verificada. No se realizarán cambios.","Fahrzeugarten aus dem SDK: lokale Verfügbarkeit noch nicht geprüft. Keine Änderungen.","Tipos do SDK: disponibilidade local não verificada. Sem alterações."],
        select_vehicle:["Seleziona almeno un veicolo per questo tipo di restrizione.","Select at least one vehicle for this restriction type.","Sélectionnez au moins un véhicule pour ce type de restriction.","Selecciona al menos un vehículo para este tipo de restricción.","Wähle mindestens eine Fahrzeugart für diese Beschränkung.","Seleciona pelo menos um veículo para este tipo de restrição."],
        rule_preview:["Regola principale","Default behavior","Règle principale","Regla principal","Grundregel","Regra principal"],
        vehicle_preview:["Eccezione per i veicoli selezionati","Exception for selected vehicles","Exception pour les véhicules choisis","Excepción para vehículos seleccionados","Ausnahme für gewählte Fahrzeuge","Exceção para os veículos selecionados"],
        no_exceptions:["Nessuna eccezione","No exceptions","Aucune exception","Sin excepciones","Keine Ausnahmen","Sem exceções"],
        summary:["Riepilogo di prova","Test summary","Résumé de test","Resumen de prueba","Testübersicht","Resumo de teste"],
        advanced:["Condizioni avanzate (anteprima)","Advanced conditions (preview)","Conditions avancées (aperçu)","Condiciones avanzadas (vista previa)","Erweiterte Bedingungen (Vorschau)","Condições avançadas (pré-visualização)"],
        occupancy:["Occupanti minimi (facoltativo)","Minimum occupants (optional)","Occupants minimum (facultatif)","Ocupantes mínimos (opcional)","Mindestinsassen (optional)","Ocupantes mínimos (opcional)"],
        occupancy_help:["Vuoto = nessun vincolo. Altrimenti inserisci un intero da 2 in su.","Blank = no limit. Otherwise enter an integer of at least 2.","Vide = aucune limite. Sinon entier à partir de 2.","Vacío = sin límite. Introduce entero de 2 o más.","Leer = keine Begrenzung. Sonst ganze Zahl ab 2.","Vazio = sem limite. Introduz inteiro a partir de 2."],
        occupancy_error:["Il numero di occupanti deve essere un intero di almeno 2.","Occupants must be an integer of at least 2.","Le nombre doit être un entier à partir de 2.","El número debe ser entero de 2 o más.","Ganze Zahl ab 2 erforderlich.","Necessário inteiro a partir de 2."],
        country_permits:["Pass disponibili nell'elenco del Paese","Permits listed for the segment country","Permis listés pour ce pays","Permisos listados para el país","Berechtigungen des Landes","Autorizações listadas para o país"],
        permits_missing:["Elenco pass non disponibile tramite SDK.","SDK permit list unavailable.","Liste de permis SDK indisponible.","Lista SDK no disponible.","SDK-Liste nicht verfügbar.","Lista SDK indisponível."],
        permits_empty:["Nessun pass restituito dallo SDK.","No permits returned by the SDK.","Aucun permis retourné.","El SDK no devuelve permisos.","Keine Berechtigungen gefunden.","Nenhuma autorização devolvida."],
        permit_note:["La presenza nell'elenco non prova che il pass sia utilizzabile nella restrizione.","Listing does not prove the permit can be used here.","La liste ne garantit pas l'admissibilité.","La lista no garantiza compatibilidad.","Listeneintrag garantiert keine Verwendbarkeit.","A lista não garante elegibilidade."],
        plate_note:["Regole targa: non selezionabili in questa Alpha; necessaria verifica nativa.","License plate rules: disabled pending native verification.","Plaques : vérification native requise.","Matrículas: requieren verificación.","Kennzeichen: native Prüfung erforderlich.","Matrículas: requerem verificação."],
        no_condition:["Nessuna","None","Aucune","Ninguna","Keine","Nenhuma"],
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
    // Pure, read-only model. SDK allows default BLOCKED with optional FREE rules,
    // FREE with mandatory BLOCKED rules, and TOLL with mandatory FREE rules.
    function normalizeDraft(draft, segment) {
        if (!availableDirections(segment).includes(draft.direction)) throw new Error("Direction unavailable");
        if (!SCOPES.includes(draft.scope)) throw new Error("Invalid scope");
        if (!LANES.includes(draft.lane)) throw new Error("Invalid lane design option");
        // WME displays 'None' for scope as an invalid placeholder, not a valid target.
        // The lane type's 'None' remains a distinct, valid design choice.
        // These labels are still unverified as SDK enum values or country capabilities.
        if (!RESTRICTION_TYPES.includes(draft.restrictionType)) throw new Error("Invalid restriction type");
        const vehicleTypes = selectedVehicleTypes(draft.vehicleTypes);
        if (draft.restrictionType !== "BLOCKED" && !vehicleTypes.length) {
            throw new Error("Selected restriction type requires explicit vehicle override rules");
        }
        return {
            direction:draft.direction, scope:draft.scope, lane:draft.lane,
            defaultType:draft.restrictionType, overrideType:OVERRIDE_TYPES[draft.restrictionType],
            vehicleTypes, verified:false
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
        module.exports = {availableDirections,countryIdentity,normalizeDraft,normalizeAdvanced,readPermits,normalizeLabel,readContext,selectedVehicleTypes,SCOPES,LANES,RESTRICTION_TYPES,VEHICLE_TYPES,OVERRIDE_TYPES,RESTRICTION_COLORS};
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
        async function advance() {
            // Guard progress here as well as in the button state: no implicit scope.
            if (step === 1 && !SCOPES.includes(draft.scope)) return;
            if (step === 2 && !LANES.includes(draft.lane)) return;
            if (step === 3 && !RESTRICTION_TYPES.includes(draft.restrictionType)) return;
            if (step === 4 && draft.restrictionType !== "BLOCKED" && !selectedVehicleTypes(draft.vehicleTypes).length) return;
            if(step===5){try{normalizeAdvanced(advanced,current.permits);}catch(_){return;}}
            let fresh;
            try {fresh=await readContext(sdk);} catch (_) {}
            if (!fresh || fresh.segment.id!==current.segment.id ||
                 JSON.stringify(fresh.country)!==JSON.stringify(current.country) ||
                 JSON.stringify(fresh.permits)!==JSON.stringify(current.permits) ||
                 !availableDirections(fresh.segment).includes(draft.direction)) {
                dialog.replaceChildren(node("p",tr("changed")),button(tr("close"),()=>dialog.close()));return;
            }
            step++;
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
                    }),node("p",tr("pending")));
            }
            if(step===4) {
                dialog.append(node("h3",tr("vehicle_step")));
                const helpKey = draft.restrictionType==="BLOCKED"?"vehicles_optional":
                    draft.restrictionType==="FREE"?"vehicles_blocked":"vehicles_toll";
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
                        render();
                    });
                    label.style.cssText="display:flex;align-items:start;gap:6px;font-size:12px;padding:5px 0;";
                    label.append(input,document.createTextNode(vehicleLabels[type]?.[LANGS.indexOf(lang)]||type));
                    all.append(label);
                }
                dialog.append(all);
                if(draft.restrictionType!=="BLOCKED" && !draft.vehicleTypes.length) {
                    const warning=node("p",tr("select_vehicle"));
                    warning.setAttribute("role","alert");warning.style.cssText="color:#c62828;font-weight:600;";
                    dialog.append(warning);
                }
                dialog.append(node("p",tr("vehicles_unknown")));
            }
            if(step===5) {
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
                    const box=node("div");box.style.cssText="max-height:130px;overflow:auto;border:1px solid #d1d5db;padding:6px;border-radius:7px;";
                    for(const permit of current.permits){
                        const item=node("label"),check=node("input");
                        item.style.cssText="display:flex;gap:8px;margin:5px 0;";
                        check.type="checkbox";check.checked=advanced.permitIds.includes(permit.id);
                        check.addEventListener("change",()=>{
                            advanced.permitIds=check.checked?
                                [...new Set([...advanced.permitIds,permit.id])]:
                                advanced.permitIds.filter(id=>id!==permit.id);
                            render();
                        });
                        item.append(check,document.createTextNode(permit.name));box.append(item);
                    }
                    dialog.append(box);
                }
                dialog.append(node("p",tr("permit_note")),node("p",tr("plate_note")));
                if(advanced.minPassengers!==null&&
                    (!Number.isSafeInteger(advanced.minPassengers)||advanced.minPassengers<2)){
                    const error=node("p",tr("occupancy_error"));
                    error.style.color="#c62828";error.setAttribute("role","alert");dialog.append(error);
                }
            }
            if(step===6) {
                const checked=normalizeDraft(draft,current.segment);
                const conditions=normalizeAdvanced(advanced,current.permits);
                dialog.append(node("h3",tr("summary")),
                    node("p",tr(checked.direction)+" · "+tr(checked.scope)+" · "+tr(checked.lane)),
                    node("p",tr("rule_preview")+": "+tr(checked.defaultType)),
                    node("p",tr("vehicle_preview")+" ("+checked.overrideType+"): "+
                        (checked.vehicleTypes.length?
                            checked.vehicleTypes.map(type=>vehicleLabels[type]?.[LANGS.indexOf(lang)]||type).join(", "):
                            tr("no_exceptions"))),
                    node("p",tr("occupancy")+": "+(conditions.minPassengers===null?tr("no_condition"):conditions.minPassengers)),
                    node("p",tr("country_permits")+": "+(conditions.permitIds.length?
                      conditions.permitIds.map(id=>current.permits?.find(p=>p.id===id)?.name||id).join(", "):tr("no_condition"))),
                    node("p",tr("plate_note")),
                    node("p",tr("vehicles_unknown")));
            }
            const footer=node("div");footer.style.cssText="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;";
            footer.append(button(tr("close"),()=>dialog.close()));
            if(step>0)footer.append(button(tr("back"),()=>{step--;render();}));
            if(step<6){
                const next=button(tr("next"),advance);
                next.disabled=(step===1&&!SCOPES.includes(draft.scope))||
                    (step===2&&!LANES.includes(draft.lane))||
                    (step===4&&draft.restrictionType!=="BLOCKED"&&!draft.vehicleTypes.length) ||
                    (step===5&&advanced.minPassengers!==null&&
                     (!Number.isSafeInteger(advanced.minPassengers)||advanced.minPassengers<2));
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
