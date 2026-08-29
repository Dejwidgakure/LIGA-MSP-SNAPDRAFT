(function(global){
    "use strict";

    const POWER_ID="mysterio";
    const EFFECT_TYPE="mysterio_illusion";
    const PEEKS_PER_ACTIVATION=4;
    const PEEK_DURATION_MS=5500;
    const VERSION="1.2.2";

    let adapter={};
    let configured=false;
    let peekTimer=0;
    let peekToken=0;
    let pendingPickResolution=null;
    let state=createEmptyState();

    function createEmptyState(){
        return {
            active:false,
            ownerName:null,
            ownerIndex:null,
            sourcePackId:null,
            sourcePackNumber:null,
            activatedAtPickIndex:null,
            illusionCount:0,
            sharedDecoyCard:null,
            sharedDecoySourceInstanceId:null,
            ownerPicksCompleted:0,
            peekTurnKey:null,
            peeksRemaining:0,
            currentPeek:null,
            pendingReflectionDiscovery:null,
            reflectionLootUsed:false,
            offeredDecoySourceInstanceIds:[],
            queueStacked:false,
            busy:false
        };
    }

    function clone(value){
        if(value===undefined) return undefined;
        if(typeof structuredClone==="function"){
            try{return structuredClone(value);}catch(error){}
        }
        return JSON.parse(JSON.stringify(value));
    }

    function escapeHtml(value){
        return String(value??"")
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/\"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function configure(nextAdapter={}){
        adapter={...adapter,...nextAdapter};
        configured=true;
        return true;
    }

    function currentPack(){
        const pack=adapter.getCurrentPack?.();
        return Array.isArray(pack)?pack:[];
    }

    function currentPackId(){
        return adapter.getCurrentPackId?.()||null;
    }

    function currentPlayerIndex(){
        const index=Number(adapter.getCurrentPlayerIndex?.());
        return Number.isInteger(index)?index:null;
    }

    function currentPickIndex(){
        const index=Number(adapter.getCurrentPickIndex?.());
        return Number.isInteger(index)?index:0;
    }

    function sameSourcePack(){
        return Boolean(state.active&&state.sourcePackId&&currentPackId()===state.sourcePackId);
    }

    function syncPreopenPrivacy(){
        const shouldHide=Boolean(state.active&&sameSourcePack()&&adapter.isPackOpen?.()!==true);
        document.body.classList.toggle("spx-mysterio-preopen",shouldHide);
        return shouldHide;
    }

    function allEffects(){
        if(!state.sourcePackId||!global.DraftStateEngine?.getPackEffects) return [];
        return global.DraftStateEngine.getPackEffects(state.sourcePackId,{type:EFFECT_TYPE})||[];
    }

    function activeEffects(){
        return allEffects().filter(effect=>effect?.status==="active");
    }

    function getEffect(effectId){
        const id=String(effectId||"");
        return allEffects().find(effect=>String(effect?.effectId||"")===id)||null;
    }

    function findEffectForCard(card){
        const instanceId=String(card?.instanceId||"");
        if(!instanceId) return null;
        return activeEffects().find(effect=>String(effect?.targetCardInstanceId||"")===instanceId)||null;
    }

    function isIllusionCard(card){
        return Boolean(findEffectForCard(card));
    }

    function getPublicCardSnapshot(card){
        if(!card) return null;
        const effect=findEffectForCard(card);
        if(!effect) return clone(card);
        const decoy=clone(effect.data?.decoyCard||state.sharedDecoyCard||{});
        return {
            ...decoy,
            instanceId:card.instanceId||null,
            isMysterioIllusion:true,
            illusionNumber:Number(effect.data?.illusionNumber)||null
        };
    }

    function getPublicCardLabel(card){
        const publicCard=getPublicCardSnapshot(card);
        return publicCard?.name||card?.name||"ILUZJA";
    }

    function findCurrentCard(instanceId){
        const id=String(instanceId||"");
        return currentPack().find(card=>String(card?.instanceId||"")===id)||null;
    }

    function findCardElement(instanceId){
        const id=String(instanceId||"");
        return [...document.querySelectorAll("#pack [data-card-instance-id]")]
            .find(element=>String(element.dataset.cardInstanceId||"")===id)||null;
    }

    function decoySnapshot(card){
        const result=clone(card||{});
        delete result.instanceId;
        delete result.instanceMeta;
        delete result.joker;
        delete result.type;
        return result;
    }

    function shuffle(items){
        const result=[...items];
        for(let i=result.length-1;i>0;i--){
            const j=Math.floor(Math.random()*(i+1));
            [result[i],result[j]]=[result[j],result[i]];
        }
        return result;
    }

    function feedback(kind,title,message){
        const channel=global.SuperpowerFeedback?.[kind];
        if(typeof channel==="function"){
            channel(POWER_ID,title,message);
            return;
        }
        if(kind==="error"||kind==="warning") global.alert?.(`${title}\n\n${message}`);
    }

    function setStoredPowerUsed(playerName,status="used"){
        const stored=global.draftSuperpowers?.[playerName];
        if(!stored) return;
        stored.used=true;
        stored.status=status;
    }

    function addSuperpowerLog(event,data={}){
        global.superpowerLog=Array.isArray(global.superpowerLog)?global.superpowerLog:[];
        global.superpowerLog.push({
            type:data.type||"superpower_resolution",
            event,
            playerName:state.ownerName,
            playerIndex:state.ownerIndex,
            powerId:POWER_ID,
            powerName:"WIELKA ILUZJA",
            packNumber:state.sourcePackNumber,
            packId:state.sourcePackId,
            pickIndex:currentPickIndex(),
            timestamp:new Date().toISOString(),
            ...clone(data)
        });
    }

    function clearPeek({rerender=true}={}){
        if(peekTimer){
            global.clearTimeout(peekTimer);
            peekTimer=0;
        }
        state.currentPeek=null;
        if(rerender) afterPackRendered();
    }

    function registerReflectionDiscovery(effect,card){
        const sourceId=String(state.sharedDecoySourceInstanceId||"");
        if(!sourceId || String(card?.instanceId||"")!==sourceId || state.reflectionLootUsed) return null;
        const offered=new Set((state.offeredDecoySourceInstanceIds||[]).map(String));
        if(offered.has(sourceId)) return null;
        const discovery={
            effectId:effect?.effectId||null,
            illusionNumber:Number(effect?.data?.illusionNumber)||null,
            decoyCard:clone(effect?.data?.decoyCard||state.sharedDecoyCard||card),
            decoySourceInstanceId:sourceId,
            sourceCard:clone(card),
            discoveredAt:Date.now()
        };
        state.pendingReflectionDiscovery=discovery;
        addSuperpowerLog("mysterio_pattern_discovered",{
            type:"superpower_resolution",
            illusionNumber:discovery.illusionNumber,
            revealedCard:card?.name||null,
            revealedInstanceId:card?.instanceId||null,
            decoySourceInstanceId:sourceId
        });
        return discovery;
    }

    function resolvePendingReflectionDiscovery(){
        const discovery=state.pendingReflectionDiscovery;
        if(!discovery || state.reflectionLootUsed || !state.active || !sameSourcePack()) return Promise.resolve({accepted:false,reason:"no_pending_pattern"});
        state.pendingReflectionDiscovery=null;
        return Promise.resolve(offerReflectionLoot(discovery));
    }

    function schedulePeekExpiry(token){
        if(peekTimer) global.clearTimeout(peekTimer);
        const arm=()=>{
            const peek=state.currentPeek;
            if(!peek || peek.token!==token){ peekTimer=0; return; }
            const remaining=Math.max(0,Number(peek.expiresAt||0)-Date.now());
            // Guard against browser/tab timer jitter: never close a peek before its real deadline.
            if(remaining>35){
                peekTimer=global.setTimeout(arm,remaining+10);
                return;
            }
            state.currentPeek=null;
            peekTimer=0;
            afterPackRendered();
            if(state.pendingReflectionDiscovery && !state.busy){
                global.setTimeout(()=>resolvePendingReflectionDiscovery().catch(error=>console.error("Mysterio reflection discovery failed:",error)),80);
            }
        };
        const peek=state.currentPeek;
        const delay=Math.max(40,Number(peek?.expiresAt||0)-Date.now()+10);
        peekTimer=global.setTimeout(arm,delay);
    }

    function reset(){
        clearPeek({rerender:false});
        pendingPickResolution=null;
        state=createEmptyState();
        document.querySelectorAll(".spx-mysterio-activation,.spx-mysterio-loot-overlay").forEach(node=>node.remove());
        document.querySelectorAll(".spx-mysterio-illusion").forEach(node=>node.remove());
        document.getElementById("spxMysterioHud")?.remove();
        document.body.classList.remove("spx-mysterio-active","spx-mysterio-casting","spx-mysterio-preopen");
    }

    function canStart(playerName){
        if(!configured) return {ok:false,reason:"Moduł Mysterio nie otrzymał adaptera draftu."};
        if(state.active) return {ok:false,reason:"W tej paczce działa już Wielka Iluzja."};
        if(!adapter.isPackPreparedForIllusion?.()) return {ok:false,reason:"Wielką Iluzję aktywuje się przed otwarciem przygotowanej paczki."};
        if(currentPickIndex()!==0) return {ok:false,reason:"Okno Wielkiej Iluzji zamyka się wraz z otwarciem paczki."};
        const players=adapter.getPlayers?.()||[];
        const ownerIndex=players.indexOf(playerName);
        if(ownerIndex<0) return {ok:false,reason:"Nie udało się rozpoznać właściciela Wielkiej Iluzji."};
        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment||assignment.powerId!==POWER_ID) return {ok:false,reason:"Mysterio nie jest przypisany do tego gracza."};
        if(assignment.used) return {ok:false,reason:"Wielka Iluzja została już wykorzystana."};
        const engineCheck=global.SuperpowerEngine?.canActivate?.(playerName,POWER_ID);
        if(engineCheck&&!engineCheck.ok) return {ok:false,reason:engineCheck.reason||"Silnik odrzucił aktywację Mysterio."};
        const pack=currentPack();
        if(!pack.length) return {ok:false,reason:"W aktualnej paczce nie ma kart do zasłonięcia."};
        const decoyCandidates=pack.filter(card=>card&&!card.joker&&card.name&&card.instanceId);
        if(!decoyCandidates.length){
            return {ok:false,reason:"Paczka nie zawiera zwykłej karty, która mogłaby stać się wspólnym obrazem iluzji."};
        }
        if(!currentPackId()||!global.DraftStateEngine?.addPackEffect){
            return {ok:false,reason:"Kanoniczny stan paczki nie jest dostępny."};
        }
        const queueCheck=adapter.canStackOwnerPicks?.(ownerIndex);
        if(queueCheck&&queueCheck.ok===false) return {ok:false,reason:queueCheck.reason||"Nie można zestackować picków Mysterio."};
        return {ok:true,ownerIndex,assignment,pack,decoyCandidates};
    }

    function start(playerName){
        const ownerName=String(playerName||"");
        const check=canStart(ownerName);
        if(!check.ok){
            feedback("warning","WIELKA ILUZJA JESZCZE NIE TERAZ",check.reason);
            return false;
        }

        const packId=currentPackId();
        const indexedPack=check.pack.map((card,index)=>({card,index}));
        const decoySource=check.decoyCandidates[Math.floor(Math.random()*check.decoyCandidates.length)];
        const decoyTarget=indexedPack.find(entry=>entry.card===decoySource);
        const targets=shuffle(indexedPack).slice(0,Math.ceil(check.pack.length*3/4));
        if(decoyTarget&&!targets.some(entry=>entry.card===decoySource)){
            targets[targets.length-1]=decoyTarget;
        }
        const sharedDecoy=decoySnapshot(decoySource);
        const created=[];

        targets.forEach((target,position)=>{
            const effect=global.DraftStateEngine.addPackEffect(packId,{
                type:EFFECT_TYPE,
                status:"active",
                sourcePowerId:POWER_ID,
                sourcePlayerIndex:check.ownerIndex,
                targetCardInstanceId:target.card?.instanceId||null,
                targetPosition:target.index,
                data:{
                    ownerName,
                    illusionNumber:position+1,
                    logicalSlot:target.index,
                    decoyCard:clone(sharedDecoy),
                    decoySourceInstanceId:decoySource.instanceId,
                    sharedDecoy:true,
                    createdBeforePackOpen:true,
                    revealPublic:true
                }
            });
            if(effect) created.push(effect);
        });

        if(created.length!==targets.length){
            created.forEach(effect=>global.DraftStateEngine.removePackEffect(packId,effect.effectId,"mysterio_activation_rollback"));
            feedback("error","ILUZJA ROZPADŁA SIĘ PRZED STARTEM","Nie udało się bezpiecznie zapisać wszystkich statusów iluzji.");
            return false;
        }

        const engineResult=global.SuperpowerEngine?.completeActivation?.(ownerName,POWER_ID,{
            packNumber:Number(adapter.getPackNumber?.())||null,
            packId,
            illusionCount:created.length,
            activatedAtPickIndex:currentPickIndex(),
            activatedBeforePackOpen:true,
            sharedDecoyCard:sharedDecoy.name||null,
            sharedDecoySourceInstanceId:decoySource.instanceId||null,
            stackedPicks:true
        })||{ok:true};
        if(engineResult.ok===false){
            created.forEach(effect=>global.DraftStateEngine.removePackEffect(packId,effect.effectId,"mysterio_engine_rollback"));
            feedback("error","SILNIK ODRZUCIŁ ILUZJĘ",engineResult.reason||"Aktywacja nie została zapisana.");
            return false;
        }

        state={
            ...createEmptyState(),
            active:true,
            ownerName,
            ownerIndex:check.ownerIndex,
            sourcePackId:packId,
            sourcePackNumber:Number(adapter.getPackNumber?.())||null,
            activatedAtPickIndex:currentPickIndex(),
            illusionCount:created.length,
            sharedDecoyCard:clone(sharedDecoy),
            sharedDecoySourceInstanceId:decoySource.instanceId||null,
            queueStacked:Boolean(adapter.stackOwnerPicks?.(check.ownerIndex)?.stacked),
            busy:true
        };
        setStoredPowerUsed(ownerName,"active");
        document.body.classList.add("spx-mysterio-active");
        syncPreopenPrivacy();
        addSuperpowerLog("mysterio_grand_illusion_cast",{
            type:"superpower_activation",
            illusionCount:created.length,
            coveredInstanceIds:created.map(effect=>effect.targetCardInstanceId),
            sharedDecoyCard:sharedDecoy.name||null,
            sharedDecoySourceInstanceId:decoySource.instanceId||null,
            activatedBeforePackOpen:true,
            stackedPicks:state.queueStacked
        });
        onTurnChanged();
        playActivation();
        adapter.refreshQueue?.();
        adapter.refreshPack?.();
        adapter.refreshRoster?.();
        return true;
    }

    function playActivation(){
        document.querySelectorAll(".spx-mysterio-activation").forEach(node=>node.remove());
        const layer=document.createElement("div");
        layer.className="spx-mysterio-activation";
        layer.setAttribute("aria-hidden","true");
        layer.innerHTML=`
            <div class="spx-mysterio-cast-smoke smoke-a"></div>
            <div class="spx-mysterio-cast-smoke smoke-b"></div>
            <img class="spx-mysterio-cast-hero" src="draft-assets/mysteriopowershero.png" alt="">
            <div class="spx-mysterio-cast-copy"><small>MYSTERIO</small><strong>WIELKA ILUZJA</strong></div>
        `;
        document.body.classList.add("spx-mysterio-casting");
        document.body.appendChild(layer);
        global.setTimeout(()=>layer.classList.add("is-active"),20);
        global.setTimeout(()=>{
            state.busy=false;
            layer.classList.add("is-leaving");
            document.body.classList.remove("spx-mysterio-casting");
            adapter.refreshPack?.();
            global.setTimeout(()=>layer.remove(),520);
        },1550);
    }

    function ensureHud(){
        let hud=document.getElementById("spxMysterioHud");
        if(!hud){
            hud=document.createElement("aside");
            hud.id="spxMysterioHud";
            hud.className="spx-mysterio-hud";
            hud.setAttribute("aria-live","polite");
            document.body.appendChild(hud);
        }
        return hud;
    }

    function updateHud(){
        const existing=document.getElementById("spxMysterioHud");
        if(!sameSourcePack()||adapter.isPackOpen?.()!==true){
            if(existing) existing.hidden=true;
            return;
        }
        const hud=ensureHud();
        const ownerTurn=currentPlayerIndex()===state.ownerIndex;
        const activeCount=activeEffects().length;
        hud.hidden=false;
        hud.classList.toggle("is-owner-turn",ownerTurn);
        hud.innerHTML=`
            <img src="draft-assets/mysteriopowerslogo.png" alt="">
            <span><small>MYSTERIO — WIELKA ILUZJA</small><strong>${ownerTurn?`PODGLĄDY: ${state.peeksRemaining}`:"DEZINFORMACJA AKTYWNA"}</strong><em>ILUZJE: ${activeCount}</em></span>
        `;
    }

    function onTurnChanged(){
        if(!sameSourcePack()){
            updateHud();
            return;
        }
        const livePlayerIndex=currentPlayerIndex();
        // During rerenders the adapter can briefly report no current player. Do not
        // destroy an otherwise valid timed peek because of that transient state.
        if(livePlayerIndex===null){
            updateHud();
            return;
        }
        const ownerTurn=livePlayerIndex===state.ownerIndex;
        if(!ownerTurn){
            if(state.currentPeek) clearPeek({rerender:false});
            updateHud();
            return;
        }
        if(!state.peekTurnKey && state.ownerPicksCompleted<2){
            state.peekTurnKey=`${state.sourcePackId}:owner-sequence`;
            state.peeksRemaining=PEEKS_PER_ACTIVATION;
            addSuperpowerLog("mysterio_peek_window_opened",{
                type:"superpower_state",
                ownerPickNumber:Math.min(2,state.ownerPicksCompleted+1),
                peeksAvailable:state.peeksRemaining,
                sharedAcrossOwnerPicks:true
            });
        }
        updateHud();
    }

    function canPeek(effect){
        return Boolean(
            sameSourcePack()&&
            effect?.status==="active"&&
            adapter.isPackOpen?.()&&
            currentPlayerIndex()===state.ownerIndex&&
            state.peeksRemaining>0&&
            !state.busy&&
            !state.currentPeek
        );
    }

    function buildIllusionOverlay(effect,card,cardElement){
        const data=effect.data||{};
        const decoy=data.decoyCard||{};
        const number=Number(data.illusionNumber)||1;
        const peeking=state.currentPeek?.effectId===effect.effectId;

        cardElement.classList.add("spx-mysterio-illusion-card");
        cardElement.dataset.mysterioIllusion=String(number);
        // Identity metadata remains masked while the card is an illusion. The real
        // card is shown by the card DOM itself during a Peek, never via tooltip.
        cardElement.removeAttribute("data-card-name");
        cardElement.title=peeking
            ? "MYSTERIO — PODGLĄD. Iluzja chwilowo opadła."
            : `MYSTERIO — ILUZJA #${number}. Kliknięcie karty oznacza pick w ciemno.`;
        cardElement.setAttribute("aria-label",peeking
            ? `Podgląd Mysterio. Ujawniona karta: ${card?.name||"nieznana"}, koszt ${card?.cost??"?"}, siła ${card?.power??"?"}`
            : `Iluzja Mysterio numer ${number}. Prawdziwa tożsamość karty jest ukryta.`
        );

        // CANON: Peek is a literal visual reveal. Do not render the illusion layer
        // at all for the peeked card; the real pack-card-inner stays visible.
        if(peeking) return;

        const overlay=document.createElement("span");
        overlay.className="spx-mysterio-illusion";
        overlay.dataset.illusionEffectId=effect.effectId;
        overlay.style.setProperty("--mysterio-frame-offset",String((number-1)%8));
        overlay.style.setProperty("--mysterio-stagger",`${Math.min(780,(number-1)*42)}ms`);
        overlay.innerHTML=`
            <span class="spx-mysterio-smoke-sheet" aria-hidden="true"></span>
            <span class="spx-mysterio-smoke-ribbon ribbon-a" aria-hidden="true"></span>
            <span class="spx-mysterio-smoke-ribbon ribbon-b" aria-hidden="true"></span>
            <span class="spx-mysterio-hologram-face">
                <span class="spx-mysterio-decoy-cost">${escapeHtml(decoy.cost??"?")}</span>
                <img src="draft-assets/mysteriopowerslogo.png" alt="" aria-hidden="true">
                <strong>${escapeHtml(decoy.name||"NIEZNANA KARTA")}</strong>
                <span class="spx-mysterio-decoy-power">${escapeHtml(decoy.power??"?")}</span>
            </span>
            <span class="spx-mysterio-illusion-number">ILUZJA #${number}</span>
            <span class="spx-mysterio-glitch" aria-hidden="true"></span>
        `;
        if(canPeek(effect)){
            const control=document.createElement("span");
            control.className="spx-mysterio-peek-control";
            control.setAttribute("role","button");
            control.setAttribute("tabindex","0");
            control.setAttribute("aria-label",`Podejrzyj Iluzję numer ${number}`);
            control.innerHTML="<b>◉</b> PODEJRZYJ";
            const activate=event=>{
                event.preventDefault();
                event.stopPropagation();
                peek(effect.effectId);
            };
            control.addEventListener("click",activate);
            control.addEventListener("keydown",event=>{
                if(event.key==="Enter"||event.key===" ") activate(event);
            });
            overlay.appendChild(control);
        }
        cardElement.appendChild(overlay);
    }

    function afterPackRendered(){
        syncPreopenPrivacy();
        document.querySelectorAll("#pack .spx-mysterio-illusion").forEach(node=>node.remove());
        document.querySelectorAll("#pack .spx-mysterio-illusion-card").forEach(node=>{
            node.classList.remove("spx-mysterio-illusion-card","spx-mysterio-peek-open","spx-mysterio-pattern-hit");
            node.querySelectorAll(":scope > .spx-mysterio-pattern-hit-badge,:scope > .spx-mysterio-peek-window-badge,:scope > .spx-mysterio-reveal-label").forEach(badge=>badge.remove());
            delete node.dataset.mysterioIllusion;
        });
        if(!sameSourcePack()){
            updateHud();
            return;
        }
        // Statusy iluzji są przygotowywane przed otwarciem paczki, ale ich
        // warstwa wizualna nie może zdradzać kart na zamkniętym stole.
        if(adapter.isPackOpen?.()!==true){
            updateHud();
            return;
        }
        onTurnChanged();
        activeEffects().forEach(effect=>{
            const card=findCurrentCard(effect.targetCardInstanceId);
            const element=findCardElement(effect.targetCardInstanceId);
            if(!card||!element) return;
            if(state.currentPeek?.effectId===effect.effectId){
                element.classList.add("spx-mysterio-peek-open");
                const peekBadge=document.createElement("span");
                peekBadge.className="spx-mysterio-peek-window-badge";
                peekBadge.textContent="PODGLĄD";
                element.appendChild(peekBadge);
                if(String(card?.instanceId||"")===String(state.sharedDecoySourceInstanceId||"")){
                    element.classList.add("spx-mysterio-pattern-hit");
                    const badge=document.createElement("span");
                    badge.className="spx-mysterio-pattern-hit-badge";
                    badge.textContent="WZORZEC TRAFIONY";
                    element.appendChild(badge);
                }
            }
            buildIllusionOverlay(effect,card,element);
        });
        updateHud();
    }

    function peek(effectId){
        const effect=getEffect(effectId);
        onTurnChanged();
        if(!canPeek(effect)){
            feedback("warning","PODGLĄD NIEDOSTĘPNY","Mysterio ma jedną pulę czterech Podglądów na swoją podwójną turę. Podgląd działa tylko na aktywną iluzję przed jego pickiem.");
            return false;
        }
        const card=findCurrentCard(effect.targetCardInstanceId);
        if(!card){
            global.DraftStateEngine?.removePackEffect?.(state.sourcePackId,effect.effectId,"mysterio_peek_target_missing");
            afterPackRendered();
            return false;
        }
        state.peeksRemaining=Math.max(0,state.peeksRemaining-1);
        const token=++peekToken;
        const now=Date.now();
        state.currentPeek={
            effectId:effect.effectId,
            instanceId:card.instanceId,
            token,
            startedAt:now,
            expiresAt:now+PEEK_DURATION_MS
        };
        const discovery=registerReflectionDiscovery(effect,card);
        addSuperpowerLog("mysterio_public_peek",{
            type:"superpower_resolution",
            illusionNumber:Number(effect.data?.illusionNumber)||null,
            revealedCard:card.name||null,
            revealedInstanceId:card.instanceId||null,
            peeksRemaining:state.peeksRemaining,
            durationMs:PEEK_DURATION_MS,
            hitPattern:Boolean(discovery)
        });
        afterPackRendered();
        const element=findCardElement(card.instanceId);
        element?.classList.add("spx-mysterio-peek-flash");
        schedulePeekExpiry(token);
        // CANON PATCH112A: hitting the real Pattern with Peek resolves the loot choice
        // immediately, before any normal pick can finalize. Peek and Loot are discovery flow;
        // a normal pick is a separate action and must never be combined with the loot copy.
        if(discovery && !state.busy){
            resolvePendingReflectionDiscovery().catch(error=>console.error("Mysterio reflection discovery failed:",error));
        }
        return true;
    }

    function onPickStartedByElement(element){
        if(!sameSourcePack()||!element) return null;
        const effect=activeEffects().find(entry=>String(entry.targetCardInstanceId||"")===String(element.dataset.cardInstanceId||""));
        if(!effect) return null;
        const card=findCurrentCard(effect.targetCardInstanceId);
        if(state.currentPeek) clearPeek({rerender:false});
        element.classList.add("spx-mysterio-pick-reveal");
        const overlay=element.querySelector(".spx-mysterio-illusion");
        overlay?.classList.add("is-picked");
        element.querySelectorAll(":scope > .spx-mysterio-reveal-label").forEach(node=>node.remove());
        const label=document.createElement("span");
        label.className="spx-mysterio-reveal-label";
        label.innerHTML=`<small>ILUZJA OPADA</small><strong>${escapeHtml(card?.name||"NIEZNANA KARTA")}</strong>`;
        element.appendChild(label);
        return {
            effectId:effect.effectId,
            illusionNumber:Number(effect.data?.illusionNumber)||null,
            decoyCard:clone(effect.data?.decoyCard||null),
            realCardName:card?.name||null,
            revealHoldMs:430
        };
    }

    function removeEffect(effect,reason){
        if(!effect||effect.status!=="active") return null;
        return global.DraftStateEngine?.removePackEffect?.(state.sourcePackId,effect.effectId,reason)||null;
    }

    function setSharedDecoy(card,reason="mysterio_shared_decoy_reanchored"){
        if(!card||card.joker||!card.name||!card.instanceId) return null;
        const snapshot=decoySnapshot(card);
        state.sharedDecoyCard=clone(snapshot);
        state.sharedDecoySourceInstanceId=card.instanceId;
        activeEffects().forEach(effect=>{
            global.DraftStateEngine?.updatePackEffect?.(state.sourcePackId,effect.effectId,{
                data:{
                    ...(effect.data||{}),
                    decoyCard:clone(snapshot),
                    decoySourceInstanceId:card.instanceId,
                    sharedDecoy:true,
                    sharedDecoyReason:reason
                }
            });
        });
        addSuperpowerLog("mysterio_shared_decoy_reanchored",{
            type:"superpower_state",
            sharedDecoyCard:card.name,
            sharedDecoySourceInstanceId:card.instanceId,
            reason
        });
        return snapshot;
    }

    function collapseTrivialIllusion(reason="mysterio_last_illusion_collapsed"){
        const live=activeEffects();
        if(live.length>1) return false;
        if(state.currentPeek) clearPeek({rerender:false});
        live.forEach(effect=>removeEffect(effect,reason));
        state.sharedDecoyCard=null;
        state.sharedDecoySourceInstanceId=null;
        state.peeksRemaining=0;
        addSuperpowerLog("mysterio_last_illusion_collapsed",{
            type:"superpower_state",
            reason,
            revealedIllusionCount:live.length
        });
        return true;
    }

    function reanchorSharedDecoy(reason,preferredCard=null,options={}){
        if(collapseTrivialIllusion(`${reason}_trivial`)) return null;
        const excluded=new Set((options.excludeInstanceIds||[]).map(String));
        const preferredEffect=preferredCard?findEffectForCard(preferredCard):null;
        if(
            preferredEffect&&preferredCard&&!preferredCard.joker&&preferredCard.name&&
            !excluded.has(String(preferredCard.instanceId||""))
        ){
            return setSharedDecoy(preferredCard,reason);
        }
        let candidates=activeEffects()
            .map(effect=>findCurrentCard(effect.targetCardInstanceId))
            .filter(card=>card&&!card.joker&&card.name&&card.instanceId&&!excluded.has(String(card.instanceId)));
        if(!candidates.length && !options.requireDifferent){
            candidates=activeEffects()
                .map(effect=>findCurrentCard(effect.targetCardInstanceId))
                .filter(card=>card&&!card.joker&&card.name&&card.instanceId);
        }
        const candidate=shuffle(candidates)[0]||null;
        if(candidate) return setSharedDecoy(candidate,reason);
        if(options.requireDifferent){
            const stranded=activeEffects();
            stranded.forEach(effect=>removeEffect(effect,`${reason}_no_new_pattern`));
            state.sharedDecoyCard=null;
            state.sharedDecoySourceInstanceId=null;
            state.peeksRemaining=0;
            addSuperpowerLog("mysterio_pattern_reanchor_exhausted",{
                type:"superpower_state",
                reason,
                removedIllusions:stranded.length
            });
            return null;
        }
        state.sharedDecoyCard=null;
        state.sharedDecoySourceInstanceId=null;
        return null;
    }

    function maintainIllusionCoherence(reason="mysterio_state_changed",options={}){
        if(collapseTrivialIllusion(`${reason}_trivial`)) return {collapsed:true};
        const sourceId=String(state.sharedDecoySourceInstanceId||"");
        const sourceStillCovered=activeEffects().some(effect=>String(effect?.targetCardInstanceId||"")===sourceId);
        if(!sourceStillCovered){
            reanchorSharedDecoy(`${reason}_reanchor`,null,options);
            return {collapsed:false,reanchored:true};
        }
        return {collapsed:false,reanchored:false};
    }

    function revealForExternalEffect(card,context={}){
        if(!sameSourcePack()||!card) return null;
        const effect=findEffectForCard(card);
        if(!effect) return null;
        const wasSource=String(card?.instanceId||"")===String(state.sharedDecoySourceInstanceId||"");
        const removed=removeEffect(effect,context.reason||"mysterio_external_effect_reveal");
        if(state.currentPeek?.effectId===effect.effectId) clearPeek({rerender:false});
        maintainIllusionCoherence(context.reason||"mysterio_external_effect_reveal",{
            excludeInstanceIds:wasSource?[card.instanceId]:[]
        });
        addSuperpowerLog("mysterio_external_effect_revealed",{
            type:"superpower_resolution",
            illusionNumber:Number(effect.data?.illusionNumber)||null,
            realCard:card?.name||null,
            realCardInstanceId:card?.instanceId||null,
            wasPattern:wasSource,
            reason:context.reason||"external_effect"
        });
        if(context.rerender!==false) afterPackRendered();
        return removed;
    }

    function offerReflectionLoot(context){
        const decoy=context?.decoyCard;
        const decoySourceId=String(context?.decoySourceInstanceId||"");
        const offered=new Set((state.offeredDecoySourceInstanceIds||[]).map(String));
        const ownerDeck=adapter.getDecks?.()?.[state.ownerIndex];
        if(state.reflectionLootUsed){
            return Promise.resolve({accepted:false,reason:"reflection_loot_already_used"});
        }
        if(decoySourceId&&offered.has(decoySourceId)){
            return Promise.resolve({accepted:false,reason:"pattern_offer_already_resolved"});
        }
        if(!decoy?.name||!Array.isArray(ownerDeck)||!ownerDeck.length||typeof adapter.commitReflectionLoot!=="function"){
            return Promise.resolve({accepted:false,reason:"no_legal_loot"});
        }
        if(decoySourceId){
            state.offeredDecoySourceInstanceIds=[...new Set([
                ...(state.offeredDecoySourceInstanceIds||[]).map(String),
                decoySourceId
            ])];
        }
        state.busy=true;
        updateHud();
        return new Promise(resolve=>{
            document.querySelectorAll(".spx-mysterio-loot-overlay").forEach(node=>node.remove());
            const overlay=document.createElement("div");
            overlay.className="spx-mysterio-loot-overlay";
            overlay.innerHTML=`
                <section class="spx-mysterio-loot" role="dialog" aria-modal="true" aria-labelledby="spxMysterioLootTitle">
                    <header>
                        <img src="draft-assets/mysteriopowerslogo.png" alt="">
                        <div><small>TRAFIONO WZORZEC ILUZJI</small><h2 id="spxMysterioLootTitle">UKRAŚĆ WZORZEC?</h2></div>
                    </header>
                    <p>Podgląd Mysterio trafił w prawdziwy Wzorzec: <b>${escapeHtml(decoy.name)}</b>. Możesz stworzyć jego jedną kopię jako Łup i wymienić za nią dokładnie jedną kartę ze swojego decku. Nie zużywa to picku.</p>
                    <div class="spx-mysterio-loot-preview">
                        <span>${escapeHtml(decoy.cost??"?")}</span><strong>${escapeHtml(decoy.name)}</strong><span>${escapeHtml(decoy.power??"?")}</span>
                    </div>
                    <div class="spx-mysterio-loot-deck" data-mysterio-loot-deck></div>
                    <div class="spx-mysterio-loot-message" data-mysterio-loot-message></div>
                    <footer><button type="button" data-mysterio-loot-decline>NIE — ZOSTAW WZORZEC</button></footer>
                </section>
            `;
            const deckRoot=overlay.querySelector("[data-mysterio-loot-deck]");
            const message=overlay.querySelector("[data-mysterio-loot-message]");
            ownerDeck.forEach((card,index)=>{
                const legal=adapter.canReplaceDeckCard?.(state.ownerIndex,index)!==false;
                const button=document.createElement("button");
                button.type="button";
                button.className="spx-mysterio-loot-card";
                button.disabled=!legal;
                button.innerHTML=`<span>${escapeHtml(card?.cost??"?")}</span><strong>${escapeHtml(card?.name||"KARTA")}</strong><span>${escapeHtml(card?.power??"?")}</span><small>${legal?"WYMIENIAM":"CHRONIONA"}</small>`;
                button.addEventListener("click",()=>{
                    const result=adapter.commitReflectionLoot({
                        playerName:state.ownerName,
                        playerIndex:state.ownerIndex,
                        replacementIndex:index,
                        decoyCard:clone(decoy),
                        illusionNumber:context.illusionNumber,
                        sourceCard:clone(context.sourceCard||null)
                    });
                    if(!result?.ok){
                        message.textContent=result?.reason||"Nie udało się zachować Wzorca.";
                        return;
                    }
                    state.reflectionLootUsed=true;
                    state.pendingReflectionDiscovery=null;
                    addSuperpowerLog("mysterio_reflection_loot_kept",{
                        type:"superpower_resolution",
                        illusionNumber:context.illusionNumber,
                        copiedCard:result.copyCard?.name||decoy.name,
                        replacedCard:result.replacedCard?.name||null,
                        resultCardInstanceId:result.copyCard?.instanceId||null,
                        decoySourceInstanceId:decoySourceId||null,
                        pickConsumed:false
                    });
                    // The Peeked source must disappear back under the illusion immediately.
                    // Loot does not consume the normal pick; it only replaces one deck card 1:1.
                    if(state.currentPeek) clearPeek({rerender:false});
                    if(decoySourceId&&String(state.sharedDecoySourceInstanceId||"")===decoySourceId){
                        reanchorSharedDecoy("mysterio_reflection_pattern_stolen",null,{
                            excludeInstanceIds:[decoySourceId],
                            requireDifferent:true
                        });
                    }else{
                        maintainIllusionCoherence("mysterio_reflection_pattern_stolen",{
                            excludeInstanceIds:decoySourceId?[decoySourceId]:[]
                        });
                    }
                    overlay.classList.add("is-closing");
                    adapter.refreshDecks?.();
                    adapter.refreshPack?.();
                    state.busy=false;
                    updateHud();
                    global.setTimeout(()=>{overlay.remove();resolve({accepted:true,result});},240);
                });
                deckRoot.appendChild(button);
            });
            overlay.querySelector("[data-mysterio-loot-decline]").addEventListener("click",()=>{
                state.pendingReflectionDiscovery=null;
                addSuperpowerLog("mysterio_reflection_loot_declined",{
                    type:"superpower_resolution",
                    illusionNumber:context.illusionNumber,
                    copiedCard:decoy.name,
                    decoySourceInstanceId:decoySourceId||null
                });
                overlay.classList.add("is-closing");
                state.busy=false;
                updateHud();
                global.setTimeout(()=>{overlay.remove();resolve({accepted:false});},200);
            });
            document.body.appendChild(overlay);
            overlay.querySelector("[data-mysterio-loot-decline]")?.focus();
        });
    }

    function onPickFinalized(context={}){
        if(!sameSourcePack()) return null;
        clearPeek({rerender:false});
        const sourceCard=context.sourceCard||context.card;
        const effect=findEffectForCard(sourceCard);
        const pickedWasIllusion=Boolean(effect);
        const pickedIllusion=effect?{
            effectId:effect.effectId,
            illusionNumber:Number(effect.data?.illusionNumber)||null,
            decoyCard:clone(effect.data?.decoyCard||null),
            decoySourceInstanceId:effect.data?.decoySourceInstanceId||state.sharedDecoySourceInstanceId||null,
            sourceCard:clone(sourceCard)
        }:null;
        if(effect){
            const wasSource=String(sourceCard?.instanceId||"")===String(state.sharedDecoySourceInstanceId||"");
            removeEffect(effect,"mysterio_illusion_left_with_picked_card");
            maintainIllusionCoherence("mysterio_illusion_left_with_picked_card",{
                excludeInstanceIds:wasSource?[sourceCard.instanceId]:[]
            });
            addSuperpowerLog("mysterio_blind_pick_revealed",{
                type:"superpower_resolution",
                pickerIndex:Number(context.playerIndex),
                pickerName:(adapter.getPlayers?.()||[])[Number(context.playerIndex)]||null,
                illusionNumber:pickedIllusion.illusionNumber,
                realCard:sourceCard?.name||null,
                realCardInstanceId:sourceCard?.instanceId||null,
                wasPattern:wasSource,
                remainingIllusions:activeEffects().length
            });
        }
        if(Number(context.playerIndex)===state.ownerIndex){
            state.ownerPicksCompleted=Math.min(2,state.ownerPicksCompleted+1);
            if(state.ownerPicksCompleted>=2){
                state.peeksRemaining=0;
                state.peekTurnKey=null;
            }
        }

        const silent=Boolean(context?.details?.data?.devSimulated||global.__SNAPDRAFT_DEV_FAST_FORWARD__);
        // CANON PATCH112A: the Pattern offer belongs to Peek, never to pick finalization.
        // If a stale discovery somehow survives until a pick, discard it rather than creating
        // the old illegal pick + loot duplication path.
        if(state.pendingReflectionDiscovery){
            addSuperpowerLog("mysterio_stale_pattern_offer_discarded_on_pick",{
                type:"superpower_state",
                pickedCard:sourceCard?.name||null,
                pickedInstanceId:sourceCard?.instanceId||null,
                silent
            });
            state.pendingReflectionDiscovery=null;
        }
        updateHud();
        return {pickedWasIllusion,silent};
    }

    function takePendingPickResolution(){
        if(!pendingPickResolution) return null;
        const factory=pendingPickResolution;
        pendingPickResolution=null;
        try{return Promise.resolve(factory());}
        catch(error){
            console.error("Mysterio pick resolution failed:",error);
            return Promise.resolve();
        }
    }

    function transferIllusion(sourceCard,replacementCard,context={}){
        if(!sameSourcePack()||!sourceCard||!replacementCard?.instanceId) return null;
        const effect=findEffectForCard(sourceCard);
        if(!effect) return null;
        const patch={
            targetCardInstanceId:replacementCard.instanceId,
            targetPosition:Number.isInteger(Number(context.targetPosition))?Number(context.targetPosition):effect.targetPosition,
            data:{
                ...(effect.data||{}),
                transferredFromInstanceId:sourceCard.instanceId||null,
                lastTransferReason:context.reason||"card_transformed_under_illusion",
                lastTransferredAt:Date.now()
            }
        };
        const updated=global.DraftStateEngine?.updatePackEffect?.(state.sourcePackId,effect.effectId,patch)||null;
        const sourceWasPattern=String(sourceCard.instanceId||"")===String(state.sharedDecoySourceInstanceId||"");
        if(sourceWasPattern){
            // The incoming card may be publicly known (Strange, Thor, rerolls).
            // Never automatically make that exact visible replacement the new pattern.
            reanchorSharedDecoy("mysterio_decoy_source_transformed",null,{excludeInstanceIds:[replacementCard.instanceId]});
        }else{
            maintainIllusionCoherence("mysterio_illusion_transferred");
        }
        if(state.currentPeek?.effectId===effect.effectId){
            state.currentPeek.instanceId=replacementCard.instanceId;
        }
        addSuperpowerLog("mysterio_illusion_transferred",{
            type:"superpower_state",
            illusionNumber:Number(effect.data?.illusionNumber)||null,
            sourceCardInstanceId:sourceCard.instanceId||null,
            resultCardInstanceId:replacementCard.instanceId||null,
            reason:context.reason||"card_transformed_under_illusion"
        });
        return updated;
    }

    function onCardLeavesPack(card,context={}){
        if(!sameSourcePack()||context.preserveIllusion) return null;
        const effect=findEffectForCard(card);
        if(!effect) return null;
        const wasSource=String(card?.instanceId||"")===String(state.sharedDecoySourceInstanceId||"");
        if(state.currentPeek?.effectId===effect.effectId) clearPeek({rerender:false});
        const removed=removeEffect(effect,context.reason||"mysterio_target_left_source_pack");
        maintainIllusionCoherence(context.reason||"mysterio_target_left_source_pack",{
            excludeInstanceIds:wasSource?[card.instanceId]:[]
        });
        addSuperpowerLog("mysterio_illusion_removed_with_card",{
            type:"superpower_state",
            illusionNumber:Number(effect.data?.illusionNumber)||null,
            targetCardInstanceId:card?.instanceId||null,
            wasPattern:wasSource,
            remainingIllusions:activeEffects().length,
            reason:context.reason||"card_left_source_pack"
        });
        return removed;
    }

    function cleanupPack(reason="pack_completed"){
        if(!state.active) return false;
        clearPeek({rerender:false});
        activeEffects().forEach(effect=>removeEffect(effect,`mysterio_cleanup_${reason}`));
        addSuperpowerLog("mysterio_grand_illusion_ended",{
            type:"superpower_state",
            reason,
            ownerPicksCompleted:state.ownerPicksCompleted
        });
        state.active=false;
        state.busy=false;
        state.peeksRemaining=0;
        state.peekTurnKey=null;
        state.pendingReflectionDiscovery=null;
        pendingPickResolution=null;
        document.body.classList.remove("spx-mysterio-active","spx-mysterio-casting","spx-mysterio-preopen");
        document.querySelectorAll(".spx-mysterio-illusion,.spx-mysterio-activation,.spx-mysterio-loot-overlay").forEach(node=>node.remove());
        document.getElementById("spxMysterioHud")?.remove();
        return true;
    }

    function exportState(){
        return clone({
            version:VERSION,
            ...state,
            currentPeek:null,
            busy:false
        });
    }

    function restoreState(payload){
        clearPeek({rerender:false});
        pendingPickResolution=null;
        if(!payload||typeof payload!=="object"){
            state=createEmptyState();
            return false;
        }
        const legacyCopied=Array.isArray(payload?.copiedDecoySourceInstanceIds)
            ? payload.copiedDecoySourceInstanceIds.map(String).filter(Boolean)
            : [];
        state={...createEmptyState(),...clone(payload),currentPeek:null,busy:false};
        state.reflectionLootUsed=Boolean(state.reflectionLootUsed||legacyCopied.length);
        state.offeredDecoySourceInstanceIds=[...new Set(
            (Array.isArray(state.offeredDecoySourceInstanceIds)?state.offeredDecoySourceInstanceIds:legacyCopied)
                .map(String)
                .filter(Boolean)
        )];
        state.peeksRemaining=Math.max(0,Math.min(PEEKS_PER_ACTIVATION,Number(state.peeksRemaining)||0));
        if(Number(state.ownerPicksCompleted)>=2){
            state.peeksRemaining=0;
            state.peekTurnKey=null;
        }
        if(state.active&&(!state.sourcePackId||!activeEffects().length)){
            state.active=false;
            state.peeksRemaining=0;
            state.peekTurnKey=null;
        }else if(state.active){
            const firstEffect=activeEffects()[0]||null;
            state.sharedDecoyCard=clone(state.sharedDecoyCard||firstEffect?.data?.decoyCard||null);
            state.sharedDecoySourceInstanceId=state.sharedDecoySourceInstanceId||firstEffect?.data?.decoySourceInstanceId||null;
            const anchor=findCurrentCard(state.sharedDecoySourceInstanceId);
            if(!anchor||!findEffectForCard(anchor)){
                reanchorSharedDecoy("mysterio_restore_reanchor");
            }
        }
        document.body.classList.toggle("spx-mysterio-active",Boolean(state.active));
        syncPreopenPrivacy();
        global.setTimeout(()=>afterPackRendered(),0);
        return true;
    }

    function getStatus(){
        return clone({
            ...state,
            activeIllusions:activeEffects().length,
            currentPlayerIndex:currentPlayerIndex(),
            currentPickIndex:currentPickIndex()
        });
    }

    global.MysterioUI=Object.freeze({
        VERSION,
        POWER_ID,
        EFFECT_TYPE,
        configure,
        reset,
        start,
        afterPackRendered,
        onTurnChanged,
        onPickStartedByElement,
        onPickFinalized,
        takePendingPickResolution,
        transferIllusion,
        onCardLeavesPack,
        cleanupPack,
        exportState,
        restoreState,
        getStatus,
        isIllusionCard,
        getPublicCardSnapshot,
        getPublicCardLabel,
        revealForExternalEffect,
        getActiveIllusions:()=>clone(activeEffects())
    });
})(window);
