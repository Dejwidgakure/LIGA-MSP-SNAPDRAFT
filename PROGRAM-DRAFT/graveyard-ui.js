(function(global){
    "use strict";

    const VISIBLE_CATEGORIES=new Set([
        "unpicked","rerolled","destroyedByPower","replaced","jokerRejected",
        "devoured","sacrificed","transformedEcho","digested",
        "riverEscaped","riverFaded","riverEndRemainder"
    ]);
    const state={open:false,mode:"view",locked:false,selectedId:"",options:{}};

    function escapeHtml(value){
        return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
    }
    function sourceLabel(entry){
        const source=String(entry?.source||entry?.category||"").toLowerCase();
        if(source.includes("venom")||entry?.category==="devoured") return "POŻARTA PRZEZ SYMBIOTA";
        if(source.includes("hulk")) return "ZMIAŻDŻONA PRZEZ HULKA";
        if(source.includes("rocket")) return "OFIARA ŁADUNKU";
        if(entry?.category==="unpicked") return "POZOSTAŁA W PACZCE";
        if(entry?.category==="rerolled") return "PRZELOSOWANA";
        if(entry?.category==="sacrificed") return "POŚWIĘCONA";
        if(entry?.category==="jokerRejected") return "ODRZUCONA PRZEZ SURPRISE JOKERA";
        if(entry?.category==="transformedEcho") return "ECHO PRZEMIANY";
        if(entry?.category==="riverEscaped") return "ODPŁYNĘŁA Z RWĄCEGO PRĄDU";
        if(entry?.category==="riverFaded") return "WYGASŁA W GWIEZDNYM PRĄDZIE";
        if(entry?.category==="riverEndRemainder") return "POZOSTAŁA W NURCIE DO KOŃCA DRAFTU";
        return "ODRZUCONA KARTA";
    }
    function availableEntries(){
        const list=global.DraftStateEngine?.listGraveyardEntries?.({status:"available",recoverable:true})||[];
        return list.filter(entry=>
            VISIBLE_CATEGORIES.has(entry?.category) &&
            !entry?.metadata?.manualEdit &&
            entry?.card?.name
        ).sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0));
    }
    function ensureLauncher(){
        let root=document.getElementById("graveyardLauncher");
        if(root) return root;
        root=document.createElement("div");
        root.id="graveyardLauncher";
        root.innerHTML=`
            <button class="gy-launcher-button" id="graveyardLauncherButton" type="button" aria-label="Otwórz Cmentarzysko SnapDraft">
                <img src="draft-assets/graveyard_planet_icon.png" alt="">
                <span class="gy-launcher-label">CMENTARZYSKO</span>
                <b class="gy-launcher-count" id="graveyardLauncherCount">0</b>
            </button>`;
        const dock=document.getElementById("graveyardDockSlot");
        (dock||document.body).appendChild(root);
        root.querySelector("button").addEventListener("click",()=>open({mode:"view"}));
        return root;
    }
    function ensureModal(){
        let overlay=document.getElementById("graveyardOverlay");
        if(overlay) return overlay;
        overlay=document.createElement("div");
        overlay.id="graveyardOverlay";
        overlay.className="gy-overlay";
        overlay.hidden=true;
        overlay.setAttribute("aria-hidden","true");
        overlay.innerHTML=`
            <section class="gy-modal" role="dialog" aria-modal="true" aria-label="Cmentarzysko SnapDraft">
                <button class="gy-close" type="button" aria-label="Zamknij Cmentarzysko">×</button>
                <div class="gy-mode-banner" id="graveyardModeBanner"></div>
                <div class="gy-field" id="graveyardField"><div class="gy-tombstone-grid" id="graveyardGrid"></div></div>
                <div class="gy-footer-note" id="graveyardFooterNote"></div>
            </section>`;
        document.body.appendChild(overlay);
        overlay.querySelector(".gy-close").addEventListener("click",()=>close("button"));
        overlay.addEventListener("click",event=>{
            if(event.target===overlay && !state.locked) close("backdrop");
        });
        return overlay;
    }
    function render(){
        const overlay=ensureModal();
        const grid=overlay.querySelector("#graveyardGrid");
        const banner=overlay.querySelector("#graveyardModeBanner");
        const footer=overlay.querySelector("#graveyardFooterNote");
        const closeButton=overlay.querySelector(".gy-close");
        const source=Array.isArray(state.options.entries) ? state.options.entries : availableEntries();
        const excluded=new Set((state.options.excludeIds||[]).map(String));
        const entries=source.filter(entry=>!excluded.has(String(entry.graveyardEntryId)));
        banner.textContent=state.options.message || (state.mode==="wolverine"
            ? "WYBIERZ NAGROBEK — CZYNNIK REGENERACYJNY LOGANA CZUWA NAD DOSTĘPNYMI KARTAMI"
            : "KARTY, KTÓRE OPUŚCIŁY PACZKI I DECKI, SPOCZYWAJĄ TUTAJ");
        footer.textContent=state.mode==="wolverine"
            ? "Zielona aura wskazuje karty, które Wolverine może wskrzesić."
            : `${entries.length} ${entries.length===1?"KARTA":"KART"} NA CMENTARZYSKU`;
        closeButton.disabled=Boolean(state.locked);
        grid.innerHTML="";
        if(!entries.length){
            const empty=document.createElement("div");
            empty.className="gy-empty";
            empty.innerHTML=state.mode==="wolverine"
                ? "Żaden nagrobek nie odpowiada teraz czynnikowi regeneracyjnemu Logana."
                : "Cmentarzysko jest jeszcze puste. Pierwsze odrzucone karty pojawią się tu jako nagrobki.";
            grid.appendChild(empty);
            return;
        }
        entries.forEach((entry,index)=>{
            const card=entry.card||{};
            const button=document.createElement("button");
            const variant=(index%4)+1;
            const tilt=((index*7)%9)-4;
            const rise=(index%2)*10;
            const scale=.88+((index*11)%10)/100;
            button.type="button";
            button.className="gy-tombstone"+(state.selectedId===entry.graveyardEntryId?" is-selected":"");
            if(String(card.name||"").length>18) button.classList.add("gy-name-long");
            button.dataset.entryId=entry.graveyardEntryId;
            button.style.setProperty("--gy-tilt",`${tilt}deg`);
            button.style.setProperty("--gy-rise",`${rise}px`);
            button.style.setProperty("--gy-scale",String(scale));
            button.disabled=state.mode!=="wolverine";
            button.setAttribute("aria-label",`${card.name}, Koszt ${card.cost}, Siła ${card.power}. ${sourceLabel(entry)}`);
            button.innerHTML=`
                <img class="gy-tombstone-art" src="draft-assets/graveyard_tombstone_${variant}.png" alt="">
                ${card.joker?'<span class="gy-joker-seal">JOKER — OTWORZY SIĘ PO WSKRZESZENIU</span>':""}
                <span class="gy-tombstone-copy">
                    <strong class="gy-tombstone-name">${escapeHtml(card.name)}</strong>
                    <span class="gy-tombstone-stats">${escapeHtml(card.cost)} / ${escapeHtml(card.power)}</span>
                    <small class="gy-tombstone-meta">${escapeHtml(sourceLabel(entry))}${entry.packNumber?` · P${escapeHtml(entry.packNumber)}`:""}</small>
                </span>
                <span class="gy-soul" aria-hidden="true"></span>`;
            if(state.mode==="wolverine"){
                button.disabled=false;
                button.addEventListener("click",()=>{
                    state.selectedId=entry.graveyardEntryId;
                    render();
                    global.setTimeout(()=>state.options.onSelect?.(entry),260);
                });
            }
            grid.appendChild(button);
        });
    }
    function open(options={}){
        if(state.open) return false;
        if(global.WolverineUI?.isBusy?.() && options.mode!=="wolverine") return false;
        state.open=true;
        state.mode=options.mode==="wolverine"?"wolverine":"view";
        state.locked=Boolean(options.locked);
        state.selectedId="";
        state.options={...options};
        const overlay=ensureModal();
        overlay.dataset.mode=state.mode;
        overlay.hidden=false;
        overlay.setAttribute("aria-hidden","false");
        document.body.classList.add("gy-is-open");
        refreshButton();
        render();
        return true;
    }
    function close(reason="programmatic",force=false,suppressCallback=false){
        if(!state.open) return true;
        if(state.locked&&!force) return false;
        const callback=state.options.onClose;
        state.open=false;state.mode="view";state.locked=false;state.selectedId="";state.options={};
        const overlay=ensureModal();
        overlay.hidden=true;overlay.setAttribute("aria-hidden","true");
        document.body.classList.remove("gy-is-open");
        refreshButton();
        if(!suppressCallback) callback?.(reason);
        return true;
    }
    function refreshButton(){
        const root=ensureLauncher();
        const count=root.querySelector("#graveyardLauncherCount");
        const button=root.querySelector("#graveyardLauncherButton");
        const amount=availableEntries().length;
        if(count) count.textContent=String(amount);
        // Zwykły podgląd Cmentarzyska jest bezpieczny i nie mutuje stanu.
        // Nie może zostać na stałe zablokowany przez zakończony modal mocy.
        if(button) button.disabled=Boolean(state.open&&state.mode==="wolverine");
        if(state.open) render();
        return amount;
    }
    function setLocked(locked){state.locked=Boolean(locked);if(state.open)render();refreshButton();}

    global.GraveyardUI={
        open,close,refresh:render,refreshButton,setLocked,
        getAvailableEntries:availableEntries,
        isOpen:()=>state.open,
        getMode:()=>state.mode,
        isInteractive:()=>state.open&&state.mode==="wolverine"
    };
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>{ensureLauncher();ensureModal();refreshButton();},{once:true});
    else{ensureLauncher();ensureModal();refreshButton();}
})(window);
