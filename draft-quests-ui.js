(function(global){
    "use strict";

    const VERSION="0.7.0-final-last-arishem-cinematic";
    const TIER_META={
        street:{label:"STREET LEVEL",short:"STREET",glyph:"S"},
        avengers:{label:"AVENGERS LEVEL",short:"AVENGERS",glyph:"A"},
        celestial:{label:"CELESTIAL LEVEL",short:"CELESTIAL",glyph:"✦"}
    };

    let selectedPlayerIndex=null;
    let refreshTimer=0;
    let pollTimer=0;
    let lastToastKey="";
    let quickPlayerIndex=null;
    let quickAnchor=null;
    let observer=null;
    const pendingClaims=new Set();

    function engine(){return global.DraftQuestEngine||null;}
    function escapeHtml(value){
        return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    }
    function currentPlayerIndex(){
        try{
            const value=global.getCurrentPlayerIndex?.();
            return Number.isInteger(value)?value:null;
        }catch(error){return null;}
    }
    function uiState(){return engine()?.getUiState?.()||{enabled:false,initialized:false,players:[]};}
    function playerState(playerIndex){return engine()?.getPlayerState?.(playerIndex)||null;}
    function questMeta(quest){return TIER_META[quest?.tier]||TIER_META.street;}
    function isClaimable(quest){return quest?.status==="completed"&&!quest?.rewardGranted;}
    function statusLabel(quest){
        if(isClaimable(quest)) return "DO ODBIORU";
        if(quest?.status==="completed"&&quest?.rewardGranted) return "ODEBRANA";
        if(quest?.status==="completed") return "UKOŃCZONA";
        if(quest?.status==="failed") return "NIEUDANA";
        return "AKTYWNA";
    }
    function visibleStatusLabel(quest){
        if(isClaimable(quest)) return "NAGRODA CZEKA";
        if(quest?.status==="completed"&&quest?.rewardGranted) return "ODEBRANA";
        if(quest?.status==="completed") return "UKOŃCZONA";
        if(quest?.status==="failed") return "NIEUDANA";
        return "W TOKU";
    }
    function rewardInlineHtml(amount,variant="default"){
        const safe=Math.max(0,Number(amount||0));
        return `<span class="draft-quest-reward-inline variant-${escapeHtml(variant)}"><img src="draft-assets/jeffcoin.png" alt="JC"><b>+${safe}</b><em>JC</em></span>`;
    }
    function progressNumbers(quest,player){
        const current=Math.max(0,Number(quest?.progress?.current||0));
        let target=Math.max(0,Number(quest?.progress?.target||0));
        if(!target){
            const remaining=Math.max(0,Number(quest?.endsAtNormalPick||0)-Number(player?.normalPicksCompleted||0));
            const total=Math.max(1,Number(quest?.endsAtNormalPick||0)-Number(quest?.assignedAtNormalPick||0));
            target=total;
            return {current:Math.max(0,total-remaining),target};
        }
        return {current:Math.min(target,current),target};
    }
    function progressPct(quest,player){
        if(quest?.status==="completed"||quest?.status==="failed") return 100;
        const {current,target}=progressNumbers(quest,player);
        return target?Math.max(0,Math.min(100,Math.round(current/target*100))):0;
    }
    function remainingWindow(quest,player){
        if(quest?.status!=="active") return statusLabel(quest);
        if(quest?.window==="draftEnd") return "DO KOŃCA DRAFTU";
        if(quest?.window==="samePackPair") return "TA SAMA PACZKA";
        const remaining=Math.max(0,Number(quest?.endsAtNormalPick||0)-Number(player?.normalPicksCompleted||0));
        return remaining===1?"1 PICK POZOSTAŁ":`${remaining} PICKI POZOSTAŁY`;
    }
    function claimableCount(player){return (player?.quests||[]).filter(isClaimable).length;}

    function ensureDockSlot(){
        let slot=document.getElementById("questDockSlot");
        if(slot) return slot;
        const dock=document.getElementById("draftBottomDock");
        if(!dock) return null;
        slot=document.createElement("div");
        slot.id="questDockSlot";
        dock.appendChild(slot);
        return slot;
    }

    function ensureLauncher(){
        const slot=ensureDockSlot();
        if(!slot) return null;
        let root=document.getElementById("draftQuestLauncher");
        if(root) return root;
        root=document.createElement("button");
        root.type="button";
        root.id="draftQuestLauncher";
        root.className="draft-quest-launcher";
        root.innerHTML=`
            <span class="draft-quest-launcher-temple" aria-hidden="true"><img src="draft-assets/quest_arishem_temple_backdrop.png" alt=""></span>
            <span class="draft-quest-launcher-emblem" data-quest-asset-slot="launcher"><img src="draft-assets/quest_arishem_chibi_logo.png" alt=""></span>
            <span class="draft-quest-launcher-copy"><small>PRÓBY ARISHEMA</small><b>KOSMICZNE QUESTY</b></span>
            <span class="draft-quest-launcher-count" data-quest-launcher-count>3</span>`;
        root.addEventListener("click",()=>open());
        slot.appendChild(root);
        return root;
    }

    function ensureQuickPreview(){
        let root=document.getElementById("draftQuestQuickPreview");
        if(root) return root;
        root=document.createElement("aside");
        root.id="draftQuestQuickPreview";
        root.className="draft-quest-quick-preview";
        root.hidden=true;
        root.innerHTML=`
            <header>
                <div><small>PRÓBY ARISHEMA</small><b data-quest-quick-player>GRACZ</b></div>
                <button type="button" data-quest-quick-close aria-label="Zamknij">×</button>
            </header>
            <div class="draft-quest-quick-list" data-quest-quick-list></div>
            <footer><button type="button" data-quest-open-full>OTWÓRZ KOSMICZNE QUESTY</button></footer>`;
        document.body.appendChild(root);
        root.querySelector("[data-quest-quick-close]")?.addEventListener("click",closeQuick);
        root.querySelector("[data-quest-open-full]")?.addEventListener("click",()=>{
            const player=quickPlayerIndex;
            closeQuick();
            open(player);
        });
        return root;
    }


    function emptyStateHtml(title,subtitle=""){
        return `<div class="draft-quest-empty"><span class="draft-quest-empty-glyph">✦</span><b>${escapeHtml(title)}</b>${subtitle?`<small>${escapeHtml(subtitle)}</small>`:""}</div>`;
    }
    function quickQuestHtml(quest,player){
        const meta=questMeta(quest);
        const {current,target}=progressNumbers(quest,player);
        const pct=progressPct(quest,player);
        const condition=String(quest?.text||quest?.name||"");
        return `<div class="draft-quest-quick-row tier-${escapeHtml(quest.tier)} status-${escapeHtml(quest.status)} ${isClaimable(quest)?"is-claimable":""}" title="${escapeHtml(condition)}" data-quest-tooltip="${escapeHtml(condition)}">
            <span class="draft-quest-quick-glyph">${escapeHtml(meta.glyph)}</span>
            <div class="draft-quest-quick-copy">
                <small>${escapeHtml(meta.label)}</small>
                <b>${escapeHtml(quest.name)}</b>
                <p>${escapeHtml(condition)}</p>
                <span class="draft-quest-quick-progress"><i style="width:${pct}%"></i></span>
            </div>
            <div class="draft-quest-quick-state"><strong>${escapeHtml(visibleStatusLabel(quest))}</strong><small>${isClaimable(quest)?rewardInlineHtml(quest.rewardJC,"compact"):(quest.status==="active"?`${current}/${target||"?"}`:remainingWindow(quest,player))}</small></div>
        </div>`;
    }

    function renderQuick(){
        const root=ensureQuickPreview();
        if(root.hidden) return;
        const state=uiState();
        const player=(state.players||[]).find(entry=>entry.playerIndex===quickPlayerIndex);
        if(!state.enabled||!state.initialized||!player){closeQuick();return;}
        root.querySelector("[data-quest-quick-player]").textContent=player.playerName||`Gracz ${player.playerIndex+1}`;
        root.querySelector("[data-quest-quick-list]").innerHTML=(player.quests||[]).map(quest=>quickQuestHtml(quest,player)).join("")||emptyStateHtml("Brak przydzielonych Prób.","Arishem nie wyznaczył jeszcze zadań dla tego gracza.");
        requestAnimationFrame(()=>positionQuick(root,quickAnchor));
    }

    function positionQuick(root,anchor){
        if(!root||root.hidden) return;
        const margin=12;
        const rect=anchor?.getBoundingClientRect?.();
        const box=root.getBoundingClientRect();
        const viewportWidth=global.innerWidth||1200;
        const viewportHeight=global.innerHeight||800;
        const anchorVisible=Boolean(rect&&rect.bottom>0&&rect.top<viewportHeight&&rect.right>0&&rect.left<viewportWidth);
        let left=anchorVisible?rect.left:Math.max(margin,(viewportWidth-box.width)/2);
        let top=anchorVisible?rect.bottom+10:Math.max(margin,(viewportHeight-box.height)/2);
        left=Math.max(margin,Math.min(left,viewportWidth-box.width-margin));
        if(anchorVisible&&top+box.height>viewportHeight-margin) top=rect.top-box.height-10;
        top=Math.max(margin,Math.min(top,viewportHeight-box.height-margin));
        root.style.left=`${left}px`;
        root.style.top=`${top}px`;
    }

    function openQuick(playerIndex,anchor){
        const state=uiState();
        if(!state.enabled||!state.initialized) return false;
        const p=Number(playerIndex);
        if(!Number.isInteger(p)) return false;
        quickPlayerIndex=p;
        quickAnchor=anchor||null;
        const root=ensureQuickPreview();
        root.hidden=false;
        renderQuick();
        return true;
    }
    function closeQuick(){
        const root=document.getElementById("draftQuestQuickPreview");
        if(root) root.hidden=true;
        quickPlayerIndex=null;
        quickAnchor=null;
    }

    function entryButtonHtml(player,context="picker"){
        const claimable=claimableCount(player);
        const active=(player?.quests||[]).filter(q=>q.status==="active").length;
        return `<span aria-hidden="true">✦</span><i>${claimable?claimable:active}</i>`;
    }

    function decorateCurrentPicker(playerIndex=currentPlayerIndex()){
        const banner=document.getElementById("currentPickerBanner");
        if(!banner) return;
        let button=banner.querySelector(".draft-quest-picker-entry");
        const state=uiState();
        const player=(state.players||[]).find(entry=>entry.playerIndex===Number(playerIndex));
        if(!state.enabled||!state.initialized||!player){button?.remove();banner.classList.remove("has-draft-quest-picker-entry");return;}
        const renderKey=`${player.playerIndex}:${claimableCount(player)}:${(player.quests||[]).filter(q=>q.status==="active").length}`;
        if(button&&button.dataset.questPlayerIndex===String(player.playerIndex)){
            banner.classList.add("has-draft-quest-picker-entry");
            if(button.dataset.questRenderKey!==renderKey){button.innerHTML=entryButtonHtml(player,"picker");button.dataset.questRenderKey=renderKey;}
            button.title=`${player.playerName}: szybki podgląd Kosmicznych Questów`;
            button.setAttribute("aria-label",button.title);
            return;
        }
        button?.remove();
        banner.classList.add("has-draft-quest-picker-entry");
        button=document.createElement("button");
        button.type="button";
        button.className="draft-quest-picker-entry";
        button.dataset.questPlayerIndex=String(player.playerIndex);
        button.dataset.questRenderKey=renderKey;
        button.innerHTML=entryButtonHtml(player,"picker");
        button.title=`${player.playerName}: szybki podgląd Kosmicznych Questów`;
        button.setAttribute("aria-label",button.title);
        button.addEventListener("click",event=>{
            event.preventDefault();event.stopPropagation();
            openQuick(player.playerIndex,button);
        });
        banner.appendChild(button);
    }

    function decorateDeckPanels(){
        const state=uiState();
        const sections=[...document.querySelectorAll("#decks .deck-section")];
        sections.forEach((section,index)=>{
            let strip=section.querySelector("[data-deck-context-strip]");
            const player=(state.players||[]).find(entry=>entry.playerIndex===index);
            const old=section.querySelector(".draft-quest-deck-entry");
            if(!state.enabled||!state.initialized||!player){old?.remove();return;}
            if(!strip){
                strip=document.createElement("div");
                strip.className="deck-context-strip";
                strip.dataset.deckContextStrip="";
                strip.dataset.playerIndex=String(index);
                const progress=section.querySelector(".deckProgressBox");
                progress?.insertAdjacentElement("afterend",strip);
            }
            const renderKey=`${player.playerIndex}:${claimableCount(player)}:${(player.quests||[]).filter(q=>q.status==="active").length}`;
            if(old){
                if(old.dataset.questRenderKey!==renderKey){old.innerHTML=entryButtonHtml(player,"deck");old.dataset.questRenderKey=renderKey;}
                old.title=`${player.playerName}: szybki podgląd Kosmicznych Questów`;
                return;
            }
            const button=document.createElement("button");
            button.type="button";
            button.className="draft-quest-deck-entry";
            button.dataset.questPlayerIndex=String(player.playerIndex);
            button.dataset.questRenderKey=renderKey;
            button.innerHTML=entryButtonHtml(player,"deck");
            button.title=`${player.playerName}: szybki podgląd Kosmicznych Questów`;
            button.setAttribute("aria-label",button.title);
            button.addEventListener("click",event=>{
                event.preventDefault();event.stopPropagation();
                openQuick(player.playerIndex,button);
            });
            strip.appendChild(button);
        });
    }

    function decorateInspectorControl(playerIndex){
        const state=uiState();
        const player=(state.players||[]).find(entry=>entry.playerIndex===Number(playerIndex));
        const slot=document.getElementById(`deckInspectorQuest_${Number(playerIndex)}`);
        if(!slot) return false;
        if(!state.enabled||!state.initialized||!player){slot.hidden=true;slot.innerHTML="";return false;}
        const renderKey=`${player.playerIndex}:${claimableCount(player)}:${(player.quests||[]).filter(q=>q.status==="active").length}`;
        let button=slot.querySelector(".draft-quest-inspector-entry");
        if(!button){
            button=document.createElement("button");
            button.type="button";
            button.className="draft-quest-inspector-entry";
            button.addEventListener("mousedown",event=>event.stopPropagation());
            button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();openQuick(player.playerIndex,button);});
            slot.appendChild(button);
        }
        if(button.dataset.questRenderKey!==renderKey){button.innerHTML=entryButtonHtml(player,"inspector");button.dataset.questRenderKey=renderKey;}
        button.title=`${player.playerName}: szybki podgląd Kosmicznych Questów`;
        button.setAttribute("aria-label",button.title);
        slot.hidden=false;
        return true;
    }

    function decorateOpenInspectors(){
        document.querySelectorAll(".deckInspector[id^='deckInspector_']").forEach(modal=>{
            const index=Number(String(modal.id).replace("deckInspector_",""));
            if(Number.isInteger(index)) decorateInspectorControl(index);
        });
    }

    function ensureOverlay(){
        let overlay=document.getElementById("draftQuestOverlay");
        if(overlay) return overlay;
        overlay=document.createElement("div");
        overlay.id="draftQuestOverlay";
        overlay.className="draft-quest-overlay";
        overlay.hidden=true;
        overlay.innerHTML=`
            <section class="draft-quest-panel" role="dialog" aria-modal="true" aria-labelledby="draftQuestPanelTitle">
                <div class="draft-quest-hero-layer" aria-hidden="true"><img src="draft-assets/quest_arishem_temple_backdrop.png" alt=""><span class="star-a">✦</span><span class="star-b">✦</span><span class="star-c">✦</span></div>
                <button class="draft-quest-close" type="button" aria-label="Zamknij">×</button>
                <header class="draft-quest-panel-header">
                    <span class="draft-quest-panel-sigil" data-quest-asset-slot="arishem-sigil">✦</span>
                    <div class="draft-quest-panel-heading">
                        <small>PRÓBY ARISHEMA</small>
                        <h2 id="draftQuestPanelTitle">KOSMICZNE QUESTY</h2>
                        <p>Trzy poziomy wyzwań: Street, Avengers i Celestial. Każdy slot ma własny darmowy reroll, a ukończoną nagrodę odbierasz ręcznie.</p>
                    </div>
                </header>
                <nav class="draft-quest-player-tabs" data-quest-player-tabs aria-label="Gracze"></nav>
                <div class="draft-quest-player-summary" data-quest-player-summary></div>
                <div class="draft-quest-grid" data-quest-grid></div>
                <footer class="draft-quest-panel-footer">
                    <div class="draft-quest-footer-copy">
                        <small>SANKTUARIUM PRÓB</small>
                        <b>Arishem obserwuje postępy wszystkich wybranych i zapisuje je w kosmicznym archiwum.</b>
                    </div>
                    <div class="draft-quest-footer-copy is-right">
                        <small>ZASADY RYTUAŁU</small>
                        <b>Każdy slot ma 1 darmowy reroll, a ukończone Próby wymagają ręcznego odbioru nagrody.</b>
                    </div>
                </footer>
            </section>`;
        document.body.appendChild(overlay);
        overlay.addEventListener("mousedown",event=>{if(event.target===overlay) close();});
        overlay.querySelector(".draft-quest-close")?.addEventListener("click",close);
        overlay.querySelector("[data-quest-player-tabs]")?.addEventListener("click",event=>{
            const button=event.target.closest?.("[data-quest-player]");
            if(!button) return;
            selectedPlayerIndex=Number(button.dataset.questPlayer);
            renderOverlay();
        });
        overlay.querySelector("[data-quest-grid]")?.addEventListener("click",event=>{
            const claim=event.target.closest?.("[data-quest-claim]");
            if(claim&&!claim.disabled){
                queueClaim(Number(claim.dataset.playerIndex),claim.dataset.questClaim);
                return;
            }
            const button=event.target.closest?.("[data-quest-reroll]");
            if(!button||button.disabled) return;
            const result=engine()?.rerollQuest?.(Number(button.dataset.playerIndex),button.dataset.questReroll);
            if(result?.ok){
                pulseQuestPanel("reroll");
                queuePresentation(()=>showToast("PRÓBA ZMIENIONA",`Slot ${Number(result.slotIndex)+1} otrzymał nowe wyzwanie.`,"success","reroll"),{durationMs:2200});
                renderAll();
            }else{
                const message=result?.reason==="slot_reroll_used"?"Darmowy reroll tego slotu został już wykorzystany.":result?.reason==="no_legal_replacement"?"Brak legalnej Próby zastępczej w tym tierze.":"Nie udało się zmienić tej Próby.";
                queuePresentation(()=>showToast("REROLL NIEDOSTĘPNY",message,"warning"),{durationMs:2300});
            }
        });
        return overlay;
    }

    function ensureToast(){
        let toast=document.getElementById("draftQuestToast");
        if(toast) return toast;
        toast=document.createElement("div");
        toast.id="draftQuestToast";
        toast.className="draft-quest-toast";
        toast.dataset.questToast="";
        toast.hidden=true;
        document.body.appendChild(toast);
        return toast;
    }

    function cardActionHtml(quest,player){
        const slotIndex=Number.isInteger(Number(quest?.slotIndex))?Number(quest.slotIndex):0;
        const rerolls=Number(player?.rerollsRemainingBySlot?.[slotIndex]||0);
        if(isClaimable(quest)){
            const pending=pendingClaims.has(quest.runtimeId);
            return `<button type="button" class="draft-quest-claim-btn" data-quest-claim="${escapeHtml(quest.runtimeId)}" data-player-index="${player.playerIndex}" ${pending?"disabled":""}><span>◆</span><b>${pending?"ODBIERANIE…":"ODBIERZ NAGRODĘ"}</b><small>${rewardInlineHtml(quest.rewardJC,"button")}</small></button>`;
        }
        if(quest.status==="completed"&&quest.rewardGranted){
            return `<button type="button" class="draft-quest-claimed-btn" disabled><span>✓</span><b>NAGRODA ODEBRANA</b><small>${rewardInlineHtml(quest.rewardJC,"button")}</small></button>`;
        }
        if(quest.status==="failed"){
            return `<button type="button" disabled><span>×</span><b>PRÓBA NIEUDANA</b><small>—</small></button>`;
        }
        const canReroll=rerolls>0;
        return `<button type="button" data-quest-reroll="${escapeHtml(quest.runtimeId)}" data-player-index="${player.playerIndex}" ${canReroll?"":"disabled"}><span>↻</span><b>${canReroll?"PRZELOSUJ":"REROLL UŻYTY"}</b><small>${rerolls}/1</small></button>`;
    }

    function cardHtml(quest,player){
        const meta=questMeta(quest);
        const {current,target}=progressNumbers(quest,player);
        const pct=progressPct(quest,player);
        const claimable=isClaimable(quest);
        return `<article class="draft-quest-card tier-${escapeHtml(quest.tier)} status-${escapeHtml(quest.status)} ${claimable?"is-claimable":""} ${quest.rewardGranted?"is-claimed":""}" data-quest-runtime-id="${escapeHtml(quest.runtimeId)}">
            <div class="draft-quest-card-art" data-quest-asset-slot="tier-${escapeHtml(quest.tier)}">
                <span class="draft-quest-tier-emblem">${escapeHtml(meta.glyph)}</span>
                <small>${escapeHtml(meta.label)}</small>
            </div>
            <div class="draft-quest-card-main">
                <div class="draft-quest-card-topline">
                    <span class="draft-quest-code">PRÓBA ARISHEMA</span>
                    <span class="draft-quest-status">${escapeHtml(visibleStatusLabel(quest))}</span>
                </div>
                <h3>${escapeHtml(quest.name)}</h3>
                <p>${escapeHtml(quest.text)}</p>
                <div class="draft-quest-progress-row">
                    <div class="draft-quest-progress"><i style="width:${pct}%"></i></div>
                    <b>${current}/${target||"?"}</b>
                </div>
                <div class="draft-quest-meta-row">
                    <span>${escapeHtml(remainingWindow(quest,player))}</span>
                    <span class="draft-quest-reward ${claimable?"is-ready":""}">${rewardInlineHtml(quest.rewardJC,"panel")}</span>
                </div>
            </div>
            <div class="draft-quest-card-actions">${cardActionHtml(quest,player)}</div>
        </article>`;
    }

    function renderLauncher(){
        const state=uiState();
        const launcher=ensureLauncher();
        if(!launcher) return;
        launcher.hidden=!state.enabled;
        if(!state.enabled) return;
        const current=currentPlayerIndex();
        const player=(state.players||[]).find(entry=>entry.playerIndex===current)||(state.players||[])[0];
        const active=(player?.quests||[]).filter(q=>q.status==="active").length;
        const claimable=claimableCount(player);
        const count=launcher.querySelector("[data-quest-launcher-count]");
        if(count) count.textContent=state.initialized?(claimable?`+${claimable}`:String(active)):"…";
        launcher.classList.toggle("has-completed",claimable>0);
        launcher.title=player?`${player.playerName}: ${active} aktywne Próby, ${claimable} nagrody do odbioru.`:"Kosmiczne Questy";
    }

    function renderOverlay(){
        const overlay=ensureOverlay();
        if(!overlay||overlay.hidden) return;
        const state=uiState();
        const players=state.players||[];
        if(!players.length){
            overlay.querySelector("[data-quest-grid]").innerHTML=emptyStateHtml("Próby nie zostały jeszcze przydzielone.","Aktywuj rozszerzenie i rozpocznij draft, aby Arishem rozdał swoje wyzwania.");
            return;
        }
        if(!Number.isInteger(selectedPlayerIndex)||!players.some(p=>p.playerIndex===selectedPlayerIndex)){
            selectedPlayerIndex=currentPlayerIndex();
            if(!Number.isInteger(selectedPlayerIndex)||!players.some(p=>p.playerIndex===selectedPlayerIndex)) selectedPlayerIndex=players[0].playerIndex;
        }
        const player=players.find(p=>p.playerIndex===selectedPlayerIndex)||players[0];
        overlay.querySelector("[data-quest-player-tabs]").innerHTML=players.map(entry=>{
            const ready=claimableCount(entry);
            return `<button type="button" data-quest-player="${entry.playerIndex}" class="${entry.playerIndex===player.playerIndex?"is-active":""} ${ready?"has-claimable":""}"><b>${escapeHtml(entry.playerName)}</b><small>${Number(entry.completed||0)}/3${ready?` • ${ready} DO ODBIORU`:""}</small></button>`;
        }).join("");
        const rerolls=(player.rerollsRemainingBySlot||[]).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0);
        const active=(player.quests||[]).filter(q=>q.status==="active").length;
        const ready=claimableCount(player);
        overlay.querySelector("[data-quest-player-summary]").innerHTML=`<div><small>GRACZ</small><b>${escapeHtml(player.playerName)}</b></div><div><small>NORMALNE PICKI</small><b>${Number(player.normalPicksCompleted||0)}/12</b></div><div><small>AKTYWNE</small><b>${active}</b></div><div class="${ready?"is-highlight":""}"><small>DO ODBIORU</small><b>${ready}</b></div><div><small>DARMOWE REROLLE</small><b>${rerolls}/3</b></div><div><small>JC Z QUESTÓW</small><b>+${Number(player.jeffCoinsEarned||0)}</b></div>`;
        overlay.querySelector("[data-quest-grid]").innerHTML=(player.quests||[]).length?(player.quests||[]).map(q=>cardHtml(q,player)).join(""):emptyStateHtml("Brak przydzielonych Prób dla tego gracza.","Ten wybrany nie otrzymał jeszcze kosmicznych zadań od Arishema.");
    }

    function renderAll(){
        renderLauncher();
        decorateCurrentPicker();
        decorateDeckPanels();
        decorateOpenInspectors();
        renderQuick();
        renderOverlay();
    }

    function open(playerIndex=null){
        const state=uiState();
        if(!state.enabled) return false;
        closeQuick();
        const overlay=ensureOverlay();
        if(Number.isInteger(Number(playerIndex))) selectedPlayerIndex=Number(playerIndex);
        else{
            const current=currentPlayerIndex();
            if(Number.isInteger(current)) selectedPlayerIndex=current;
        }
        overlay.hidden=false;
        document.body.classList.add("draft-quest-overlay-open");
        renderOverlay();
        requestAnimationFrame(triggerOverlayEntrance);
        return true;
    }
    function close(){
        const overlay=document.getElementById("draftQuestOverlay");
        if(overlay) overlay.hidden=true;
        document.body.classList.remove("draft-quest-overlay-open");
    }

    function triggerOverlayEntrance(){
        const overlay=document.getElementById("draftQuestOverlay");
        if(!overlay||overlay.hidden) return;
        overlay.classList.remove("is-entering");
        void overlay.offsetWidth;
        overlay.classList.add("is-entering");
        clearTimeout(triggerOverlayEntrance._timer);
        triggerOverlayEntrance._timer=setTimeout(()=>overlay.classList.remove("is-entering"),1150);
    }

    function pulseQuestPanel(kind="pulse"){
        const overlay=document.getElementById("draftQuestOverlay");
        const panel=overlay?.querySelector?.(".draft-quest-panel");
        if(!panel) return;
        const cls=`quest-fx-${kind}`;
        panel.classList.remove(cls);
        void panel.offsetWidth;
        panel.classList.add(cls);
        clearTimeout(pulseQuestPanel._timers?.[kind]);
        pulseQuestPanel._timers=pulseQuestPanel._timers||{};
        pulseQuestPanel._timers[kind]=setTimeout(()=>panel.classList.remove(cls),1100);
    }

    function showToast(title,message,type="info",fx="",durationMs=2800){
        const toast=ensureToast();
        if(!toast) return;
        toast.className=`draft-quest-toast is-${type}`;
        if(fx) toast.dataset.questFx=String(fx); else delete toast.dataset.questFx;
        toast.innerHTML=`<i class="draft-quest-toast-eyes" aria-hidden="true"></i><b>${escapeHtml(title)}</b><span>${escapeHtml(message)}</span>`;
        toast.hidden=false;
        const baseDuration=Math.max(2800,Number(durationMs||2800));
        const resultHold=(fx==="completion"||fx==="claim"||fx==="failed"||fx==="reroll")?1600:0;
        showToast._durationMs=baseDuration+resultHold;
        clearTimeout(showToast._timer);
        showToast._timer=setTimeout(()=>{
            toast.hidden=true;
            toast.removeAttribute("data-quest-fx");
        },Math.max(2800,Number(showToast._durationMs||0)));
    }

    function localHigherPriorityBusy(){
        try{
            if(global.SuperpowerUI?.isBusy?.()) return true;
            if(global.GambitUI?.isBusy?.()) return true;
            if(global.JokerV2UI?.isBusy?.()) return true;
            if(global.GalacticCurrent?.getState?.()?.isResolving) return true;
            if(global.GrootUI?.isBusy?.()) return true;
            if(global.DevilDinoUI?.isBusy?.()) return true;
        }catch(error){}
        const selectors=[
            ".bounty-aged-toast",
            ".bounty-round-overlay",
            ".bounty-discount-award",
            ".economy-jeffcoin-award-flight",
            "[id^='spx'][aria-modal='true']",
            "[id^='spx'][role='dialog']"
        ];
        return selectors.some(selector=>[...document.querySelectorAll(selector)].some(node=>{
            if(node.hidden) return false;
            const style=global.getComputedStyle?.(node);
            if(style&&(style.display==="none"||style.visibility==="hidden"||Number(style.opacity)===0)) return false;
            const rect=node.getBoundingClientRect?.();
            return Boolean(rect&&rect.width>0&&rect.height>0);
        }));
    }

    function queuePresentation(play,options={}){
        if(typeof play!=="function") return false;
        if(global.BountyEngine?.queueBountyPresentation){
            return global.BountyEngine.queueBountyPresentation(play,{
                initialDelayMs:Number(options.initialDelayMs??120),
                settleMs:Number(options.settleMs??260),
                durationMs:Number(options.durationMs??2600)
            });
        }
        const started=Date.now();
        const pump=()=>{
            if(!localHigherPriorityBusy()||Date.now()-started>9000){play();return;}
            setTimeout(pump,120);
        };
        setTimeout(pump,Math.max(0,Number(options.initialDelayMs??120)));
        return true;
    }

    function queueClaim(playerIndex,questRuntimeId){
        if(pendingClaims.has(questRuntimeId)) return false;
        pendingClaims.add(questRuntimeId);
        renderAll();
        queuePresentation(()=>{
            const result=engine()?.claimQuestReward?.(playerIndex,questRuntimeId,{source:"quest_ui_claim"});
            pendingClaims.delete(questRuntimeId);
            if(result?.ok){
                global.EconomyEngine?.playJeffCoinAward?.(playerIndex,result.amount,{label:"NAGRODA ZA QUEST",source:"quest"});
                pulseQuestPanel("claim");
                showToast("NAGRODA ODEBRANA",`+${Number(result.amount||0)} JC trafia do portfela gracza.`,"success","claim",4300);
            }else{
                const message=result?.reason==="already_claimed"?"Ta nagroda została już odebrana.":result?.reason==="economy_credit_failed"?"Economy nie przyjęło wypłaty. Spróbuj ponownie.":"Nie udało się odebrać nagrody.";
                showToast("WYPŁATA NIEDOSTĘPNA",message,"warning");
            }
            renderAll();
        },{durationMs:6000});
        return true;
    }

    function scheduleRefresh(delay=0){
        clearTimeout(refreshTimer);
        refreshTimer=setTimeout(renderAll,Math.max(0,delay));
    }

    function handleQuestEvent(event){
        const detail=event?.detail||{};
        scheduleRefresh(0);
        scheduleRefresh(250);
        if(detail.type==="initialized"){
            queuePresentation(()=>showToast("PRÓBY ARISHEMA GOTOWE","Kosmiczne Questy zostały przydzielone. Otwórz je z ikony ✦ albo z dolnego panelu.","info","opening"),{durationMs:2600});
        }
        if(detail.type==="completed"){
            const key=`complete:${detail.questRuntimeId}`;
            if(lastToastKey!==key){
                lastToastKey=key;
                queuePresentation(()=>showToast("PRÓBA UKOŃCZONA",`${detail.playerName||"Gracz"}: nagroda czeka na ręczne odebranie.`,"success","completion",4600),{initialDelayMs:240,durationMs:6300});
            }
        }
        if(detail.type==="failed"){
            const key=`fail:${detail.questRuntimeId}`;
            if(lastToastKey!==key){
                lastToastKey=key;
                queuePresentation(()=>showToast("PRÓBA NIEUDANA",`${detail.playerName||"Gracz"}: warunek Próby nie został spełniony.`,"warning","failed",4300),{initialDelayMs:240,durationMs:6100});
            }
        }
    }

    function installObserver(){
        if(observer||typeof MutationObserver==="undefined") return;
        observer=new MutationObserver(()=>scheduleRefresh(40));
        const decks=document.getElementById("decks");
        const banner=document.getElementById("currentPickerBanner");
        if(decks) observer.observe(decks,{childList:true,subtree:true});
        if(banner) observer.observe(banner,{childList:true});
    }

    function boot(){
        ensureLauncher();
        ensureQuickPreview();
        ensureOverlay();
        ensureToast();
        installObserver();
        global.addEventListener?.("snapdraft:quest-change",handleQuestEvent);
        document.addEventListener("keydown",event=>{
            if(event.key!=="Escape") return;
            const quick=document.getElementById("draftQuestQuickPreview");
            if(quick&&!quick.hidden){closeQuick();return;}
            close();
        });
        document.addEventListener("click",event=>{
            const quick=document.getElementById("draftQuestQuickPreview");
            if(quick&&!quick.hidden&&!quick.contains(event.target)&&!event.target.closest?.(".draft-quest-picker-entry,.draft-quest-deck-entry,.draft-quest-inspector-entry")) closeQuick();
        },true);
        renderAll();
        clearInterval(pollTimer);
        pollTimer=setInterval(()=>{if(engine()?.isEnabled?.()) renderAll();},1200);
    }

    global.DraftQuestUI=Object.freeze({
        VERSION,open,close,openQuick,closeQuick,refresh:renderAll,showToast,
        decorateCurrentPicker,decorateDeckPanels,decorateInspectorControl
    });
    if(typeof document!=="undefined"){
        if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
        else boot();
    }
})(typeof window!=="undefined"?window:globalThis);
