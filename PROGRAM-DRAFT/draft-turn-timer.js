(function(global){
    "use strict";

    const VERSION="1.1-system-stability";
    const POLL_MS=100;
    const OPENER_BONUS_SECONDS=10;

    const state={
        enabled:false,
        baseSeconds:0,
        remainingMs:0,
        turnKey:null,
        playerIndex:null,
        openerBonus:false,
        manualPaused:false,
        expired:false,
        status:"disabled",
        pauseReason:"",
        lastTickAt:Date.now(),
        restored:false
    };

    let intervalId=null;
    let bonusHideTimer=null;

    function byId(id){ return document.getElementById(id); }


    function runtimeState(){
        return {
            draftFinished:typeof draftFinished!=="undefined"?Boolean(draftFinished):Boolean(global.draftFinished),
            pickOrder:typeof pickOrder!=="undefined"&&Array.isArray(pickOrder)?pickOrder:(Array.isArray(global.pickOrder)?global.pickOrder:[]),
            currentPickIndex:typeof currentPickIndex!=="undefined"?Number(currentPickIndex):Number(global.currentPickIndex),
            packStartIndex:typeof packStartIndex!=="undefined"?Number(packStartIndex):Number(global.packStartIndex),
            packIsOpen:typeof packIsOpen!=="undefined"?Boolean(packIsOpen):Boolean(global.packIsOpen),
            packOpeningInProgress:typeof packOpeningInProgress!=="undefined"?Boolean(packOpeningInProgress):Boolean(global.packOpeningInProgress),
            packEnding:typeof packEnding!=="undefined"?Boolean(packEnding):Boolean(global.packEnding)
        };
    }

    function getConfiguredSeconds(){
        const input=byId("turnTimerSeconds");
        const value=Number(input?.value||0);
        return Number.isFinite(value)&&value>0 ? Math.round(value) : 0;
    }

    function isVisibleElement(element){
        if(!element || element.hidden) return false;
        const style=global.getComputedStyle?.(element);
        if(style && (style.display==="none" || style.visibility==="hidden" || Number(style.opacity)===0)) return false;
        const rect=element.getBoundingClientRect?.();
        return !rect || rect.width>0 || rect.height>0;
    }

    function hasVisibleBlockingDialog(){
        const selectors=[
            '[aria-modal="true"]',
            '#reshuffleOverlay',
            '#surpriseJokerModal',
            '#spxDinoBackupPrompt',
            '#spxThorOverlay',
            '#spxDoomResultOverlay',
            '#spxDeadpoolResult',
            '#spxLokiMagicLayer',
            '#spxHulkImpactLayer',
            '#spxSpiderWebLayer',
            '#spxJeffSwimLayer',
            '#spxRocketExplosion',
            '#spxDoomForgeLayer',
            '#spxDeadpoolStage',
            '#spxCaptainActivationLayer',
            '#spxCaptainReadyPrompt',
            '#spxCaptainRicochetLayer',
            '#spxVenomFeastLayer',
            '#spxThorCinematicLayer',
            '[id^="spx"][id$="Overlay"]',
            '[id^="spx"][id$="Modal"]'
        ];
        const nodes=new Set();
        selectors.forEach(selector=>{
            document.querySelectorAll(selector).forEach(node=>nodes.add(node));
        });
        for(const node of nodes){
            if(!isVisibleElement(node)) continue;
            if(node.id==="spmOverlay" && !node.classList.contains("spm-is-open")) continue;
            if(node.id==="spmManualOverlay" && node.getAttribute("aria-hidden")==="true") continue;
            return true;
        }
        return false;
    }

    function currentContext(){
        const runtime=runtimeState();
        if(runtime.draftFinished) return null;
        const order=runtime.pickOrder;
        const pickIndex=runtime.currentPickIndex;
        if(!Number.isInteger(pickIndex) || pickIndex<0 || pickIndex>=order.length) return null;
        const playerIndex=Number(order[pickIndex]);
        if(!Number.isInteger(playerIndex)) return null;

        const gc=global.GalacticCurrent?.getState?.();
        const currentActive=Boolean(gc?.active);
        const packIndex=runtime.packStartIndex||0;
        const phase=currentActive
            ? `current:${Number(gc.round)||0}`
            : `pack:${packIndex}`;
        const key=`${phase}:pick:${pickIndex}:player:${playerIndex}`;
        const opener=currentActive
            ? Number(gc.round)===0 && pickIndex===0
            : pickIndex===0;

        return {key,playerIndex,pickIndex,packIndex,opener,currentActive};
    }

    function automaticPauseReason(){
        if(!state.enabled) return "";
        if(!document.body.classList.contains("draft-active")) return "OCZEKIWANIE NA DRAFT";
        const runtime=runtimeState();
        if(runtime.draftFinished) return "DRAFT ZAKOŃCZONY";
        if(!runtime.packIsOpen) return "OCZEKIWANIE NA PACZKĘ";
        if(runtime.packOpeningInProgress) return "OTWIERANIE PACZKI";
        if(runtime.packEnding) return "ROZSTRZYGANIE PICKU";
        if(document.body.classList.contains("draft-transitioning")) return "PRZEJŚCIE DRAFTU";

        const pack=byId("pack");
        if(pack?.classList.contains("pre-reveal") || pack?.classList.contains("revealing")) return "ODKRYWANIE PACZKI";
        if(pack?.classList.contains("clearing")) return "ZAMYKANIE PACZKI";

        const current=global.GalacticCurrent?.getState?.();
        if(current?.active && current.isResolving) return "PRĄD ROZSTRZYGA PICK";
        if(current?.active && current.isFinishing) return "PRĄD KOŃCZY OBIEG";

        if(global.SuperpowerUI?.isBusy?.()) return "AKTYWNA SUPERMOC";
        if(global.JokerV2UI?.isBusy?.()) return "ROZSTRZYGANIE JOKERA";
        if(global.DraftFoundation?.hasOpenTransaction?.()) return "ROZSTRZYGANIE EFEKTU";
        if(global.BountyEngine?.hasPendingPresentations?.()) return "ROZSTRZYGANIE NAGRÓD";
        if(global.GraveyardUI?.isOpen?.()) return "OTWARTE CMENTARZYSKO";
        if(hasVisibleBlockingDialog()) return "AKTYWNE OKNO DRAFTU";

        return "";
    }

    function setBodyMode(){
        document.body.classList.toggle("draft-turn-timer-enabled",state.enabled);
    }

    function timerRoot(){ return byId("draftTurnTimer"); }
    function hudRoot(){ return byId("draftTurnHud"); }

    function syncHudPortal(){
        const hud=hudRoot();
        if(!hud) return;
        const stage=byId("packStage");
        const pack=byId("pack");
        if(stage && hud.parentNode!==stage){
            if(pack && pack.parentNode===stage){
                stage.insertBefore(hud,pack.nextSibling);
            }else{
                stage.appendChild(hud);
            }
        }
        hud.classList.remove("draft-turn-hud-portal");
    }

    function showOpenerBonus(){
        if(!state.openerBonus) return;
        const badge=byId("draftTurnTimerBonus");
        if(!badge) return;
        if(bonusHideTimer) global.clearTimeout(bonusHideTimer);
        badge.textContent=`+${OPENER_BONUS_SECONDS} s • PIERWSZY PICK`;
        badge.classList.remove("is-visible");
        void badge.offsetWidth;
        badge.classList.add("is-visible");
        bonusHideTimer=global.setTimeout(()=>badge.classList.remove("is-visible"),2850);
    }

    function startNewTurn(context){
        const seconds=state.baseSeconds+(context.opener?OPENER_BONUS_SECONDS:0);
        state.turnKey=context.key;
        state.playerIndex=context.playerIndex;
        state.openerBonus=Boolean(context.opener);
        state.remainingMs=Math.max(0,seconds*1000);
        state.expired=false;
        state.status="waiting";
        state.pauseReason="";
        state.lastTickAt=Date.now();
        state.restored=false;
        render();
        showOpenerBonus();
    }

    function ensureTurn(){
        const context=currentContext();
        if(!context) return null;
        if(state.turnKey!==context.key){
            startNewTurn(context);
        }else{
            state.playerIndex=context.playerIndex;
        }
        return context;
    }

    function displayedSeconds(){
        if(state.remainingMs<=0) return 0;
        return Math.max(0,Math.ceil(state.remainingMs/1000));
    }

    function render(){
        const root=timerRoot();
        const hud=hudRoot();
        if(!root || !hud) return;

        setBodyMode();
        syncHudPortal();
        root.hidden=!state.enabled;

        const context=currentContext();
        const canShow=Boolean(
            state.enabled &&
            document.body.classList.contains("draft-active") &&
            !runtimeState().draftFinished &&
            runtimeState().packIsOpen &&
            context
        );
        hud.classList.toggle("timer-hud-hidden",state.enabled && !canShow);

        const value=byId("draftTurnTimerValue");
        const status=byId("draftTurnTimerStatus");
        const pauseButton=byId("draftTurnTimerPause");
        const playButton=byId("draftTurnTimerPlay");
        if(value) value.textContent=String(displayedSeconds());

        const totalSeconds=state.baseSeconds+(state.openerBonus?OPENER_BONUS_SECONDS:0);
        const totalMs=Math.max(1,totalSeconds*1000);
        const progress=Math.max(0,Math.min(1,state.remainingMs/totalMs));
        root.style.setProperty("--timer-angle",`${(progress*360).toFixed(2)}deg`);

        const seconds=displayedSeconds();
        root.classList.toggle("is-warning",!state.expired && seconds<=10 && seconds>5);
        root.classList.toggle("is-critical",!state.expired && seconds<=5);
        root.classList.toggle("is-expired",state.expired);
        root.classList.toggle("is-paused",state.status==="paused" || state.status==="waiting");

        if(status){
            if(state.expired){
                status.textContent="CZAS MINĄŁ";
                status.title="Czas wyboru minął. Timer v1 nie uruchamia jeszcze Autopilota.";
            }else if(state.manualPaused){
                status.textContent="PAUZA HOSTA";
                status.title="Timer zatrzymany ręcznie przez hosta.";
            }else if(state.status==="paused" || state.status==="waiting"){
                status.textContent="CZAS WSTRZYMANY";
                status.title=state.pauseReason||"Timer czeka na zakończenie aktywnej sekwencji.";
            }else{
                status.textContent="";
                status.title="";
            }
        }
        if(pauseButton) pauseButton.disabled=state.manualPaused || state.expired || !canShow;
        if(playButton) playButton.disabled=!state.manualPaused || state.expired || !canShow;
    }

    function tick(){
        const now=Date.now();
        const elapsed=Math.max(0,now-state.lastTickAt);
        state.lastTickAt=now;

        if(!state.enabled){
            state.status="disabled";
            render();
            return;
        }

        const previousTurnKey=state.turnKey;
        const context=ensureTurn();
        if(!context){
            state.status="waiting";
            state.pauseReason="OCZEKIWANIE NA RUCH";
            render();
            return;
        }
        if(previousTurnKey!==state.turnKey){
            // Pierwszy tick nowej tury tylko inicjuje pełny limit.
            // Nie odejmujemy opóźnienia samego pollera od świeżo przyznanego czasu.
            render();
            return;
        }

        if(state.expired){
            state.status="expired";
            state.remainingMs=0;
            render();
            return;
        }

        if(!runtimeState().packIsOpen){
            state.status="waiting";
            state.pauseReason="OCZEKIWANIE NA PACZKĘ";
            render();
            return;
        }

        const autoReason=automaticPauseReason();
        if(state.manualPaused || autoReason){
            state.status="paused";
            state.pauseReason=state.manualPaused?"PAUZA HOSTA":autoReason;
            render();
            return;
        }

        state.status="running";
        state.pauseReason="";
        state.remainingMs=Math.max(0,state.remainingMs-elapsed);
        if(state.remainingMs<=0){
            state.remainingMs=0;
            state.expired=true;
            state.status="expired";
        }
        render();
    }

    function configure(seconds,options={}){
        const next=Math.max(0,Math.round(Number(seconds)||0));
        state.baseSeconds=next;
        state.enabled=next>0;
        if(options.syncSetting!==false){
            const select=byId("turnTimerSeconds");
            if(select && [...select.options].some(option=>Number(option.value)===next)) select.value=String(next);
        }
        if(options.reset!==false){
            state.turnKey=null;
            state.playerIndex=null;
            state.remainingMs=0;
            state.openerBonus=false;
            state.manualPaused=false;
            state.expired=false;
            state.status=state.enabled?"waiting":"disabled";
            state.pauseReason="";
            state.lastTickAt=Date.now();
        }
        setBodyMode();
        render();
        return state.enabled;
    }

    function configureFromSettings(options={}){
        return configure(getConfiguredSeconds(),options);
    }

    function resetForNewDraft(){
        configureFromSettings({reset:true});
    }

    function pauseManually(){
        if(!state.enabled || state.expired) return false;
        state.manualPaused=true;
        state.lastTickAt=Date.now();
        render();
        return true;
    }

    function resumeManually(){
        if(!state.enabled || state.expired) return false;
        state.manualPaused=false;
        state.lastTickAt=Date.now();
        render();
        return true;
    }

    function exportState(){
        return {
            version:VERSION,
            enabled:state.enabled,
            baseSeconds:state.baseSeconds,
            remainingMs:Math.max(0,Math.round(state.remainingMs)),
            turnKey:state.turnKey,
            playerIndex:state.playerIndex,
            openerBonus:state.openerBonus,
            manualPaused:state.manualPaused,
            expired:state.expired,
            status:state.status
        };
    }

    function restoreState(snapshot){
        if(!snapshot || typeof snapshot!=="object") return false;
        const seconds=Math.max(0,Math.round(Number(snapshot.baseSeconds)||0));
        state.baseSeconds=seconds;
        state.enabled=Boolean(snapshot.enabled&&seconds>0);
        state.remainingMs=Math.max(0,Number(snapshot.remainingMs)||0);
        state.turnKey=snapshot.turnKey||null;
        state.playerIndex=Number.isInteger(Number(snapshot.playerIndex))?Number(snapshot.playerIndex):null;
        state.openerBonus=Boolean(snapshot.openerBonus);
        state.manualPaused=Boolean(snapshot.manualPaused);
        state.expired=Boolean(snapshot.expired)||state.remainingMs<=0;
        state.status=state.enabled?(snapshot.status||"waiting"):"disabled";
        state.pauseReason="";
        state.lastTickAt=Date.now();
        state.restored=true;
        const select=byId("turnTimerSeconds");
        if(select && [...select.options].some(option=>Number(option.value)===seconds)) select.value=String(seconds);
        setBodyMode();
        render();
        return true;
    }

    function init(){
        const pauseButton=byId("draftTurnTimerPause");
        const playButton=byId("draftTurnTimerPlay");
        pauseButton?.addEventListener("click",pauseManually);
        playButton?.addEventListener("click",resumeManually);
        const select=byId("turnTimerSeconds");
        select?.addEventListener("change",()=>{
            if(!document.body.classList.contains("draft-active")){
                configureFromSettings({reset:true});
            }
        });
        configureFromSettings({reset:true});
        if(intervalId) global.clearInterval(intervalId);
        intervalId=global.setInterval(tick,POLL_MS);
        render();
    }

    global.DraftTurnTimer=Object.freeze({
        VERSION,
        OPENER_BONUS_SECONDS,
        init,
        configure,
        configureFromSettings,
        resetForNewDraft,
        pause:pauseManually,
        play:resumeManually,
        exportState,
        restoreState,
        getState:()=>({...state}),
        sync:()=>{state.lastTickAt=Date.now();tick();}
    });

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",init,{once:true});
    }else{
        init();
    }
})(window);
