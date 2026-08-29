// =====================================================
// MSP SnapDraft — Jeff's Cosmic Shop / Core Economy E2.1
// Live products + locked reveal flows + shop-specific motion polish. Visual assets are external.
// =====================================================
(function(global){
    "use strict";

    const VERSION="2.7.1-shop-final";
    const Engine=global.EconomyEngine;
    if(!Engine){
        console.error("EconomyShopCore: EconomyEngine is not loaded.");
        return;
    }

    const ASSET_ROOT="draft-assets/";
    const FLOW_ID="economyFlowOverlay";
    let feedbackTimer=null;

    function bridge(){ return global.DraftEconomyBridge||null; }
    function clone(value){
        if(value===undefined) return undefined;
        try{ return structuredClone(value); }catch(error){ return JSON.parse(JSON.stringify(value)); }
    }
    function escapeHtml(value){
        return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
    }
    function canonicalAsset(stem){
        return {
            sale:`${ASSET_ROOT}${stem}_sale.png`,
            standard:`${ASSET_ROOT}${stem}_standard.png`
        };
    }
    function showFeedback(message,type="info"){
        if(typeof document==="undefined") return;
        let node=document.getElementById("economyShopFeedback");
        if(!node){
            node=document.createElement("div");
            node.id="economyShopFeedback";
            node.className="economy-shop-feedback";
            document.body.appendChild(node);
        }
        node.className=`economy-shop-feedback is-${type}`;
        node.textContent=String(message||"");
        node.classList.add("is-visible");
        clearTimeout(feedbackTimer);
        feedbackTimer=setTimeout(()=>node.classList.remove("is-visible"),2600);
    }

    function showCheckout(price,productName=""){
        if(typeof document==="undefined") return;
        document.querySelector(".economy-checkout-burst")?.remove();
        const amount=Math.max(0,Number(price)||0);
        const burst=document.createElement("div");
        burst.className="economy-checkout-burst";
        burst.setAttribute("aria-hidden","true");
        burst.innerHTML=`<div class="economy-checkout-card"><img src="${ASSET_ROOT}jeffcoin.png" alt=""><b>-${amount} JC</b><span>${escapeHtml(productName||"TRANSAKCJA ZAKOŃCZONA")}</span></div>`;
        document.body.appendChild(burst);
        requestAnimationFrame(()=>burst.classList.add("is-visible"));
        setTimeout(()=>burst.remove(),1450);
    }

    function closeFlow(){ document.getElementById(FLOW_ID)?.remove(); }

    const FLOW_EFFECTS=Object.freeze({
        exchange:{label:"KOSMICZNA WYMIANA",wait:520},
        sift:{label:"GALAKTYCZNY PRZESIEW",wait:650},
        deep:{label:"SKAN GŁĘBOKIEJ PRZESTRZENI",wait:900},
        orbit:{label:"SKAN NISKIEJ ORBITY",wait:700},
        cost:{label:"SKAN KOSZTU",wait:760},
        synergy:{label:"SKAN SYNERGII",wait:820},
        momentum:{label:"SKOK NADŚWIETLNY",wait:700},
        shield:{label:"GWIEZDNA OSŁONA",wait:650},
        mystery:{label:"TAJEMNICZA OFERTA",wait:1050},
        joker:{label:"JOKER SPOD LADY",wait:900},
        custom:{label:"CUSTOMOWA DOSTAWA",wait:780},
        recharge:{label:"RECHARGE",wait:920},
        save:{label:"DODATKOWY SAVE",wait:650},
        graveyard:{label:"KOSMICZNE ZMARTWYCHWSTANIE",wait:880}
    });

    function wait(ms){ return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0))); }

    function buildFlow(title,subtitle,options={}){
        closeFlow();
        const overlay=document.createElement("div");
        overlay.id=FLOW_ID;
        const kind=String(options.kind||"generic");
        overlay.className=`economy-flow-overlay economy-flow-${kind}${options.locked?" is-locked":""}`;
        overlay.dataset.flowKind=kind;
        overlay.innerHTML=`
            <section class="economy-flow-panel" role="dialog" aria-modal="true">
                ${options.allowCancel===false?"":`<button type="button" class="economy-flow-close" aria-label="Anuluj">×</button>`}
                <div class="economy-flow-ambient" aria-hidden="true"><i></i><i></i><i></i></div>
                <small>JEFF'S COSMIC SHOP</small>
                <h3>${escapeHtml(title)}</h3>
                ${subtitle?`<p>${escapeHtml(subtitle)}</p>`:""}
                <div class="economy-flow-content"></div>
            </section>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(()=>overlay.classList.add("is-entered"));
        return overlay;
    }

    function chooseFromList({title,subtitle,items,renderItem,allowCancel=true,className="",kind="generic",locked=false,stagger=true,isDisabled=null,disabledReason=null}){
        return new Promise(resolve=>{
            const overlay=buildFlow(title,subtitle,{allowCancel,kind,locked});
            const content=overlay.querySelector(".economy-flow-content");
            content.className=`economy-flow-content ${className}`.trim();
            let settled=false;
            const finish=value=>{
                if(settled) return;
                settled=true;
                overlay.classList.add("is-leaving");
                setTimeout(()=>overlay.remove(),150);
                resolve(value);
            };
            (items||[]).forEach((item,index)=>{
                const button=document.createElement("button");
                button.type="button";
                button.className="economy-flow-choice";
                if(stagger) button.style.setProperty("--economy-choice-delay",`${Math.min(index,11)*55}ms`);
                button.innerHTML=renderItem?renderItem(item,index):escapeHtml(String(item));
                const disabled=Boolean(isDisabled?.(item,index));
                if(disabled){
                    button.disabled=true;
                    button.classList.add("is-disabled");
                    const reason=typeof disabledReason==="function" ? disabledReason(item,index) : disabledReason;
                    if(reason) button.title=String(reason);
                }else{
                    button.addEventListener("click",()=>finish(item));
                }
                content.appendChild(button);
            });
            if(allowCancel){
                overlay.querySelector(".economy-flow-close")?.addEventListener("click",()=>finish(null));
                overlay.addEventListener("mousedown",event=>{ if(event.target===overlay) finish(null); });
            }
        });
    }

    function confirmCommit({title,message,actionLabel="LOSUJ",kind="exchange",price=null}){
        return new Promise(resolve=>{
            const overlay=buildFlow(title,message,{allowCancel:true,kind});
            const content=overlay.querySelector(".economy-flow-content");
            const panel=overlay.querySelector(".economy-flow-panel");
            content.classList.add("economy-flow-confirm");
            const priceLine=Number.isFinite(Number(price)) ? `<span class="economy-flow-commit-price"><img src="${ASSET_ROOT}jeffcoin.png" alt="JeffCoin">${Number(price)} JC</span>` : "";
            panel?.insertAdjacentHTML("beforeend",`<img class="economy-flow-shop-logo" src="${ASSET_ROOT}cosmic_shop_logo.png" alt="Jeff's Cosmic Shop">`);
            content.innerHTML=`
                <div class="economy-flow-commit-warning"><b>UWAGA</b><span>Po kliknięciu przycisku koszyka usługa sklepu zostanie aktywowana. Nie można jej już cofnąć.</span></div>
                <button type="button" class="economy-flow-primary economy-flow-commit">
                    <img class="economy-flow-commit-cart" src="${ASSET_ROOT}shop_purchase_cart.png" alt="">
                    <span class="economy-flow-commit-action">${escapeHtml(actionLabel)}</span>
                    ${priceLine}
                </button>
                <button type="button" class="economy-flow-secondary">ANULUJ</button>`;
            let settled=false;
            const finish=value=>{
                if(settled) return;
                settled=true;
                overlay.classList.add("is-leaving");
                setTimeout(()=>overlay.remove(),150);
                resolve(value);
            };
            content.querySelector(".economy-flow-commit")?.addEventListener("click",()=>finish(true));
            content.querySelector(".economy-flow-secondary")?.addEventListener("click",()=>finish(false));
            overlay.querySelector(".economy-flow-close")?.addEventListener("click",()=>finish(false));
            overlay.addEventListener("mousedown",event=>{ if(event.target===overlay) finish(false); });
        });
    }

    function miniCardMarkup(card,options={}){
        const value=card||{};
        const tags=[];
        if(options.shielded) tags.push("✦ OSŁONA");
        if(options.blocked) tags.push("⛔ OCHRONA");
        return `<span class="economy-shop-mini-card${options.compact?" is-compact":""}">
            <img class="economy-shop-mini-card-frame" src="${ASSET_ROOT}shop_mini_card_frame.png" alt="" aria-hidden="true">
            <span class="economy-shop-mini-cost">${Number(value.cost??0)}</span>
            <b>${escapeHtml(value.name||"KARTA")}</b>
            <span class="economy-shop-mini-power">${Number(value.power??0)}</span>
            ${tags.length?`<em>${escapeHtml(tags.join(" • "))}</em>`:""}
        </span>`;
    }

    async function runInterlude({title,subtitle,kind="exchange",label="",duration=null,cards=[]}){
        const effect=FLOW_EFFECTS[kind]||FLOW_EFFECTS.exchange;
        const overlay=buildFlow(title,subtitle,{allowCancel:false,kind,locked:true});
        const content=overlay.querySelector(".economy-flow-content");
        content.classList.add("economy-flow-interlude");
        content.innerHTML=`
            <div class="economy-flow-effect economy-effect-${escapeHtml(kind)}" aria-hidden="true">
                <span class="economy-effect-core"></span>
                <span class="economy-effect-ring ring-a"></span>
                <span class="economy-effect-ring ring-b"></span>
                <span class="economy-effect-line"></span>
                <span class="economy-effect-symbol">${escapeHtml(label||effect.label||"")}</span>
                ${Array.isArray(cards)&&cards.length?`<span class="economy-effect-live-cards">${cards.slice(0,3).map(card=>miniCardMarkup(card,{compact:true})).join("")}</span>`:""}
            </div>`;
        await wait(duration??effect.wait);
        overlay.classList.add("is-leaving");
        await wait(150);
        overlay.remove();
    }

    function showNotice(title,message,buttonLabel="REALIZUJ",kind="generic"){
        return new Promise(resolve=>{
            const overlay=buildFlow(title,message,{allowCancel:false,kind,locked:true});
            const content=overlay.querySelector(".economy-flow-content");
            content.innerHTML=`<button type="button" class="economy-flow-primary">${escapeHtml(buttonLabel)}</button>`;
            content.querySelector("button")?.addEventListener("click",()=>{ overlay.classList.add("is-leaving"); setTimeout(()=>overlay.remove(),150); resolve(true); });
        });
    }

    function showEffectBurst(kind,label){
        if(typeof document==="undefined") return;
        const burst=document.createElement("div");
        burst.className=`economy-purchase-burst economy-purchase-burst-${kind||"generic"}`;
        burst.innerHTML=`<span>${escapeHtml(label||"ZAKUP UDANY")}</span>`;
        document.body.appendChild(burst);
        requestAnimationFrame(()=>burst.classList.add("is-visible"));
        setTimeout(()=>burst.classList.add("is-leaving"),760);
        setTimeout(()=>burst.remove(),1080);
    }

    async function showCardExchangeAnimation(sourceCard,resultCard,{kind="exchange",label="WYMIANA ZAKOŃCZONA"}={}){
        if(typeof document==="undefined") return;
        document.querySelector(".economy-card-exchange-stage")?.remove();
        const stage=document.createElement("div");
        stage.className=`economy-card-exchange-stage economy-card-exchange-${kind}`;
        stage.setAttribute("aria-hidden","true");
        stage.innerHTML=`
            <div class="economy-card-exchange-panel">
                <small>${escapeHtml(label)}</small>
                <div class="economy-card-exchange-cards">
                    ${miniCardMarkup(sourceCard)}
                    <span class="economy-card-exchange-energy"><i></i><b>✦</b><i></i></span>
                    ${miniCardMarkup(resultCard)}
                </div>
            </div>`;
        document.body.appendChild(stage);
        requestAnimationFrame(()=>stage.classList.add("is-visible"));
        const reduced=global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        await wait(reduced?420:1280);
        stage.classList.add("is-leaving");
        await wait(reduced?80:240);
        stage.remove();
    }

    function getDeck(playerIndex){
        return bridge()?.getDeckEntries?.(playerIndex)||[];
    }

    function chooseDeckCard(playerIndex,options={}){
        const protectedIds=new Set(Engine.getProtectedCardIds?.(playerIndex)||[]);
        const items=getDeck(playerIndex).filter(entry=>{
            if(!entry?.card) return false;
            if(options.onlyUnprotected && protectedIds.has(String(entry.card.instanceId||""))) return false;
            return options.filter ? options.filter(entry) : true;
        });
        if(!items.length) return Promise.resolve(null);
        const isWolverineBlocked=entry=>Boolean(
            options.repairTarget &&
            global.isWolverineRegeneratedProtectedCard?.(entry?.card)
        );
        return chooseFromList({
            title:options.title||"WYBIERZ KARTĘ Z DECKU",
            subtitle:options.suppressSubtitle?"":(options.subtitle||"Ta karta zostanie użyta przez wybraną usługę sklepu."),
            items,
            allowCancel:options.allowCancel!==false,
            kind:options.kind||"exchange",
            className:"economy-flow-card-grid economy-flow-deck-grid",
            isDisabled:isWolverineBlocked,
            disabledReason:"Czynnik regeneracyjny Wolverinea chroni tę kartę przed przelosowaniem do końca draftu.",
            renderItem:entry=>{
                const card=entry.card||{};
                const shielded=protectedIds.has(String(card.instanceId||""));
                const wolverineBlocked=isWolverineBlocked(entry);
                return miniCardMarkup(card,{shielded,blocked:wolverineBlocked});
            }
        });
    }

    function chooseReplacement(options,meta={}){
        if(!Array.isArray(options)||!options.length) return Promise.resolve(null);
        return chooseFromList({
            title:meta.title||"WYBIERZ NOWĄ KARTĘ",
            subtitle:meta.subtitle||"Wybierz jedną z legalnych propozycji.",
            items:options,
            allowCancel:meta.allowCancel!==false,
            locked:meta.allowCancel===false,
            kind:meta.kind||"exchange",
            className:`economy-flow-card-grid economy-flow-replacements economy-reveal-${meta.kind||"exchange"}` ,
            renderItem:card=>miniCardMarkup(card)
        });
    }

    async function performReplacement(playerIndex,{count,filter={},productId,productName,mysteryGrant=false,kind="exchange",price=null}){
        const b=bridge();
        if(!b) return {ok:false,reason:"Brak mostu Economy do draftu."};
        const source=await chooseDeckCard(playerIndex,{
            title:"WYBIERZ KARTĘ DO WYMIANY",
            suppressSubtitle:true,
            allowCancel:!mysteryGrant,
            kind,
            repairTarget:true
        });
        if(!source) return {ok:false,reason:"Zakup anulowany."};

        if(!mysteryGrant){
            const committed=await confirmCommit({
                title:productName,
                message:`${escapeTextPlain(source.card?.name)} zostanie przelosowana. Kliknięcie LOSUJ uruchamia ofertę i od tego momentu nie ma już wycofania po podejrzeniu wyniku.`,
                actionLabel:kind==="deep"?"OTWÓRZ SKAN":"LOSUJ",
                kind,
                price
            });
            if(!committed) return {ok:false,reason:"Zakup anulowany."};
        }

        await runInterlude({
            title:productName,
            subtitle:kind==="deep"?"Otwieranie szerokiego skanu puli…":"Jeffik przygotowuje ofertę…",
            kind,
            label:count>1?`1 Z ${count}`:"",
            cards:[source.card]
        });

        const generated=b.getReplacementOptions?.(playerIndex,source.index,count,filter)||[];
        if(generated.length<count){
            return {ok:false,reason:`Brak pełnej legalnej puli ${count} kart dla tej usługi.`};
        }
        const replacement=await chooseReplacement(generated,{
            title:productName,
            subtitle:`${escapeTextPlain(source.card?.name)} → wybierz 1 z ${count}. Wynik jest już zablokowany.`,
            allowCancel:false,
            kind
        });
        if(!replacement) return {ok:false,reason:"Nie udało się wybrać wyniku."};
        const result=b.replaceDeckCard?.(playerIndex,source.index,replacement,{
            productId,
            productName,
            filter:clone(filter),
            mysteryGrant:Boolean(mysteryGrant)
        });
        if(!result?.ok) return result||{ok:false,reason:"Nie udało się wymienić karty."};
        await showCardExchangeAnimation(source.card,replacement,{kind,label:productName});
        showEffectBurst(kind,`${productName} • ${replacement.name||"KARTA WYBRANA"}`);
        return {ok:true,data:{sourceCard:source.card?.name||null,resultCard:replacement.name||null,cardIndex:source.index}};
    }

    function escapeTextPlain(value){ return String(value??""); }

    function canRepair(playerIndex,count,filter={}){
        const b=bridge();
        if(!b) return {ok:false,reason:"Sklep nie ma dostępu do draftu."};
        const deck=getDeck(playerIndex);
        if(!deck.length) return {ok:false,reason:"Najpierw musisz mieć kartę w decku."};
        const hasAny=deck.some(entry=>
            !global.isWolverineRegeneratedProtectedCard?.(entry?.card) &&
            (b.getReplacementOptions?.(playerIndex,entry.index,count,filter)||[]).length>=count
        );
        return hasAny ? {ok:true} : {ok:false,reason:"Brak pełnej legalnej puli dla tej usługi."};
    }

    async function costScanResolve({playerIndex,price,context={}}){
        const b=bridge();
        const mysteryGrant=Boolean(context.mysteryGrant);
        const source=await chooseDeckCard(playerIndex,{title:"SKAN KOSZTU • KARTA DO WYMIANY",allowCancel:!mysteryGrant,kind:"cost",repairTarget:true});
        if(!source) return {ok:false,reason:"Zakup anulowany."};
        const costs=b?.getEligibleCosts?.(playerIndex,source.index,3)||[];
        if(!costs.length) return {ok:false,reason:"Brak kosztu z pełną pulą 3 legalnych kart."};
        const selected=await chooseFromList({
            title:"SKAN KOSZTU",
            subtitle:"Wybierz dokładny koszt poszukiwanej karty.",
            items:costs,
            allowCancel:!mysteryGrant,
            kind:"cost",
            className:"economy-flow-token-grid economy-flow-cost-grid",
            renderItem:item=>`<b>${escapeHtml(item.label??item.cost)}</b><span>${Number(item.count||0)} legalnych</span>`
        });
        if(!selected) return {ok:false,reason:"Zakup anulowany."};
        if(!mysteryGrant){
            const committed=await confirmCommit({
                title:`SKAN KOSZTU • ${selected.cost}`,
                message:`Skan wyszuka 3 legalne karty o koszcie ${selected.cost}. Po kliknięciu SKANUJ oferta zostaje zablokowana.`,
                actionLabel:"SKANUJ",kind:"cost",price
            });
            if(!committed) return {ok:false,reason:"Zakup anulowany."};
        }
        await runInterlude({title:"SKAN KOSZTU",subtitle:`Namierzanie kart o koszcie ${selected.cost}…`,kind:"cost",label:`KOSZT ${selected.cost}`,cards:[source.card]});
        const options=b.getReplacementOptions?.(playerIndex,source.index,3,{exactCost:Number(selected.cost)})||[];
        if(options.length<3) return {ok:false,reason:"Pula kosztu zmieniła się i nie ma już 3 legalnych kart."};
        const replacement=await chooseReplacement(options,{title:`SKAN KOSZTU • ${selected.cost}`,subtitle:"Wybierz 1 z 3. Skan został już opłacony i zablokowany.",allowCancel:false,kind:"cost"});
        if(!replacement) return {ok:false,reason:"Nie udało się wybrać wyniku skanu."};
        const result=b.replaceDeckCard?.(playerIndex,source.index,replacement,{productId:"cost_scan",exactCost:Number(selected.cost),mysteryGrant});
        if(!result?.ok) return result;
        await showCardExchangeAnimation(source.card,replacement,{kind:"cost",label:`SKAN KOSZTU ${selected.cost}`});
        showEffectBurst("cost",`KOSZT ${selected.cost} • ${replacement.name||"KARTA WYBRANA"}`);
        return {ok:true,data:{sourceCard:source.card?.name||null,resultCard:replacement.name||null,cost:Number(selected.cost)}};
    }

    async function synergyScanResolve({playerIndex,price,context={}}){
        const b=bridge();
        const mysteryGrant=Boolean(context.mysteryGrant);
        const source=await chooseDeckCard(playerIndex,{title:"SKAN SYNERGII • KARTA DO WYMIANY",allowCancel:!mysteryGrant,kind:"synergy",repairTarget:true});
        if(!source) return {ok:false,reason:"Zakup anulowany."};
        const tags=b?.getEligibleSynergyTags?.(playerIndex,source.index,3)||[];
        if(!tags.length) return {ok:false,reason:"Brak archetypu z pełną pulą 3 legalnych kart."};
        const selected=await chooseFromList({
            title:"SKAN SYNERGII",
            subtitle:"Wybierz archetyp / tag synergii.",
            items:tags,
            allowCancel:!mysteryGrant,
            kind:"synergy",
            className:"economy-flow-tag-grid economy-flow-synergy-grid",
            renderItem:item=>`<b>${escapeHtml(item.name||item.id)}</b><span>${Number(item.count||0)} legalnych kart</span>`
        });
        if(!selected) return {ok:false,reason:"Zakup anulowany."};
        if(!mysteryGrant){
            const committed=await confirmCommit({
                title:`SKAN SYNERGII • ${selected.name||selected.id}`,
                message:"Skan dopasuje 3 legalne karty z wybranego archetypu. Po kliknięciu SKANUJ wynik zostaje zablokowany.",
                actionLabel:"SKANUJ",kind:"synergy",price
            });
            if(!committed) return {ok:false,reason:"Zakup anulowany."};
        }
        await runInterlude({title:"SKAN SYNERGII",subtitle:`Łączenie sygnałów archetypu ${selected.name||selected.id}…`,kind:"synergy",label:"SYNERGIA",cards:[source.card]});
        const options=b.getReplacementOptions?.(playerIndex,source.index,3,{requiredTag:selected.id})||[];
        if(options.length<3) return {ok:false,reason:"Pula synergii zmieniła się i nie ma już 3 legalnych kart."};
        const replacement=await chooseReplacement(options,{title:`SKAN SYNERGII • ${selected.name||selected.id}`,subtitle:"Wybierz 1 z 3. Wynik skanu jest już zablokowany.",allowCancel:false,kind:"synergy"});
        if(!replacement) return {ok:false,reason:"Nie udało się wybrać wyniku skanu."};
        const result=b.replaceDeckCard?.(playerIndex,source.index,replacement,{productId:"synergy_scan",requiredTag:selected.id,mysteryGrant});
        if(!result?.ok) return result;
        await showCardExchangeAnimation(source.card,replacement,{kind:"synergy",label:"SKAN SYNERGII"});
        showEffectBurst("synergy",`${selected.name||selected.id} • ${replacement.name||"KARTA WYBRANA"}`);
        return {ok:true,data:{sourceCard:source.card?.name||null,resultCard:replacement.name||null,tag:selected.id}};
    }

    function momentumAvailability(playerIndex){
        const b=bridge();
        if(!b) return {ok:false,reason:"Brak dostępu do kolejki."};
        const momentum=Engine.getMomentum?.(playerIndex)||{pending:0,applied:0,targetKey:null};
        if(Number(momentum.pending||0)>=4) return {ok:false,reason:"Ten przyszły pick ma już maksymalne +4."};
        const opportunity=b.getMomentumOpportunity?.(playerIndex);
        if(!opportunity?.ok) return opportunity||{ok:false,reason:"Brak przyszłego normalnego picku."};
        if(momentum.targetKey && momentum.targetKey!==opportunity.targetKey){
            return {ok:false,reason:"Najpierw wykorzystaj wykupiony Skok Nadświetlny."};
        }
        if(Number(opportunity.maxShift||0)<2){
            return {ok:false,reason:"Najbliższego picku nie da się legalnie przesunąć o pełne 2 miejsca."};
        }
        return {ok:true,opportunity,momentum};
    }

    async function momentumResolve({playerIndex,price,context={}}){
        const availability=momentumAvailability(playerIndex);
        if(!availability.ok) return availability;
        const mysteryGrant=Boolean(context.mysteryGrant);
        if(!mysteryGrant){
            const current=Number(Engine.getMomentum?.(playerIndex)?.pending||0);
            const committed=await confirmCommit({
                title:"SKOK NADŚWIETLNY",
                message:`Najbliższy przyszły normalny pick przesunie się o +2 miejsca${current?` (łącznie będzie +${Math.min(4,current+2)})`:""}.`,
                actionLabel:"AKTYWUJ +2",kind:"momentum",price
            });
            if(!committed) return {ok:false,reason:"Zakup anulowany."};
        }
        await runInterlude({title:"SKOK NADŚWIETLNY",subtitle:"Napęd Jeffika ładuje pozycję w kolejce…",kind:"momentum",label:"+2"});
        const reserved=Engine.reserveMomentum?.(playerIndex,availability.opportunity.targetKey,2);
        if(!reserved?.ok) return reserved;
        const applyResult=Engine.applyPendingMomentumForCurrentQueue?.({fresh:false})||[];
        const total=Number(Engine.getMomentum?.(playerIndex)?.pending||2);
        showEffectBurst("momentum",`SKOK AKTYWNY • +${Math.min(4,total)}`);
        return {ok:true,data:{targetKey:availability.opportunity.targetKey,pending:total,appliedNow:clone(applyResult)}};
    }

    function shieldAvailability(playerIndex){
        if(bridge()?.isDraftFinished?.()) return {ok:false,reason:"Po zakończeniu draftowania Gwiezdna Osłona nie ma już legalnego celu."};
        const items=getDeck(playerIndex);
        const protectedIds=new Set(Engine.getProtectedCardIds?.(playerIndex)||[]);
        const has=items.some(entry=>entry.card?.instanceId && !protectedIds.has(String(entry.card.instanceId)));
        return has?{ok:true}:{ok:false,reason:"Wszystkie dostępne karty tego gracza są już objęte Gwiezdną Osłoną."};
    }

    async function shieldResolve({playerIndex,context={}}){
        const mysteryGrant=Boolean(context.mysteryGrant);
        const selected=await chooseDeckCard(playerIndex,{
            title:"GWIEZDNA OSŁONA",
            subtitle:"Wybierz kartę, którą chcesz zabezpieczyć do końca draftu.",
            onlyUnprotected:true,
            allowCancel:!mysteryGrant,
            kind:"shield"
        });
        if(!selected) return {ok:false,reason:"Zakup anulowany."};
        await runInterlude({title:"GWIEZDNA OSŁONA",subtitle:`Nakładanie osłony na ${selected.card?.name||"kartę"}…`,kind:"shield",label:"OCHRONA",cards:[selected.card]});
        const result=Engine.protectCard?.(playerIndex,selected.card,{cardName:selected.card?.name||null});
        if(!result?.ok) return result;
        bridge()?.refreshAfterEconomyMutation?.();
        showEffectBurst("shield",`${selected.card?.name||"KARTA"} • CHRONIONA`);
        return {ok:true,data:{cardName:selected.card?.name||null,instanceId:selected.card?.instanceId||null}};
    }


    const EXTENSION_META=Object.freeze({
        jokers:{label:"JOKERY",icon:"draft-assets/jeff_joker.webp",color:"#ff35c8"},
        custom_packs:{label:"CUSTOM PACKS",icon:"draft-assets/jeffgoldenhand.webp",color:"#38e9c0"},
        superpowers:{label:"SUPERMOCE",icon:"draft-assets/jeffpowers.webp",color:"#ffd45b"},
        save_steal:{label:"SAVE & STEAL",icon:"draft-assets/jeff_thief.png",color:"#ff536f"}
    });

    function extensionEnabled(id){
        return Boolean(bridge()?.isExtensionEnabled?.(id));
    }

    function extensionAsset(stem){
        return canonicalAsset(stem);
    }

    function resolveJokerForEffect(joker,playerIndex){
        return new Promise(resolve=>{
            const ui=global.JokerV2UI;
            if(!ui?.resolveForEffect){ resolve(null); return; }
            const shopOverlay=document.getElementById("economyShopOverlay");
            shopOverlay?.classList.add("has-child-modal");
            let settled=false;
            const finish=value=>{
                if(settled) return;
                settled=true;
                shopOverlay?.classList.remove("has-child-modal");
                resolve(value||null);
            };
            const opened=ui.resolveForEffect(joker,{
                playerIndex,
                sourceZone:"economy_shop",
                sourceEvent:"joker_under_counter",
                allowCancel:false,
                onResolve:card=>finish(card),
                onCancel:()=>finish(null)
            });
            if(opened===false) finish(null);
        });
    }

    function getRandomShopJoker(){
        if(typeof global.getPremiumJoker!=="function") return null;
        for(let attempt=0;attempt<40;attempt++){
            const joker=global.getPremiumJoker({minimumRarity:"epic"});
            const rarity=String(global.getJokerRarity?.(joker)||joker?.rarity||"").toLowerCase();
            if(joker && (rarity==="epic"||rarity==="legendary")) return joker;
        }
        return null;
    }

    function jokerUnderCounterAvailability(playerIndex){
        if(!extensionEnabled("jokers")) return {ok:false,reason:"Rozszerzenie Jokery jest wyłączone."};
        if(typeof global.getPremiumJoker!=="function"||!global.JokerV2UI?.resolveForEffect){
            return {ok:false,reason:"Joker Engine nie jest gotowy."};
        }
        const hasTarget=getDeck(playerIndex).some(entry=>entry?.card&&!global.isWolverineRegeneratedProtectedCard?.(entry.card));
        if(!hasTarget) return {ok:false,reason:"Brak legalnej karty do wymiany na Jokera."};
        return getRandomShopJoker()?{ok:true}:{ok:false,reason:"Brak legalnego Epickiego lub Legendarnego Jokera."};
    }

    async function jokerUnderCounterResolve({playerIndex,price}){
        const source=await chooseDeckCard(playerIndex,{
            title:"JOKER SPOD LADY • KARTA DO WYMIANY",
            subtitle:"Wybierz kartę, którą oddasz za losowego Epickiego lub Legendarnego Jokera.",
            allowCancel:true,
            kind:"joker",
            repairTarget:true
        });
        if(!source) return {ok:false,reason:"Zakup anulowany."};
        const committed=await confirmCommit({
            title:"JOKER SPOD LADY",
            message:`${escapeTextPlain(source.card?.name)} zostanie oddana. Po wyciągnięciu Jokera spod lady jego rzadkość i typ zostają zablokowane — trzeba go od razu rozstrzygnąć.`,
            actionLabel:"WYCIĄGNIJ JOKERA",
            kind:"joker",
            price
        });
        if(!committed) return {ok:false,reason:"Zakup anulowany."};
        await runInterlude({title:"JOKER SPOD LADY",subtitle:"Jeffik sprawdza tajną półkę pod ladą…",kind:"joker",label:"EPIC / LEGENDARY",cards:[source.card]});
        const jokerTemplate=getRandomShopJoker();
        if(!jokerTemplate) return {ok:false,reason:"Sklep nie znalazł legalnego Epickiego ani Legendarnego Jokera."};
        const joker=typeof global.createDraftCardInstance==="function"
            ? global.createDraftCardInstance(jokerTemplate,{origin:"economy_joker_under_counter",sourceEvent:"joker_under_counter",forceNew:true})
            : clone(jokerTemplate);
        const resolvedCard=await resolveJokerForEffect(joker,playerIndex);
        if(!resolvedCard) return {ok:false,reason:"Nie udało się rozstrzygnąć Jokera."};
        const result=bridge()?.replaceDeckCard?.(playerIndex,source.index,resolvedCard,{
            productId:"joker_under_counter",
            productName:"Joker spod lady",
            jokerId:joker?.id||null,
            jokerRarity:global.getJokerRarity?.(joker)||joker?.rarity||null
        });
        if(!result?.ok) return result||{ok:false,reason:"Nie udało się wymienić karty na wynik Jokera."};
        const rejected=global.archivePendingJokerRejections?.(resolvedCard,{
            source:"economy_joker_under_counter_rejected",
            resolutionPath:"economy_joker_under_counter",
            metadata:{playerIndex,productId:"joker_under_counter"}
        })||[];
        global.jokerLog=Array.isArray(global.jokerLog)?global.jokerLog:[];
        global.jokerLog.push({
            event:"economy_joker_under_counter_resolved",
            jokerId:joker?.id||null,
            jokerName:joker?.name||null,
            jokerType:global.getJokerMode?.(joker)||joker?.type||null,
            jokerRarity:global.getJokerRarity?.(joker)||joker?.rarity||null,
            playerIndex,
            playerName:Engine.getPlayerState?.(playerIndex)?.playerName||null,
            removedCard:source.card?.name||null,
            addedCard:resolvedCard?.name||null,
            rejectedCards:rejected.map(entry=>entry?.card?.name).filter(Boolean),
            timestamp:new Date().toISOString()
        });
        bridge()?.refreshAfterEconomyMutation?.();
        await showCardExchangeAnimation(source.card,resolvedCard,{kind:"joker",label:"JOKER SPOD LADY"});
        showEffectBurst("joker",`JOKER • ${resolvedCard?.name||"ROZSTRZYGNIĘTY"}`);
        return {ok:true,data:{sourceCard:source.card?.name||null,resultCard:resolvedCard?.name||null,jokerId:joker?.id||null,jokerRarity:global.getJokerRarity?.(joker)||joker?.rarity||null}};
    }

    function customDeliveryAvailability(playerIndex){
        if(!extensionEnabled("custom_packs")) return {ok:false,reason:"Rozszerzenie Custom Packs jest wyłączone."};
        const packs=bridge()?.getActiveCustomPacks?.()||[];
        if(!packs.length) return {ok:false,reason:"Brak aktywnej Customowej Paczki."};
        const deck=getDeck(playerIndex).filter(entry=>!global.isWolverineRegeneratedProtectedCard?.(entry?.card));
        const has=deck.some(entry=>packs.some(pack=>(bridge()?.getCustomPackReplacementOptions?.(playerIndex,entry.index,pack.id,3)||[]).length>=3));
        return has?{ok:true}:{ok:false,reason:"Aktywne Customowe Paczki nie mają teraz pełnej puli 1 z 3 dla tego decku."};
    }

    async function customDeliveryResolve({playerIndex,price}){
        const source=await chooseDeckCard(playerIndex,{title:"CUSTOMOWA DOSTAWA • KARTA DO WYMIANY",subtitle:"Wybierz kartę, którą zastąpi dostawa z aktywnej Customowej Paczki.",allowCancel:true,kind:"custom",repairTarget:true});
        if(!source) return {ok:false,reason:"Zakup anulowany."};
        const packs=(bridge()?.getActiveCustomPacks?.()||[]).filter(pack=>(bridge()?.getCustomPackReplacementOptions?.(playerIndex,source.index,pack.id,3)||[]).length>=3);
        if(!packs.length) return {ok:false,reason:"Dla tej karty nie ma aktywnej Customowej Paczki z pełną pulą 1 z 3."};
        const selected=await chooseFromList({
            title:"CUSTOMOWA DOSTAWA",
            subtitle:"Wybierz jedną z Customowych Paczek aktywnych w tym drafcie.",
            items:packs,
            allowCancel:true,
            kind:"custom",
            className:"economy-flow-tag-grid economy-flow-custom-grid",
            renderItem:pack=>`<b>${escapeHtml(pack.name||pack.id)}</b><span>${escapeHtml(pack.summary||"AKTYWNA CUSTOM PACK")}</span>`
        });
        if(!selected) return {ok:false,reason:"Zakup anulowany."};
        const committed=await confirmCommit({
            title:`CUSTOMOWA DOSTAWA • ${selected.name||selected.id}`,
            message:"Po kliknięciu OTWÓRZ system pokaże 3 legalne karty tylko z wybranej Customowej Paczki. Wynik zostaje zablokowany.",
            actionLabel:"OTWÓRZ DOSTAWĘ",
            kind:"custom",
            price
        });
        if(!committed) return {ok:false,reason:"Zakup anulowany."};
        await runInterlude({title:"CUSTOMOWA DOSTAWA",subtitle:`Sprowadzanie kart z: ${selected.name||selected.id}…`,kind:"custom",label:"CUSTOM PACK",cards:[source.card]});
        const options=bridge()?.getCustomPackReplacementOptions?.(playerIndex,source.index,selected.id,3)||[];
        if(options.length<3) return {ok:false,reason:"Pula Customowej Paczki zmieniła się i nie ma już pełnych 3 legalnych kart."};
        const replacement=await chooseReplacement(options,{title:selected.name||"CUSTOMOWA DOSTAWA",subtitle:"Wybierz 1 z 3. Dostawa została już otwarta.",allowCancel:false,kind:"custom"});
        if(!replacement) return {ok:false,reason:"Nie udało się wybrać karty z dostawy."};
        const result=bridge()?.replaceDeckCard?.(playerIndex,source.index,replacement,{productId:"custom_delivery",productName:"Customowa Dostawa",customPackId:selected.id});
        if(!result?.ok) return result;
        await showCardExchangeAnimation(source.card,replacement,{kind:"custom",label:"CUSTOMOWA DOSTAWA"});
        showEffectBurst("custom",`CUSTOM • ${replacement.name||"KARTA WYBRANA"}`);
        return {ok:true,data:{sourceCard:source.card?.name||null,resultCard:replacement.name||null,customPackId:selected.id,customPackName:selected.name||selected.id}};
    }

    function rechargeAvailability(playerIndex){
        if(!extensionEnabled("superpowers")) return {ok:false,reason:"Rozszerzenie Supermoce jest wyłączone."};
        return bridge()?.getSuperpowerRechargeOpportunity?.(playerIndex)||{ok:false,reason:"Recharge jest teraz niedostępny."};
    }

    async function rechargeResolve({playerIndex,price}){
        const opportunity=rechargeAvailability(playerIndex);
        if(!opportunity?.ok) return opportunity;
        const upgradeCopy=opportunity.rechargeLabel
            ? ` • ${opportunity.rechargeLabel}`
            : "";
        const committed=await confirmCommit({
            title:"RECHARGE SUPERMOCY",
            message:`Naładuj ponownie: ${opportunity.powerName||"Supermoc"}${upgradeCopy}. Recharge można kupić tylko raz na draft.`,
            actionLabel:"RECHARGE",
            kind:"recharge",
            price
        });
        if(!committed) return {ok:false,reason:"Zakup anulowany."};
        await runInterlude({title:"RECHARGE SUPERMOCY",subtitle:`Ładowanie: ${opportunity.powerName||"Supermoc"}${upgradeCopy}…`,kind:"recharge",label:"⚡ RECHARGE"});
        const result=bridge()?.rechargeSuperpower?.(playerIndex);
        if(!result?.ok) return result||{ok:false,reason:"Nie udało się naładować Supermocy."};
        showEffectBurst("recharge",`${opportunity.powerName||"SUPERMOC"} • ${opportunity.rechargeLabel||"GOTOWA"}`);
        return {ok:true,data:{powerId:result.powerId||opportunity.powerId||null,powerName:result.powerName||opportunity.powerName||null,rechargeMode:opportunity.rechargeMode||"normal"}};
    }

    function extraSaveIds(playerIndex){
        const value=Engine.getExtensionState?.(playerIndex,"save_steal_extra_saved_ids",[])||[];
        return Array.isArray(value)?value.map(String):[];
    }

    function extraSaveAvailability(playerIndex){
        if(!extensionEnabled("save_steal")) return {ok:false,reason:"Rozszerzenie Save & Steal jest wyłączone."};
        if(bridge()?.isDraftFinished?.()) return {ok:false,reason:"Dodatkowy Save trzeba wykupić przed końcową fazą Save & Steal."};
        const protectedIds=new Set(extraSaveIds(playerIndex));
        const has=getDeck(playerIndex).some(entry=>entry?.card?.instanceId&&!protectedIds.has(String(entry.card.instanceId)));
        return has?{ok:true}:{ok:false,reason:"Wszystkie dostępne karty są już objęte zakupionym Save."};
    }

    async function extraSaveResolve({playerIndex}){
        const current=new Set(extraSaveIds(playerIndex));
        const selected=await chooseDeckCard(playerIndex,{
            title:"DODATKOWY SAVE",
            subtitle:"Wybierz kartę, która będzie dodatkowo chroniona przed STEAL w końcowej fazie Save & Steal.",
            allowCancel:true,
            kind:"save",
            filter:entry=>Boolean(entry?.card?.instanceId)&&!current.has(String(entry.card.instanceId))
        });
        if(!selected) return {ok:false,reason:"Zakup anulowany."};
        const id=String(selected.card?.instanceId||"");
        if(!id) return {ok:false,reason:"Ta karta nie ma stabilnej instancji do ochrony."};
        current.add(id);
        const stored=Engine.setExtensionState?.(playerIndex,"save_steal_extra_saved_ids",[...current],{reason:"economy_extra_save",data:{cardName:selected.card?.name||null,instanceId:id}});
        if(!stored?.ok) return stored||{ok:false,reason:"Nie udało się zapisać dodatkowego Save."};
        await runInterlude({title:"DODATKOWY SAVE",subtitle:`Zabezpieczanie ${selected.card?.name||"karty"} przed STEAL…`,kind:"save",label:"SAVE"});
        bridge()?.refreshAfterEconomyMutation?.();
        showEffectBurst("save",`${selected.card?.name||"KARTA"} • SAVE`);
        return {ok:true,data:{cardName:selected.card?.name||null,instanceId:id,totalExtraSaves:current.size}};
    }

    function shuffleCopy(list){
        const result=[...(Array.isArray(list)?list:[])];
        for(let index=result.length-1;index>0;index--){
            const target=Math.floor(Math.random()*(index+1));
            [result[index],result[target]]=[result[target],result[index]];
        }
        return result;
    }

    function graveyardCandidates(){
        const entries=global.DraftStateEngine?.listGraveyardEntries?.({status:"available",recoverable:true})||[];
        const seen=new Set();
        return entries.filter(entry=>{
            const card=entry?.card;
            const id=String(entry?.graveyardEntryId||"");
            if(!id||!card||card.joker||seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }

    function graveyardAvailability(playerIndex){
        if(!graveyardCandidates().length){
            return {ok:false,reason:"W Cmentarzysku nie ma teraz karty, którą można przywrócić."};
        }
        const protectedIds=new Set(Engine.getProtectedCardIds?.(playerIndex)||[]);
        const hasReplacement=getDeck(playerIndex).some(entry=>{
            const card=entry?.card;
            if(!card) return false;
            if(global.isWolverineRegeneratedProtectedCard?.(card)) return false;
            if(card.instanceId && protectedIds.has(String(card.instanceId))) return false;
            return true;
        });
        return hasReplacement
            ? {ok:true}
            : {ok:false,reason:"Nie masz legalnej własnej karty, którą można wymienić za kartę z Cmentarzyska."};
    }

    async function graveyardResolve({playerIndex}){
        const choices=shuffleCopy(graveyardCandidates()).slice(0,5);
        if(!choices.length) return {ok:false,reason:"W Cmentarzysku nie ma teraz karty, którą można przywrócić."};
        const selected=await chooseFromList({
            title:"KOSMICZNE ZMARTWYCHWSTANIE",
            subtitle:"Wybierz jedną z maksymalnie pięciu kart z Cmentarzyska. Następnie wskaż własną kartę, która zajmie jej miejsce na Cmentarzysku — wymiana jest zawsze 1:1.",
            items:choices,
            renderItem:entry=>miniCardMarkup(entry.card),
            allowCancel:true,
            className:"economy-flow-card-grid economy-graveyard-choice-grid",
            kind:"graveyard"
        });
        if(!selected) return {ok:false,reason:"Zakup anulowany."};
        const release=await chooseDeckCard(playerIndex,{
            title:"KOSMICZNE ZMARTWYCHWSTANIE • WYMIANA 1:1",
            subtitle:`${selected.card?.name||"Wybrana karta"} wróci z Cmentarzyska. Wskaż własną kartę, którą oddasz w zamian.`,
            allowCancel:true,
            onlyUnprotected:true,
            repairTarget:true,
            kind:"graveyard"
        });
        if(!release) return {ok:false,reason:"Zakup anulowany."};
        const committed=await confirmCommit({
            title:"KOSMICZNE ZMARTWYCHWSTANIE",
            message:`${selected.card?.name||"Karta z Cmentarzyska"} zastąpi ${release.card?.name||"Twoją kartę"}. Rozmiar decku nie zmieni się.`,
            actionLabel:"ZAMIEŃ 1:1",
            kind:"graveyard"
        });
        if(!committed) return {ok:false,reason:"Zakup anulowany."};
        await runInterlude({
            title:"KOSMICZNE ZMARTWYCHWSTANIE",
            subtitle:`${selected.card?.name||"Karta"} opuszcza Cmentarzysko, a ${release.card?.name||"Twoja karta"} zajmuje jej miejsce…`,
            kind:"graveyard",
            label:"WYMIANA 1:1",
            cards:[release.card,selected.card]
        });
        const result=bridge()?.recoverGraveyardCard?.(playerIndex,selected.graveyardEntryId,release.index);
        if(!result?.ok) return result||{ok:false,reason:"Nie udało się wykonać wymiany z Cmentarzyskiem."};
        bridge()?.refreshAfterEconomyMutation?.();
        await showCardExchangeAnimation(release.card,result.resultCard||selected.card,{kind:"graveyard",label:"KOSMICZNE ZMARTWYCHWSTANIE"});
        showEffectBurst("graveyard",`${result.resultCard?.name||selected.card?.name||"KARTA"} • POWRÓT 1:1`);
        return {ok:true,data:{graveyardEntryId:selected.graveyardEntryId,cardName:result.resultCard?.name||selected.card?.name||null,replacedCard:release.card?.name||null,replacementIndex:release.index}};
    }

    const definitions={};

    function applyCatalogReference(definition){
        const reference=global.EconomyCatalogData?.get?.(definition?.id);
        if(!reference) return definition;
        const metadata={
            ...(definition.metadata||{}),
            ...(reference.artAsset?{artAsset:reference.artAsset}:{}),
            ...(reference.accent?{accent:reference.accent}:{}),
            ...(reference.badge?{badge:reference.badge}:{}),
            ...(reference.assets?{assets:reference.assets}:{}),
            ...(reference.requiresExtension?{requiresExtension:reference.requiresExtension}:{})
        };
        if(reference.fixedPrice===true) metadata.fixedPrice=true;
        if(reference.priceModifiersAllowed===false) metadata.priceModifiersAllowed=false;
        const canonical={
            ...definition,
            name:reference.name||definition.name,
            description:reference.description||definition.description,
            section:reference.section||definition.section,
            prices:{
                early:Number(reference.prices?.sale ?? definition.prices?.early ?? 0),
                late:Number(reference.prices?.standard ?? definition.prices?.late ?? 0)
            },
            metadata
        };
        if(Number.isFinite(Number(reference.maxPerDraft))) canonical.maxPerDraft=Number(reference.maxPerDraft);
        return canonical;
    }

    function define(definition){
        const canonical=applyCatalogReference(definition);
        definitions[canonical.id]=canonical;
        Engine.registerProduct(canonical);
    }

    define({
        id:"cosmic_exchange",name:"Kosmiczna Wymiana",description:"Wymień własną kartę na 1 z 3 losowych kart.",section:"core",
        prices:{early:3,late:4},metadata:{assets:canonicalAsset("shop_exchange")},
        canPurchase:({playerIndex})=>canRepair(playerIndex,3),
        resolve:({playerIndex,price,context})=>performReplacement(playerIndex,{count:3,productId:"cosmic_exchange",productName:"Kosmiczna Wymiana",mysteryGrant:Boolean(context?.mysteryGrant),kind:"exchange",price})
    });
    define({
        id:"galactic_sift",name:"Galaktyczny Przesiew",description:"Wymień własną kartę na 1 z 5 losowych kart.",section:"core",
        prices:{early:5,late:7},metadata:{assets:canonicalAsset("shop_sift")},
        canPurchase:({playerIndex})=>canRepair(playerIndex,5),
        resolve:({playerIndex,price,context})=>performReplacement(playerIndex,{count:5,productId:"galactic_sift",productName:"Galaktyczny Przesiew",mysteryGrant:Boolean(context?.mysteryGrant),kind:"sift",price})
    });
    define({
        id:"deep_space_scan",name:"Skan Głębokiej Przestrzeni",description:"Wymień własną kartę na 1 z 8 losowych kart.",section:"core",
        prices:{early:6,late:8},metadata:{assets:canonicalAsset("shop_deep_scan")},
        canPurchase:({playerIndex})=>canRepair(playerIndex,8),
        resolve:({playerIndex,price,context})=>performReplacement(playerIndex,{count:8,productId:"deep_space_scan",productName:"Skan Głębokiej Przestrzeni",mysteryGrant:Boolean(context?.mysteryGrant),kind:"deep",price})
    });
    define({
        id:"low_orbit_scan",name:"Skan Niskiej Orbity",description:"Wymień własną kartę na 1 z 3 kart o koszcie 1–3.",section:"core",
        prices:{early:4,late:5},metadata:{assets:canonicalAsset("shop_low_orbit")},
        canPurchase:({playerIndex})=>canRepair(playerIndex,3,{minCost:1,maxCost:3}),
        resolve:({playerIndex,price,context})=>performReplacement(playerIndex,{count:3,filter:{minCost:1,maxCost:3},productId:"low_orbit_scan",productName:"Skan Niskiej Orbity",mysteryGrant:Boolean(context?.mysteryGrant),kind:"orbit",price})
    });
    define({
        id:"cost_scan",name:"Skan Kosztu",description:"Wybierz dokładny koszt i 1 z 3 kart o tym koszcie.",section:"core",
        prices:{early:5,late:7},metadata:{assets:canonicalAsset("shop_cost_scan")},
        canPurchase:({playerIndex})=>getDeck(playerIndex).some(entry=>
            !global.isWolverineRegeneratedProtectedCard?.(entry?.card) &&
            (bridge()?.getEligibleCosts?.(playerIndex,entry.index,3)||[]).length
        ),
        resolve:costScanResolve
    });
    define({
        id:"synergy_scan",name:"Skan Synergii",description:"Wybierz archetyp / tag i 1 z 3 pasujących kart.",section:"core",
        prices:{early:6,late:8},metadata:{assets:canonicalAsset("shop_synergy_scan")},
        canPurchase:({playerIndex})=>getDeck(playerIndex).some(entry=>
            !global.isWolverineRegeneratedProtectedCard?.(entry?.card) &&
            (bridge()?.getEligibleSynergyTags?.(playerIndex,entry.index,3)||[]).length
        ),
        resolve:synergyScanResolve
    });
    define({
        id:"hyperspace_jump",name:"Skok Nadświetlny",description:"Najbliższy przyszły normalny pick: +2 miejsca. Maksymalnie +4.",section:"core",
        prices:{early:5,late:6},metadata:{assets:canonicalAsset("shop_hyperjump")},
        canPurchase:({playerIndex})=>momentumAvailability(playerIndex),
        resolve:momentumResolve
    });
    define({
        id:"stellar_shield",name:"Gwiezdna Osłona",description:"Chroni wybraną kartę do końca draftu. Można kupić wielokrotnie.",section:"core",
        prices:{early:3,late:4},metadata:{assets:canonicalAsset("shop_star_shield")},
        canPurchase:({playerIndex})=>shieldAvailability(playerIndex),
        resolve:shieldResolve
    });
    define({
        id:"graveyard_revival",name:"Kosmiczne Zmartwychwstanie",description:"Wymień własną kartę na jedną z pięciu kart Cmentarzyska.",section:"core",
        prices:{early:6,late:6},metadata:{artAsset:`${ASSET_ROOT}shop_art_graveyard_revival.png`,badge:"1 Z 5 • CMENTARZYSKO"},
        canPurchase:({playerIndex})=>graveyardAvailability(playerIndex),
        resolve:graveyardResolve
    });

    async function getMysteryCandidates(playerIndex,context={}){
        const candidates=[];
        for(const def of Object.values(definitions)){
            if(def.id==="mystery_offer" || def.enabled===false || def.metadata?.mysteryEligible===false) continue;
            if(typeof def.isVisible==="function" && def.isVisible({playerIndex})===false) continue;
            if(def.maxPerDraft){
                const wallet=Engine.getWallet?.(playerIndex);
                const count=(wallet?.purchases||[]).filter(entry=>entry.productId===def.id).length;
                if(count>=def.maxPerDraft) continue;
            }
            if(def.canPurchase){
                const allowed=await def.canPurchase({playerIndex,wallet:Engine.getWallet?.(playerIndex),phase:Engine.getPhase?.(playerIndex),context:{...context,freeGrant:true,mysteryGrant:true}});
                if(allowed===false || allowed?.ok===false) continue;
            }
            candidates.push(def);
        }
        return candidates;
    }


    define({
        id:"joker_under_counter",name:"Joker spod lady",description:"Oddaj 1 kartę i natychmiast rozstrzygnij losowego Epickiego lub Legendarnego Jokera.",section:"extensions",
        prices:{early:6,late:8},
        metadata:{assets:extensionAsset("shop_joker_under_counter"),extensionBadge:EXTENSION_META.jokers,mysteryEligible:false},
        isVisible:()=>extensionEnabled("jokers"),
        canPurchase:({playerIndex})=>jokerUnderCounterAvailability(playerIndex),
        resolve:jokerUnderCounterResolve
    });
    define({
        id:"custom_delivery",name:"Customowa Dostawa",description:"Wybierz aktywną Customową Paczkę i wymień kartę na 1 z 3 kart z jej czystej puli.",section:"extensions",
        prices:{early:7,late:9},
        metadata:{assets:extensionAsset("shop_custom_delivery"),extensionBadge:EXTENSION_META.custom_packs,mysteryEligible:false},
        isVisible:()=>extensionEnabled("custom_packs"),
        canPurchase:({playerIndex})=>customDeliveryAvailability(playerIndex),
        resolve:customDeliveryResolve
    });
    define({
        id:"superpower_recharge",name:"Recharge Supermocy",description:"Naładuj ponownie już wykorzystaną Supermoc. Maksymalnie raz na draft.",section:"extensions",
        prices:{early:10,late:10},maxPerDraft:1,
        metadata:{assets:extensionAsset("shop_superpower_recharge"),extensionBadge:EXTENSION_META.superpowers,mysteryEligible:false},
        isVisible:()=>extensionEnabled("superpowers"),
        canPurchase:({playerIndex})=>rechargeAvailability(playerIndex),
        resolve:rechargeResolve
    });
    define({
        id:"save_steal_extra_save",name:"Dodatkowy Save",description:"Zabezpiecz dodatkową kartę przed STEAL. Możesz kupić maksymalnie 2 dodatkowe SAVE.",section:"extensions",
        prices:{early:3,late:4},maxPerDraft:2,
        metadata:{assets:extensionAsset("shop_extra_save"),extensionBadge:EXTENSION_META.save_steal,mysteryEligible:false},
        isVisible:()=>extensionEnabled("save_steal"),
        canPurchase:({playerIndex})=>extraSaveAvailability(playerIndex),
        resolve:extraSaveResolve
    });

    define({
        id:"mystery_offer",name:"Tajemnicza Oferta",description:"Otrzymaj losowy produkt sklepu.",section:"core",
        prices:{early:5,late:5},maxPerDraft:1,
        metadata:{assets:{sale:`${ASSET_ROOT}shop_mystery.png`,standard:`${ASSET_ROOT}shop_mystery.png`}},
        canPurchase:async ({playerIndex,context})=>(await getMysteryCandidates(playerIndex,context)).length?{ok:true}:{ok:false,reason:"Brak nagrody do wylosowania."},
        resolve:async ({playerIndex,price,phase,context={}})=>{
            const candidates=await getMysteryCandidates(playerIndex,context);
            if(!candidates.length) return {ok:false,reason:"Brak nagrody do wylosowania."};
            const committed=await confirmCommit({
                title:"TAJEMNICZA OFERTA",
                message:"Po kliknięciu LOSUJ 5 JeffCoinów zostaje wydane, wynik jest natychmiast zablokowany i nie można już zrezygnować po jego zobaczeniu.",
                actionLabel:"LOSUJ",kind:"mystery",price
            });
            if(!committed) return {ok:false,reason:"Zakup anulowany."};
            await runInterlude({title:"TAJEMNICZA OFERTA",subtitle:"Jeffik miesza oferty sklepu…",kind:"mystery",label:"?"});
            const chosen=candidates[Math.floor(Math.random()*candidates.length)];
            await showNotice("TAJEMNICZA OFERTA",`WYLOSOWANO: ${chosen.name}. Wynik jest zablokowany — nagroda musi zostać teraz zrealizowana.`,"REALIZUJ NAGRODĘ","mystery");
            const result=chosen.resolve ? await chosen.resolve({playerIndex,price:0,phase,context:{...context,freeGrant:true,mysteryGrant:true},wallet:Engine.getWallet?.(playerIndex)}) : {ok:true};
            if(result===false || result?.ok===false) return result||{ok:false,reason:"Nie udało się zrealizować losowej nagrody."};
            showEffectBurst("mystery",`MYSTERY • ${chosen.name}`);
            return {ok:true,data:{grantedProductId:chosen.id,grantedProductName:chosen.name,grantedResult:clone(result?.data||{})}};
        }
    });

    async function refreshAvailability(playerIndex,root){
        if(!root) return;
        const buttons=[...root.querySelectorAll("[data-economy-buy]")];
        await Promise.all(buttons.map(async button=>{
            const productId=button.dataset.economyBuy;
            const result=await Engine.checkPurchase?.(playerIndex,productId,{source:"shop_preview"});
            const stateNode=button.querySelector("[data-economy-product-state]");
            const available=Boolean(result?.ok);
            button.classList.toggle("is-unavailable",!available);
            button.classList.toggle("is-affordable",available);
            button.disabled=!available;
            button.classList.toggle("is-unaffordable",!available && String(result?.reason||"").includes("JeffCoin"));
            button.setAttribute("aria-disabled",available?"false":"true");
            button.title=available?"Kup produkt":String(result?.reason||"Produkt niedostępny.");
            if(stateNode) stateNode.textContent=available?"KUP":(String(result?.reason||"").includes("JeffCoin")?"ZA MAŁO JC":"NIEDOSTĘPNE");
        }));
    }

    global.EconomyShopCore=Object.freeze({
        VERSION,
        showFeedback,
        showCheckout,
        closeFlow,
        refreshAvailability,
        getDefinitions:()=>Object.values(definitions).map(def=>({id:def.id,name:def.name,prices:clone(def.prices),metadata:clone(def.metadata||{})}))
    });
})(window);

/* ============================================================
   PATCH113B — flow overlays: shelf confirms + right-side explainer
   ============================================================ */
(function(global){
    "use strict";
    if(global.__MSP_PATCH113B_FLOW_ENHANCER__) return;
    global.__MSP_PATCH113B_FLOW_ENHANCER__=true;

    const FLOW_INFO={
        exchange:{title:'Kosmiczna Wymiana',description:'Wskaż własną kartę, a sklep pokaże 3 losowe propozycje. Wybierzesz 1 wynik, który zastąpi obecną kartę.',tip:'Najpierw zaznacz kartę do wymiany, potem wybierz jedną z nowych ofert.'},
        sift:{title:'Galaktyczny Przesiew',description:'Wskaż własną kartę, a sklep pokaże 5 losowych propozycji. Wybierzesz 1 wynik, który zastąpi obecną kartę.',tip:'Większy wybór niż przy Kosmicznej Wymianie — dobry do naprawiania słabego slotu.'},
        deep:{title:'Skan Głębokiej Przestrzeni',description:'Wskaż własną kartę, a sklep pokaże 8 losowych propozycji. Wybierzesz 1 wynik, który zastąpi obecną kartę.',tip:'Najszersza usługa naprawcza sklepu — dużo opcji, ale bez cofnięcia po odsłonięciu.'},
        orbit:{title:'Skan Niskiej Orbity',description:'Wymień wskazaną kartę na 1 z 3 propozycji o koszcie 1–3.',tip:'Szybki sposób na wczesne krzywe i tanie role-playe.'},
        cost:{title:'Skan Kosztu',description:'Sklep wyszuka 1 z 3 kart o konkretnym koszcie. Najpierw wskaż kartę do wymiany.',tip:'Używaj, gdy potrzebujesz domknąć konkretny slot kosztu.'},
        synergy:{title:'Skan Synergii',description:'Wymień kartę na 1 z 3 propozycji powiązanych z archetypem lub synergią twojego decku.',tip:'Najlepiej działa, gdy twój deck ma już wyraźny kierunek.'},
        momentum:{title:'Skok Nadświetlny',description:'Przesuwa najbliższy przyszły normalny pick o +2 miejsca w kolejce, maksymalnie do +4.',tip:'To usługa kolejki, a nie wymiany karty — kup ją, gdy chcesz poprawić timing picku.'},
        shield:{title:'Gwiezdna Osłona',description:'Nałóż stałą ochronę na wskazaną kartę do końca draftu. Osłonięte cele są wyłączone z wielu efektów sklepu.',tip:'Chroni najważniejsze trafy i nie znika po pojedynczym użyciu.'},
        mystery:{title:'Tajemnicza Oferta',description:'Losuje i natychmiast odpala ukryty produkt sklepu. Wynik jest blokowany po kliknięciu LOSUJ.',tip:'Dobra dla hazardu i elastyczności, ale bez możliwości odwrotu po revealu.'},
        joker:{title:'Joker spod lady',description:'Oddaj 1 kartę i od razu rozstrzygnij losowego Epickiego lub Legendarnego Jokera.',tip:'To produkt rozszerzenia Jokery — wynik musisz dokończyć natychmiast.'},
        custom:{title:'Customowa Dostawa',description:'Wybierz aktywną Customową Paczkę, a potem wymień kartę na 1 z 3 kart z jej puli.',tip:'Pozwala sięgnąć wprost po klimat i pulę aktywnych customów.'},
        recharge:{title:'Recharge Supermocy',description:'Naładuj ponownie zużytą Supermoc. Maksymalnie raz na draft.',tip:'Produkt rozszerzenia Supermoce — działa tylko na już wykorzystane moce.'},
        save:{title:'Dodatkowy Save',description:'Wskaż kartę, która dostanie dodatkową ochronę przed STEAL w końcowej fazie Save & Steal.',tip:'Nie zwiększa decku — tylko wzmacnia ochronę twoich zasobów.'},
        graveyard:{title:'Kosmiczne Zmartwychwstanie',description:'Wymień własną kartę na jedną z pięciu kart Cmentarzyska.',tip:'Najpierw wybierasz cel z Cmentarzyska, potem własną kartę do oddania.'},
        generic:{title:'Usługa Sklepu',description:'Jeffik przygotowuje wybraną usługę sklepu.',tip:'Sprawdź opis i potwierdź tylko wtedy, gdy chcesz sfinalizować akcję.'}
    };

    const FLOW_PRODUCT_IDS={
        exchange:'cosmic_exchange',sift:'galactic_sift',deep:'deep_space_scan',orbit:'low_orbit_scan',
        cost:'cost_scan',synergy:'synergy_scan',momentum:'hyperspace_jump',shield:'stellar_shield',
        mystery:'mystery_offer',graveyard:'graveyard_revival'
    };

    function escapeHtml(value){
        return String(value??'').replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
    }

    function enhanceFlowOverlay(overlay){
        if(!overlay || overlay.dataset.patch113bEnhanced==='1') return;
        const panel=overlay.querySelector('.economy-flow-panel');
        const content=overlay.querySelector('.economy-flow-content');
        if(!panel || !content) return;
        const kind=String(overlay.dataset.flowKind||'generic');
        const className=String(content.className||'');
        if(className.includes('economy-flow-card-grid')){
            let body=overlay.querySelector('.economy-flow-body');
            if(!body){
                body=document.createElement('div');
                body.className='economy-flow-body';
                content.parentNode.insertBefore(body,content);
                body.appendChild(content);
            }
            if(!body.querySelector('.economy-flow-info')){
                const fallback=FLOW_INFO[kind]||FLOW_INFO.generic;
                const catalog=global.EconomyCatalogData?.get?.(FLOW_PRODUCT_IDS[kind]);
                const info={
                    title:catalog?.name||fallback.title,
                    description:catalog?.description||fallback.description,
                    tip:fallback.tip
                };
                const aside=document.createElement('aside');
                aside.className='economy-flow-info';
                aside.innerHTML=`
                    <small>USŁUGA SKLEPU</small>
                    <b>${escapeHtml(info.title)}</b>
                    <p>${escapeHtml(info.description)}</p>
                    <em>${escapeHtml(info.tip)}</em>
                    <img class="economy-flow-info-cart" src="draft-assets/shop_purchase_cart.png" alt="" aria-hidden="true">`;
                body.appendChild(aside);
            }
            overlay.classList.add('is-shop-selector','has-shop-info');
        }else if(className.includes('economy-flow-confirm') || content.querySelector('.economy-flow-commit-warning')){
            overlay.classList.add('is-shelf-confirm');
        }
        overlay.dataset.patch113bEnhanced='1';
    }

    function scan(){
        document.querySelectorAll('.economy-flow-overlay').forEach(enhanceFlowOverlay);
    }

    if(typeof document!=='undefined'){
        if(typeof MutationObserver!=='undefined'){
            const observer=new MutationObserver(()=>{
                if(typeof queueMicrotask==='function') queueMicrotask(scan);
                else Promise.resolve().then(scan);
            });
            /* PATCH113B/113C HOTFIX: only newly inserted flow DOM needs scanning. */
            observer.observe(document.documentElement,{subtree:true,childList:true});
        }
        setInterval(scan,500);
        if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',scan,{once:true});
        else scan();
    }
})(window);
