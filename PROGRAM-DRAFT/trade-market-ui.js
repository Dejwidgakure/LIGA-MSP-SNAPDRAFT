(function(global){
    "use strict";

    const VERSION="1.0.3-trade-market-open-runtime-fix";
    const ASSETS=Object.freeze({
        backdrop:"draft-assets/galactic_market_backdrop_v2.png",
        marketHeader:"draft-assets/galactic_market_header_panorama_v4.png",
        frame:"draft-assets/galactic_market_ui_frame.png",
        logo:"draft-assets/galactic_market_logo.png",
        icon:"draft-assets/galactic_market_icon.png",
        launcher:"draft-assets/galactic_market_planet_launcher_v2.png",
        table:"draft-assets/galactic_market_negotiation_table_stage.png",
        tableSource:"draft-assets/galactic_market_negotiation_table.png",
        listed:"draft-assets/galactic_market_listed_marker.png",
        listingOverlay:"draft-assets/galactic_market_listing_overlay.png",
        energy:"draft-assets/galactic_market_deal_energy_overlay.png",
        coinBurst:"draft-assets/galactic_market_deal_coin_burst.png",
        handshake1:"draft-assets/galactic_market_handshake_01.png",
        handshake2:"draft-assets/galactic_market_handshake_02.png",
        handshakeJeffs:"draft-assets/galactic_market_handshake_jeffs.png",
        dealFailed:"draft-assets/galactic_market_deal_failed.png"
    });
    let currentViewPlayer=null;
    let currentTab="market";
    let selectedListingId=null;
    let negotiationDraftState={sellerIndex:"",targetInstanceId:"",price:"",mode:"cash",ownInstanceId:""};
    let timerWasManualPaused=null;
    let decorateRefreshTimer=null;
    let panelRefreshTimer=null;
    const toastQueue=[];
    let toastBusy=false;
    const dealQueue=[];
    let dealBusy=false;

    function engine(){return global.TradeMarketEngine||null;}
    function runtime(){return global.TradeMarketRuntime||null;}
    function economy(){return global.EconomyEngine||null;}
    function esc(value){return String(value??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));}
    function activePlayer(){const p=runtime()?.getCurrentPlayerIndex?.();return Number.isInteger(p)?p:null;}
    function players(){return runtime()?.getPlayers?.()||[];}
    // V1.0.3 — authoritative UI permission helper.
    // It mirrors TradeMarketEngine.requireActive(): during the draft only the
    // current player may perform actions; after the draft any selected player
    // panel may be operated by the Game Operator. The V2 visual rewrite kept
    // calls to canActAs() but accidentally dropped this helper, causing a
    // ReferenceError exactly when Market/Negotiations were opened.
    function canActAs(playerIndex){
        const p=Number(playerIndex);
        if(!Number.isInteger(p)||!players()[p]) return false;
        if(runtime()?.isPostDraft?.()) return true;
        return activePlayer()===p;
    }
    function wallet(playerIndex){return economy()?.getWallet?.(playerIndex)||null;}
    function deckEntries(playerIndex){return runtime()?.getDeckEntries?.(playerIndex)||[];}
    function config(){return engine()?.getConfig?.()||{marketMinPrice:2,negotiationMinPrice:5,maxMarketListingsPerPlayer:2,maxNegotiationsPerPlayer:2};}

    function runToastQueue(){
        if(toastBusy||!toastQueue.length) return;
        toastBusy=true;
        const {title,message,error}=toastQueue.shift();
        const node=document.createElement("div");
        node.className="trade-market-toast"+(error?" is-error":"");
        node.innerHTML=`<b>${esc(title)}</b><span>${esc(message)}</span>`;
        document.body.appendChild(node);
        setTimeout(()=>{node.classList.add("is-leaving");setTimeout(()=>{node.remove();toastBusy=false;runToastQueue();},260);},2200);
    }
    function showToast(title,message,error=false){
        toastQueue.push({title,message,error});
        runToastQueue();
    }

    function walletAnchor(playerIndex){
        if(!Number.isInteger(Number(playerIndex))) return null;
        const p=Number(playerIndex);
        return document.querySelector(`.deck-context-strip[data-player-index="${p}"] .economy-wallet-strip, #deckInspectorEconomy_${p} .deckInspectorEconomyBadge, #deckInspectorEconomy_${p} .economy-wallet-strip`);
    }
    function panelAnchor(playerIndex){
        if(!Number.isInteger(Number(playerIndex))) return null;
        const p=Number(playerIndex);
        return document.querySelector(`.deck-context-strip[data-player-index="${p}"]`)?.closest('.deck-section') || document.getElementById(`deckInspector_${p}`) || null;
    }
    function animateCoinsBetweenPlayers(buyerIndex,sellerIndex,price){
        const from=walletAnchor(Number(buyerIndex))?.getBoundingClientRect?.();
        const to=walletAnchor(Number(sellerIndex))?.getBoundingClientRect?.();
        if(!from||!to) return;
        const layer=document.createElement("div");layer.className="trade-transfer-layer";document.body.appendChild(layer);
        const count=Math.max(4,Math.min(8,Number(price)||4));
        const sx=from.left+from.width/2, sy=from.top+from.height/2, tx=to.left+to.width/2, ty=to.top+to.height/2;
        for(let i=0;i<count;i++){
            const coin=document.createElement("img");coin.className="trade-transfer-coin";coin.src="draft-assets/jeffcoin.png";coin.alt="";coin.style.left=(sx-13)+"px";coin.style.top=(sy-13)+"px";layer.appendChild(coin);
            const dx=tx-sx+(Math.random()*18-9),dy=ty-sy+(Math.random()*14-7),lift=-48-Math.random()*38;
            coin.animate([{transform:"translate(0,0) scale(.72) rotate(0deg)",opacity:0},{transform:`translate(${dx*.28}px,${lift}px) scale(1.08) rotate(150deg)`,opacity:1,offset:.34},{transform:`translate(${dx}px,${dy}px) scale(.68) rotate(430deg)`,opacity:1,offset:.9},{transform:`translate(${dx}px,${dy}px) scale(.2) rotate(520deg)`,opacity:0}],{duration:900+i*55,delay:i*55,easing:"cubic-bezier(.19,.78,.22,1)",fill:"forwards"});
        }
        const minus=document.createElement("b");minus.className="trade-money-delta is-minus";minus.textContent=`-${Number(price)||0} JC`;minus.style.left=sx+"px";minus.style.top=(sy-18)+"px";layer.appendChild(minus);
        const plus=document.createElement("b");plus.className="trade-money-delta is-plus";plus.textContent=`+${Number(price)||0} JC`;plus.style.left=tx+"px";plus.style.top=(ty-18)+"px";layer.appendChild(plus);
        setTimeout(()=>layer.remove(),1550);
    }
    function dealCardMarkup(card,label){
        const name=card?.name||"KARTA";
        const cost=Number.isFinite(Number(card?.cost))?Number(card.cost):"?";
        const power=Number.isFinite(Number(card?.power))?Number(card.power):"?";
        return `<div class="trade-deal-mini-card"><small>${esc(label||"")}</small><i>${esc(cost)}</i><strong>${esc(name)}</strong><b>${esc(power)}</b></div>`;
    }
    function runDealQueue(){
        if(dealBusy||!dealQueue.length) return;
        dealBusy=true;
        const payload=dealQueue.shift();
        const node=document.createElement("div");
        const tableArena=payload.kind==="negotiation"
            ? document.querySelector("#tradeMarketOverlay .trade-neg-table-arena")
            : null;
        const inline=Boolean(tableArena);
        node.className=(inline?"trade-neg-inline-deal ":"trade-deal-scene ")+"is-stage-contract";
        const hasMoney=Number(payload.price)>0;
        const offered=payload.offerCard?dealCardMarkup(payload.offerCard,"ODDAJE"):payload.releaseCard?dealCardMarkup(payload.releaseCard,"ZWALNIA SLOT"):"";
        const replacement=payload.replacement?dealCardMarkup(payload.replacement,"REPLACEMENT"):"";
        node.innerHTML=`<div class="trade-deal-energy" aria-hidden="true"><img src="${ASSETS.energy}" alt=""></div><div class="trade-deal-board">
            <div class="trade-deal-party is-buyer"><small>KUPUJĄCY</small><b>${esc(payload.buyerName||"—")}</b></div>
            <div class="trade-deal-center"><div class="trade-deal-contract">KONTRAKT // ${esc(payload.kind==="negotiation"?"NEGOCJACJE":"MARKET")}</div><div class="trade-deal-card-row">${offered}${dealCardMarkup(payload.targetCard||{name:payload.cardName},"PRZEJMUJE")}${replacement}</div>${hasMoney?`<div class="trade-deal-price"><img src="draft-assets/jeffcoin.png" alt=""><b>${Number(payload.price)} JC</b></div>`:""}<div class="trade-deal-handshake" aria-hidden="true"><img class="phase-one" src="${ASSETS.handshake1}" alt=""><img class="phase-two" src="${ASSETS.handshake2}" alt=""><img class="phase-jeffs" src="${ASSETS.handshakeJeffs}" alt=""><img class="coin-burst" src="${ASSETS.coinBurst}" alt=""></div><strong>DEAL PODPISANY</strong><span>${esc(payload.message||"")}</span></div>
            <div class="trade-deal-party is-seller"><small>SPRZEDAJĄCY</small><b>${esc(payload.sellerName||"—")}</b></div>
        </div>`;
        (tableArena||document.body).appendChild(node);
        setTimeout(()=>{node.classList.add("is-stage-money");if(hasMoney) animateCoinsBetweenPlayers(Number(payload.buyerIndex),Number(payload.sellerIndex),Number(payload.price));},520);
        setTimeout(()=>node.classList.add("is-stage-cards"),980);
        setTimeout(()=>node.classList.add("is-stage-signed"),1460);
        setTimeout(()=>node.classList.add("is-leaving"),2500);
        setTimeout(()=>{node.remove();dealBusy=false;runDealQueue();},2920);
    }
    function showDealScene(payload){
        dealQueue.push(typeof payload==="string"?{message:payload}:payload||{});
        runDealQueue();
    }
    function showFailedDealScene(message="OFERTA ODRZUCONA") {
        const tableArena=document.querySelector("#tradeMarketOverlay .trade-neg-table-arena");
        const old=document.querySelector(".trade-deal-failed-scene,.trade-neg-inline-failed");
        old?.remove();
        const node=document.createElement("div");
        node.className=tableArena?"trade-neg-inline-failed":"trade-deal-failed-scene";
        node.innerHTML=`<div class="trade-deal-failed-card"><img src="${ASSETS.dealFailed}" alt=""><strong>NEGOCJACJE ZERWANE</strong><span>${esc(message)}</span></div>`;
        (tableArena||document.body).appendChild(node);
        setTimeout(()=>node.classList.add("is-leaving"),1350);
        setTimeout(()=>node.remove(),1800);
    }

    function pauseTimerForMarket(){
        if(timerWasManualPaused!==null) return;
        try{
            const state=global.DraftTurnTimer?.getState?.();
            timerWasManualPaused=state?Boolean(state.manualPaused):false;
            global.DraftTurnTimer?.pause?.();
        }catch(_){timerWasManualPaused=false;}
    }
    function restoreTimerAfterMarket(){
        if(timerWasManualPaused===null) return;
        const wasPaused=timerWasManualPaused;
        timerWasManualPaused=null;
        if(!wasPaused){try{global.DraftTurnTimer?.play?.();}catch(_){ }}
    }

    function ensureDockSlot(){
        let slot=document.getElementById("tradeDockSlot");
        if(slot) return slot;
        const dock=document.getElementById("draftBottomDock");
        if(!dock) return null;
        slot=document.createElement("div");
        slot.id="tradeDockSlot";
        const shopSlot=document.getElementById("shopDockSlot");
        dock.insertBefore(slot,shopSlot||null);
        return slot;
    }

    function ensureLauncher(){
        const slot=ensureDockSlot();
        if(!slot) return null;
        let root=document.getElementById("tradeMarketLauncher");
        if(!root){
            root=document.createElement("div");
            root.id="tradeMarketLauncher";
            root.className="trade-market-launcher";
            root.innerHTML=`<button type="button" class="trade-market-launcher-button"><span class="trade-market-launcher-icon"><img src="${ASSETS.launcher}" alt=""></span><span class="trade-market-launcher-copy"><small>PLANETA TARGOWA</small><b>GALAKTYCZNY TARG</b><em data-trade-launcher-status>Negocjacje i Market</em></span></button>`;
            slot.appendChild(root);
            root.querySelector("button")?.addEventListener("click",()=>open(activePlayer()));
        }
        refreshLauncher();
        return root;
    }

    function refreshLauncher(){
        const root=document.getElementById("tradeMarketLauncher");
        if(!root) return;
        root.hidden=!engine()?.isEnabled?.();
        if(root.hidden) return;
        const p=activePlayer();
        const status=root.querySelector("[data-trade-launcher-status]");
        if(status){
            const summary=Number.isInteger(p)?engine()?.getPlayerSummary?.(p):null;
            const listings=engine()?.getActiveListings?.()?.length||0;
            const pending=summary?.pendingNegotiations||0;
            status.textContent=Number.isInteger(p)?`${players()[p]||"Aktywny gracz"} • ${listings} ofert • ${pending} negoc.`:"Oczekiwanie na aktywny ruch";
        }
    }

    function entryOptions(playerIndex,selected="",excludeInstanceId=null){
        return deckEntries(playerIndex).filter(({card})=>{
            const id=String(card?.instanceId||"");
            if(id===String(excludeInstanceId||"__none__")) return false;
            if(id===String(selected||"")) return true;
            return !engine()?.isInstanceInNegotiation?.(id);
        }).map(({card})=>{
            const id=String(card?.instanceId||"");
            const label=`${card?.name||"Karta"} (${Number(card?.cost)}/${Number(card?.power)})`;
            return `<option value="${esc(id)}"${id===String(selected)?" selected":""}>${esc(label)}</option>`;
        }).join("");
    }

    function renderStats(playerIndex){
        const summary=engine()?.getPlayerSummary?.(playerIndex);
        const w=wallet(playerIndex);
        return `
            <div class="trade-market-stat"><i class="trade-market-stat-windows" aria-hidden="true"></i><span class="trade-market-stat-screen"><small>GRACZ</small><b>${esc(players()[playerIndex]||"—")}</b></span></div>
            <div class="trade-market-stat"><i class="trade-market-stat-windows" aria-hidden="true"></i><span class="trade-market-stat-screen"><small>JEFFCOINY</small><b class="trade-market-stat-balance"><img src="draft-assets/jeffcoin.png" alt="">${Number(w?.balance||0)}</b></span></div>
            <div class="trade-market-stat"><i class="trade-market-stat-windows" aria-hidden="true"></i><span class="trade-market-stat-screen"><small>STRAGANY</small><b>${Number(summary?.marketListingsRemaining??0)} / ${config().maxMarketListingsPerPlayer}</b></span></div>
            <div class="trade-market-stat"><i class="trade-market-stat-windows" aria-hidden="true"></i><span class="trade-market-stat-screen"><small>DEALE</small><b>${Number(summary?.negotiationsRemaining??0)} / ${config().maxNegotiationsPerPlayer}</b></span></div>`;
    }

    function getSceneFlavor(){
        if(currentTab==="negotiations") return {
            eyebrow:"PLANETA TARGOWA // SIEDZIBA KORPORACJI",
            title:"GALAKTYCZNY TARG",
            zone:"NEGOCJACJE",
            description:"Korporacyjne centrum wymian — układaj ofertę bezpośrednio na stole, zestawiaj karty i JeffCoiny, a potem podpisuj deal.",
            mood:"is-negotiations"
        };
        if(currentTab==="history") return {
            eyebrow:"PLANETA TARGOWA // ARCHIWA DEALI",
            title:"GALAKTYCZNY TARG",
            zone:"HISTORIA",
            description:"Prześledź sprzedaże, wygasłe oferty i podpisane kontrakty z całego draftu.",
            mood:"is-history"
        };
        return {
            eyebrow:"PLANETA TARGOWA // DZIELNICA STRAGANÓW",
            title:"GALAKTYCZNY TARG",
            zone:"MARKET",
            description:"Kolorowe stragany, lampki i neonowe szyldy — kupuj od ręki albo wystawiaj własne towary na kosmicznym bazarze.",
            mood:"is-market"
        };
    }

    function marketTheme(seed){
        const themes=["amber","cyan","violet","mint","rose"];
        return themes[Math.abs(Number(seed)||0)%themes.length];
    }

    function makeStallLights(count=6){
        return `<div class="trade-stall-lights" aria-hidden="true">${Array.from({length:count},(_,index)=>`<span style="--light-index:${index}"></span>`).join("")}</div>`;
    }

    function renderSnapDraftCard(card,options={}){
        const name=card?.name||card?.cardName||"KARTA";
        const cost=Number.isFinite(Number(card?.cost??card?.cardCost))?Number(card?.cost??card?.cardCost):"?";
        const power=Number.isFinite(Number(card?.power??card?.cardPower))?Number(card?.power??card?.cardPower):"?";
        const empty=Boolean(options.empty||!card);
        return `<div class="trade-real-card${empty?" is-empty":""}${options.compact?" is-compact":""}" aria-label="${esc(empty?"Puste miejsce":`${name}, koszt ${cost}, siła ${power}`)}">
            <span class="trade-real-cost">${esc(cost)}</span>
            <span class="trade-real-power">${esc(power)}</span>
            <div class="trade-real-card-surface" aria-hidden="true"><span>✦</span></div>
            <strong>${esc(empty?(options.emptyText||"WYBIERZ KARTĘ"):name)}</strong>
        </div>`;
    }

    function makeCardMini(listing,viewerIndex,options={}){
        const own=listing.sellerIndex===viewerIndex;
        const selected=String(selectedListingId||"")===String(listing.id||"");
        const canAct=Boolean(options.canAct);
        const cost=Number.isFinite(Number(listing.cardCost))?Number(listing.cardCost):"?";
        const power=Number.isFinite(Number(listing.cardPower))?Number(listing.cardPower):"?";
        const theme=marketTheme(Number(listing.sellerIndex)+String(listing.cardName||"").length);
        return `<article class="trade-stall-card theme-${theme}${selected?" is-selected":""}" data-trade-listing-id="${esc(listing.id)}">
            <div class="trade-stall-awning" aria-hidden="true"></div>
            ${makeStallLights(7)}
            <header class="trade-stall-sign"><small>STRAGAN • ${own?"TWÓJ":"OFERTA"}</small><b>${esc(listing.sellerName)}</b></header>
            <div class="trade-stall-showcase">
                ${renderSnapDraftCard({name:listing.cardName,cost,power},{compact:true})}
                <div class="trade-stall-price"><small>CENA OD RĘKI</small><span><img src="draft-assets/jeffcoin.png" alt="">${Number(listing.price)} JC</span></div>
            </div>
            <div class="trade-stall-actions">
                ${own?`<button class="danger" data-trade-cancel="${esc(listing.id)}">ZDEJMIJ ZE STRAGANU</button>`:`<button class="primary" data-trade-buy-select="${esc(listing.id)}">${selected?"WYBRANO OFERTĘ":"KUP ZE STRAGANU"}</button>`}
            </div>
            ${selected&&!own?`<div class="trade-stall-inline-buy">
                <div><small>FINALIZACJA NA STRAGANIE</small><b>${esc(listing.cardName)} • ${Number(listing.price)} JC</b></div>
                <label>TWÓJ SLOT DO ZASTĄPIENIA<select data-trade-buyer-release ${canAct?"":"disabled"}><option value="">— wybierz własną kartę —</option>${entryOptions(viewerIndex,"",listing.cardInstanceId)}</select></label>
                <button class="trade-market-submit" data-trade-confirm-buy="${esc(listing.id)}" ${canAct?"":"disabled"}>POTWIERDŹ ZAKUP</button>
            </div>`:""}
        </article>`;
    }

    function makeEmptyStall(slotIndex){
        const theme=marketTheme(slotIndex+13);
        return `<article class="trade-stall-card is-empty theme-${theme}">
            <div class="trade-stall-awning" aria-hidden="true"></div>
            ${makeStallLights(6)}
            <header class="trade-stall-sign"><small>PUSTY STRAGAN</small><b>CZEKA NA HANDLARZA</b></header>
            <div class="trade-stall-empty-copy"><strong>WOLNE STOISKO</strong><span>Gdy gracz coś wystawi, to miejsce ożyje i pokaże nową ofertę.</span></div>
        </article>`;
    }

    function makeOwnStallSlot(listing,slotIndex){
        if(!listing){
            return `<div class="trade-own-stall-slot is-empty"><small>SLOT ${slotIndex+1}</small><strong>PUSTY STRAGAN</strong><span>Możesz wystawić tutaj własną kartę.</span></div>`;
        }
        const cost=Number.isFinite(Number(listing.cardCost))?Number(listing.cardCost):"?";
        return `<div class="trade-own-stall-slot"><small>SLOT ${slotIndex+1}</small><strong>${esc(listing.cardName)}</strong><span><img src="draft-assets/jeffcoin.png" alt="">${Number(listing.price)} JC • koszt ${esc(cost)}</span></div>`;
    }

    function makeOwnBazaarStall(ownListings){
        const slotCount=Math.max(1,Number(config().maxMarketListingsPerPlayer)||2);
        const slots=Array.from({length:slotCount},(_,index)=>{
            const listing=ownListings[index]||null;
            if(!listing) return `<div class="trade-own-stage-card is-empty"><small>SLOT ${index+1}</small><strong>WOLNE MIEJSCE</strong><span>✦</span></div>`;
            const cost=Number.isFinite(Number(listing.cardCost))?Number(listing.cardCost):"?";
            const power=Number.isFinite(Number(listing.cardPower))?Number(listing.cardPower):"?";
            return `<div class="trade-own-stage-card" data-trade-listing-id="${esc(listing.id)}">${renderSnapDraftCard({name:listing.cardName,cost,power},{compact:true})}<button class="danger" data-trade-cancel="${esc(listing.id)}">ZDEJMIJ</button></div>`;
        }).join("");
        return `<article class="trade-own-bazaar-stall theme-rainbow"><div class="trade-stall-awning" aria-hidden="true"></div>${makeStallLights(9)}<header class="trade-stall-sign"><b>MÓJ STRAGAN</b></header><div class="trade-own-stage-cards count-${Math.min(slotCount,ownListings.length)}">${slots}</div></article>`;
    }

    function renderMarketView(playerIndex){
        const listings=engine()?.getActiveListings?.()||[];
        const ownCards=deckEntries(playerIndex);
        const canAct=canActAs(playerIndex);
        const summary=engine()?.getPlayerSummary?.(playerIndex);
        const listingFormDisabled=!canAct || !ownCards.length || Number(summary?.marketListingsRemaining||0)<=0;
        const ownListings=listings.filter(item=>Number(item.sellerIndex)===Number(playerIndex)).slice(0,config().maxMarketListingsPerPlayer);
        const publicListings=listings.filter(item=>Number(item.sellerIndex)!==Number(playerIndex));
        const emptyStalls=Math.max(0,3-publicListings.length);
        return `<div class="trade-market-view trade-market-bazaar-view" data-trade-view="market">
            <div class="trade-market-v2-layout trade-market-bazaar-layout-v2">
                <aside class="trade-market-control-rail trade-market-bazaar-rail">
                    <section class="trade-market-bazaar-banner">
                        <div class="trade-market-bazaar-copy"><small>DZIELNICA STRAGANÓW</small><h3>Kosmiczna Shibuya handlu</h3><p>Wystaw maksymalnie <strong>${config().maxMarketListingsPerPlayer} karty</strong> w całym drafcie. Zakup odbywa się bezpośrednio na wybranym straganie.</p></div>
                        <div class="trade-market-bazaar-status"><span><b>${ownListings.length}</b><small>NA STRAGANIE</small></span><span><b>${Number(summary?.marketListingsRemaining||0)}</b><small>POZOSTAŁE SLOTY</small></span></div>
                    </section>
                    <section class="trade-market-box trade-market-my-stall"><h3>WYSTAW NOWY TOWAR</h3><div class="trade-market-box-content">
                        <div class="trade-own-stall-slots">${Array.from({length:config().maxMarketListingsPerPlayer},(_,index)=>makeOwnStallSlot(ownListings[index]||null,index)).join("")}</div>
                        <div class="trade-market-field"><label>KARTA DO WYSTAWIENIA</label><select data-trade-list-card ${listingFormDisabled?"disabled":""}><option value="">— wybierz kartę —</option>${entryOptions(playerIndex)}</select></div>
                        <div class="trade-market-field"><label>CENA • MINIMUM ${config().marketMinPrice} JC</label><input data-trade-list-price type="number" min="${config().marketMinPrice}" step="1" value="${config().marketMinPrice}" ${listingFormDisabled?"disabled":""}></div>
                        <button class="trade-market-submit" data-trade-create-listing ${listingFormDisabled?"disabled":""}>WYSTAW NA STRAGAN</button>
                        <p class="trade-market-inline-note">Karta zostaje w Panelu Wojownika do chwili zakupu. Wycofanie nie odnawia wykorzystanego slotu.</p>
                    </div></section>
                </aside>
                <section class="trade-market-bazaar-scene">
                    <header class="trade-bazaar-scene-head"><span><small>PUBLICZNY MARKET</small><b>STRAGANY PLANETY TARGOWEJ</b></span><em>${publicListings.length} ofert innych graczy</em></header>
                    <div class="trade-market-stall-grid">${makeOwnBazaarStall(ownListings)}${publicListings.map(item=>makeCardMini(item,playerIndex,{canAct})).join("")}${Array.from({length:emptyStalls},(_,index)=>makeEmptyStall(index)).join("")}</div>
                    ${!publicListings.length?`<div class="trade-market-empty">Na razie cisza na bazarze. Twój stragan jest gotowy, a kolejne stoiska ożyją, gdy inni gracze wystawią karty.</div>`:""}
                </section>
            </div>
        </div>`;
    }

    function sellerOptions(buyerIndex){
        return players().map((name,index)=>index===buyerIndex?"":`<option value="${index}">${esc(name)}</option>`).join("");
    }


    function getEntryCard(playerIndex,instanceId){
        const normalized=String(instanceId||"");
        if(!normalized) return null;
        try{
            const found=runtime()?.findEntry?.(Number(playerIndex),normalized);
            if(found?.card) return found.card;
        }catch(_){ }
        const hit=(deckEntries(Number(playerIndex))||[]).find(entry=>String(entry?.card?.instanceId||"")===normalized);
        return hit?.card||null;
    }

    function renderTradeCoinStack(amount,label="JEFFCOINY",visible=true){
        const value=Math.max(0,Number(amount)||0);
        if(!visible){
            return `<div class="trade-neg-coin-stack is-awaiting" data-trade-coin-amount="0"><span>Stos pojawi się po ułożeniu pełnej oferty.</span></div>`;
        }
        if(!value){
            return `<div class="trade-neg-coin-stack is-empty" data-trade-coin-amount="0"><span>0 JC</span></div>`;
        }
        const count=Math.max(1,Math.min(6,Math.ceil(value/2)));
        const coins=Array.from({length:count},(_,index)=>`<img src="draft-assets/jeffcoin.png" alt="" style="--coin-offset:${index};">`).join("");
        return `<div class="trade-neg-coin-stack" data-trade-coin-amount="${value}" aria-label="${value} JeffCoinów"><div class="trade-neg-coin-stack-art">${coins}</div><b>${value} JC</b></div>`;
    }

    function renderTradeTableCard(card,options={}){
        const label=options.label||"KARTA";
        if(!card){
            return `<div class="trade-neg-table-card trade-neg-live-card is-empty"><small>${esc(label)}</small>${renderSnapDraftCard(null,{empty:true,emptyText:"WYBIERZ KARTĘ"})}</div>`;
        }
        return `<div class="trade-neg-table-card trade-neg-live-card" data-card-name="${esc(card?.name||"")}">
            <small>${esc(label)}</small>
            ${renderSnapDraftCard(card,{compact:true})}
            <em>${esc(options.caption||"Aktywny element stołu")}</em>
        </div>`;
    }

    function pendingNegotiationForBuyer(playerIndex){
        const list=(engine()?.getNegotiations?.()||[]).filter(item=>item.status==="pending"&&Number(item.buyerIndex)===Number(playerIndex));
        return list.sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))[0]||null;
    }

    function pendingNegotiationForPlayer(playerIndex){
        const list=(engine()?.getNegotiations?.()||[]).filter(item=>item.status==="pending"&&(Number(item.buyerIndex)===Number(playerIndex)||Number(item.sellerIndex)===Number(playerIndex)));
        return list.sort((a,b)=>{
            const sellerPriority=Number(Number(b.sellerIndex)===Number(playerIndex))-Number(Number(a.sellerIndex)===Number(playerIndex));
            return sellerPriority||Number(b.createdAt||0)-Number(a.createdAt||0);
        })[0]||null;
    }

    function getNegotiationStageModel(playerIndex){
        const state=negotiationDraftState||{};
        const hasDraft=Boolean(state.sellerIndex||state.targetInstanceId||state.ownInstanceId);
        const pending=!hasDraft?pendingNegotiationForPlayer(playerIndex):null;
        if(pending){
            const targetCard=getEntryCard(pending.sellerIndex,pending.targetInstanceId)||{name:pending.targetCardName,cost:pending.targetCost,power:pending.targetPower,instanceId:pending.targetInstanceId};
            const pendingMode=["cash","card","hybrid"].includes(pending.mode)?pending.mode:(pending.offerCardInstanceId?"hybrid":"cash");
            const ownId=pendingMode==="cash"?(pending.buyerReleaseInstanceId||""):(pending.offerCardInstanceId||"");
            const ownCard=getEntryCard(pending.buyerIndex,ownId)||null;
            const canResolve=Number(pending.sellerIndex)===Number(playerIndex);
            const contractParts=[pending.targetCardName||"Karta"];
            if(Number(pending.price)>0) contractParts.push(`${Number(pending.price)} JC`);
            if(pending.offerCardName) contractParts.push(pending.offerCardName);
            return {
                sellerIndex:Number(pending.sellerIndex),sellerName:pending.sellerName||players()[pending.sellerIndex]||"—",
                buyerName:pending.buyerName||players()[playerIndex]||"—",targetCard,ownCard,
                price:Number(pending.price)||0,mode:pendingMode,
                statusTitle:canResolve?"KONTRAKT CZEKA NA TWÓJ OSĄD":"OFERTA WYSŁANA",statusText:`${contractParts.join(" • ")} • kontrakt czeka na rozstrzygnięcie.`,
                ready:true,locked:true,pendingId:pending.id,canResolve
            };
        }
        const sellerIndex=Number(state.sellerIndex);
        const sellerValid=Number.isInteger(sellerIndex)&&players()[sellerIndex];
        const targetCard=sellerValid?getEntryCard(sellerIndex,state.targetInstanceId):null;
        const ownCard=getEntryCard(playerIndex,state.ownInstanceId);
        const mode=["cash","card","hybrid"].includes(state.mode)?state.mode:"cash";
        const usesCoins=mode!=="card";
        const usesCard=mode!=="cash";
        const price=usesCoins?Math.max(0,Number(state.price)||Number(config().negotiationMinPrice)||0):0;
        const ready=Boolean(sellerValid&&targetCard&&ownCard&&(!usesCoins||price>=Number(config().negotiationMinPrice||0)));
        let statusTitle="UKŁADAJ OFERTĘ NA STOLE";
        let statusText="Wybierz partnera, kartę celu i model transakcji — stół aktualizuje się na żywo.";
        if(sellerValid&&!targetCard){
            statusTitle="WYBIERZ KARTĘ CELU";
            statusText=`${players()[sellerIndex]} — wskaż kartę, której dotyczy kontrakt.`;
        }else if(targetCard&&!ownCard){
            statusTitle=mode==="cash"?"WYBIERZ KARTĘ DO ZASTĄPIENIA":"DODAJ SWOJĄ KARTĘ";
            statusText=mode==="cash"
                ? `${targetCard.name} jest już na stole. Wskaż kartę, którą zastąpi w twoim Panelu Wojownika.`
                : `${targetCard.name} jest już na stole. Do tego modelu kontraktu brakuje twojej karty.`;
        }else if(ready&&mode==="cash"){
            statusTitle="KONTRAKT GOTOWY";
            statusText=`${price} JC za ${targetCard.name}. ${ownCard.name} zostanie zastąpiona u ciebie i nie trafia do sprzedającego.`;
        }else if(ready&&mode==="card"){
            statusTitle="KONTRAKT GOTOWY";
            statusText=`${ownCard.name} w zamian za ${targetCard.name}.`;
        }else if(ready&&mode==="hybrid"){
            statusTitle="KONTRAKT GOTOWY";
            statusText=`${price} JC + ${ownCard.name} w zamian za ${targetCard.name}.`;
        }
        return {sellerIndex:sellerValid?sellerIndex:null,sellerName:sellerValid?players()[sellerIndex]:"—",buyerName:players()[playerIndex]||"—",targetCard,ownCard,price,mode,statusTitle,statusText,ready,locked:false,canResolve:false};
    }

    function renderNegotiationStage(model){
        const usesCard=model.mode!=="cash";
        const usesCoins=model.mode!=="card";
        const ownCard=usesCard?renderTradeTableCard(model.ownCard,{label:"TWOJA KARTA W OFERCIE",caption:"Trafi do drugiej strony po dealu"}):"";
        const showCoins=Boolean(usesCoins&&(model.ready||model.locked));
        return `<div class="trade-neg-stage-shell ${model.ready?"is-ready":""} ${model.locked?"is-locked":""}">
            <div class="trade-neg-stage-topline">
                <div class="trade-neg-scene-tag"><span>STÓŁ NEGOCJACYJNY</span><b>${esc(model.statusTitle)}</b></div>
                <div class="trade-neg-scene-status"><small>AKTUALNY KONTRAKT</small><b>${esc(model.statusText)}</b></div>
            </div>
            <div class="trade-neg-table-arena">
                <img class="trade-neg-stage-table" src="${ASSETS.table}" alt="Interaktywny stół negocjacyjny">
                <div class="trade-neg-table-party is-left"><small>STRONA A</small><b>${esc(model.buyerName||"—")}</b></div>
                <div class="trade-neg-table-party is-right"><small>STRONA B</small><b>${esc(model.sellerName||"WYBIERZ GRACZA")}</b></div>
                <div class="trade-neg-live-zone is-left">
                    <span class="trade-neg-zone-title">TY OFERUJESZ</span>
                    <div class="trade-neg-live-offer ${usesCard?"has-card":"is-coins-only"}">
                        ${ownCard}
                        ${usesCoins?renderTradeCoinStack(model.price,model.mode==="hybrid"?"JEFFCOINY + KARTA":"JEFFCOINY",showCoins):""}
                    </div>
                </div>
                <div class="trade-neg-live-zone is-right">
                    <span class="trade-neg-zone-title">W ZAMIAN CHCESZ</span>
                    ${renderTradeTableCard(model.targetCard,{label:"KARTA CELU",caption:model.sellerIndex!==null?`Od: ${model.sellerName}`:"Wskaż gracza i kartę"})}
                </div>
                <div class="trade-neg-table-contract-state ${model.ready?"is-ready":""}"><span>${model.locked?(model.canResolve?"TWÓJ RUCH PRZY STOLE":"OFERTA WYSŁANA"):model.ready?"GOTOWE DO WYSŁANIA":"UZUPEŁNIJ KONTRAKT"}</span></div>
                ${model.locked&&model.canResolve?`<div class="trade-neg-table-decision"><button class="accept" data-trade-neg-accept="${esc(model.pendingId)}">AKCEPTUJ DEAL</button><button class="reject" data-trade-neg-reject="${esc(model.pendingId)}">ODRZUĆ</button></div>`:""}
            </div>
        </div>`;
    }

    function syncNegotiationTargetOptions(overlay,playerIndex){
        const sellerSelect=overlay.querySelector('[data-trade-neg-seller]');
        const targetSelect=overlay.querySelector('[data-trade-neg-target]');
        if(!sellerSelect||!targetSelect) return;
        const seller=Number(sellerSelect.value);
        if(!Number.isInteger(seller)||!players()[seller]){
            targetSelect.disabled=true;
            targetSelect.innerHTML='<option value="">— najpierw wybierz gracza —</option>';
            if(negotiationDraftState) negotiationDraftState.targetInstanceId="";
            return;
        }
        targetSelect.disabled=false;
        const previous=String(negotiationDraftState?.targetInstanceId||"");
        targetSelect.innerHTML=`<option value="">— wybierz kartę —</option>${entryOptions(seller,previous)}`;
        const exists=[...targetSelect.options].some(option=>String(option.value||"")===previous);
        targetSelect.value=exists?previous:"";
        if(!exists&&negotiationDraftState) negotiationDraftState.targetInstanceId="";
    }

    function syncNegotiationOwnField(overlay){
        const modeSelect=overlay.querySelector('[data-trade-neg-mode]');
        const ownField=overlay.querySelector('[data-trade-neg-own-field]');
        const priceField=overlay.querySelector('[data-trade-neg-price-field]');
        if(!modeSelect||!ownField) return;
        const usesCard=modeSelect.value!=="cash";
        const usesCoins=modeSelect.value!=="card";
        const label=ownField.querySelector('label');
        const ownSelect=ownField.querySelector('select');
        if(label) label.textContent=usesCard?"KARTA DODAWANA DO OFERTY":"KARTA ZASTĘPOWANA W TWOIM DECKU";
        ownField.hidden=false;
        ownField.dataset.mode=modeSelect.value;
        if(ownSelect) ownSelect.disabled=Boolean(modeSelect.disabled);
        if(priceField){
            priceField.hidden=!usesCoins;
            const priceInput=priceField.querySelector('input');
            if(priceInput) priceInput.disabled=!usesCoins||modeSelect.disabled;
        }
    }

    function syncNegotiationDraftStateFromOverlay(overlay){
        if(!overlay) return;
        negotiationDraftState={
            sellerIndex:overlay.querySelector('[data-trade-neg-seller]')?.value||"",
            targetInstanceId:overlay.querySelector('[data-trade-neg-target]')?.value||"",
            price:overlay.querySelector('[data-trade-neg-price]')?.value||String(config().negotiationMinPrice||5),
            mode:overlay.querySelector('[data-trade-neg-mode]')?.value||"cash",
            ownInstanceId:overlay.querySelector('[data-trade-neg-own]')?.value||""
        };
    }

    function updateNegotiationStage(overlay,playerIndex){
        syncNegotiationDraftStateFromOverlay(overlay);
        const model=getNegotiationStageModel(playerIndex);
        const stage=overlay.querySelector('[data-trade-neg-stage-live]');
        if(stage) stage.innerHTML=renderNegotiationStage(model);
        const submit=overlay.querySelector('[data-trade-create-neg]');
        if(submit){
            const hardLocked=submit.dataset.tradeHardDisabled==="1";
            submit.disabled=hardLocked||!model.ready||Boolean(model.locked);
            submit.classList.toggle("is-ready",!submit.disabled&&model.ready);
        }
    }

    function renderPendingNegotiations(playerIndex){
        const pending=(engine()?.getNegotiations?.()||[]).filter(item=>item.status==="pending"&&(item.buyerIndex===playerIndex||item.sellerIndex===playerIndex));
        if(!pending.length) return `<div class="trade-market-empty">Brak oczekujących negocjacji dla tego gracza.</div>`;
        return `<div class="trade-neg-pending">${pending.map(item=>{
            const payment=[Number(item.price)>0?`${Number(item.price)} JC`:"",item.offerCardName?`karta <strong>${esc(item.offerCardName)}</strong>`:""].filter(Boolean).join(" + ");
            return `<article class="trade-neg-entry"><strong>${esc(item.buyerName)} → ${esc(item.sellerName)}</strong><p>Cel: <b>${esc(item.targetCardName)}</b> • ${payment}</p><div class="trade-neg-entry-actions"><button class="accept" data-trade-neg-accept="${esc(item.id)}">AKCEPTUJ</button><button class="reject" data-trade-neg-reject="${esc(item.id)}">ODRZUĆ</button></div></article>`;
        }).join("")}</div>`;
    }

    function renderNegotiationsView(playerIndex){
        const canAct=canActAs(playerIndex);
        const ownCards=deckEntries(playerIndex);
        const summary=engine()?.getPlayerSummary?.(playerIndex);
        const turnKey=runtime()?.getTurnKey?.()||null;
        const turnLocked=!runtime()?.isPostDraft?.()&&Boolean(summary?.lastNegotiationTurnKey&&turnKey&&String(summary.lastNegotiationTurnKey)===String(turnKey));
        const disabled=!canAct || turnLocked || Number(summary?.negotiationsRemaining||0)<=0;
        const sellerValue=String(negotiationDraftState?.sellerIndex||"");
        const targetValue=String(negotiationDraftState?.targetInstanceId||"");
        const ownValue=String(negotiationDraftState?.ownInstanceId||"");
        const priceValue=String(negotiationDraftState?.price||config().negotiationMinPrice);
        const modeValue=["cash","card","hybrid"].includes(negotiationDraftState?.mode)?negotiationDraftState.mode:"cash";
        const sellerIndex=Number(sellerValue);
        const sellerValid=Number.isInteger(sellerIndex)&&players()[sellerIndex];
        const targetOptions=sellerValid?entryOptions(sellerIndex,targetValue):"";
        const model=getNegotiationStageModel(playerIndex);
        return `<div class="trade-market-view trade-negotiations-view" data-trade-view="negotiations">
            <div class="trade-market-v2-layout trade-neg-v2-layout">
                <aside class="trade-market-control-rail trade-neg-control-rail">
                    <section class="trade-market-box trade-neg-command-box"><h3>KONFIGURACJA KONTRAKTU</h3><div class="trade-market-box-content">
                    <div class="trade-neg-form-grid">
                        <div class="trade-market-field"><label>Z KIM NEGOCJUJESZ?</label><select data-trade-neg-seller ${disabled?"disabled":""}><option value="">— wybierz gracza —</option>${sellerOptions(playerIndex)}</select></div>
                        <div class="trade-market-field"><label>KARTA, KTÓRĄ CHCESZ PRZEJĄĆ</label><select data-trade-neg-target ${disabled||!sellerValid?"disabled":""}><option value="">${sellerValid?"— wybierz kartę —":"— najpierw wybierz gracza —"}</option>${targetOptions}</select></div>
                        <div class="trade-market-field" data-trade-neg-price-field ${modeValue==="card"?"hidden":""}><label>JEFFCOINY • MINIMUM ${config().negotiationMinPrice} JC</label><input data-trade-neg-price type="number" min="${config().negotiationMinPrice}" step="1" value="${esc(priceValue)}" ${disabled||modeValue==="card"?"disabled":""}></div>
                        <div class="trade-market-field"><label>MODEL TRANSAKCJI</label><select data-trade-neg-mode ${disabled?"disabled":""}><option value="cash"${modeValue==="cash"?" selected":""}>TYLKO JEFFCOINY</option><option value="card"${modeValue==="card"?" selected":""}>TYLKO KARTA</option><option value="hybrid"${modeValue==="hybrid"?" selected":""}>JEFFCOINY + KARTA</option></select></div>
                        <div class="trade-market-field trade-neg-own-field" data-trade-neg-own-field><label>${modeValue==="cash"?"KARTA ZASTĘPOWANA W TWOIM DECKU":"KARTA DODAWANA DO OFERTY"}</label><select data-trade-neg-own ${disabled?"disabled":""}><option value="">— wybierz kartę —</option>${entryOptions(playerIndex,ownValue)}</select></div>
                    </div>
                    <button class="trade-market-submit" data-trade-create-neg data-trade-hard-disabled="${disabled?"1":"0"}" ${disabled||!model.ready?"disabled":""}>ZŁÓŻ OFERTĘ</button>
                    <p class="trade-market-inline-note"><strong>1 PROPOZYCJA NA RUCH.</strong> Wybierz gracza, kartę i warunki — gotowa oferta pojawi się na stole po prawej.${turnLocked?" W tym ruchu wykorzystano już możliwość rozpoczęcia negocjacji.":""}</p>
                    </div></section>
                    <section class="trade-market-box trade-neg-pending-box"><h3>OCZEKUJĄCE DEALE</h3><div class="trade-market-box-content">${renderPendingNegotiations(playerIndex)}</div></section>
                </aside>
                <section class="trade-neg-live-scene"><div data-trade-neg-stage-live>${renderNegotiationStage(model)}</div></section>
            </div>
        </div>`;
    }

    function historyLabel(entry){
        const type=String(entry.type||"");
        const negotiationAmount=entry.mode==="card"
            ? (entry.offerCardName?"KARTA":"")
            : entry.mode==="hybrid"
                ? `${Number(entry.price)||0} JC + KARTA`
                : `${Number(entry.price)||0} JC`;
        if(type==="market_listed") return ["MARKET",`${entry.sellerName||"Gracz"} wystawia ${entry.cardName||"kartę"}`,`${Number(entry.price)||0} JC`];
        if(type==="market_sold") return ["SPRZEDAŻ",`${entry.buyerName||"Kupujący"} kupuje ${entry.cardName||"kartę"} od ${entry.sellerName||"sprzedającego"}`,`${Number(entry.price)||0} JC`];
        if(type==="market_withdrawn") return ["WYCOFANO",`${entry.sellerName||"Gracz"} wycofuje ${entry.cardName||"kartę"}`,""];
        if(type==="negotiation_created") return ["NEGOCJACJA",`${entry.buyerName||"Kupujący"} chce ${entry.targetCardName||"kartę"} od ${entry.sellerName||"sprzedającego"}`,negotiationAmount];
        if(type==="negotiation_accepted") return ["DEAL",`${entry.buyerName||"Kupujący"} i ${entry.sellerName||"sprzedający"} podpisali kontrakt`,negotiationAmount];
        if(type==="negotiation_rejected") return ["ODRZUCONO",`${entry.sellerName||"Sprzedający"} odrzucił ofertę ${entry.buyerName||"kupującego"}`,""];
        if(type==="negotiation_expired"){
            const reason=entry.reason||entry.expireReason;
            const text=reason==="turn_ended"?`Oferta ${entry.buyerName||"kupującego"} wygasła wraz z końcem jego ruchu`:reason==="draft_finished"?"Draft się zakończył — negocjacja została zamknięta":`Oferta ${entry.buyerName||"kupującego"} wygasła, bo karta lub slot przestały być dostępne`;
            return ["WYGASŁA",text,""];
        }
        if(type==="market_expired"){
            const reason=entry.reason||entry.expireReason;
            const text=reason==="draft_finished"
                ? "Draft się zakończył — oferta Marketu została zamknięta"
                : reason==="negotiation_committed"
                    ? `${entry.cardName||"Karta"} została automatycznie zdjęta po zatwierdzeniu negocjacji`
                    : reason==="market_purchase_committed"
                        ? `${entry.cardName||"Karta"} została automatycznie zdjęta po innym zatwierdzonym zakupie`
                        : `${entry.cardName||"Karta"} opuściła Panel Wojownika sprzedającego`;
            return ["WYGASŁA",text,""];
        }
        return ["LOG",type,""];
    }

    function renderHistoryView(playerIndex){
        const rows=(engine()?.getHistory?.()||[]).filter(entry=>{
            const values=[entry.playerIndex,entry.buyerIndex,entry.sellerIndex];
            return values.some(value=>Number(value)===Number(playerIndex));
        });
        return `<div class="trade-market-view" data-trade-view="history">${rows.length?`<div class="trade-history">${rows.map(entry=>{const [tag,text,amount]=historyLabel(entry);return `<div class="trade-history-row"><small>${esc(tag)}</small><b>${esc(text)}</b><em>${esc(amount)}</em></div>`;}).join("")}</div>`:`<div class="trade-market-empty">Ten gracz nie ma jeszcze historii na Targowisku.</div>`}</div>`;
    }

    function renderPanel(){
        const overlay=document.getElementById("tradeMarketOverlay");
        if(!overlay) return;
        const active=activePlayer();
        if(!Number.isInteger(currentViewPlayer)||!players()[currentViewPlayer]) currentViewPlayer=Number.isInteger(active)?active:0;
        const p=currentViewPlayer;
        const flavor=getSceneFlavor();
        overlay.innerHTML=`<section class="trade-market-panel ${esc(flavor.mood)}" data-trade-scene="${esc(currentTab)}" role="dialog" aria-modal="true" aria-label="Galaktyczny Targ">
            <img class="trade-market-ui-frame" src="${ASSETS.frame}" alt="" aria-hidden="true">
            <button class="trade-market-close" type="button" data-trade-close>×</button>
            <header class="trade-market-planet-head">
                <div class="trade-market-planet-backdrop" aria-hidden="true"><img src="${currentTab==="market"?ASSETS.marketHeader:ASSETS.backdrop}" alt=""></div>
                <div class="trade-market-head-planet" aria-hidden="true"><img src="${ASSETS.launcher}" alt=""></div>
                <div class="trade-market-planet-lights" aria-hidden="true">${Array.from({length:18},(_,index)=>`<span style="--lamp-index:${index}"></span>`).join("")}</div>
                <div class="trade-market-planet-shell">
                    <div class="trade-market-planet-brand"><div class="trade-market-head-icon"><img src="${ASSETS.logo}" alt="Galaktyczny Targ"></div><div class="trade-market-head-copy"><small>${esc(flavor.eyebrow)}</small><h2>${esc(flavor.title)}</h2><p>${esc(flavor.description)}</p></div></div>
                    <div class="trade-market-head-stats">${renderStats(p)}</div>
                </div>
                <nav class="trade-market-tabs"><button data-trade-tab="market" class="${currentTab==="market"?"is-active":""}"><span>MARKET</span></button><button data-trade-tab="negotiations" class="${currentTab==="negotiations"?"is-active":""}"><span>NEGOCJACJE</span></button><button data-trade-tab="history" class="${currentTab==="history"?"is-active":""}"><span>HISTORIA</span></button></nav>
            </header>
            <main class="trade-market-body">${currentTab==="market"?renderMarketView(p):currentTab==="negotiations"?renderNegotiationsView(p):renderHistoryView(p)}</main>
        </section>`;
        bindPanelEvents(overlay,p);
    }

    function bindPanelEvents(overlay,playerIndex){
        overlay.querySelector("[data-trade-close]")?.addEventListener("click",close);
        overlay.addEventListener("mousedown",event=>{if(event.target===overlay) close();});
        overlay.querySelectorAll("[data-trade-tab]").forEach(button=>button.addEventListener("click",()=>{currentTab=button.dataset.tradeTab||"market";selectedListingId=null;renderPanel();}));
        overlay.querySelector("[data-trade-create-listing]")?.addEventListener("click",()=>{
            const card=overlay.querySelector("[data-trade-list-card]")?.value||"";
            const price=overlay.querySelector("[data-trade-list-price]")?.value;
            const result=engine()?.createListing?.({playerIndex,cardInstanceId:card,price});
            if(!result?.ok){showToast("MARKET",result?.reason||"Nie udało się wystawić karty.",true);return;}
            showToast("KARTA WYSTAWIONA",`${result.listing.cardName} • ${result.listing.price} JC`);
            renderPanel();decorateAll();
        });
        overlay.querySelectorAll("[data-trade-cancel]").forEach(btn=>btn.addEventListener("click",()=>{
            const result=engine()?.cancelListing?.({playerIndex,listingId:btn.dataset.tradeCancel});
            if(!result?.ok){showToast("MARKET",result?.reason||"Nie udało się wycofać oferty.",true);return;}
            selectedListingId=null;showToast("OFERTA WYCOFANA",result.listing.cardName);renderPanel();decorateAll();
        }));
        overlay.querySelectorAll("[data-trade-buy-select]").forEach(btn=>btn.addEventListener("click",()=>{selectedListingId=btn.dataset.tradeBuySelect||null;renderPanel();}));
        overlay.querySelector("[data-trade-confirm-buy]")?.addEventListener("click",()=>{
            const listingId=overlay.querySelector("[data-trade-confirm-buy]")?.dataset.tradeConfirmBuy;
            const release=overlay.querySelector("[data-trade-buyer-release]")?.value||"";
            const result=engine()?.buyListing?.({buyerIndex:playerIndex,listingId,buyerReleaseInstanceId:release});
            if(!result?.ok){showToast("TRANSAKCJA ODRZUCONA",result?.reason||"Zakup nie powiódł się.",true);return;}
            selectedListingId=null;renderPanel();decorateAll();showDealScene({kind:"market",buyerIndex:result.listing.buyerIndex,sellerIndex:result.listing.sellerIndex,buyerName:result.listing.buyerName,sellerName:result.listing.sellerName,price:result.listing.price,cardName:result.listing.cardName,targetCard:result.transfer?.targetCard,releaseCard:result.transfer?.releaseCard,replacement:result.transfer?.replacement,message:`${result.listing.buyerName} kupuje ${result.listing.cardName} od ${result.listing.sellerName}.`});
        });

        const sellerSelect=overlay.querySelector("[data-trade-neg-seller]");
        const targetSelect=overlay.querySelector("[data-trade-neg-target]");
        const modeSelect=overlay.querySelector("[data-trade-neg-mode]");
        [sellerSelect,targetSelect,overlay.querySelector("[data-trade-neg-price]"),modeSelect,overlay.querySelector("[data-trade-neg-own]")].filter(Boolean).forEach(control=>{
            const eventName=control.matches('input[type="number"]')?"input":"change";
            control.addEventListener(eventName,()=>{
                if(control===sellerSelect) syncNegotiationTargetOptions(overlay,playerIndex);
                if(control===modeSelect) syncNegotiationOwnField(overlay);
                updateNegotiationStage(overlay,playerIndex);
            });
            if(eventName!=="change") control.addEventListener("change",()=>updateNegotiationStage(overlay,playerIndex));
        });
        sellerSelect && (sellerSelect.value=String(negotiationDraftState?.sellerIndex||""));
        modeSelect && (modeSelect.value=["cash","card","hybrid"].includes(negotiationDraftState?.mode)?negotiationDraftState.mode:"cash");
        syncNegotiationTargetOptions(overlay,playerIndex);
        targetSelect && (targetSelect.value=String(negotiationDraftState?.targetInstanceId||targetSelect.value||""));
        const priceControl=overlay.querySelector("[data-trade-neg-price]");
        priceControl && (priceControl.value=String(negotiationDraftState?.price||config().negotiationMinPrice));
        const ownControl=overlay.querySelector("[data-trade-neg-own]");
        ownControl && (ownControl.value=String(negotiationDraftState?.ownInstanceId||""));
        syncNegotiationOwnField(overlay);
        updateNegotiationStage(overlay,playerIndex);
        overlay.querySelector("[data-trade-create-neg]")?.addEventListener("click",()=>{
            const sellerIndex=Number(sellerSelect?.value);
            const targetInstanceId=targetSelect?.value||"";
            const price=overlay.querySelector("[data-trade-neg-price]")?.value;
            const mode=modeSelect?.value||"cash";
            const own=overlay.querySelector("[data-trade-neg-own]")?.value||"";
            const result=engine()?.createNegotiation?.({
                buyerIndex:playerIndex,sellerIndex,targetInstanceId,price,mode,
                offerCardInstanceId:mode!=="cash"?own:null,
                buyerReleaseInstanceId:mode==="cash"?own:null
            });
            if(!result?.ok){showToast("NEGOCJACJE",result?.reason||"Nie udało się złożyć oferty.",true);return;}
            const payment=result.negotiation.mode==="card"
                ? `karta ${result.negotiation.offerCardName||""}`
                : result.negotiation.mode==="hybrid"
                    ? `${result.negotiation.price} JC + karta ${result.negotiation.offerCardName||""}`
                    : `${result.negotiation.price} JC`;
            showToast("OFERTA NA STOLE",`${result.negotiation.targetCardName} • ${payment}`);negotiationDraftState={sellerIndex:"",targetInstanceId:"",price:String(config().negotiationMinPrice||5),mode:"cash",ownInstanceId:""};renderPanel();decorateAll();
        });
        overlay.querySelectorAll("[data-trade-neg-accept]").forEach(btn=>btn.addEventListener("click",()=>{
            const result=engine()?.resolveNegotiation?.({negotiationId:btn.dataset.tradeNegAccept,accept:true});
            if(!result?.ok){showToast("DEAL NIE DOSZEDŁ DO SKUTKU",result?.reason||"Transakcja nie może zostać wykonana.",true);return;}
            renderPanel();decorateAll();showDealScene({kind:"negotiation",buyerIndex:result.negotiation.buyerIndex,sellerIndex:result.negotiation.sellerIndex,buyerName:result.negotiation.buyerName,sellerName:result.negotiation.sellerName,price:result.negotiation.price,cardName:result.negotiation.targetCardName,targetCard:result.transfer?.targetCard,offerCard:result.transfer?.offerCard,releaseCard:result.transfer?.releaseCard,replacement:result.transfer?.replacement,message:`${result.negotiation.buyerName} ↔ ${result.negotiation.sellerName} • ${result.negotiation.targetCardName}`});
        }));
        overlay.querySelectorAll("[data-trade-neg-reject]").forEach(btn=>btn.addEventListener("click",()=>{
            const result=engine()?.resolveNegotiation?.({negotiationId:btn.dataset.tradeNegReject,accept:false});
            if(!result?.ok){showToast("NEGOCJACJE",result?.reason||"Nie udało się odrzucić oferty.",true);return;}
            showToast("OFERTA ODRZUCONA",`${result.negotiation.buyerName} → ${result.negotiation.sellerName}`);renderPanel();decorateAll();showFailedDealScene(`${result.negotiation.sellerName} odrzuca ofertę ${result.negotiation.buyerName}.`);
        }));
    }

    function open(playerIndex=null,tab=null){
        if(!engine()?.isEnabled?.()){showToast("TARG ZAMKNIĘTY","Włącz Economy i Galaktyczny Targ przed startem draftu.",true);return false;}
        const active=activePlayer();
        currentViewPlayer=Number.isInteger(Number(playerIndex))&&players()[Number(playerIndex)]?Number(playerIndex):(Number.isInteger(active)?active:0);
        if(tab) currentTab=tab;
        let overlay=document.getElementById("tradeMarketOverlay");
        if(!overlay){overlay=document.createElement("div");overlay.id="tradeMarketOverlay";overlay.className="trade-market-overlay";document.body.appendChild(overlay);}
        overlay.hidden=false;
        document.body.classList.add("trade-market-open");
        pauseTimerForMarket();
        renderPanel();
        return true;
    }
    function close(){
        document.getElementById("tradeMarketOverlay")?.remove();
        document.body.classList.remove("trade-market-open");
        selectedListingId=null;
        restoreTimerAfterMarket();
    }

    function makeQuickButton(playerIndex){
        const summary=engine()?.getPlayerSummary?.(playerIndex);
        const button=document.createElement("button");
        button.type="button";
        button.className="trade-market-quick-btn";
        button.dataset.tradeMarketDecoration="quick-button";
        button.title=`Galaktyczny Targ • ${players()[playerIndex]||"Gracz"}`;
        button.setAttribute("aria-label",button.title);
        button.innerHTML=`<img src="${ASSETS.icon}" alt="">${Number(summary?.pendingNegotiations||0)>0?`<i>${Number(summary.pendingNegotiations)}</i>`:""}`;
        button.addEventListener("mousedown",event=>event.stopPropagation());
        button.addEventListener("click",event=>{event.stopPropagation();open(playerIndex,"negotiations");});
        return button;
    }

    function decorateContextButtons(){
        if(!engine()?.isEnabled?.()){
            document.querySelectorAll(".trade-market-quick-btn").forEach(node=>node.remove());
            return;
        }
        document.querySelectorAll(".deck-context-strip[data-player-index]").forEach(strip=>{
            const p=Number(strip.dataset.playerIndex);if(!Number.isInteger(p)) return;
            if(!strip.querySelector(".trade-market-quick-btn")) strip.appendChild(makeQuickButton(p));
        });
        document.querySelectorAll('[id^="deckInspectorTrade_"]').forEach(slot=>{
            const p=Number(String(slot.id).split("_").pop());if(!Number.isInteger(p)) return;
            slot.hidden=false;
            if(!slot.querySelector(".trade-market-quick-btn")) slot.replaceChildren(makeQuickButton(p));
        });
    }

    function decorateListedCards(){
        const listings=engine()?.isEnabled?.()?(engine()?.getActiveListings?.()||[]):[];
        const byId=new Map(listings.map(item=>[String(item.cardInstanceId||""),item]));
        document.querySelectorAll(".card[data-card-instance-id], .deckInspectorCard[data-card-instance-id]").forEach(card=>{
            const listing=byId.get(String(card.dataset.cardInstanceId||""));
            const badge=card.querySelector(":scope > .trade-market-listed-badge");
            if(!listing){
                if(card.classList.contains("is-trade-market-listed")) card.classList.remove("is-trade-market-listed");
                if(badge) badge.remove();
                return;
            }
            if(!card.classList.contains("is-trade-market-listed")) card.classList.add("is-trade-market-listed");
            const price=Number(listing.price)||0;
            const title=`Wystawiona na Galaktycznym Targu za ${price} JC`;
            if(!badge){
                const nextBadge=document.createElement("span");
                nextBadge.className="trade-market-listed-badge";
                nextBadge.dataset.tradeMarketDecoration="listing";
                nextBadge.innerHTML=`<img class="trade-market-listed-ribbon" src="${ASSETS.listed}" alt=""><span><em><img src="draft-assets/jeffcoin.png" alt=""><b>${price}</b></em></span>`;
                nextBadge.title=title;
                card.appendChild(nextBadge);
            }else{
                const amount=badge.querySelector("b");
                if(amount&&amount.textContent!==String(price)) amount.textContent=String(price);
                if(badge.title!==title) badge.title=title;
            }
        });
    }

    function decorateAll(){ensureLauncher();refreshLauncher();decorateContextButtons();decorateListedCards();}

    // HARD FREEZE FIX: Trade Market no longer watches the whole deck DOM.
    // Deck rebuilds are explicit in SnapDraft, so one coalesced refresh is safer
    // than a MutationObserver competing with Quest/Economy/Collector decorators.
    function scheduleDecorate(delay=0){
        global.clearTimeout?.(decorateRefreshTimer);
        decorateRefreshTimer=global.setTimeout?.(()=>{decorateRefreshTimer=null;decorateAll();},Math.max(0,Number(delay)||0));
    }
    function schedulePanelRender(delay=0){
        if(!document.getElementById("tradeMarketOverlay")) return;
        global.clearTimeout?.(panelRefreshTimer);
        panelRefreshTimer=global.setTimeout?.(()=>{
            panelRefreshTimer=null;
            if(document.getElementById("tradeMarketOverlay")) renderPanel();
        },Math.max(0,Number(delay)||0));
    }

    function bindLobby(){
        const economyInput=document.getElementById("enableEconomy");
        const tradeInput=document.getElementById("enableTradeMarket");
        if(!tradeInput) return;
        const option=tradeInput.closest(".tradeMarketModeOption");
        function sync(){
            const economyOn=Boolean(economyInput?.checked);
            tradeInput.disabled=!economyOn;
            if(!economyOn) tradeInput.checked=false;
            option?.classList.toggle("trade-active",Boolean(tradeInput.checked&&economyOn));
            option?.classList.toggle("trade-requires-economy",!economyOn);
        }
        economyInput?.addEventListener("change",sync);
        tradeInput.addEventListener("change",sync);
        sync();
    }

    function init(){bindLobby();ensureLauncher();decorateAll();}

    global.addEventListener("trade-market:change",()=>{scheduleDecorate(0);schedulePanelRender(0);});
    global.addEventListener("trade-market:runtime-refreshed",()=>scheduleDecorate(0));
    global.addEventListener("snapdraft:economy-change",()=>{refreshLauncher();schedulePanelRender(0);});
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true}); else init();

    global.TradeMarketUI=Object.freeze({VERSION,open,close,refresh:decorateAll});
})(window);
