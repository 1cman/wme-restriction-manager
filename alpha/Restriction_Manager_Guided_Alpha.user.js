// ==UserScript==
// @name         Restriction Manager — Guided Creator Alpha
// @namespace    https://github.com/1cman/wme-restriction-manager/alpha
// @version      4.0.0-alpha.1
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
    const VERSION = "4.0.0-alpha.1";
    const ID = "rm-guided-alpha";
    // Design vocabulary only: these are NOT SDK enum values or country permissions.
    const SCOPES = ["segment", "left", "center", "right"];
    const LANES = ["express", "fast", "hov", "public_transport", "carpool_toll_free"];
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
        segment:["Intero segmento","Entire segment","Segment entier","Segmento completo","Gesamtes Segment","Segmento inteiro"],
        left:["Corsia sinistra","Left lane","Voie gauche","Carril izquierdo","Linker Fahrstreifen","Via esquerda"],
        center:["Corsia centrale","Center lane","Voie centrale","Carril central","Mittlerer Fahrstreifen","Via central"],
        right:["Corsia destra","Right lane","Voie droite","Carril derecho","Rechter Fahrstreifen","Via direita"],
        lane:["Tipologia di corsia richiesta","Requested lane type","Type de voie souhaité","Tipo de carril solicitado","Gewünschter Fahrstreifentyp","Tipo de via pretendido"],
        express:["Express","Express","Express","Express","Express","Express"],
        fast:["Fast","Fast","Fast","Fast","Fast","Fast"],
        hov:["HOV","HOV","HOV","HOV","HOV","HOV"],
        public_transport:["Mezzi pubblici","Public transport","Transports publics","Transporte público","Öffentlicher Verkehr","Transportes públicos"],
        carpool_toll_free:["No pedaggio per carpool","Toll-free carpool","Péage gratuit pour covoiturage","Sin peaje para vehículos compartidos","Mautfrei für Fahrgemeinschaften","Sem portagem para boleias"],
        pending:["Opzioni dimostrative: disponibilità per Paese, segmento e direzione ancora da verificare nel pannello nativo.","Design options only: country, segment and direction eligibility still requires native WME verification.","Options de conception : disponibilité à vérifier dans WME.","Opciones de diseño: disponibilidad aún por verificar en WME.","Entwurfsoptionen: Verfügbarkeit in WME noch zu prüfen.","Opções de desenho: disponibilidade ainda por verificar no WME."],
        summary:["Riepilogo di prova","Test summary","Résumé de test","Resumen de prueba","Testübersicht","Resumo de teste"],
        changed:["La selezione è cambiata. Chiudi e riapri la procedura.","Selection changed. Close and reopen the wizard.","La sélection a changé. Rouvrez l'assistant.","La selección ha cambiado. Vuelve a abrir el asistente.","Auswahl geändert. Assistent erneut öffnen.","A seleção mudou. Reabre o assistente."],
        anchor:["Pulsante nel pannello WME","Button in WME panel","Bouton dans WME","Botón en WME","Schaltfläche in WME","Botão no WME"],
        found:["Rilevato","Detected","Détecté","Detectado","Erkannt","Detetado"],
        fallback:["Non rilevato: usa questa scheda.","Not detected: use this tab.","Non détecté : utilisez cet onglet.","No detectado: usa esta pestaña.","Nicht erkannt: diesen Tab verwenden.","Não detetado: usa este separador."]
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
    function normalizeDraft(draft, segment) {
        if (!availableDirections(segment).includes(draft.direction)) throw new Error("Direction unavailable");
        if (!SCOPES.includes(draft.scope)) throw new Error("Invalid scope");
        if (draft.scope !== "segment" && !LANES.includes(draft.lane)) throw new Error("Invalid lane design option");
        return {direction:draft.direction, scope:draft.scope, lane:draft.scope === "segment" ? null : draft.lane, verified:false};
    }
    async function readContext(sdk) {
        const sel = await sdk.Editing.getSelection();
        if (!Array.isArray(sel?.ids) || sel.ids.length !== 1 || !String(sel.objectType || "").toLowerCase().includes("segment")) return null;
        const segment = await sdk.DataModel.Segments.getById({segmentId:sel.ids[0]});
        if (!segment) return null;
        let address = null;
        try { address = await sdk.DataModel.Segments.getAddress({segmentId:segment.id}); } catch (_) {}
        return {segment,country:countryIdentity(address)};
    }
    // Expose pure functions only in Node, not in the WME page.
    if (typeof module === "object" && module.exports && typeof document === "undefined") {
        module.exports = {availableDirections,countryIdentity,normalizeDraft,normalizeLabel,readContext,SCOPES,LANES};
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
        const draft={direction:availableDirections(current.segment).at(-1),scope:"segment",lane:null};
        const options = (keys,value,onChange) => {
            const box=node("div");
            for(const k of keys) {
                const label=node("label"),input=node("input");
                input.type="radio";input.name=ID+"-choice";input.value=k;input.checked=k===value;
                input.addEventListener("change",()=>{onChange(k);render();});
                label.style.cssText="display:block;padding:8px 0;";
                label.append(input,document.createTextNode(" "+tr(k)));box.append(label);
            }
            return box;
        };
        async function advance() {
            let fresh;
            try {fresh=await readContext(sdk);} catch (_) {}
            if (!fresh || fresh.segment.id!==current.segment.id ||
                 JSON.stringify(fresh.country)!==JSON.stringify(current.country) ||
                 !availableDirections(fresh.segment).includes(draft.direction)) {
                dialog.replaceChildren(node("p",tr("changed")),button(tr("close"),()=>dialog.close()));return;
            }
            if(step===1 && draft.scope==="segment") step=3;
            else step++;
            render();
        }
        function render(){
            dialog.replaceChildren(node("h2",tr("launch")),node("p",tr("country")+": "+(current.country?.name || tr("unknown"))),node("p",tr("test")));
            if(step===0) dialog.append(node("h3",tr("direction")),options(availableDirections(current.segment),draft.direction,v=>draft.direction=v));
            if(step===1) dialog.append(node("h3",tr("scope")),options(SCOPES,draft.scope,v=>{draft.scope=v;draft.lane=null;}),node("p",tr("pending")));
            if(step===2) dialog.append(node("h3",tr("lane")),options(LANES,draft.lane,v=>draft.lane=v),node("p",tr("pending")));
            if(step===3) {
                const checked=normalizeDraft(draft,current.segment);
                dialog.append(node("h3",tr("summary")),node("p",tr(checked.direction)+" · "+tr(checked.scope)+(checked.lane?" · "+tr(checked.lane):"")),node("p",tr("pending")));
            }
            const footer=node("div");footer.style.cssText="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;";
            footer.append(button(tr("close"),()=>dialog.close()));
            if(step>0)footer.append(button(tr("back"),()=>{step=step===3&&draft.scope==="segment"?1:step-1;render();}));
            if(step<3){const next=button(tr("next"),advance);next.disabled=step===2&&!draft.lane;footer.append(next);}
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
