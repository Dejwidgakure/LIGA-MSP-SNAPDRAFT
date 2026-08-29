(function(){
    "use strict";

    const state={
        joker:null,
        packIndex:-1,
        sourceJoker:null,
        cards:[],
        filteredCards:[],
        availablePoolSize:0,
        selectedCard:null,
        visibleLimit:72,
        resolving:false,
        effectResolver:null,
        effectContext:null,
        allowCancel:true
    };

    const VIRTUAL_LABELS={
        "cost-greater-than-power":"KOSZT > SIŁA",
        "power-greater-than-cost":"SIŁA > KOSZT",
        "equal-cost-power":"KOSZT = SIŁA",
        "exact-2-power":"SIŁA = 2",
        "exact-6-6":"KOSZT 6 • SIŁA 6",
        "power-4-above-cost":"SIŁA ≥ KOSZT + 4"
    };

    const JOKER_FAMILY_LABELS={
        tag:"TAGOWY",
        statistics:"STATYSTYCZNY",
        hybrid:"HYBRYDOWY",
        special:"SPECJALNY"
    };

    const STAT_FIELD_LABELS={
        cost:"KOSZT",
        power:"SIŁA"
    };

    function escapeHtml(value){
        return String(value??"").replace(/[&<>"']/g,char=>({
            "&":"&amp;",
            "<":"&lt;",
            ">":"&gt;",
            '"':"&quot;",
            "'":"&#039;"
        }[char]));
    }

    function normalizeSearch(value){
        return String(value||"")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g,"")
            .toLowerCase()
            .trim();
    }

    function getMode(joker){
        return typeof window.getJokerMode==="function"
            ? window.getJokerMode(joker)
            : String(joker?.type||joker?.mode||"choice").toLowerCase();
    }

    function getRarity(joker){
        if(typeof window.getJokerRarity==="function"){
            return window.getJokerRarity(joker);
        }
        const rarity=String(joker?.rarity||"rare").toLowerCase();
        return rarity==="common" ? "rare" : rarity;
    }

    function getTagIndex(){
        const index=new Map();
        if(typeof TAGS!=="object" || !TAGS) return index;
        Object.entries(TAGS).forEach(([categoryId,tags])=>{
            if(!Array.isArray(tags)) return;
            tags.forEach(tag=>{
                if(!tag?.id) return;
                index.set(String(tag.id).toLowerCase(),{
                    ...tag,
                    categoryId,
                    category:typeof TAG_CATEGORIES==="object"
                        ? TAG_CATEGORIES[categoryId]
                        : null
                });
            });
        });
        return index;
    }

    function getTagLabel(tag,index=getTagIndex()){
        const normalized=String(tag||"").toLowerCase();
        return VIRTUAL_LABELS[normalized]
            || index.get(normalized)?.name
            || normalized.replace(/-/g," ").toUpperCase();
    }

    function getCriteriaGroups(joker){
        const filter=typeof window.getJokerFilterConfig==="function"
            ? window.getJokerFilterConfig(joker)
            : {
                minCost:joker?.minCost??null,
                maxCost:joker?.maxCost??null,
                minPower:joker?.minPower??null,
                maxPower:joker?.maxPower??null,
                allOf:Array.isArray(joker?.tags) ? joker.tags : [],
                anyOf:[],
                noneOf:[],
                predicates:[],
                relations:[]
            };
        const groups=new Map();
        const tagIndex=getTagIndex();
        const addLabel=(groupId,groupName,label,category=null)=>{
            if(!label) return;
            if(!groups.has(groupId)){
                groups.set(groupId,{
                    id:groupId,
                    name:groupName,
                    labels:[],
                    color:category?.color || null,
                    glow:category?.glow || null
                });
            }
            const group=groups.get(groupId);
            if(!group.labels.includes(label)) group.labels.push(label);
        };
        const addRange=(name,min,max)=>{
            if(min==null && max==null) return;
            if(min!=null && max!=null && Number(min)===Number(max)){
                addLabel("stats","STATYSTYKI",`${name} ${min}`);
            }else if(min!=null && max!=null){
                addLabel("stats","STATYSTYKI",`${name} ${min}–${max}`);
            }else if(min!=null){
                addLabel("stats","STATYSTYKI",`${name} ${min}+`);
            }else{
                addLabel("stats","STATYSTYKI",`${name} DO ${max}`);
            }
        };

        const getRelationLabel=relation=>{
            if(relation?.label) return String(relation.label).toUpperCase();
            const left=STAT_FIELD_LABELS[String(relation?.left||"").toLowerCase()]
                || String(relation?.left||"").toUpperCase();
            const right=STAT_FIELD_LABELS[String(relation?.right||"").toLowerCase()]
                || String(relation?.right||"").toUpperCase();
            const operator=String(relation?.operator||"=");
            const offset=Number(relation?.offset||0);
            const offsetText=offset>0 ? ` + ${offset}` : offset<0 ? ` - ${Math.abs(offset)}` : "";
            return `${left} ${operator} ${right}${offsetText}`;
        };

        const displayMaxCost=Number(filter.maxCost)>=99 ? null : filter.maxCost;
        const displayMaxPower=Number(filter.maxPower)>=99 ? null : filter.maxPower;
        addRange("KOSZT",filter.minCost,displayMaxCost);
        addRange("SIŁA",filter.minPower,displayMaxPower);
        const allOfTags=(filter.allOf||[]).filter(tag=>tag!=="any");
        allOfTags.forEach(tag=>{
            const normalized=String(tag||"").toLowerCase();
            const info=tagIndex.get(normalized);
            const categoryId=info?.categoryId || "tags";
            const baseCategoryName=info?.category?.name || "TAGI";
            const categoryName=allOfTags.length>1
                ? `WSZYSTKIE • ${baseCategoryName}`
                : baseCategoryName;
            addLabel(categoryId,categoryName,getTagLabel(tag,tagIndex),info?.category);
        });
        if(filter.anyOf?.length){
            filter.anyOf.forEach(tag=>{
                const normalized=String(tag||"").toLowerCase();
                const info=tagIndex.get(normalized);
                const categoryName=info?.category?.name || "TAGI";
                addLabel(
                    `any-${info?.categoryId||"tags"}`,
                    `JEDEN Z • ${categoryName}`,
                    getTagLabel(tag,tagIndex),
                    info?.category
                );
            });
        }
        (filter.noneOf||[]).forEach(tag=>
            addLabel(
                "excluded",
                "WYKLUCZENIA",
                `BEZ: ${getTagLabel(tag,tagIndex)}`
            )
        );
        (filter.predicates||[]).forEach(predicate=>
            addLabel(
                "predicates",
                "WARUNKI SPECJALNE",
                getTagLabel(predicate,tagIndex)
            )
        );
        (filter.relations||[]).forEach(relation=>
            addLabel(
                "relations",
                "RELACJE STATYSTYCZNE",
                getRelationLabel(relation)
            )
        );

        return [...groups.values()];
    }

    function getCriteria(joker){
        return getCriteriaGroups(joker).flatMap(group=>group.labels);
    }

    function getPackSummary(joker){
        return String(
            joker?.packDescription ||
            joker?.desc ||
            joker?.description ||
            "Dowolna karta"
        ).trim();
    }

    function ensureModal(){
        let modal=document.getElementById("jokerV2ResolveModal");
        if(modal) return modal;

        modal=document.createElement("div");
        modal.id="jokerV2ResolveModal";
        modal.className="joker-v2-overlay";
        modal.hidden=true;
        modal.setAttribute("aria-hidden","true");
        modal.innerHTML=`
            <section class="joker-v2-modal" role="dialog" aria-modal="true" aria-labelledby="jokerV2Title">
                <div class="joker-v2-glitch-layer" aria-hidden="true"></div>
                <header class="joker-v2-header">
                    <img class="joker-v2-jeff" src="draft-assets/jeff_joker.webp" alt="">
                    <div class="joker-v2-heading">
                        <div class="joker-v2-kicker" id="jokerV2Kicker"></div>
                        <h2 class="joker-v2-title" id="jokerV2Title">JOKER</h2>
                        <p class="joker-v2-description" id="jokerV2Description"></p>
                    </div>
                    <div class="joker-v2-rarity" id="jokerV2Rarity"></div>
                </header>

                <div class="joker-v2-criteria" id="jokerV2Criteria"></div>

                <div class="joker-v2-toolbar" id="jokerV2Toolbar">
                    <label class="joker-v2-search-label">
                        <span>WYSZUKAJ KARTĘ</span>
                        <input id="jokerV2Search" type="search" autocomplete="off" placeholder="Zacznij wpisywać nazwę...">
                    </label>
                    <div class="joker-v2-count" id="jokerV2Count"></div>
                </div>

                <div class="joker-v2-card-grid" id="jokerV2CardGrid"></div>
                <button class="joker-v2-more" id="jokerV2More" type="button">POKAŻ WIĘCEJ</button>

                <footer class="joker-v2-footer">
                    <div class="joker-v2-selected" id="jokerV2Selected">Nie wybrano karty</div>
                    <div class="joker-v2-actions">
                        <button class="joker-v2-btn joker-v2-btn--cancel" id="jokerV2Cancel" type="button">ANULUJ</button>
                        <button class="joker-v2-btn joker-v2-btn--confirm" id="jokerV2Confirm" type="button" disabled>ZATWIERDŹ WYBÓR</button>
                    </div>
                </footer>
            </section>
        `;
        document.body.appendChild(modal);

        modal.querySelector("#jokerV2Search").addEventListener("input",event=>{
            state.visibleLimit=72;
            applySearch(event.target.value);
        });
        modal.querySelector("#jokerV2More").addEventListener("click",()=>{
            state.visibleLimit+=72;
            renderCards();
        });
        modal.querySelector("#jokerV2Cancel").addEventListener("click",close);
        modal.querySelector("#jokerV2Confirm").addEventListener("click",commitSelection);
        modal.addEventListener("click",event=>{
            if(event.target===modal) close();
        });

        return modal;
    }

    function buildCardButton(card){
        const button=document.createElement("button");
        button.type="button";
        button.className="joker-v2-card-option";
        button.dataset.cardName=card.name;
        button.innerHTML=`
            <span class="joker-v2-card-cost">${escapeHtml(card.cost)}</span>
            <span class="joker-v2-card-name">${escapeHtml(card.name)}</span>
            <span class="joker-v2-card-power">${escapeHtml(card.power)}</span>
        `;
        if(state.selectedCard===card){
            button.classList.add("is-selected");
        }
        button.addEventListener("click",()=>{
            state.selectedCard=card;
            document.querySelectorAll("#jokerV2CardGrid .joker-v2-card-option")
                .forEach(item=>item.classList.toggle(
                    "is-selected",
                    item.dataset.cardName===card.name
                ));
            updateSelected();
        });
        return button;
    }

    function renderCards(){
        const modal=ensureModal();
        const grid=modal.querySelector("#jokerV2CardGrid");
        const more=modal.querySelector("#jokerV2More");
        grid.innerHTML="";

        const visible=state.filteredCards.slice(0,state.visibleLimit);
        visible.forEach((card,index)=>{
            const button=buildCardButton(card);
            button.style.setProperty("--joker-option-index",String(index));
            grid.appendChild(button);
        });

        if(!visible.length){
            grid.innerHTML=`
                <div class="joker-v2-empty">
                    Brak kart spełniających podane warunki.
                </div>
            `;
        }

        more.hidden=state.filteredCards.length<=state.visibleLimit;
        modal.querySelector("#jokerV2Count").textContent=
            `${state.filteredCards.length} ${state.filteredCards.length===1 ? "dostępna karta" : "dostępnych kart"}`;
    }

    function applySearch(query){
        const normalized=normalizeSearch(query);
        state.filteredCards=!normalized
            ? [...state.cards]
            : state.cards.filter(card=>
                normalizeSearch(card.name).includes(normalized)
            );
        renderCards();
    }

    function updateSelected(){
        const modal=ensureModal();
        modal.querySelector("#jokerV2Selected").innerHTML=state.selectedCard
            ? `WYBRANO: <strong>${escapeHtml(state.selectedCard.name)}</strong>`
            : "Nie wybrano karty";
        modal.querySelector("#jokerV2Confirm").disabled=!state.selectedCard || state.resolving;
    }

    function open(joker,packIndex,options={}){
        const modal=ensureModal();
        if(state.resolving || state.effectResolver || !modal.hidden) return false;
        // Zwykły pick Jokera nie może nadpisać rozpoczętej sekwencji Supermocy.
        // Wyjątkiem jest kontrolowane rozstrzygnięcie Jokera wewnątrz Portalu Strange’a.
        if(!options?.effectResolver && window.SuperpowerUI?.isBusy?.()){
            window.SuperpowerFeedback?.warning?.("","SEKWENCJA SUPERMOCY W TOKU","Najpierw dokończ albo legalnie anuluj aktywną Supermoc.");
            return false;
        }
        const mode=getMode(joker);
        const available=typeof window.getJokerAvailableCards==="function"
            ? window.getJokerAvailableCards(joker)
            : [];
        const cards=mode==="surprise"
            ? fisherYates(available).slice(0,3)
            : [...available].sort((a,b)=>String(a.name).localeCompare(String(b.name),"pl"));

        if((mode==="surprise" && cards.length<3) || (mode==="choice" && !cards.length)){
            alert("Ten Joker nie ma obecnie wystarczającej liczby dostępnych kart.");
            return false;
        }

        state.joker=joker;
        state.packIndex=Number(packIndex);
        state.sourceJoker=currentPack?.[packIndex] || joker;
        state.cards=cards;
        state.filteredCards=[...cards];
        state.availablePoolSize=available.length;
        state.selectedCard=null;
        state.visibleLimit=mode==="surprise" ? 3 : 72;
        state.resolving=false;
        state.effectResolver=options?.effectResolver||null;
        state.effectContext=options?.effectContext||null;
        // Surprise jest zobowiązaniem: po odsłonięciu trzech opcji trzeba wybrać jedną.
        // Choice nadal może zezwalać na anulowanie, jeśli wywołujący na to pozwala.
        state.allowCancel=mode==="surprise" ? false : options?.allowCancel!==false;

        const rarity=getRarity(joker);
        const criteriaGroups=getCriteriaGroups(joker);
        const family=String(joker?.family||"special").toLowerCase();
        const familyLabel=JOKER_FAMILY_LABELS[family]||family.toUpperCase();
        const resolutionLabels=mode==="surprise"
            ? [familyLabel,`3 OPCJE Z PULI ${available.length}`,"NIEWYBRANE → CMENTARZYSKO"]
            : [familyLabel,`PEŁNA PULA: ${available.length} KART`];
        const displayGroups=[
            {
                id:"catalog-info",
                name:"RODZAJ I PULA",
                labels:resolutionLabels,
                color:"#ffe875",
                glow:"rgba(255,216,79,.30)"
            },
            ...criteriaGroups
        ];
        modal.dataset.mode=mode;
        modal.dataset.family=family;
        modal.dataset.rarity=rarity;
        modal.querySelector("#jokerV2Kicker").textContent=
            mode==="surprise" ? "JOKER SURPRISE" : "JOKER CHOICE";
        modal.querySelector("#jokerV2Title").textContent=joker.name || "JOKER";
        modal.querySelector("#jokerV2Description").textContent=
            joker.description || joker.desc || "Wybierz kartę.";
        modal.querySelector("#jokerV2Rarity").textContent=rarity.toUpperCase();
        modal.querySelector("#jokerV2Criteria").innerHTML=displayGroups.length
            ? displayGroups.map(group=>`
                <section
                    class="joker-v2-criteria-group"
                    style="--jv2-group-color:${escapeHtml(group.color||"#85f8ff")};--jv2-group-glow:${escapeHtml(group.glow||"rgba(0,240,255,.34)")}"
                >
                    <b>${escapeHtml(group.name)}</b>
                    <div>
                        ${group.labels.map(label=>`<span>${escapeHtml(label)}</span>`).join("")}
                    </div>
                </section>
            `).join("")
            : `
                <section class="joker-v2-criteria-group">
                    <b>ZAKRES JOKERA</b>
                    <div><span>DOWOLNA KARTA</span></div>
                </section>
            `;

        const toolbar=modal.querySelector("#jokerV2Toolbar");
        toolbar.hidden=mode==="surprise";
        modal.querySelector("#jokerV2Search").value="";
        modal.querySelector("#jokerV2Confirm").textContent=
            mode==="surprise" ? "WYBIERAM" : "ZATWIERDŹ WYBÓR";
        const cancelButton=modal.querySelector("#jokerV2Cancel");
        if(cancelButton) cancelButton.hidden=!state.allowCancel;
        modal.classList.toggle("is-locked-resolution",!state.allowCancel);

        renderCards();
        updateSelected();
        modal.hidden=false;
        modal.setAttribute("aria-hidden","false");
        requestAnimationFrame(()=>modal.classList.add("is-open"));
        if(window.CardTooltips?.hide) window.CardTooltips.hide();
        return true;
    }

    function resolveForEffect(joker,options={}){
        return open(joker,-1,{
            effectResolver:{
                onResolve:typeof options.onResolve==="function" ? options.onResolve : null,
                onCancel:typeof options.onCancel==="function" ? options.onCancel : null
            },
            effectContext:{
                playerIndex:Number.isInteger(Number(options.playerIndex)) ? Number(options.playerIndex) : null,
                sourceZone:options.sourceZone||"effect",
                sourcePowerId:options.sourcePowerId||null,
                sourceEvent:options.sourceEvent||"joker_effect_resolution"
            },
            allowCancel:options.allowCancel!==false
        });
    }

    function close(){
        if(state.resolving || state.allowCancel===false) return;
        const resolver=state.effectResolver;
        state.effectResolver=null;
        state.effectContext=null;
        const modal=ensureModal();
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden","true");
        window.setTimeout(()=>{
            if(!modal.classList.contains("is-open")) modal.hidden=true;
        },220);
        if(window.CardTooltips?.hide) window.CardTooltips.hide();
        resolver?.onCancel?.();
    }

    function commitSelection(){
        if(state.resolving || !state.selectedCard) return;

        const effectResolver=state.effectResolver;
        const effectContext=state.effectContext||{};
        const liveIndex=effectResolver ? -1 : currentPack?.indexOf(state.sourceJoker);
        if(!effectResolver && liveIndex<0){
            alert("Paczka zmieniła się przed zatwierdzeniem Jokera.");
            close();
            return;
        }

        state.resolving=true;
        updateSelected();
        const playerIndex=effectResolver
            ? effectContext.playerIndex
            : pickOrder[currentPickIndex];
        const sourceJoker=state.sourceJoker;
        const selectedTemplate=state.selectedCard;
        const resolvedCard=typeof createDraftCardInstance==="function"
            ? createDraftCardInstance(selectedTemplate,{
                origin:effectResolver ? "joker_effect_resolution" : "joker_v2_resolution",
                sourcePowerId:effectContext.sourcePowerId||null,
                sourceEvent:effectContext.sourceEvent||"joker_resolved",
                forceNew:true
            })
            : {...selectedTemplate};
        resolvedCard.instanceMeta={
            ...(resolvedCard.instanceMeta||{}),
            fulfilledFromJokerInstanceId:sourceJoker?.instanceId||null,
            fulfilledFromJokerId:state.joker?.id||null,
            fulfilledFromJokerName:state.joker?.name||null
        };
        const rejectedOptions=typeof window.getSurpriseJokerRejectedOptions==="function"
            ? window.getSurpriseJokerRejectedOptions(sourceJoker,state.cards,selectedTemplate)
            : [];
        if(effectResolver && rejectedOptions.length && typeof window.buildPendingSurpriseJokerRejections==="function"){
            const pending=window.buildPendingSurpriseJokerRejections(
                sourceJoker,
                state.cards,
                selectedTemplate,
                {
                    sourceZone:effectContext.sourceZone||"effect",
                    sourcePowerId:effectContext.sourcePowerId||null,
                    sourceEvent:effectContext.sourceEvent||"joker_effect_resolution"
                }
            );
            if(pending) resolvedCard.instanceMeta.pendingJokerRejections=pending;
        }

        const modal=ensureModal();
        modal.classList.remove("is-open");
        modal.hidden=true;
        modal.setAttribute("aria-hidden","true");
        if(window.CardTooltips?.hide) window.CardTooltips.hide();

        if(effectResolver){
            state.effectResolver=null;
            state.effectContext=null;
            state.allowCancel=true;
            state.resolving=false;
            // To jest wybór wyniku dla zewnętrznej sekwencji, nie finalne zdobycie.
            // Oficjalny event zapisuje dopiero moc przy atomowym commitcie.
            window.jokerLog=Array.isArray(window.jokerLog) ? window.jokerLog : [];
            window.jokerLog.push({
                event:"joker_selected_for_effect",
                committed:false,
                jokerId:state.joker?.id||null,
                jokerName:state.joker?.name||null,
                jokerType:getMode(state.joker),
                jokerRarity:getRarity(state.joker),
                sourceJokerInstanceId:sourceJoker?.instanceId||null,
                resultCardInstanceId:resolvedCard?.instanceId||null,
                sourceZone:effectContext.sourceZone||"effect",
                sourcePowerId:effectContext.sourcePowerId||null,
                playerIndex:Number.isInteger(playerIndex)?playerIndex:null,
                playerName:Number.isInteger(playerIndex)?players?.[playerIndex]||null:null,
                card:resolvedCard.name,
                packNumber:Number(packStartIndex||0)+1,
                pickIndex:typeof currentPickIndex==="number"?currentPickIndex:null,
                timestamp:new Date().toISOString()
            });
            effectResolver.onResolve?.(resolvedCard,{
                sourceJoker,
                context:{...effectContext}
            });
            return;
        }

        const questPackSnapshotBeforePick=window.DraftQuestEngine?.capturePackSnapshot?.(currentPack)||null;
        window.playClassicPackPickAnimation?.(liveIndex);
        if(typeof finalizeSpiderManPackPick==="function"){
            finalizeSpiderManPackPick(playerIndex,sourceJoker);
        }
        decks[playerIndex].push(resolvedCard);
        if(typeof consumeProfessorXControl==="function"){
            consumeProfessorXControl(playerIndex,resolvedCard);
        }
        currentPack.splice(liveIndex,1);
        const rejectedEntries=(
            rejectedOptions.length &&
            typeof window.archiveSurpriseJokerRejections==="function"
        ) ? window.archiveSurpriseJokerRejections(
            sourceJoker,
            rejectedOptions,
            resolvedCard,
            {
                source:"surprise_joker_rejected",
                resolutionPath:"joker_v2_pack_pick",
                revealedOptionNames:state.cards.map(card=>card?.name).filter(Boolean)
            }
        ) : [];
        if(typeof recordDraftPickEvent==="function"){
            recordDraftPickEvent(playerIndex,resolvedCard,liveIndex,"joker",{
                sourceCard:sourceJoker,
                resultCard:resolvedCard,
                data:{
                    jokerId:state.joker?.id||null,
                    jokerType:getMode(state.joker),
                    jokerRarity:getRarity(state.joker),
                    rejectedCount:rejectedEntries.length,
                    rejectedCards:rejectedEntries.map(entry=>entry?.card?.name).filter(Boolean)
                },
                questContext:{packSnapshotBeforePick:questPackSnapshotBeforePick,pickedPackIndex:liveIndex}
            });
        }
        window.showDraftPickToast?.(`${players[playerIndex]} WYBIERA: ${resolvedCard.name}`,"pick");

        window.jokerLog=Array.isArray(window.jokerLog) ? window.jokerLog : [];
        window.jokerLog.push({
            event:"joker_resolved",
            jokerId:state.joker?.id || null,
            jokerName:state.joker?.name || null,
            jokerType:getMode(state.joker),
            jokerRarity:getRarity(state.joker),
            sourceJokerInstanceId:sourceJoker?.instanceId||null,
            resultCardInstanceId:resolvedCard?.instanceId||null,
            playerIndex,
            playerName:players?.[playerIndex] || null,
            card:resolvedCard.name,
            rejectedCards:rejectedEntries.map(entry=>entry?.card?.name).filter(Boolean),
            packNumber:Number(packStartIndex||0)+1,
            pickIndex:currentPickIndex,
            timestamp:new Date().toISOString()
        });

        const rocketResult=typeof resolveRocketBombAfterPick==="function"
            ? resolveRocketBombAfterPick(playerIndex,sourceJoker,resolvedCard)
            : null;
        state.effectContext=null;
        state.allowCancel=true;
        state.resolving=false;

        if(rocketResult?.triggered){
            showPack(false);
            showDecks();
            updateRoundQueueDisplay();
            if(
                window.SuperpowerUI &&
                typeof window.SuperpowerUI.resolveRocketBomb==="function"
            ){
                window.SuperpowerUI.resolveRocketBomb(rocketResult,()=>nextPickOrPack());
            }else{
                nextPickOrPack();
            }
            return;
        }
        nextPickOrPack();
    }

    function fisherYates(items){
        const shuffled=[...items];
        for(let i=shuffled.length-1;i>0;i--){
            const j=Math.floor(Math.random()*(i+1));
            [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
        }
        return shuffled;
    }

    function buildPackCardButton(joker,index){
        const button=document.createElement("button");
        const mode=getMode(joker);
        const rarity=getRarity(joker);
        const packSummary=getPackSummary(joker);
        button.type="button";
        button.className="joker-card-btn joker-card-btn--v2";
        button.dataset.packIndex=String(index);
        button.dataset.jokerType=mode;
        button.dataset.jokerRarity=rarity;
        button.setAttribute(
            "aria-label",
            `Joker ${joker.name||""}, ${mode}, ${rarity}: ${packSummary}`
        );
        button.innerHTML=`
            <div class="joker-border">
                <div class="joker-card">
                    <div class="joker-bg-glow"></div>
                    <div class="joker-starfield"></div>
                    <div class="joker-galaxy"></div>
                    <div class="joker-v2-badges">
                        <span class="joker-v2-type">${mode.toUpperCase()}</span>
                        <span class="joker-v2-rarity-badge" title="${rarity.toUpperCase()}">
                            <i class="joker-v2-gem"></i>
                            <b>${rarity.toUpperCase()}</b>
                        </span>
                    </div>
                    <div class="joker-questions">
                        <span class="q-left">?</span>
                        <span class="q-right">?</span>
                    </div>
                    <div class="joker-desc joker-v2-pack-desc">
                        <strong class="joker-v2-pack-title">${escapeHtml(joker.name||"JOKER")}</strong>
                        <span class="joker-v2-pack-summary">${escapeHtml(packSummary)}</span>
                    </div>
                </div>
            </div>
            <div class="joker-title" data-text="JOKER">JOKER</div>
        `;
        button.onclick=()=>{
            if(!packIsOpen || packOpeningInProgress || packEnding) return;
            if(
                window.SuperpowerUI &&
                typeof window.SuperpowerUI.handlePackCardClick==="function" &&
                window.SuperpowerUI.handlePackCardClick(index,joker)
            ){
                return;
            }
            open(joker,index);
        };
        const delay=index<3 ? index*180 : 920+(index-3)*230;
        button.style.setProperty("--reveal-delay",`${delay}ms`);
        return button;
    }

    document.addEventListener("keydown",event=>{
        if(event.key==="Escape" && !ensureModal().hidden) close();
    });

    window.JokerV2UI={
        open,
        resolveForEffect,
        close,
        isBusy:()=>Boolean(state.resolving || state.effectResolver || !ensureModal().hidden),
        buildPackCardButton,
        getCriteria,
        getCriteriaGroups
    };

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",ensureModal,{once:true});
    }else{
        ensureModal();
    }
})();
