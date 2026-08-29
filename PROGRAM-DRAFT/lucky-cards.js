(function(global){
    "use strict";

    const VERSION = "1.0-lucky-cards";
    const MAX_SELECTED = 4;
    const MAX_CLASSIC_LUCKY_PER_PACK = 2;
    const CURRENT_OPPORTUNITIES = 6;
    const CHANCE_BY_APPEARANCES = Object.freeze([0.35, 0.20, 0.05]);

    const state = {
        enabled:false,
        selected:[],
        appearances:{},
        history:[],
        currentOpportunityKey:null,
        currentPending:[]
    };

    let uiSelected = [];

    function normalizeName(value){
        if(typeof normalizeBanText === "function") return normalizeBanText(value);
        return String(value || "").trim().toLocaleLowerCase("pl-PL");
    }

    function getDatabase(){
        try{
            return Array.isArray(cardDatabase) ? cardDatabase : [];
        }catch(error){
            return [];
        }
    }

    function getTemplate(name){
        const key = normalizeName(name);
        return getDatabase().find(card=>normalizeName(card?.name) === key) || null;
    }

    function getSelectedSet(){
        return new Set(state.selected.map(normalizeName));
    }

    function isSelected(name){
        return getSelectedSet().has(normalizeName(name));
    }

    function isEnabled(){
        return Boolean(state.enabled && state.selected.length);
    }

    function getAppearances(name){
        return Math.max(0, Number(state.appearances[normalizeName(name)]) || 0);
    }

    function getChance(name){
        const count = getAppearances(name);
        if(count <= 0) return CHANCE_BY_APPEARANCES[0];
        if(count === 1) return CHANCE_BY_APPEARANCES[1];
        return CHANCE_BY_APPEARANCES[2];
    }

    function chancePercent(name){
        return Math.round(getChance(name) * 100);
    }

    function cloneCard(card,meta={}){
        if(!card || typeof card !== "object") return card;
        return {
            ...card,
            luckyCardMeta:{
                selected:true,
                boosted:Boolean(meta.boosted),
                mode:meta.mode || null,
                source:meta.source || (meta.boosted ? "lucky_boost" : "natural"),
                chance:Number.isFinite(Number(meta.chance)) ? Number(meta.chance) : null,
                opportunity:meta.opportunity ?? null
            }
        };
    }

    function resetRuntime(){
        state.appearances = Object.fromEntries(state.selected.map(name=>[normalizeName(name), 0]));
        state.history = [];
        state.currentOpportunityKey = null;
        state.currentPending = [];
    }

    function commitSettings(){
        const checkbox = document.getElementById("enableLuckyCards");
        const enabled = Boolean(checkbox?.checked);
        if(enabled && uiSelected.length < 1){
            alert("Wybierz przynajmniej 1 Lucky Card albo wyłącz to ustawienie.");
            return false;
        }
        if(enabled && document.getElementById("enablePokerDraft")?.checked){
            alert("Lucky Cards działa w naturalnym generatorze Classic i Gwiezdnym Prądzie. Wyłącz Poker Draft albo Lucky Cards.");
            return false;
        }
        state.enabled = enabled;
        state.selected = enabled ? uiSelected.slice(0, MAX_SELECTED) : [];
        resetRuntime();
        return true;
    }

    function beginDraft(){
        resetRuntime();
        refreshStatus();
        return exportState();
    }

    function isBanned(name,bans){
        const key = normalizeName(name);
        return new Set((Array.isArray(bans) ? bans : []).map(normalizeName)).has(key);
    }

    function eligibleSelected(options={}){
        const excluded = new Set((options.excludedNames || []).map(normalizeName));
        const bans = options.bannedCards || [];
        return state.selected.filter(name=>{
            const key = normalizeName(name);
            return !excluded.has(key) && !isBanned(name,bans) && Boolean(getTemplate(name));
        });
    }

    function rollCandidates(options={}){
        const limit = Math.max(0, Number(options.limit) || 0);
        if(!isEnabled() || limit < 1) return [];
        const rolled = eligibleSelected(options)
            .map(name=>({
                name,
                appearances:getAppearances(name),
                chance:getChance(name),
                tie:Math.random()
            }))
            .filter(entry=>Math.random() < entry.chance)
            .sort((a,b)=>a.appearances-b.appearances || a.tie-b.tie);
        return rolled.slice(0, limit);
    }

    function recordAppearance(name,meta={}){
        if(!isEnabled() || !isSelected(name)) return null;
        const key = normalizeName(name);
        state.appearances[key] = getAppearances(name) + 1;
        const entry = {
            name:String(name),
            appearance:state.appearances[key],
            boosted:Boolean(meta.boosted),
            mode:meta.mode || "classic",
            source:meta.source || (meta.boosted ? "lucky_boost" : "natural"),
            packNumber:Number.isFinite(Number(meta.packNumber)) ? Number(meta.packNumber) : null,
            pickNumber:Number.isFinite(Number(meta.pickNumber)) ? Number(meta.pickNumber) : null,
            opportunity:meta.opportunity ?? null,
            chance:Number.isFinite(Number(meta.chance)) ? Number(meta.chance) : null
        };
        state.history.push(entry);
        if(global.DraftStateEngine?.log){
            global.DraftStateEngine.log("lucky_card_appeared",{
                packNumber:entry.packNumber,
                pickIndex:entry.pickNumber,
                sourceCard:getTemplate(name),
                reason:entry.source,
                data:{
                    luckyCard:name,
                    appearance:entry.appearance,
                    boosted:entry.boosted,
                    mode:entry.mode,
                    opportunity:entry.opportunity,
                    chance:entry.chance
                }
            });
        }
        refreshStatus();
        return entry;
    }

    function enhanceClassicPack(pack,context={}){
        if(!isEnabled() || !Array.isArray(pack)) return pack;
        if(context.customPack === true) return pack;

        const result = pack.map(card=>card && typeof card === "object" ? {...card} : card);
        const selectedSet = getSelectedSet();
        const existingLucky = [];
        const seenExisting = new Set();

        result.forEach((card,index)=>{
            if(!card || card.joker) return;
            const key = normalizeName(card.name);
            if(!selectedSet.has(key) || seenExisting.has(key)) return;
            seenExisting.add(key);
            existingLucky.push({name:card.name,index});
        });

        existingLucky.forEach(entry=>{
            const chance = getChance(entry.name);
            result[entry.index] = cloneCard(result[entry.index],{
                boosted:false,
                mode:"classic",
                source:"natural",
                chance,
                opportunity:context.packNumber ?? null
            });
            recordAppearance(entry.name,{
                boosted:false,
                mode:"classic",
                source:"natural",
                chance,
                packNumber:context.packNumber,
                opportunity:context.packNumber ?? null
            });
        });

        const boostBudget = Math.max(0, MAX_CLASSIC_LUCKY_PER_PACK - existingLucky.length);
        if(boostBudget < 1) return result;

        const excludedNames = result
            .filter(card=>card && !card.joker)
            .map(card=>card.name)
            .filter(Boolean);
        const winners = rollCandidates({
            limit:boostBudget,
            excludedNames,
            bannedCards:context.bannedCards || []
        });
        if(!winners.length) return result;

        const protectedKeys = new Set(
            result
                .filter(card=>card && !card.joker && selectedSet.has(normalizeName(card.name)))
                .map(card=>normalizeName(card.name))
        );
        const replaceable = result
            .map((card,index)=>({card,index,tie:Math.random()}))
            .filter(entry=>entry.card && !entry.card.joker && !protectedKeys.has(normalizeName(entry.card.name)))
            .sort((a,b)=>a.tie-b.tie);

        winners.forEach(winner=>{
            const slot = replaceable.shift();
            const template = getTemplate(winner.name);
            if(!slot || !template) return;
            result[slot.index] = cloneCard(template,{
                boosted:true,
                mode:"classic",
                source:"lucky_boost",
                chance:winner.chance,
                opportunity:context.packNumber ?? null
            });
            recordAppearance(winner.name,{
                boosted:true,
                mode:"classic",
                source:"lucky_boost",
                chance:winner.chance,
                packNumber:context.packNumber,
                opportunity:context.packNumber ?? null
            });
        });

        return result;
    }

    function currentOpportunityKey(pickNumber,playerCount){
        const players = Math.max(1, Number(playerCount) || 1);
        const pick = Math.max(0, Number(pickNumber) || 0);
        const span = players * 2;
        const key = Math.floor(pick / span);
        return key >= 0 && key < CURRENT_OPPORTUNITIES ? key : null;
    }

    function prepareCurrentOpportunity(context={}){
        const key = currentOpportunityKey(context.pickNumber, context.playerCount);
        if(key === null) return;
        if(state.currentOpportunityKey === key) return;
        state.currentOpportunityKey = key;
        const liveNames = (context.liveCards || []).map(card=>card?.name).filter(Boolean);
        state.currentPending = rollCandidates({
            limit:MAX_CLASSIC_LUCKY_PER_PACK,
            excludedNames:liveNames,
            bannedCards:context.bannedCards || []
        }).map(entry=>({
            ...entry,
            opportunity:key
        }));
    }

    function pickCurrentBoost(context={}){
        if(!isEnabled()) return null;
        prepareCurrentOpportunity(context);
        if(!state.currentPending.length) return null;

        const live = new Set((context.liveCards || []).map(card=>normalizeName(card?.name)));
        const normalName = normalizeName(context.normalTemplate?.name);
        if(normalName && getSelectedSet().has(normalName)){
            return null;
        }

        const rotations = state.currentPending.length;
        for(let i=0;i<rotations;i++){
            const winner = state.currentPending.shift();
            const key = normalizeName(winner?.name);
            if(!winner || !key) continue;
            if(live.has(key) || isBanned(winner.name,context.bannedCards || [])){
                state.currentPending.push(winner);
                continue;
            }
            const template = getTemplate(winner.name);
            if(!template) continue;
            return {
                name:winner.name,
                card:cloneCard(template,{
                    boosted:true,
                    mode:"galactic_current",
                    source:"lucky_boost",
                    chance:winner.chance,
                    opportunity:winner.opportunity
                }),
                chance:winner.chance,
                opportunity:winner.opportunity
            };
        }
        return null;
    }

    function recordCurrentCard(card,context={}){
        if(!card || card.joker || !isSelected(card.name) || !isEnabled()) return null;
        const meta = card.luckyCardMeta || {};
        if(!meta.selected){
            card.luckyCardMeta = {
                selected:true,
                boosted:false,
                mode:"galactic_current",
                source:"natural",
                chance:getChance(card.name),
                opportunity:currentOpportunityKey(context.pickNumber,context.playerCount)
            };
        }
        return recordAppearance(card.name,{
            boosted:Boolean(card.luckyCardMeta?.boosted),
            mode:"galactic_current",
            source:card.luckyCardMeta?.boosted ? "lucky_boost" : "natural",
            chance:card.luckyCardMeta?.chance ?? getChance(card.name),
            pickNumber:context.pickNumber,
            opportunity:card.luckyCardMeta?.opportunity ?? currentOpportunityKey(context.pickNumber,context.playerCount)
        });
    }

    function exportState(){
        return {
            version:VERSION,
            enabled:Boolean(state.enabled),
            selected:[...state.selected],
            appearances:{...state.appearances},
            history:state.history.map(entry=>({...entry})),
            currentOpportunityKey:state.currentOpportunityKey,
            currentPending:state.currentPending.map(entry=>({...entry}))
        };
    }

    function restoreState(payload){
        if(!payload || typeof payload !== "object") return false;
        state.enabled = Boolean(payload.enabled);
        state.selected = (Array.isArray(payload.selected) ? payload.selected : [])
            .filter(name=>Boolean(getTemplate(name)))
            .slice(0,MAX_SELECTED);
        state.appearances = payload.appearances && typeof payload.appearances === "object"
            ? {...payload.appearances}
            : Object.fromEntries(state.selected.map(name=>[normalizeName(name),0]));
        state.history = Array.isArray(payload.history) ? payload.history.map(entry=>({...entry})) : [];
        state.currentOpportunityKey = Number.isInteger(payload.currentOpportunityKey)
            ? payload.currentOpportunityKey
            : null;
        state.currentPending = Array.isArray(payload.currentPending)
            ? payload.currentPending.map(entry=>({...entry}))
            : [];
        uiSelected = [...state.selected];
        const checkbox = document.getElementById("enableLuckyCards");
        if(checkbox) checkbox.checked = state.enabled;
        renderSelected();
        syncPanel();
        refreshStatus();
        return true;
    }

    function getExportData(){
        return {
            enabled:Boolean(state.enabled),
            selected:[...state.selected],
            appearances:Object.fromEntries(
                state.selected.map(name=>[name,getAppearances(name)])
            )
        };
    }

    function syncPanel(){
        const checkbox = document.getElementById("enableLuckyCards");
        const panel = document.getElementById("luckyCardsPanel");
        const active = Boolean(checkbox?.checked);
        if(panel) panel.hidden = !active;
        document.querySelector(".luckyCardsModeOption")?.classList.toggle("is-active",active);
    }

    function refreshStatus(){
        const counter = document.getElementById("luckyCardsCounter");
        if(counter) counter.textContent = `${uiSelected.length}/${MAX_SELECTED}`;
        const runtime = document.getElementById("luckyCardsRuntimeNote");
        if(runtime){
            if(!isEnabled()){
                runtime.textContent = "";
            }else{
                runtime.textContent = state.selected
                    .map(name=>`⭐ ${name}: ${getAppearances(name)}×`)
                    .join(" • ");
            }
        }
    }

    function renderSelected(){
        const container = document.getElementById("luckyCardsSelected");
        if(!container) return;
        container.innerHTML = "";
        uiSelected.forEach(name=>{
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "lucky-card-chip";
            chip.innerHTML = `<span aria-hidden="true">⭐</span><span>${escapeLuckyHtml(name)}</span><b aria-hidden="true">×</b>`;
            chip.title = `Usuń ${name} z Lucky Cards`;
            chip.addEventListener("click",()=>{
                uiSelected = uiSelected.filter(selected=>normalizeName(selected)!==normalizeName(name));
                renderSelected();
                renderSearchResults(document.getElementById("luckyCardsSearch")?.value || "");
                refreshStatus();
            });
            container.appendChild(chip);
        });
        refreshStatus();
    }

    function escapeLuckyHtml(value){
        return String(value || "").replace(/[&<>"']/g,char=>({
            "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
        }[char]));
    }

    function addUiCard(name){
        if(uiSelected.some(selected=>normalizeName(selected)===normalizeName(name))) return;
        if(uiSelected.length >= MAX_SELECTED){
            alert(`Możesz wybrać maksymalnie ${MAX_SELECTED} Lucky Cards.`);
            return;
        }
        if(!getTemplate(name)) return;
        uiSelected.push(name);
        renderSelected();
        const search = document.getElementById("luckyCardsSearch");
        if(search) search.value = "";
        renderSearchResults("");
    }

    function renderSearchResults(query){
        const container = document.getElementById("luckyCardsResults");
        if(!container) return;
        const text = String(query || "").trim().toLocaleLowerCase("pl-PL");
        if(!text){
            container.innerHTML = "";
            container.hidden = true;
            return;
        }
        const selected = new Set(uiSelected.map(normalizeName));
        const matches = getDatabase()
            .filter(card=>card?.name && !selected.has(normalizeName(card.name)))
            .filter(card=>card.name.toLocaleLowerCase("pl-PL").includes(text))
            .slice(0,8);
        container.innerHTML = "";
        matches.forEach(card=>{
            const button = document.createElement("button");
            button.type = "button";
            button.className = "lucky-card-result";
            button.innerHTML = `<span class="lucky-result-star" aria-hidden="true">⭐</span><strong>${escapeLuckyHtml(card.name)}</strong><small>${Number(card.cost) || 0}/${Number(card.power) || 0}</small>`;
            button.addEventListener("click",()=>addUiCard(card.name));
            container.appendChild(button);
        });
        container.hidden = matches.length === 0;
    }

    function initUI(){
        const checkbox = document.getElementById("enableLuckyCards");
        const search = document.getElementById("luckyCardsSearch");
        if(!checkbox || !search) return;
        checkbox.addEventListener("change",()=>{
            syncPanel();
            if(typeof updateModePreview === "function") updateModePreview();
        });
        search.addEventListener("input",()=>renderSearchResults(search.value));
        search.addEventListener("focus",()=>renderSearchResults(search.value));
        document.addEventListener("click",event=>{
            const panel = document.getElementById("luckyCardsPanel");
            const results = document.getElementById("luckyCardsResults");
            if(panel && results && !panel.contains(event.target)){
                results.hidden = true;
            }
        });
        syncPanel();
        renderSelected();
    }

    global.LuckyCards = Object.freeze({
        VERSION,
        MAX_SELECTED,
        MAX_CLASSIC_LUCKY_PER_PACK,
        CHANCE_BY_APPEARANCES,
        commitSettings,
        beginDraft,
        resetRuntime,
        isEnabled,
        isSelected,
        getAppearances,
        getChance,
        chancePercent,
        enhanceClassicPack,
        pickCurrentBoost,
        recordCurrentCard,
        exportState,
        restoreState,
        getExportData
    });

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded",initUI,{once:true});
    }else{
        initUI();
    }
})(window);
