(function(global){
    "use strict";

    const VERSION = "87.1-bounty-hunters";
    const RIVER_SIZE = 7;
    const RIVER_ROUNDS = 12;
    const VARIANT_RUSHING = "rushing";
    const VARIANT_FADING = "fading";
    const JOKER_MODE_CONTROLLED = "controlled";
    const JOKER_MODE_CHANCE = "chance";
    const JOKER_INTERVALS = Object.freeze([5,7,10,15]);
    const JOKER_CHANCES = Object.freeze([10,20,35,50]);
    const FLOW_TIMING = Object.freeze({
        pick:430,
        escape:500,
        shift:390,
        enter:420,
        enterStagger:130,
        fade:620,
        rebirth:440,
        settle:90
    });
    const INCOMPATIBLE_IDS = [
        "enableCustomPacks",
        "enablePokerDraft"
    ];
    const INCOMPATIBLE_LABELS = Object.freeze({
        enableCustomPacks:"Custom Packi",
        enablePokerDraft:"Poker Draft"
    });

    const state = {
        active:false,
        variant:VARIANT_RUSHING,
        round:0,
        pickNumber:0,
        cards:[],
        drawQueue:[],
        escaped:[],
        faded:[],
        endRemainders:[],
        fadeAfterPicks:null,
        startedAt:null,
        isResolving:false,
        isFinishing:false,
        jokersEnabled:false,
        jokerMode:JOKER_MODE_CONTROLLED,
        jokerInterval:10,
        jokerChance:0.20,
        jokersGenerated:0
    };

    function checkbox(){
        return document.getElementById("enableGalacticCurrent");
    }

    function jokersCheckbox(){
        return document.getElementById("enableJokers");
    }

    function isJokerModeEnabled(){
        return Boolean(isActiveMode() && jokersCheckbox()?.checked);
    }

    function normalizeAllowedNumber(value,allowed,fallback){
        const number=Number(value);
        return allowed.includes(number) ? number : fallback;
    }

    function readGalacticJokerSettings(){
        const selected=document.querySelector('input[name="galacticJokerMode"]:checked');
        return {
            mode:selected?.value===JOKER_MODE_CHANCE ? JOKER_MODE_CHANCE : JOKER_MODE_CONTROLLED,
            interval:normalizeAllowedNumber(
                document.getElementById("galacticJokerInterval")?.value,
                JOKER_INTERVALS,
                10
            ),
            chance:normalizeAllowedNumber(
                document.getElementById("galacticJokerChance")?.value,
                JOKER_CHANCES,
                20
            ) / 100
        };
    }

    function updateGalacticJokerSettingsVisibility(){
        const modal=document.getElementById("jokerModal");
        if(!modal) return;
        const selected=document.querySelector('input[name="galacticJokerMode"]:checked');
        const mode=selected?.value===JOKER_MODE_CHANCE ? JOKER_MODE_CHANCE : JOKER_MODE_CONTROLLED;
        const controlled=document.getElementById("galacticJokerControlledPanel");
        const chance=document.getElementById("galacticJokerChancePanel");
        if(controlled) controlled.hidden=mode!==JOKER_MODE_CONTROLLED;
        if(chance) chance.hidden=mode!==JOKER_MODE_CHANCE;
        modal.querySelectorAll(".gc-joker-mode-card").forEach(card=>{
            const radio=card.querySelector('input[name="galacticJokerMode"]');
            card.classList.toggle("active",Boolean(radio?.checked));
        });
    }

    function bindGalacticJokerSettings(){
        const panel=document.getElementById("galacticJokerControlPanel");
        if(!panel || panel.dataset.bound==="true") return;
        panel.dataset.bound="true";
        panel.querySelectorAll('input[name="galacticJokerMode"]').forEach(radio=>{
            radio.addEventListener("change",updateGalacticJokerSettingsVisibility);
        });
        updateGalacticJokerSettingsVisibility();
    }

    function prepareJokerSettingsModal(){
        const modal=document.getElementById("jokerModal");
        if(!modal) return false;
        const currentMode=isActiveMode();
        modal.classList.toggle("gc-joker-settings",currentMode);
        const currentPanel=document.getElementById("galacticJokerControlPanel");
        if(currentPanel) currentPanel.hidden=!currentMode;
        const title=document.getElementById("jokerSettingsTitle");
        const subtitle=document.getElementById("jokerSettingsSubtitle");
        if(title) title.textContent=currentMode ? "JOKERY W GALAKTYCZNYM PRĄDZIE" : "JOKER SYSTEM";
        if(subtitle) subtitle.textContent=currentMode
            ? "Ustal rytm pojawiania się Jokerów wśród kart dopływających i odradzających się w nurcie."
            : "Skonfiguruj natężenie chaosu, typy Jokerów i sposób pojawiania się paczek.";
        bindGalacticJokerSettings();
        return currentMode;
    }

    function commitJokerSettings(){
        if(!isActiveMode()) return false;
        const settings=readGalacticJokerSettings();
        state.jokerMode=settings.mode;
        state.jokerInterval=settings.interval;
        state.jokerChance=settings.chance;
        if(typeof jokerSettings==="object" && jokerSettings){
            jokerSettings.enabled=true;
        }
        return true;
    }

    function variantPanel(){
        return document.getElementById("galacticCurrentVariantPanel");
    }

    function getConfiguredVariant(){
        const selected=document.querySelector('input[name="galacticCurrentVariant"]:checked');
        return selected?.value===VARIANT_FADING ? VARIANT_FADING : VARIANT_RUSHING;
    }

    function getVariant(){
        return state.active ? state.variant : getConfiguredVariant();
    }

    function isRushingVariant(){
        return getVariant()===VARIANT_RUSHING;
    }

    function isFadingVariant(){
        return getVariant()===VARIANT_FADING;
    }

    function variantLabel(variant=getVariant()){
        return variant===VARIANT_FADING ? "Wygasające Gwiazdy" : "Rwący Prąd";
    }

    /* PATCH87: Wygasające Gwiazdy dostają +1 pick żywotności
       na każdym progu, aby karta miała więcej czasu na dotarcie
       do kolejnych graczy przy siedmiokartowym nurcie. */
    function fadeLimitForPlayers(count=numPlayers){
        const playersCount=Math.max(1,Number(count)||1);
        if(playersCount<=6) return 7;
        if(playersCount<=8) return 8;
        if(playersCount<=10) return 9;
        return 10;
    }

    function currentFadeLimit(){
        return Number(state.fadeAfterPicks)||fadeLimitForPlayers();
    }

    function isActiveMode(){
        return Boolean(checkbox()?.checked);
    }

    function normalizeName(value){
        if(typeof normalizeBanText === "function") return normalizeBanText(value);
        return String(value||"").trim().toLowerCase();
    }

    function safeShuffle(items){
        const copy=[...items];
        if(typeof fisherYatesShuffle === "function") return fisherYatesShuffle(copy);
        for(let i=copy.length-1;i>0;i--){
            const j=Math.floor(Math.random()*(i+1));
            [copy[i],copy[j]]=[copy[j],copy[i]];
        }
        return copy;
    }

    function enforceCompatibility(options={}){
        if(!isActiveMode()) return;
        const disabled=[];
        INCOMPATIBLE_IDS.forEach(id=>{
            const input=document.getElementById(id);
            if(!input) return;
            if(input.checked) disabled.push(INCOMPATIBLE_LABELS[id]||id);
            input.checked=false;
        });
        if(disabled.length && options.notify!==false){
            showToast(`GWIEZDNY PRĄD WYŁĄCZA: ${disabled.join(" • ")}`);
        }
        if(options.refresh!==false){
            updateModePreview?.();
        }
    }

    function syncLobbyVisuals(){
        const active=isActiveMode();
        const option=document.querySelector(".galacticCurrentModeOption");
        const panel=variantPanel();
        option?.classList.toggle("is-active",active);
        option?.classList.toggle("is-locked-note",active);
        if(panel) panel.hidden=!active;
        if(active) enforceCompatibility({refresh:false});
        updateModePreview?.();
    }

    function buildLegalQueue(){
        const bans=new Set((bannedCards||[]).map(normalizeName));
        const seen=new Set();
        const legal=(Array.isArray(cardDatabase)?cardDatabase:[]).filter(card=>{
            const name=String(card?.name||"").trim();
            const key=normalizeName(name);
            if(!name || !key || bans.has(key) || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        return safeShuffle(legal);
    }

    function getLiveJokerIds(){
        return state.cards
            .filter(card=>card?.joker && card?.id)
            .map(card=>card.id);
    }

    function createRiverJoker(slotIndex,generationKind="flow"){
        if(typeof getRandomJoker!=="function") return null;
        const definition=getRandomJoker(getLiveJokerIds());
        if(!definition) return null;
        const source={joker:true,...definition};
        const card=typeof createDraftCardInstance==="function"
            ? createDraftCardInstance(source,{
                origin:"galactic_current_joker",
                sourceEvent:"river_joker_draw",
                forceNew:true
            })
            : {...source};
        card.instanceMeta={
            ...(card.instanceMeta||{}),
            riverEnteredAtPick:state.pickNumber,
            riverEnteredAtRound:state.round,
            riverSurvivalCount:0,
            riverAge:0,
            riverSlot:Number.isInteger(slotIndex)?slotIndex:null,
            riverVariant:state.variant,
            riverSource:"galactic_current",
            riverGeneratedAsJoker:true,
            riverJokerGenerationKind:generationKind,
            riverJokerTriggerMode:state.jokerMode,
            riverJokerTriggerPick:state.pickNumber
        };
        state.jokersGenerated++;
        logRiver("galactic_current_joker_generated",{
            sourceCard:card,
            data:{
                jokerId:card.id||null,
                jokerType:card.type||null,
                jokerRarity:card.rarity||null,
                slot:Number.isInteger(slotIndex)?slotIndex:null,
                generationKind,
                triggerMode:state.jokerMode,
                triggerInterval:state.jokerMode===JOKER_MODE_CONTROLLED?state.jokerInterval:null,
                triggerChance:state.jokerMode===JOKER_MODE_CHANCE?state.jokerChance:null
            }
        });
        return card;
    }

    function drawCard(slotIndex=null,options={}){
        /* Joker zastępuje normalnie dobraną kartę, dlatego slot nadal zużywa
           jeden element legalnej kolejki — identycznie jak podmiana w Classicu. */
        const template=state.drawQueue.pop();
        if(!template) return null;
        if(options.joker===true){
            const joker=createRiverJoker(slotIndex,options.generationKind||"flow");
            if(joker) return joker;
        }

        let resolvedTemplate=template;
        if(window.LuckyCards?.isEnabled?.()){
            const boost=window.LuckyCards.pickCurrentBoost({
                normalTemplate:template,
                liveCards:state.cards.filter(Boolean),
                pickNumber:state.pickNumber,
                playerCount:numPlayers,
                bannedCards:[...(bannedCards||[])]
            });
            if(boost?.card){
                const luckyKey=normalizeName(boost.card.name);
                const canonicalIndex=state.drawQueue.findIndex(card=>normalizeName(card?.name)===luckyKey);
                if(canonicalIndex>=0){
                    // Zachowaj rozmiar kolejki: Lucky zajmuje bieżący slot,
                    // a wyparta zwykła karta przechodzi w miejsce kanonicznego Lucky.
                    state.drawQueue[canonicalIndex]=template;
                }
                resolvedTemplate=boost.card;
            }
        }

        const card=typeof createDraftCardInstance === "function"
            ? createDraftCardInstance(resolvedTemplate,{
                origin:"galactic_current",
                sourceEvent:"river_draw",
                forceNew:true
            })
            : {...resolvedTemplate};
        card.instanceMeta={
            ...(card.instanceMeta||{}),
            riverEnteredAtPick:state.pickNumber,
            riverEnteredAtRound:state.round,
            riverSurvivalCount:0,
            riverAge:0,
            riverSlot:Number.isInteger(slotIndex)?slotIndex:null,
            riverVariant:state.variant,
            riverSource:"galactic_current"
        };
        window.LuckyCards?.recordCurrentCard?.(card,{
            pickNumber:state.pickNumber,
            playerCount:numPlayers
        });
        return card;
    }

    function planJokerForGeneratedCards(totalCards){
        const count=Math.max(0,Number(totalCards)||0);
        if(!state.jokersEnabled || count<1 || state.pickNumber<1) return -1;
        const triggered=state.jokerMode===JOKER_MODE_CHANCE
            ? Math.random()<state.jokerChance
            : state.pickNumber%state.jokerInterval===0;
        return triggered ? Math.floor(Math.random()*count) : -1;
    }

    function refreshRiverSlots(){
        state.cards.forEach((card,slot)=>{
            if(!card) return;
            card.instanceMeta=card.instanceMeta||{};
            card.instanceMeta.riverSlot=slot;
        });
    }

    function fillRiver(targetSize=RIVER_SIZE){
        while(state.cards.length<targetSize){
            const card=drawCard(state.cards.length);
            if(!card) break;
            state.cards.push(card);
        }
        refreshRiverSlots();
        currentPack=state.cards.filter(Boolean);
    }

    /* PATCH70: Galaktyczny Prąd korzysta z jednej stałej, zapętlonej
       kolejki. Po ostatnim graczu wracamy do pierwszego bez snake'a,
       odwracania kierunku ani rotowania startera między obiegami. */
    function setupRiverPickOrder(){
        pickOrder=[];
        for(let playerIndex=0;playerIndex<numPlayers;playerIndex++){
            pickOrder.push(playerIndex);
        }
        currentPickIndex=0;
        packStartIndex=0;
    }

    /* PATCH69: warstwowa plansza prądu.
       Segmenty są placeholderami CSS gotowymi do późniejszej zamiany na PNG/WebP. */
    function ensureBoardLayers(){
        const stage=document.getElementById("packStage");
        const pack=document.getElementById("pack");
        if(!stage || !pack) return null;

        let board=document.getElementById("galacticCurrentBoard");
        if(!board){
            board=document.createElement("div");
            board.id="galacticCurrentBoard";
            board.className="gc-board";
            board.setAttribute("aria-hidden","true");

            const viewport=document.createElement("div");
            viewport.className="gc-current-viewport";

            const base=document.createElement("div");
            base.className="gc-current-base";

            const track=document.createElement("div");
            track.className="gc-current-track";
            ["a","b","c","a","b","c"].forEach((kind,index)=>{
                const tile=document.createElement("span");
                tile.className=`gc-flow-tile gc-flow-tile-${kind}`;
                tile.dataset.tile=kind.toUpperCase();
                tile.dataset.sequence=String(index);
                track.appendChild(tile);
            });

            const sheen=document.createElement("div");
            sheen.className="gc-current-sheen";

            viewport.append(base,track,sheen);

            const drift=document.createElement("div");
            drift.className="gc-drift-layer";
            const objects=[
                ["rock","one"],["cardback","one"],["rock","two"],
                ["spark","one"],["cardback","two"],["rock","three"],
                ["spark","two"],["rock","four"]
            ];
            objects.forEach(([type,variant])=>{
                const object=document.createElement("span");
                object.className=`gc-drift-object gc-${type} gc-${type}-${variant}`;
                if(type==="cardback"){
                    const mark=document.createElement("i");
                    mark.textContent="✦";
                    object.appendChild(mark);
                }
                drift.appendChild(object);
            });

            /* PATCH97A: prawdziwe assety korzystają z TEJ SAMEJ warstwy co
               canonical debris, więc nigdy nie wychodzą wizualnie poza nurt. */
            const realAssets=[
                {kind:"card", variants:["draft-assets/cosmic_cardback.webp","draft-assets/cosmic_cardback_alt_a.webp","draft-assets/cosmic_cardback_alt_b.webp","draft-assets/cosmic_cardback_alt_c.webp"]},
                {kind:"card", variants:["draft-assets/cosmic_cardback.webp","draft-assets/cosmic_cardback_alt_a.webp","draft-assets/cosmic_cardback_alt_b.webp","draft-assets/cosmic_cardback_alt_c.webp"]},
                {kind:"card", variants:["draft-assets/cosmic_cardback.webp","draft-assets/cosmic_cardback_alt_a.webp","draft-assets/cosmic_cardback_alt_b.webp","draft-assets/cosmic_cardback_alt_c.webp"]},
                {kind:"asteroid", variants:["draft-assets/cosmic_asteroid.webp","draft-assets/cosmic_asteroid_brown.webp","draft-assets/cosmic_asteroid_purple.webp","draft-assets/cosmic_asteroid_crystal.webp"]},
                {kind:"asteroid", variants:["draft-assets/cosmic_asteroid.webp","draft-assets/cosmic_asteroid_brown.webp","draft-assets/cosmic_asteroid_purple.webp","draft-assets/cosmic_asteroid_crystal.webp"]},
                {kind:"asteroid", variants:["draft-assets/cosmic_asteroid.webp","draft-assets/cosmic_asteroid_brown.webp","draft-assets/cosmic_asteroid_purple.webp","draft-assets/cosmic_asteroid_crystal.webp"]},
                {kind:"star", variants:["draft-assets/cosmic_twinkle_star.png"]}
            ];
            const rand=(min,max)=>min+Math.random()*(max-min);
            const CURRENT_LANES=[35,42,49,56,63];
            const lanePick=(index)=>CURRENT_LANES[index % CURRENT_LANES.length] + rand(-1.4,1.4);
            const pickVariant=(variants)=>variants[Math.floor(Math.random()*variants.length)];
            const randomizeRealAsset=(asset,initial=false)=>{
                const kind=asset.dataset.kind;
                const idx=Number(asset.dataset.sceneIndex||0);
                const isCard=kind==="card";
                const isAsteroid=kind==="asteroid";
                const isStar=kind==="star";
                const variants=(asset.dataset.variants||"").split("|").filter(Boolean);
                if(variants.length) asset.src=pickVariant(variants);
                const size=isCard ? rand(28,42) : isAsteroid ? rand(24,40) : rand(16,24);
                const y=lanePick(idx + Math.floor(rand(0,2)));
                const r1=isCard ? rand(-18,18) : isAsteroid ? rand(-25,25) : rand(-10,10);
                const spin=isCard ? rand(-60,60) : isAsteroid ? rand(-155,155) : rand(-24,24);
                asset.style.setProperty("--gc-size",size.toFixed(1)+"px");
                asset.style.setProperty("--gc-y",y.toFixed(1)+"%");
                asset.style.setProperty("--gc-op",(isStar ? rand(.44,.86) : rand(.42,.72)).toFixed(2));
                asset.style.setProperty("--gc-r1",r1.toFixed(1)+"deg");
                asset.style.setProperty("--gc-rm",(r1+spin*.48).toFixed(1)+"deg");
                asset.style.setProperty("--gc-r2",(r1+spin).toFixed(1)+"deg");
                asset.style.setProperty("--gc-mid-y",(isStar ? rand(-6,6) : rand(-9,9)).toFixed(1)+"px");
                asset.style.setProperty("--gc-end-y",(isStar ? rand(-8,8) : rand(-12,12)).toFixed(1)+"px");
                const dur=isStar ? rand(10,16) : rand(14,22);
                asset.style.setProperty("--gc-dur",dur.toFixed(1)+"s");
                asset.style.setProperty("--gc-delay",initial ? (-rand(0,dur)).toFixed(1)+"s" : "0s");
            };
            realAssets.forEach((spec,index)=>{
                const asset=document.createElement("img");
                asset.src=pickVariant(spec.variants);
                asset.alt="";
                asset.className=`gc-scene-asset gc-scene-asset--${spec.kind}`;
                asset.dataset.kind=spec.kind;
                asset.dataset.sceneIndex=String(index);
                asset.dataset.variants=spec.variants.join("|");
                randomizeRealAsset(asset,true);
                asset.addEventListener("animationiteration",()=>randomizeRealAsset(asset,false));
                drift.appendChild(asset);
            });

            board.append(viewport,drift);
            stage.insertBefore(board,pack);
        }

        board.dataset.variant=state.variant;
        board.hidden=false;
        return board;
    }

    function removeBoardLayers(){
        document.getElementById("galacticCurrentBoard")?.remove();
    }

    let detachedGhostSyncFrame=0;

    function ensureDetachedGhostStages(){
        const host=document.getElementById("packStage");
        if(!host) return {under:null,over:null};

        let under=document.getElementById("gcDetachedGhostStageUnder");
        if(!under){
            under=document.createElement("div");
            under.id="gcDetachedGhostStageUnder";
            under.className="gc-detached-ghost-stage is-under";
            under.setAttribute("aria-hidden","true");
        }
        if(under.parentElement!==host) host.appendChild(under);

        let over=document.getElementById("gcDetachedGhostStageOver");
        if(!over){
            over=document.createElement("div");
            over.id="gcDetachedGhostStageOver";
            over.className="gc-detached-ghost-stage is-over";
            over.setAttribute("aria-hidden","true");
        }
        if(over.parentElement!==host) host.appendChild(over);

        return { under, over };
    }

    function stopDetachedGhostSync(){
        if(detachedGhostSyncFrame){
            cancelAnimationFrame(detachedGhostSyncFrame);
            detachedGhostSyncFrame=0;
        }
    }

    function clearDetachedGhostStage(){
        document.getElementById("gcDetachedGhostStageUnder")?.replaceChildren();
        document.getElementById("gcDetachedGhostStageOver")?.replaceChildren();
        stopDetachedGhostSync();
    }

    function syncDetachedGhostPositions(){
        const host=document.getElementById("packStage");
        if(!host) return;
        const hostRect=host.getBoundingClientRect();
        document.querySelectorAll(".gc-detached-ghost-layer[data-gc-anchor]").forEach(layer=>{
            const key=layer.dataset.gcAnchor;
            const button=[...document.querySelectorAll('#pack .river-card')]
                .find(card=>card.dataset.gcInstanceId===key);
            if(!button){
                layer.remove();
                return;
            }
            const rect=button.getBoundingClientRect();
            layer.style.left=`${rect.left-hostRect.left+host.scrollLeft}px`;
            layer.style.top=`${rect.top-hostRect.top+host.scrollTop}px`;
            layer.style.width=`${rect.width}px`;
            layer.style.height=`${rect.height}px`;
        });
    }

    function startDetachedGhostSync(){
        if(detachedGhostSyncFrame) return;
        const tick=()=>{
            detachedGhostSyncFrame=0;
            if(!state.active || state.isResolving) return;
            const hasGhosts=document.querySelector(".gc-detached-ghost-layer[data-gc-anchor]");
            if(!hasGhosts) return;
            syncDetachedGhostPositions();
            detachedGhostSyncFrame=requestAnimationFrame(tick);
        };
        detachedGhostSyncFrame=requestAnimationFrame(tick);
    }

    function buildDetachedGhost(button,variant){
        const stages=ensureDetachedGhostStages();
        if(!stages.under || !stages.over) return;
        const anchor=String(button.dataset.gcInstanceId||"");
        if(!anchor) return;

        const appendLayer=(kind,isUnder)=>{
            const layer=document.createElement("div");
            layer.className=`gc-detached-ghost-layer ${kind} ${isUnder?"is-under":"is-over"}`;
            layer.dataset.gcAnchor=anchor;
            const clone=button.cloneNode(true);
            clone.className=`${button.className} gc-detached-ghost-card`;
            clone.classList.remove("river-escaping","river-next-warning","gc-is-picked","gc-is-escaping-left","gc-is-fading","gc-is-reborn");
            clone.removeAttribute("id");
            clone.disabled=true;
            clone.removeAttribute("onclick");
            clone.querySelectorAll(".river-age-badge,.gc-card-status-fx,.gc-card-ghost").forEach(node=>node.remove());
            clone.querySelectorAll("[id]").forEach(node=>node.removeAttribute("id"));
            layer.appendChild(clone);
            (isUnder?stages.under:stages.over).appendChild(layer);
        };
        appendLayer(variant+"-under",true);
        appendLayer(variant+"-over",false);
        syncDetachedGhostPositions();
        startDetachedGhostSync();
    }

    function prepareStage(){
        document.body.classList.add("galactic-current-mode");
        document.body.classList.toggle("galactic-current-rushing",state.variant===VARIANT_RUSHING);
        document.body.classList.toggle("galactic-current-fading",state.variant===VARIANT_FADING);
        const stage=document.getElementById("packStage");
        ensureBoardLayers();
        if(stage){
            stage.classList.remove("draft-finished","next-transition");
            stage.classList.add("opened");
            stage.setAttribute("data-layout","river");
            stage.setAttribute("data-pack-type","river");
            stage.setAttribute("data-river-variant",state.variant);
        }
        const packDiv=document.getElementById("pack");
        if(packDiv) packDiv.style.display="";
        const intro=document.getElementById("packIntro");
        if(intro) intro.style.display="none";
        const banner=document.getElementById("currentPickerBanner");
        if(banner) banner.style.display="block";
        const queueTitle=document.querySelector(".info-panel .panel-title");
        if(queueTitle) queueTitle.textContent="KOLEJKA PRĄDU";
        packIsOpen=true;
        packOpeningInProgress=false;
        packEnding=false;
    }

    function decorateCards(){
        if(!state.active){
            clearDetachedGhostStage();
            return;
        }
        const packDiv=document.getElementById("pack");
        if(!packDiv) return;
        packDiv.classList.add("galactic-current-cards");
        packDiv.classList.toggle("gc-is-resolving",state.isResolving);
        clearDetachedGhostStage();
        [...packDiv.children].forEach((button,index)=>{
            const card=state.cards[index];
            if(!card) return;
            const age=Number(card?.instanceMeta?.riverAge ?? card?.instanceMeta?.riverSurvivalCount ?? 0);
            const fadeLimit=currentFadeLimit();
            const isRushing=state.variant===VARIANT_RUSHING;
            const isFading=state.variant===VARIANT_FADING;
            const burnRatio=fadeLimit>0 ? Math.min(1,age/fadeLimit) : 0;
            const burnStage=!isFading || age<=0
                ? 0
                : burnRatio<.38
                    ? 1
                    : burnRatio<.62
                        ? 2
                        : age<fadeLimit-1
                            ? 3
                            : 4;

            button.classList.add("river-card");
            button.dataset.riverSlot=String(index);
            button.dataset.gcInstanceId=String(card.instanceId||card.id||card.name||index);
            button.dataset.gcCardName=String(card.name||"");
            button.dataset.gcBurnStage=String(burnStage);
            button.classList.toggle("river-escaping",isRushing && index===0 && !isSpiderAnchored(card));
            button.classList.toggle("river-next-warning",isRushing && index===1);
            button.classList.toggle("river-aging",isFading && age>=Math.max(2,fadeLimit-3));
            button.classList.toggle("river-fading-soon",isFading && age>=fadeLimit-1);
            button.classList.toggle("river-fresh",age===0);
            for(let stage=1;stage<=4;stage++){
                button.classList.toggle(`gc-burn-stage-${stage}`,isFading && burnStage===stage);
            }
            button.disabled=state.isResolving;
            button.setAttribute("aria-busy",state.isResolving?"true":"false");
            if(card.joker){
                button.onclick=event=>{
                    event?.preventDefault?.();
                    event?.stopPropagation?.();
                    if(
                        window.GrootUI?.isBusy?.() &&
                        window.GrootUI?.handlePackCardClick?.(index,card)
                    ){
                        return;
                    }
                    pick(index);
                };
            }

            button.querySelectorAll(":scope > .river-age-badge, :scope > .gc-card-status-fx").forEach(node=>node.remove());

            const statusFx=document.createElement("span");
            statusFx.className="gc-card-status-fx";
            statusFx.setAttribute("aria-hidden","true");
            button.appendChild(statusFx);

            let badgeText="";
            let badgeKind="";
            let badgeLabel="";

            if(isRushing){
                if(index===0){
                    badgeText="←";
                    badgeKind="escape";
                    badgeLabel="Karta na ujściu prądu — odpłynie, jeżeli nie zostanie wybrana.";
                }else if(age===0 && index>=Math.max(0,state.cards.length-2)){
                    badgeText="✦";
                    badgeKind="fresh";
                    badgeLabel="Świeżo dopłynięta karta.";
                }
            }else if(isFading){
                if(age===0){
                    badgeText="✦";
                    badgeKind="fresh";
                    badgeLabel="Świeżo narodzona gwiazda.";
                }else if(age>=fadeLimit-1){
                    badgeText="GAŚNIE";
                    badgeKind="critical";
                    badgeLabel=`Gwiazda wygaśnie po kolejnym pominięciu. Wiek ${age} z ${fadeLimit}.`;
                }else{
                    badgeText=`✦ ${age}/${fadeLimit}`;
                    badgeKind=burnStage>=3?"hot":"age";
                    badgeLabel=`Wiek gwiazdy: ${age} z ${fadeLimit}.`;
                }
            }

            if(badgeText){
                const badge=document.createElement("span");
                badge.className=`river-age-badge gc-status-${badgeKind}`;
                badge.textContent=badgeText;
                badge.title=badgeLabel;
                badge.setAttribute("aria-hidden","true");
                button.appendChild(badge);
            }

            if(isRushing && index===0 && !state.isResolving){
                buildDetachedGhost(button,"is-primary");
            }
        });
    }

    function showToast(message,type="normal"){
        let toast=document.getElementById("galacticCurrentToast");
        if(!toast){
            toast=document.createElement("div");
            toast.id="galacticCurrentToast";
            toast.className="galactic-current-toast";
            document.body.appendChild(toast);
        }
        toast.textContent=message;
        toast.classList.toggle("is-escape",type==="escape");
        toast.classList.toggle("is-fade",type==="fade");
        toast.classList.toggle("is-pick",type==="pick");
        toast.classList.remove("is-visible");
        void toast.offsetWidth;
        toast.classList.add("is-visible");
        clearTimeout(showToast.timer);
        showToast.timer=setTimeout(()=>toast.classList.remove("is-visible"),1500);
    }

    function wait(ms){
        return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));
    }

    function nextFrame(){
        return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }

    function cardKey(card){
        return String(card?.instanceId||card?.id||card?.name||"");
    }

    function isSpiderAnchored(card){
        return Boolean(window.isSpiderManReservationAnchored?.(card));
    }

    function getCardElement(cardOrKey){
        const key=typeof cardOrKey==="string" ? cardOrKey : cardKey(cardOrKey);
        if(!key) return null;
        return [...document.querySelectorAll('#pack .river-card')]
            .find(element=>element.dataset.gcInstanceId===key)||null;
    }

    function captureCardPositions(cards=state.cards){
        const positions=new Map();
        cards.filter(Boolean).forEach(card=>{
            const element=getCardElement(card);
            if(!element) return;
            positions.set(cardKey(card),element.getBoundingClientRect());
        });
        return positions;
    }

    function setResolving(active){
        state.isResolving=Boolean(active);
        if(state.isResolving) clearDetachedGhostStage();
        document.body.classList.toggle("galactic-current-resolving",state.isResolving);
        const pack=document.getElementById("pack");
        pack?.classList.toggle("gc-is-resolving",state.isResolving);
        pack?.querySelectorAll(".river-card").forEach(button=>{
            button.disabled=state.isResolving;
            button.setAttribute("aria-busy",state.isResolving?"true":"false");
        });
        if(!state.isResolving && state.active){
            requestAnimationFrame(()=>{
                decorateCards();
                syncDetachedGhostPositions();
            });
        }
    }

    async function animateExistingCard(card,className,duration){
        const element=getCardElement(card);
        if(!element){
            await wait(duration);
            return;
        }
        element.classList.add(className);
        element.setAttribute("aria-hidden","true");
        await wait(duration);
    }

    async function renderFlowTransition(oldPositions,{enteringCards=[],rebornCards=[]}={}){
        render();
        const moving=[];
        state.cards.filter(Boolean).forEach(card=>{
            const element=getCardElement(card);
            if(!element) return;
            const previous=oldPositions.get(cardKey(card));
            if(previous){
                const current=element.getBoundingClientRect();
                const dx=previous.left-current.left;
                const dy=previous.top-current.top;
                if(Math.abs(dx)>.5 || Math.abs(dy)>.5){
                    element.style.setProperty("--gc-flip-x",`${dx}px`);
                    element.style.setProperty("--gc-flip-y",`${dy}px`);
                    element.classList.add("gc-flow-from-old");
                    moving.push(element);
                }
            }
        });

        enteringCards.filter(Boolean).forEach((card,index)=>{
            const element=getCardElement(card);
            if(!element) return;
            element.style.setProperty("--gc-enter-delay",`${index*FLOW_TIMING.enterStagger}ms`);
            element.classList.add("gc-is-entering-right");
        });
        rebornCards.filter(Boolean).forEach(card=>{
            getCardElement(card)?.classList.add("gc-is-reborn");
        });

        await nextFrame();
        moving.forEach(element=>element.classList.add("gc-flow-to-new"));
        const enterDuration=enteringCards.length
            ? FLOW_TIMING.enter+(Math.max(0,enteringCards.length-1)*FLOW_TIMING.enterStagger)
            : 0;
        await wait(Math.max(FLOW_TIMING.shift,enterDuration,rebornCards.length?FLOW_TIMING.rebirth:0)+FLOW_TIMING.settle);
    }

    function archiveRiverCard(category,card,metadata={}){
        if(!card) return null;
        const naturalHarvest=category==="riverEscaped"||category==="riverFaded";
        window.GrootUI?.harvestCard?.(card,category,{
            natural:naturalHarvest,
            perfectEligible:naturalHarvest,
            mode:"current",
            riverVariant:state.variant
        });
        if(category==="riverEscaped") state.escaped.push(card);
        if(category==="riverFaded") state.faded.push(card);
        if(category==="riverEndRemainder") state.endRemainders.push(card);
        if(typeof archiveCardToGraveyard === "function"){
            return archiveCardToGraveyard(category,card,{
                source:category,
                packNumber:state.round+1,
                pickIndex:state.pickNumber,
                recoverable:true,
                metadata:{
                    draftMode:"galactic_current",
                    riverVariant:state.variant,
                    riverRound:state.round+1,
                    riverPickNumber:state.pickNumber,
                    riverSlot:Number(card?.instanceMeta?.riverSlot ?? -1),
                    riverAge:Number(card?.instanceMeta?.riverAge ?? card?.instanceMeta?.riverSurvivalCount ?? 0),
                    riverSurvivalCount:Number(card?.instanceMeta?.riverSurvivalCount||0),
                    ...metadata
                }
            });
        }
        return null;
    }

    function logRiver(type,payload={}){
        window.DraftStateEngine?.log?.(type,{
            packNumber:state.round+1,
            pickIndex:state.pickNumber,
            playerIndex:Number.isInteger(payload.playerIndex)?payload.playerIndex:null,
            player:Number.isInteger(payload.playerIndex)?players[payload.playerIndex]:null,
            sourceCard:payload.sourceCard||null,
            resultCard:payload.resultCard||null,
            reason:payload.reason||type,
            data:{
                draftMode:"galactic_current",
                riverVariant:state.variant,
                riverRound:state.round+1,
                riverPickNumber:state.pickNumber,
                ...payload.data
            }
        });
    }

    function render(){
        prepareStage();
        currentPack=state.cards.filter(Boolean);
        showPack(false);
        showDecks();
        updateRoundQueueDisplay();
        updateInfoPanel();
    }

    function openBountyRoundForCurrentOrbit(){
        const result=window.BountyEngine?.onGalacticOrbitStarted?.({
            round:state.round+1,
            cards:state.cards.filter(Boolean),
            pickIndex:state.pickNumber
        })||null;
        return result;
    }

    function advanceBountyAging(){
        return window.BountyEngine?.onTableAdvanced?.({
            mode:"galactic_current",
            cards:state.cards.filter(Boolean),
            tableKey:"galactic_current",
            initialCardCount:RIVER_SIZE,
            packNumber:state.round+1,
            pickIndex:state.pickNumber,
            remainingPicks:Math.max(0,(RIVER_ROUNDS*numPlayers)-state.pickNumber)
        })||null;
    }

    async function finish(){
        if(state.isFinishing) return;
        state.isFinishing=true;
        state.isResolving=true;
        syncResolvingState();
        clearDetachedGhostStage();
        document.getElementById("galacticCurrentToast")?.classList.remove("is-visible");

        const stage=document.getElementById("packStage");
        document.body.classList.add("gc-current-finishing");
        stage?.classList.add("gc-current-finishing");

        let veil=document.getElementById("gcCurrentFinishVeil");
        if(!veil){
            veil=document.createElement("div");
            veil.id="gcCurrentFinishVeil";
            veil.className="gc-current-finish-veil";
            veil.setAttribute("aria-hidden","true");
            document.body.appendChild(veil);
        }
        requestAnimationFrame(()=>veil.classList.add("is-active"));

        /* Najpierw cały Gwiezdny Prąd odpływa i zamyka się w kosmicznym fadem. */
        await wait(720);

        state.cards.filter(Boolean).forEach(card=>archiveRiverCard("riverEndRemainder",card,{
            reason:"draft_finished"
        }));
        state.cards=[];
        currentPack=[];
        logRiver("galactic_current_finished",{
            data:{
                variant:state.variant,
                escapedCount:state.escaped.length,
                fadedCount:state.faded.length,
                endRemainderCount:state.endRemainders.length,
                deckSizes:decks.map(deck=>deck.length)
            }
        });

        /* Wizualnie zamykamy tryb przed pokazaniem standardowej, wycentrowanej sceny końca. */
        document.body.classList.remove(
            "galactic-current-mode",
            "galactic-current-rushing",
            "galactic-current-fading",
            "galactic-current-resolving",
            "gc-current-finishing"
        );
        stage?.removeAttribute("data-river-variant");
        removeBoardLayers();
        document.getElementById("gcDetachedGhostStageUnder")?.remove();
        document.getElementById("gcDetachedGhostStageOver")?.remove();

        /* Gwiezdny Prąd zamyka własny stół, ale od tego miejsca korzysta z tego
           samego finałowego pipeline'u co Classic: Collector / finalne moce /
           Save & Steal / Planetarna Rezerwa. */
        syncResolvingState();
        if(typeof preparePendingDraftFinish==="function") preparePendingDraftFinish({prepared:true,source:"galactic_current"});
        else {
            showDraftFinishedScene({prepared:true});
            window.continuePostDraftAfterGrootGardens?.();
        }
        state.active=false;
        state.isResolving=false;
        window.GrootUI?.onCurrentResolutionComplete?.({variant:state.variant,round:state.round,pickNumber:state.pickNumber,final:true});

        await wait(260);
        stage?.classList.remove("gc-current-finishing");
        document.body.classList.remove("gc-current-finishing");
        veil?.classList.remove("is-active");
        setTimeout(()=>veil?.remove(),320);
        state.isFinishing=false;
    }

    function advance(){
        if(decks.every(deck=>deck.length>=DRAFT_DECK_SIZE)){
            finish();
            return;
        }

        let bountyRound=null;
        currentPickIndex++;
        if(currentPickIndex>=pickOrder.length){
            state.round++;
            if(state.round>=RIVER_ROUNDS){
                finish();
                return;
            }
            /* Stały cykl: ostatni gracz przekazuje ruch pierwszemu. */
            currentPickIndex=0;
            if(window.GrootUI?.applyPendingQueueShift){
                players.forEach(playerName=>window.GrootUI.applyPendingQueueShift(playerName,{fromIndex:0}));
            }
            // Economy: Skok Nadświetlny kupiony pod kolejny obieg realizuje się na świeżej kolejce.
            window.EconomyEngine?.applyPendingMomentumForCurrentQueue?.({fresh:true});
            bountyRound=openBountyRoundForCurrentOrbit();
            showToast(`OBIEG ${state.round+1}/${RIVER_ROUNDS} • PRĄD PŁYNIE DALEJ`);
        }
        render();
        if(bountyRound?.triggered){
            window.BountyEngine?.decoratePack?.(state.cards.filter(Boolean));
            window.BountyEngine?.announceRound?.(bountyRound);
        }
    }

    function recordRiverPick(playerIndex,sourceCard,resultCard,index,data={}){
        const {packSnapshotBeforePick=null,...eventData}=data&&typeof data==="object"?data:{};
        recordDraftPickEvent?.(
            playerIndex,
            resultCard||sourceCard,
            index,
            sourceCard?.joker ? "joker" : "galactic_current",
            {
                sourceCard,
                resultCard:resultCard||sourceCard,
                data:{
                    riverVariant:state.variant,
                    riverRound:state.round+1,
                    riverPickNumber:state.pickNumber,
                    resolvedFromJoker:Boolean(sourceCard?.joker),
                    ...eventData
                },
                questContext:{packSnapshotBeforePick,pickedPackIndex:index}
            }
        );
    }

    function resolveRiverJoker(sourceJoker,playerIndex){
        return new Promise(resolve=>{
            if(!window.JokerV2UI || typeof window.JokerV2UI.resolveForEffect!=="function"){
                alert("Moduł Jokerów nie jest gotowy.");
                resolve(null);
                return;
            }
            let settled=false;
            const finish=value=>{
                if(settled) return;
                settled=true;
                resolve(value);
            };
            const opened=window.JokerV2UI.resolveForEffect(sourceJoker,{
                playerIndex,
                sourceZone:"galactic_current",
                sourceEvent:"galactic_current_joker_pick",
                onResolve:(resolvedCard,payload)=>finish({resolvedCard,payload}),
                onCancel:()=>finish(null)
            });
            if(!opened) finish(null);
        });
    }

    function finalizeRiverJokerResolution(sourceJoker,resolvedCard,playerIndex){
        if(!sourceJoker?.joker || !resolvedCard) return [];
        resolvedCard.instanceMeta={
            ...(resolvedCard.instanceMeta||{}),
            draftedInMode:"galactic_current",
            draftedInRiverVariant:state.variant,
            draftedAtRiverPick:state.pickNumber+1,
            fulfilledFromRiverJokerInstanceId:sourceJoker.instanceId||null
        };
        const rejectedEntries=typeof window.archivePendingJokerRejections==="function"
            ? window.archivePendingJokerRejections(resolvedCard,{
                source:"surprise_joker_rejected",
                resolutionPath:"galactic_current_joker_pick",
                metadata:{
                    draftMode:"galactic_current",
                    riverVariant:state.variant,
                    riverPickNumber:state.pickNumber+1,
                    playerIndex
                }
            })
            : [];
        window.jokerLog=Array.isArray(window.jokerLog)?window.jokerLog:[];
        window.jokerLog.push({
            event:"galactic_current_joker_resolved",
            jokerId:sourceJoker.id||null,
            jokerName:sourceJoker.name||null,
            jokerType:sourceJoker.type||null,
            jokerRarity:sourceJoker.rarity||null,
            sourceJokerInstanceId:sourceJoker.instanceId||null,
            resultCardInstanceId:resolvedCard.instanceId||null,
            playerIndex,
            playerName:players?.[playerIndex]||null,
            card:resolvedCard.name||null,
            rejectedCards:rejectedEntries.map(entry=>entry?.card?.name).filter(Boolean),
            riverVariant:state.variant,
            riverPickNumber:state.pickNumber+1,
            timestamp:new Date().toISOString()
        });
        logRiver("galactic_current_joker_resolved",{
            playerIndex,
            sourceCard:sourceJoker,
            resultCard:resolvedCard,
            data:{
                jokerId:sourceJoker.id||null,
                jokerType:sourceJoker.type||null,
                jokerRarity:sourceJoker.rarity||null,
                rejectedCount:rejectedEntries.length,
                rejectedCards:rejectedEntries.map(entry=>entry?.card?.name).filter(Boolean)
            }
        });
        return rejectedEntries;
    }

    async function pickRushing(index,playerIndex,pickedCard,resultCard=pickedCard){
        const questPackSnapshotBeforePick=window.DraftQuestEngine?.capturePackSnapshot?.(state.cards.filter(Boolean))||null;
        const pickedOldest=index===0;
        const escapedCard=!pickedOldest
            ? (state.cards.find((card,slot)=>card && slot!==index && !isSpiderAnchored(card))||null)
            : null;

        window.GrootUI?.harvestCard?.(pickedCard,"picked",{
            natural:false,perfectEligible:false,mode:"current",riverVariant:state.variant,playerIndex
        });
        await animateExistingCard(pickedCard,"gc-is-picked",FLOW_TIMING.pick);
        if(escapedCard){
            await wait(80);
            await animateExistingCard(escapedCard,"gc-is-escaping-left",FLOW_TIMING.escape);
        }

        const removedKeys=new Set([cardKey(pickedCard),cardKey(escapedCard)]);
        const survivors=state.cards.filter(card=>card && !removedKeys.has(cardKey(card)));
        const oldPositions=captureCardPositions(survivors);

        decks[playerIndex].push(resultCard);
        window.consumeProfessorXControl?.(playerIndex,resultCard);
        state.cards.splice(index,1);
        if(escapedCard){
            const escapedIndex=state.cards.findIndex(card=>cardKey(card)===cardKey(escapedCard));
            if(escapedIndex>=0) state.cards.splice(escapedIndex,1);
            window.removeRocketBombWithCard?.(escapedCard,"galactic_current_escaped",{});
            archiveRiverCard("riverEscaped",escapedCard,{
                selectedCardInstanceId:pickedCard.instanceId||null,
                selectedCardName:pickedCard.name||null
            });
        }

        state.cards.forEach((card,slot)=>{
            if(!card) return;
            card.instanceMeta=card.instanceMeta||{};
            const survived=Number(card.instanceMeta.riverSurvivalCount||0)+1;
            card.instanceMeta.riverSurvivalCount=survived;
            card.instanceMeta.riverAge=survived;
            card.instanceMeta.riverSlot=slot;
        });
        window.GrootUI?.advanceSurvivors?.(state.cards,{
            mode:"current",riverVariant:state.variant,riverPickNumber:state.pickNumber
        });

        state.pickNumber++;
        recordRiverPick(playerIndex,pickedCard,resultCard,index,{
            packSnapshotBeforePick:questPackSnapshotBeforePick,
            savedOldest:pickedOldest,
            escapedCardName:escapedCard?.name||null,
            escapedCardInstanceId:escapedCard?.instanceId||null
        });

        const willFinish=decks.every(deck=>deck.length>=DRAFT_DECK_SIZE);
        const enteringCards=[];
        if(!willFinish){
            const required=Math.max(0,RIVER_SIZE-state.cards.length);
            const jokerOrdinal=planJokerForGeneratedCards(required);
            for(let ordinal=0;ordinal<required;ordinal++){
                const card=drawCard(state.cards.length,{
                    joker:ordinal===jokerOrdinal,
                    generationKind:"right_edge"
                });
                if(!card) break;
                state.cards.push(card);
                enteringCards.push(card);
            }
            refreshRiverSlots();
        }

        await renderFlowTransition(oldPositions,{enteringCards});
        advanceBountyAging();
        window.BountyEngine?.decoratePack?.(state.cards.filter(Boolean));
        if(escapedCard){
            showToast(`${escapedCard.name} ODPŁYWA DO GRAVEYARDU`,"escape");
        }else{
            showToast(`${resultCard.name} WYBRANA • CZOŁO PRĄDU URATOWANE`);
        }
    }

    async function pickFading(index,playerIndex,pickedCard,resultCard=pickedCard){
        const questPackSnapshotBeforePick=window.DraftQuestEngine?.capturePackSnapshot?.(state.cards.filter(Boolean))||null;
        const fadeLimit=currentFadeLimit();
        window.GrootUI?.harvestCard?.(pickedCard,"picked",{
            natural:false,perfectEligible:false,mode:"current",riverVariant:state.variant,playerIndex
        });
        await animateExistingCard(pickedCard,"gc-is-picked",FLOW_TIMING.pick);

        const survivorsBefore=state.cards.filter((card,slot)=>card && slot!==index);
        const oldPositions=captureCardPositions(survivorsBefore);
        decks[playerIndex].push(resultCard);
        window.consumeProfessorXControl?.(playerIndex,resultCard);
        state.cards.splice(index,1);
        refreshRiverSlots();

        const fadedEntries=[];
        state.cards.forEach((card,slot)=>{
            if(!card) return;
            card.instanceMeta=card.instanceMeta||{};
            const age=Number(card.instanceMeta.riverAge ?? card.instanceMeta.riverSurvivalCount ?? 0)+1;
            card.instanceMeta.riverAge=age;
            card.instanceMeta.riverSurvivalCount=age;
            card.instanceMeta.riverSlot=slot;
            if(age>=fadeLimit && !isSpiderAnchored(card)) fadedEntries.push({card,slot});
        });
        window.GrootUI?.advanceSurvivors?.(state.cards,{
            mode:"current",riverVariant:state.variant,riverPickNumber:state.pickNumber
        });

        state.pickNumber++;
        const willFinish=decks.every(deck=>deck.length>=DRAFT_DECK_SIZE);
        const generatedCount=willFinish ? 0 : 1+fadedEntries.length;
        const jokerOrdinal=planJokerForGeneratedCards(generatedCount);
        let generationOrdinal=0;
        const flowingReplacement=!willFinish ? drawCard(state.cards.length,{
            joker:generationOrdinal++===jokerOrdinal,
            generationKind:"right_edge"
        }) : null;
        if(flowingReplacement) state.cards.push(flowingReplacement);
        refreshRiverSlots();

        await renderFlowTransition(oldPositions,{
            enteringCards:flowingReplacement?[flowingReplacement]:[]
        });

        const rebornCards=[];
        for(const entry of fadedEntries){
            const liveCard=state.cards[entry.slot];
            if(!liveCard || cardKey(liveCard)!==cardKey(entry.card)) continue;
            await animateExistingCard(entry.card,"gc-is-fading",FLOW_TIMING.fade);
            window.removeRocketBombWithCard?.(entry.card,"galactic_current_faded",{});
            archiveRiverCard("riverFaded",entry.card,{
                reason:"age_limit",
                fadedAfterPicks:fadeLimit,
                selectedCardInstanceId:pickedCard.instanceId||null,
                selectedCardName:pickedCard.name||null,
                rebirthSlot:entry.slot,
                replacementMode:willFinish?"draft_finished_no_rebirth":"local_supernova"
            });

            if(willFinish){
                /* Na ostatnim picku nie rodzimy nowych gwiazd. Nie filtrujemy
                   tablicy w środku sekwencji, aby kolejne sloty zachowały
                   stabilne indeksy podczas animowania kilku wygaśnięć. */
                state.cards[entry.slot]=null;
                await wait(FLOW_TIMING.settle);
            }else{
                const reborn=drawCard(entry.slot,{
                    joker:generationOrdinal++===jokerOrdinal,
                    generationKind:"local_rebirth"
                });
                state.cards[entry.slot]=reborn;
                refreshRiverSlots();
                if(reborn) rebornCards.push(reborn);
                render();
                const rebornElement=getCardElement(reborn);
                rebornElement?.classList.add("gc-is-reborn");
                await wait(FLOW_TIMING.rebirth+FLOW_TIMING.settle);
            }
        }

        if(willFinish && fadedEntries.length){
            state.cards=state.cards.filter(Boolean);
            refreshRiverSlots();
            render();
        }

        recordRiverPick(playerIndex,pickedCard,resultCard,index,{
            packSnapshotBeforePick:questPackSnapshotBeforePick,
            pickedSlot:index,
            normalReplacementSource:"right_edge",
            fadeAfterPicks:fadeLimit,
            fadedCardNames:fadedEntries.map(entry=>entry.card.name),
            fadedCardInstanceIds:fadedEntries.map(entry=>entry.card.instanceId||null),
            fadedSlots:fadedEntries.map(entry=>entry.slot),
            localRebirthCount:willFinish?0:rebornCards.length
        });

        currentPack=state.cards.filter(Boolean);
        advanceBountyAging();
        window.BountyEngine?.decoratePack?.(state.cards.filter(Boolean));
        if(fadedEntries.length===1){
            showToast(`${fadedEntries[0].card.name} WYGASA • NOWA GWIAZDA RODZI SIĘ W JEJ MIEJSCU`,"fade");
        }else if(fadedEntries.length>1){
            showToast(`${fadedEntries.length} GWIAZDY WYGASAJĄ • LOKALNE ODRODZENIE`,"fade");
        }else{
            showToast(`${resultCard.name} WYŁOWIONA • NOWA KARTA WPŁYWA Z PRAWEJ`);
        }
    }

    async function pick(index,blackCatOverride=null){
        if(!state.active || state.isResolving || state.isFinishing || draftFinished || !packIsOpen || packEnding) return;
        const playerIndex=pickOrder[currentPickIndex];
        const pickedCard=state.cards[index];
        if(!pickedCard || !Number.isInteger(playerIndex)) return;
        if(!blackCatOverride && window.SuperpowerUI?.handlePackCardClick?.(index,pickedCard)) return;
        if(!blackCatOverride && window.BlackCatUI?.handlePackCardClick?.({
            index,
            card:pickedCard,
            commit:(sourceIndex,override)=>pick(Number(sourceIndex),override)
        })) return;

        setResolving(true);
        try{
            let resultCard=blackCatOverride?.card||pickedCard;
            if(!blackCatOverride?.portal && pickedCard.joker){
                const resolution=await resolveRiverJoker(pickedCard,playerIndex);
                if(!resolution?.resolvedCard){
                    render();
                    return;
                }
                resultCard=resolution.resolvedCard;
                finalizeRiverJokerResolution(pickedCard,resultCard,playerIndex);
            }
            if(blackCatOverride?.portal && typeof archiveCardToGraveyard==="function"){
                archiveCardToGraveyard("portal",pickedCard,{
                    source:"black_cat_gem_portal",
                    reason:`black_cat_${blackCatOverride?.blackCatGem?.gemType||"gem"}`,
                    powerId:"black_cat",
                    recoverable:true,
                    skipGrootHarvest:true,
                    metadata:{resultCardInstanceId:resultCard?.instanceId||null,resultCardName:resultCard?.name||null,draftMode:"galactic_current"}
                });
            }
            // Spider-Man: gotowe Sieci rozliczamy przed naturalnym odpływem/wygasaniem,
            // aby niewybrana karta została uwolniona dokładnie na ten sam przepływ.
            window.finalizeSpiderManPackPick?.(playerIndex,pickedCard);
            if(state.variant===VARIANT_FADING){
                await pickFading(index,playerIndex,pickedCard,resultCard);
            }else{
                await pickRushing(index,playerIndex,pickedCard,resultCard);
            }
            window.BlackCatUI?.finalizeGemPick?.(blackCatOverride,{playerIndex,sourceCard:pickedCard,resultCard});
            const rocketResult=window.resolveRocketBombAfterPick?.(playerIndex,pickedCard,resultCard)||null;
            if(rocketResult?.triggered&&window.SuperpowerUI?.resolveRocketBomb){
                await new Promise(resolve=>window.SuperpowerUI.resolveRocketBomb(rocketResult,resolve));
            }
            advance();
            return {ok:true,pickedCard,resultCard,rocketResult};
        }catch(error){
            console.error("[GalacticCurrent] Błąd sekwencji animacji:",error);
            render();
        }finally{
            if(!state.isFinishing){
                setResolving(false);
                window.GrootUI?.onCurrentResolutionComplete?.({variant:state.variant,round:state.round,pickNumber:state.pickNumber});
            }
        }
    }

    function start(){
        if(state.active) return;
        enforceCompatibility({refresh:false});
        state.active=true;
        state.variant=getConfiguredVariant();
        state.round=0;
        state.pickNumber=0;
        state.cards=[];
        state.drawQueue=buildLegalQueue();
        state.escaped=[];
        state.faded=[];
        state.endRemainders=[];
        state.fadeAfterPicks=state.variant===VARIANT_FADING?fadeLimitForPlayers(numPlayers):null;
        state.startedAt=Date.now();
        state.isResolving=false;
        state.isFinishing=false;
        const configuredJokers=readGalacticJokerSettings();
        state.jokersEnabled=Boolean(jokersCheckbox()?.checked);
        state.jokerMode=configuredJokers.mode;
        state.jokerInterval=configuredJokers.interval;
        state.jokerChance=configuredJokers.chance;
        state.jokersGenerated=0;

        if(state.drawQueue.length<RIVER_SIZE+(numPlayers*RIVER_ROUNDS)){
            state.active=false;
            alert("Za mało legalnych kart, aby uruchomić Gwiezdny Prąd.");
            return;
        }

        window.DraftStateEngine?.init?.({
            players:[...players],
            numPlayers,
            mode:"galactic_current",
            galacticCurrentVariant:state.variant,
            galacticCurrentVariantLabel:variantLabel(state.variant),
            totalRounds:RIVER_ROUNDS,
            riverSize:RIVER_SIZE,
            fadeAfterPicks:state.variant===VARIANT_FADING?state.fadeAfterPicks:null,
            bans:[...(bannedCards||[])],
            jokersEnabled:state.jokersEnabled,
            galacticJokerMode:state.jokersEnabled?state.jokerMode:null,
            galacticJokerInterval:state.jokersEnabled&&state.jokerMode===JOKER_MODE_CONTROLLED?state.jokerInterval:null,
            galacticJokerChance:state.jokersEnabled&&state.jokerMode===JOKER_MODE_CHANCE?state.jokerChance:null,
            customPacksEnabled:false,
            superpowersEnabled:Boolean(document.getElementById("enableSuperpowers")?.checked),
            bountiesEnabled:Boolean(window.BountyEngine?.isEnabled?.()),
            luckyCardsEnabled:Boolean(window.LuckyCards?.isEnabled?.()),
            luckyCards:window.LuckyCards?.getExportData?.() || null,
            snapshotsEnabled:false
        });

        currentPackName=`GWIEZDNY PRĄD — ${variantLabel(state.variant).toUpperCase()}`;
        currentCustomPackDefinition=null;
        setupRiverPickOrder();
        fillRiver(RIVER_SIZE);
        const openingBountyRound=openBountyRoundForCurrentOrbit();
        logRiver("galactic_current_started",{
            data:{
                variant:state.variant,
                variantLabel:variantLabel(state.variant),
                riverSize:RIVER_SIZE,
                totalRounds:RIVER_ROUNDS,
                fadeAfterPicks:state.variant===VARIANT_FADING?state.fadeAfterPicks:null,
                jokersEnabled:state.jokersEnabled,
                jokerMode:state.jokersEnabled?state.jokerMode:null,
                jokerInterval:state.jokersEnabled&&state.jokerMode===JOKER_MODE_CONTROLLED?state.jokerInterval:null,
                jokerChance:state.jokersEnabled&&state.jokerMode===JOKER_MODE_CHANCE?state.jokerChance:null,
                legalPoolSize:state.drawQueue.length+state.cards.filter(Boolean).length
            }
        });
        render();
        if(openingBountyRound?.triggered){
            window.BountyEngine?.decoratePack?.(state.cards.filter(Boolean));
            window.BountyEngine?.announceRound?.(openingBountyRound);
        }
    }

    function reset(){
        state.active=false;
        state.variant=getConfiguredVariant();
        state.round=0;
        state.pickNumber=0;
        state.cards=[];
        state.drawQueue=[];
        state.escaped=[];
        state.faded=[];
        state.endRemainders=[];
        state.fadeAfterPicks=null;
        state.startedAt=null;
        state.isResolving=false;
        state.isFinishing=false;
        state.jokersEnabled=false;
        state.jokersGenerated=0;
        clearDetachedGhostStage();
        document.getElementById("gcDetachedGhostStageUnder")?.remove();
        document.getElementById("gcDetachedGhostStageOver")?.remove();
        document.body.classList.remove(
            "galactic-current-mode",
            "galactic-current-rushing",
            "galactic-current-fading",
            "galactic-current-resolving",
            "gc-current-finishing"
        );
        const stage=document.getElementById("packStage");
        stage?.removeAttribute("data-river-variant");
        const queueTitle=document.querySelector(".info-panel .panel-title");
        if(queueTitle) queueTitle.textContent="KOLEJKA PACZKI";
        removeBoardLayers();
    }

    /* ---------- chirurgiczne hooki do obecnego silnika ---------- */

    const baseBuildDraftModeParts=buildDraftModeParts;
    buildDraftModeParts=function(){
        const parts=baseBuildDraftModeParts();
        if(isActiveMode()){
            const modeName=`Gwiezdny Prąd — ${variantLabel(getConfiguredVariant())}`;
            if(parts.length) parts[0]=modeName;
            else parts.push(modeName);
        }
        return parts;
    };

    const baseApplyPackStageMode=applyPackStageMode;
    applyPackStageMode=function(){
        baseApplyPackStageMode();
        const stage=document.getElementById("packStage");
        if(stage && isActiveMode()){
            stage.setAttribute("data-layout","river");
            stage.setAttribute("data-river-variant",getConfiguredVariant());
        }
    };

    const baseStartDraft=startDraft;
    startDraft=function(){
        reset();
        if(isActiveMode()) enforceCompatibility({refresh:false});
        return baseStartDraft();
    };

    const baseStartDraftFlow=startDraftFlow;
    startDraftFlow=function(){
        if(!isActiveMode()) return baseStartDraftFlow();
        /* V1 compat: zachowujemy wspólny preflight Classica (Bany → Supermoce → Questy),
           a dopiero jego końcowy krok przekierowuje się do startu Gwiezdnego Prądu. */
        enforceCompatibility({refresh:false});
        return baseStartDraftFlow();
    };

    const baseSetPackTitle=setPackTitle;
    setPackTitle=function(){
        if(!state.active) return baseSetPackTitle();
        const title=document.getElementById("packName");
        const reveal=document.getElementById("customPackRevealInfo");
        if(title){
            title.className="pack-standard gc-current-title";
            title.innerHTML=`<span class="gc-current-title-sticker-wrap" aria-hidden="true"><img class="gc-current-title-sticker" src="draft-assets/gwiezdny_prad_sticker.webp" alt=""></span><span class="gc-current-title-text">GWIEZDNY PRĄD</span>`;
            title.dataset.gcText="GWIEZDNY PRĄD";
            title.dataset.gcVariant=state.variant;
            title.setAttribute("aria-label",`Gwiezdny Prąd — ${variantLabel(state.variant)}, obieg ${state.round+1} z ${RIVER_ROUNDS}`);
        }
        if(reveal) reveal.innerHTML="";
    };

    const baseShowPack=showPack;
    showPack=function(revealCards=false){
        const result=baseShowPack(state.active?false:revealCards);
        if(state.active) decorateCards();
        return result;
    };

    const basePickCard=pickCard;
    pickCard=function(index,blackCatOverride=null){
        if(state.active) return pick(Number(index),blackCatOverride);
        return basePickCard(index,blackCatOverride);
    };

    const baseUpdateInfoPanel=updateInfoPanel;
    updateInfoPanel=function(){
        baseUpdateInfoPanel();
        if(!state.active) return;
        const info=document.getElementById("infoContent");
        if(!info) return;
        [...info.querySelectorAll(".infoPanelLine")].forEach(line=>{
            if(line.textContent.trim().startsWith("NUMER PACZKI:")){
                line.innerHTML=`<b>OBIEG PRĄDU:</b> ${state.round+1}/${RIVER_ROUNDS}`;
            }
        });
        const currentLine=document.createElement("div");
        currentLine.className="infoPanelLine";
        currentLine.innerHTML=state.variant===VARIANT_FADING
            ? `<b>WARIANT:</b> WYGASAJĄCE GWIAZDY<br><b>W NURCIE:</b> ${state.cards.filter(Boolean).length}/${RIVER_SIZE}<br><b>WYGASŁY:</b> ${state.faded.length}<br><b>LIMIT WIEKU:</b> ${currentFadeLimit()} PICKÓW`
            : `<b>WARIANT:</b> RWĄCY PRĄD<br><b>W NURCIE:</b> ${state.cards.filter(Boolean).length}/${RIVER_SIZE}<br><b>ODPŁYNĘŁY:</b> ${state.escaped.length}`;
        if(state.jokersEnabled){
            const jokerLine=document.createElement("div");
            jokerLine.className="infoPanelLine";
            jokerLine.innerHTML=state.jokerMode===JOKER_MODE_CHANCE
                ? `<b>JOKERY W NURCIE:</b> ${Math.round(state.jokerChance*100)}% NA PICK<br><b>WYGENEROWANE:</b> ${state.jokersGenerated}`
                : `<b>JOKERY W NURCIE:</b> CO ${state.jokerInterval} PICKÓW<br><b>WYGENEROWANE:</b> ${state.jokersGenerated}`;
            info.appendChild(jokerLine);
        }
        info.appendChild(currentLine);
    };

    function syncExternalPackMirror(){
        currentPack=state.cards.filter(Boolean);
        return currentPack;
    }

    function cloneCurrentState(value){
        if(value===undefined) return undefined;
        if(typeof structuredClone==="function"){
            try{return structuredClone(value);}catch(_){ }
        }
        return JSON.parse(JSON.stringify(value));
    }

    function captureState(){
        return cloneCurrentState(state);
    }

    function restoreState(snapshot,options={}){
        if(!snapshot||typeof snapshot!=="object") return false;
        const restored=cloneCurrentState(snapshot);
        Object.keys(state).forEach(key=>{ delete state[key]; });
        Object.assign(state,restored);
        if(!Array.isArray(state.cards)) state.cards=[];
        if(!Array.isArray(state.drawQueue)) state.drawQueue=[];
        refreshRiverSlots();
        syncExternalPackMirror();
        if(options.render!==false) render();
        return true;
    }

    function advanceExternalTurn(){
        if(!state.active||state.isFinishing) return false;
        advance();
        return true;
    }

    function getLiveCards(){ return state.cards; }
    function getFutureCards(){ return state.drawQueue; }

    function replaceLiveCardAt(index,replacement,options={}){
        const slot=Number(index);
        if(!state.active) return {ok:false,reason:"Gwiezdny Prąd nie jest aktywny."};
        if(!Number.isInteger(slot)||slot<0||slot>=state.cards.length||!state.cards[slot]) return {ok:false,reason:"Nie znaleziono aktywnej karty nurtu."};
        if(!replacement) return {ok:false,reason:"Brak karty zastępczej."};
        const previous=state.cards[slot];
        if(window.isSpiderManReservationAnchored?.(previous) && !options.allowSpiderWeb){
            return {ok:false,reason:"Pajęcza Sieć kotwiczy tę kartę w nurcie."};
        }
        const next=replacement;
        const oldMeta=previous?.instanceMeta||{};
        next.instanceMeta={
            ...(next.instanceMeta||{}),
            riverSlot:slot,
            riverEnteredAtPick:options.inheritFlowAge?oldMeta.riverEnteredAtPick:state.pickNumber,
            riverEnteredAtRound:options.inheritFlowAge?oldMeta.riverEnteredAtRound:state.round,
            riverSurvivalCount:options.inheritFlowAge?Number(oldMeta.riverSurvivalCount||0):0,
            riverAge:options.inheritFlowAge?Number(oldMeta.riverAge||oldMeta.riverSurvivalCount||0):0,
            externalMutation:true,
            externalMutationSource:String(options.source||"superpower_bridge")
        };
        state.cards[slot]=next;
        syncExternalPackMirror();
        if(options.render!==false) render();
        logRiver("galactic_current_external_replace",{sourceCard:previous,resultCard:next,reason:String(options.source||"superpower_bridge"),data:{slot}});
        return {ok:true,index:slot,previousCard:previous,resultCard:next};
    }

    function consumeLiveCardAt(index,options={}){
        const slot=Number(index);
        if(!state.active) return {ok:false,reason:"Gwiezdny Prąd nie jest aktywny."};
        if(!Number.isInteger(slot)||slot<0||slot>=state.cards.length||!state.cards[slot]) return {ok:false,reason:"Nie znaleziono aktywnej karty nurtu."};
        const previous=state.cards[slot];
        if(window.isSpiderManReservationAnchored?.(previous) && !options.allowSpiderWeb){
            return {ok:false,reason:"Pajęcza Sieć kotwiczy tę kartę w nurcie."};
        }
        state.cards.splice(slot,1);
        let refillCard=null;
        if(options.refill!==false){
            refillCard=drawCard(state.cards.length,{generationKind:String(options.generationKind||"superpower_refill")});
            if(refillCard) state.cards.push(refillCard);
        }
        syncExternalPackMirror();
        if(options.render!==false) render();
        logRiver("galactic_current_external_consume",{sourceCard:previous,resultCard:refillCard,reason:String(options.source||"superpower_bridge"),data:{slot,refilled:Boolean(refillCard)}});
        return {ok:true,index:slot,previousCard:previous,refillCard};
    }

    function resolveExternalNormalPick(index,playerIndex,resultCard,options={}){
        const slot=Number(index);
        const owner=Number(playerIndex);
        const pickedCard=state.cards[slot];
        if(!state.active||state.isFinishing) return {ok:false,reason:"Gwiezdny Prąd nie jest aktywny."};
        if(!Number.isInteger(slot)||slot<0||slot>=state.cards.length||!pickedCard) return {ok:false,reason:"Nie znaleziono karty normalnego picku w nurcie."};
        const isCurrentOwner=Number.isInteger(owner)&&Number(pickOrder?.[currentPickIndex])===owner;
        const deferredPickIndex=Number.isInteger(owner)&&options.allowDeferredTurn===true
            ? pickOrder?.findIndex?.((entry,idx)=>idx>currentPickIndex&&Number(entry)===owner) ?? -1
            : -1;
        const isDeferredOwner=!isCurrentOwner&&deferredPickIndex>=0;
        if(!isCurrentOwner&&!isDeferredOwner) return {ok:false,reason:"Ten gracz nie ma dostępnego normalnego picku w Gwiezdnym Prądzie."};
        const legalityPickIndex=isDeferredOwner?deferredPickIndex:currentPickIndex;
        if(typeof window.isSpiderManCardAvailableToPlayer==="function"&&!window.isSpiderManCardAvailableToPlayer(pickedCard,owner,legalityPickIndex)){
            return {ok:false,reason:"Pajęcza Sieć rezerwuje tę kartę dla innego wyboru."};
        }
        const resolved=resultCard||pickedCard;
        const questPackSnapshotBeforePick=window.DraftQuestEngine?.capturePackSnapshot?.(state.cards.filter(Boolean))||null;
        const flowData={};
        window.GrootUI?.harvestCard?.(pickedCard,"picked",{natural:false,perfectEligible:false,mode:"current",riverVariant:state.variant,playerIndex:owner,sourcePowerId:options.powerId||null});
        window.finalizeSpiderManPackPick?.(owner,pickedCard);
        decks[owner].push(resolved);
        window.consumeProfessorXControl?.(owner,resolved);

        if(state.variant===VARIANT_FADING){
            state.cards.splice(slot,1);
            refreshRiverSlots();
            const fadeLimit=currentFadeLimit();
            const fadedEntries=[];
            state.cards.forEach((card,cardSlot)=>{
                if(!card) return;
                card.instanceMeta=card.instanceMeta||{};
                const age=Number(card.instanceMeta.riverAge ?? card.instanceMeta.riverSurvivalCount ?? 0)+1;
                card.instanceMeta.riverAge=age;
                card.instanceMeta.riverSurvivalCount=age;
                card.instanceMeta.riverSlot=cardSlot;
                if(age>=fadeLimit&&!isSpiderAnchored(card)) fadedEntries.push({card,slot:cardSlot});
            });
            window.GrootUI?.advanceSurvivors?.(state.cards,{mode:"current",riverVariant:state.variant,riverPickNumber:state.pickNumber});
            state.pickNumber++;
            const willFinish=decks.every(deck=>deck.length>=DRAFT_DECK_SIZE);
            if(!willFinish){
                const flowingReplacement=drawCard(state.cards.length,{generationKind:String(options.generationKind||"external_normal_pick")});
                if(flowingReplacement) state.cards.push(flowingReplacement);
                refreshRiverSlots();
            }
            const fadedNames=[];
            for(const entry of fadedEntries){
                const live=state.cards[entry.slot];
                if(!live||cardKey(live)!==cardKey(entry.card)) continue;
                window.removeRocketBombWithCard?.(entry.card,"galactic_current_faded",{replacementPowerId:options.powerId||null});
                archiveRiverCard("riverFaded",entry.card,{reason:"age_limit",fadedAfterPicks:fadeLimit,selectedCardInstanceId:pickedCard.instanceId||null,selectedCardName:pickedCard.name||null,rebirthSlot:entry.slot,replacementMode:willFinish?"draft_finished_no_rebirth":"local_supernova"});
                fadedNames.push(entry.card.name);
                if(willFinish){
                    state.cards[entry.slot]=null;
                }else{
                    state.cards[entry.slot]=drawCard(entry.slot,{generationKind:"local_rebirth"});
                }
            }
            if(willFinish) state.cards=state.cards.filter(Boolean);
            refreshRiverSlots();
            Object.assign(flowData,{pickedSlot:slot,fadeAfterPicks:fadeLimit,fadedCardNames:fadedNames});
        }else{
            const pickedOldest=slot===0;
            const escapedCard=!pickedOldest?(state.cards.find((card,cardSlot)=>card&&cardSlot!==slot&&!isSpiderAnchored(card))||null):null;
            const removedKeys=new Set([cardKey(pickedCard),cardKey(escapedCard)]);
            state.cards.splice(slot,1);
            if(escapedCard){
                const escapedIndex=state.cards.findIndex(card=>cardKey(card)===cardKey(escapedCard));
                if(escapedIndex>=0) state.cards.splice(escapedIndex,1);
                window.removeRocketBombWithCard?.(escapedCard,"galactic_current_escaped",{replacementPowerId:options.powerId||null});
                archiveRiverCard("riverEscaped",escapedCard,{selectedCardInstanceId:pickedCard.instanceId||null,selectedCardName:pickedCard.name||null});
            }
            state.cards.forEach((card,cardSlot)=>{
                if(!card||removedKeys.has(cardKey(card))) return;
                card.instanceMeta=card.instanceMeta||{};
                const survived=Number(card.instanceMeta.riverSurvivalCount||0)+1;
                card.instanceMeta.riverSurvivalCount=survived;
                card.instanceMeta.riverAge=survived;
                card.instanceMeta.riverSlot=cardSlot;
            });
            window.GrootUI?.advanceSurvivors?.(state.cards,{mode:"current",riverVariant:state.variant,riverPickNumber:state.pickNumber});
            state.pickNumber++;
            const willFinish=decks.every(deck=>deck.length>=DRAFT_DECK_SIZE);
            if(!willFinish){
                const required=Math.max(0,RIVER_SIZE-state.cards.length);
                for(let ordinal=0;ordinal<required;ordinal++){
                    const card=drawCard(state.cards.length,{generationKind:String(options.generationKind||"external_normal_pick")});
                    if(!card) break;
                    state.cards.push(card);
                }
            }
            refreshRiverSlots();
            Object.assign(flowData,{savedOldest:pickedOldest,escapedCardName:escapedCard?.name||null,escapedCardInstanceId:escapedCard?.instanceId||null});
        }

        recordRiverPick(owner,pickedCard,resolved,slot,{packSnapshotBeforePick:questPackSnapshotBeforePick,externalPowerId:options.powerId||null,deferredNormalPick:isDeferredOwner,...flowData});
        const rocketResult=window.resolveRocketBombAfterPick?.(owner,pickedCard,resolved)||null;
        syncExternalPackMirror();
        advanceBountyAging();
        window.BountyEngine?.decoratePack?.(state.cards.filter(Boolean));
        if(options.render!==false) render();
        return {ok:true,pickedCard,resultCard:resolved,rocketResult,index:slot};
    }

    function getNextTurnDescriptor(playerIndex){
        const target=Number(playerIndex);
        if(!Number.isInteger(target)||!Array.isArray(pickOrder)||!pickOrder.length) return null;
        let orderIndex=pickOrder.findIndex((entry,idx)=>idx>currentPickIndex&&Number(entry)===target);
        let round=state.round;
        if(orderIndex<0){
            orderIndex=pickOrder.findIndex(entry=>Number(entry)===target);
            round+=1;
        }
        if(orderIndex<0||round>=RIVER_ROUNDS) return null;
        const currentPos=Math.max(0,Number(currentPickIndex)||0);
        const turnsAway=round===state.round
            ? Math.max(0,orderIndex-currentPos)
            : Math.max(0,(pickOrder.length-currentPos)+orderIndex);
        return {playerIndex:target,round:round+1,orderIndex,turnsAway,currentRound:state.round+1,currentOrderIndex:currentPos};
    }

    function init(){
        const input=checkbox();
        if(!input) return;
        input.addEventListener("change",()=>{
            if(input.checked){
                enforceCompatibility({refresh:false});
            }
            syncLobbyVisuals();
        });
        document.querySelectorAll('input[name="galacticCurrentVariant"]').forEach(radio=>{
            radio.addEventListener("change",()=>{
                state.variant=getConfiguredVariant();
                syncLobbyVisuals();
            });
        });
        INCOMPATIBLE_IDS.forEach(id=>{
            const other=document.getElementById(id);
            if(!other) return;
            other.addEventListener("change",()=>{
                if(other.checked && input.checked){
                    input.checked=false;
                    syncLobbyVisuals();
                }
            });
        });
        syncLobbyVisuals();
    }

    global.showDraftPickToast=(message,type="normal")=>showToast(message,type);

    global.GalacticCurrent=Object.freeze({
        VERSION,
        RIVER_SIZE,
        RIVER_ROUNDS,
        fadeLimitForPlayers,
        getCurrentFadeLimit:currentFadeLimit,
        VARIANT_RUSHING,
        VARIANT_FADING,
        isModeEnabled:isActiveMode,
        getConfiguredVariant,
        prepareJokerSettingsModal,
        commitJokerSettings,
        updateGalacticJokerSettingsVisibility,
        getState:()=>state,
        getLiveCards,
        getFutureCards,
        replaceLiveCardAt,
        consumeLiveCardAt,
        resolveExternalNormalPick,
        getNextTurnDescriptor,
        captureState,
        restoreState,
        advanceExternalTurn,
        refresh:render,
        start,
        reset
    });

    init();
})(window);
