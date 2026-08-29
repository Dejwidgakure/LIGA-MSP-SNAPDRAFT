/**
 * MSP SnapDraft — PATCH 40.2 / Iron Fist UI
 * Scroll prompts, sealed Dragon Prize and a dedicated top-down K’un-Lun arena.
 */

const IronFistUI=(()=>{
    const engine=window.IronFistTournamentEngine;
    const EMBLEM="draft-assets/ironfist_shoulao_emblem_v2.png";
    const HERO="draft-assets/ironfist_jeff_hero_v2.png";
    const state={
        active:false,phase:"idle",playerName:"",playerIndex:-1,
        eligiblePrizeCards:new Set(),selectedPrize:null,selectedStakeId:"",stakeCursor:0,
        selectedSwapId:"",selectedConsolationName:"",selectedCaptureId:"",resolvedPrizeCard:null,
        lastRound:null,awaitingAdvance:false,primaryResult:null,result:null,
        primaryAction:null,secondaryAction:null,scrollTimer:null,countdownTimer:null
    };

    const escapeText=value=>String(value??"")
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;").replace(/'/g,"&#039;");

    const isMysterioIllusion=card=>Boolean(window.MysterioUI?.isIllusionCard?.(card));
    const publicPackCardSnapshot=card=>window.MysterioUI?.getPublicCardSnapshot?.(card)||card;
    const isGalacticCurrent=()=>Boolean(window.GalacticCurrentSuperpowerBridge?.isModeEnabled?.());
    const flowText=(classicText,currentText)=>isGalacticCurrent()?currentText:classicText;

    function notify(title,text){
        if(window.SuperpowerFeedback?.warning) window.SuperpowerFeedback.warning("iron_fist",title,text);
        else if(window.SuperpowerUI?.notify) window.SuperpowerUI.notify(`${title}: ${text}`);
        else console.warn(title,text);
    }

    function ensureInterface(){
        if(!document.getElementById("spxIronFistHud")){
            const hud=document.createElement("section");
            hud.id="spxIronFistHud";
            hud.className="spx-if-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <img src="${EMBLEM}" alt="" aria-hidden="true">
                <strong id="spxIronFistHudTitle">SMOCZA NAGRODA</strong>
                <span id="spxIronFistHudText"></span>
                <button id="spxIronFistHudCancel" type="button">ZWIŃ</button>`;
            document.body.appendChild(hud);
            hud.querySelector("#spxIronFistHudCancel").addEventListener("click",()=>cancel());
        }

        if(!document.getElementById("spxIronFistOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxIronFistOverlay";
            overlay.className="spx-if-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-if-panel" role="dialog" aria-modal="true" aria-labelledby="spxIronFistTitle">
                    <img class="spx-if-dragon" src="draft-assets/ironfist_shoulao_dragon.png" alt="" aria-hidden="true">
                    <header class="spx-if-header">
                        <img class="spx-if-icon" src="${EMBLEM}" alt="Godło Shou-Lao i Iron Fista">
                        <div class="spx-if-title-copy">
                            <span id="spxIronFistKicker" class="spx-if-kicker">IRON FIST • K’UN-LUN</span>
                            <h2 id="spxIronFistTitle">WYZWANIE K’UN-LUN</h2>
                            <p id="spxIronFistLead">Shou-Lao czeka na wojowników.</p>
                        </div>
                        <img class="spx-if-hero" src="${HERO}" alt="Jeff Iron Fist" aria-hidden="true">
                    </header>
                    <div id="spxIronFistStage" class="spx-if-stage"></div>
                    <footer class="spx-if-footer">
                        <span id="spxIronFistStatus" class="spx-if-status"></span>
                        <div class="spx-if-actions">
                            <button id="spxIronFistSecondary" type="button"></button>
                            <button id="spxIronFistPrimary" class="spx-if-primary" type="button"></button>
                        </div>
                    </footer>
                </section>`;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxIronFistPrimary").addEventListener("click",()=>state.primaryAction?.());
            overlay.querySelector("#spxIronFistSecondary").addEventListener("click",()=>state.secondaryAction?.());
            overlay.addEventListener("click",event=>{
                if(event.target===overlay && state.phase==="prize_confirm") cancelPrizeConfirm();
            });
        }

        if(!document.getElementById("spxIronFistScrollToast")){
            const scroll=document.createElement("aside");
            scroll.id="spxIronFistScrollToast";
            scroll.className="spx-if-scroll-toast";
            scroll.hidden=true;
            scroll.innerHTML=`<em id="spxIronFistScrollSeal">龍</em><b id="spxIronFistScrollTitle"></b><span id="spxIronFistScrollText"></span>`;
            document.body.appendChild(scroll);
        }
    }

    function setHeader(kicker,title,lead){
        const overlay=document.getElementById("spxIronFistOverlay");
        if(!overlay) return;
        overlay.querySelector("#spxIronFistKicker").textContent=kicker;
        overlay.querySelector("#spxIronFistTitle").textContent=title;
        overlay.querySelector("#spxIronFistLead").textContent=lead;
    }

    function setArenaMode(active){
        document.getElementById("spxIronFistOverlay")?.classList.toggle("is-arena-mode",Boolean(active));
    }

    function setActions(options={}){
        const primary=document.getElementById("spxIronFistPrimary");
        const secondary=document.getElementById("spxIronFistSecondary");
        const status=document.getElementById("spxIronFistStatus");
        state.primaryAction=typeof options.onPrimary==="function"?options.onPrimary:null;
        state.secondaryAction=typeof options.onSecondary==="function"?options.onSecondary:null;
        if(primary){primary.hidden=!options.primaryText;primary.textContent=options.primaryText||"";primary.disabled=Boolean(options.primaryDisabled);}
        if(secondary){
            secondary.hidden=!options.secondaryText;secondary.textContent=options.secondaryText||"";
            secondary.disabled=Boolean(options.secondaryDisabled);secondary.classList.toggle("spx-if-danger",Boolean(options.secondaryDanger));
        }
        if(status) status.textContent=options.status||"";
    }

    function showOverlay(){const overlay=document.getElementById("spxIronFistOverlay");if(overlay) overlay.hidden=false;}
    function hideOverlay(){const overlay=document.getElementById("spxIronFistOverlay");if(overlay) overlay.hidden=true;}

    function showScroll(title,text,seal="龍",duration=4300){
        ensureInterface();
        const scroll=document.getElementById("spxIronFistScrollToast");
        if(!scroll) return;
        clearTimeout(state.scrollTimer);
        scroll.querySelector("#spxIronFistScrollSeal").textContent=seal;
        scroll.querySelector("#spxIronFistScrollTitle").textContent=title;
        scroll.querySelector("#spxIronFistScrollText").textContent=text;
        scroll.hidden=false;
        state.scrollTimer=setTimeout(()=>{scroll.hidden=true;},duration);
    }

    function scrollMarkup(title,text,left="挑戰",right="龍"){
        return `<section class="spx-if-scroll">
            <span class="spx-if-scroll-seal">${escapeText(left)}</span>
            <div class="spx-if-scroll-copy"><strong>${escapeText(title)}</strong><span>${escapeText(text)}</span></div>
            <span class="spx-if-scroll-seal">${escapeText(right)}</span>
        </section>`;
    }

    function prizeBadges(card){
        const badges=[];
        if(card?.joker) badges.push('<span class="spx-if-joker-sealed">🃏 ZAPIECZĘTOWANY JOKER</span>');
        if(typeof getRocketBombTrapForCard==="function" && getRocketBombTrapForCard(card)){
            badges.push('<span class="spx-if-bomb-sealed">💣 ŁADUNEK ROCKETA W DEPOZYCIE</span>');
        }
        return badges.join("");
    }

    function cardChoiceMarkup(card,options={}){
        const selected=options.selected?" is-selected":"";
        const stake=options.isStake?" is-stake":"";
        return `<button class="spx-if-choice-card${selected}${stake}" type="button" data-instance-id="${escapeText(card?.instanceId||"")}" data-card-name="${escapeText(card?.name||"")}">
            <em>${escapeText(options.label||"KARTA K’UN-LUN")}</em>
            <strong>${escapeText(card?.name||"Nieznana karta")}</strong>
            <small>${escapeText(card?.cost??0)} KOSZT • ${escapeText(card?.power??0)} SIŁA</small>
        </button>`;
    }

    function start(playerName){
        ensureInterface();
        const check=engine?.preflight?.(playerName);
        if(!check?.ok){notify("BRAMA K’UN-LUN ZAMKNIĘTA",check?.reason||"Nie można teraz ogłosić Wyzwania.");return false;}
        resetState(false);
        state.active=true;state.phase="prize";state.playerName=check.playerName;state.playerIndex=check.playerIndex;
        state.eligiblePrizeCards=new Set(check.prizeCards);
        const hud=document.getElementById("spxIronFistHud");
        if(hud){
            hud.querySelector("#spxIronFistHudTitle").textContent="WSKAŻ SMOCZĄ NAGRODĘ";
            hud.querySelector("#spxIronFistHudText").textContent=flowText(`${check.playerName}: wybierz dostępną kartę z otwartej paczki. Shou-Lao wykradnie ją z draftu i zapieczętuje nad areną.`,`${check.playerName}: wybierz dostępną kartę z aktualnego nurtu. Shou-Lao wyrwie ją z Prądu i zapieczętuje nad areną; jej miejsce natychmiast wypełni dopływ.`);
            hud.hidden=false;
        }
        showScroll("Shou-Lao otwiera bramy",`Iron Fist ${check.playerName} może rzucić Wyzwanie w tej chwili — niezależnie od tego, czyja trwa tura.`,"挑戰");
        showPack?.(false);
        return true;
    }

    function afterPackRendered(){
        document.querySelectorAll("#pack [data-pack-index]").forEach(element=>{
            element.classList.remove("spx-if-prize-candidate");
            element.querySelectorAll(".spx-if-prize-marker,.spx-if-prize-marker-label").forEach(marker=>marker.remove());
        });
        if(!state.active || state.phase!=="prize") return;
        (currentPack||[]).forEach((card,packIndex)=>{
            if(!state.eligiblePrizeCards.has(card)) return;
            const element=document.querySelector(`#pack [data-pack-index="${packIndex}"]`);
            if(!element) return;
            element.classList.add("spx-if-prize-candidate");
            element.title="IRON FIST: Shou-Lao wykradnie tę kartę jako Smoczą Nagrodę";
            const marker=document.createElement("img");
            marker.className="spx-if-prize-marker";marker.src=EMBLEM;marker.alt="";marker.setAttribute("aria-hidden","true");
            const label=document.createElement("span");
            label.className="spx-if-prize-marker-label";label.textContent=card.joker?"ZAPIECZĘTOWANY JOKER • SMOCZA NAGRODA":"SMOCZA NAGRODA";
            element.append(marker,label);
        });
    }

    function handlePackCardClick(packIndex,card){
        if(!state.active) return false;
        if(state.phase!=="prize") return true;
        if(!state.eligiblePrizeCards.has(card)){
            showScroll("Nagroda odrzucona",flowText("Ta karta jest zabezpieczona i Shou-Lao nie może wyrwać jej z paczki.","Ta karta jest zabezpieczona i Shou-Lao nie może wyrwać jej z nurtu."),"封");
            return true;
        }
        state.selectedPrize=card;state.phase="prize_confirm";
        const hud=document.getElementById("spxIronFistHud");if(hud) hud.hidden=true;
        renderPrizeConfirm();
        return true;
    }

    function renderPrizeConfirm(){
        const card=state.selectedPrize;if(!card) return;
        const publicCard=publicPackCardSnapshot(card);
        const hiddenByMysterio=isMysterioIllusion(card);
        const identityBadges=hiddenByMysterio
            ? '<span class="spx-if-joker-sealed">🔮 TOŻSAMOŚĆ UKRYTA PRZEZ MYSTERIO</span>'
            : prizeBadges(card);
        setArenaMode(false);showOverlay();
        setHeader("IRON FIST • SMOCZA NAGRODA","CZY PRZYJMUJESZ WYZWANIE?","Shou-Lao czeka na Twoją decyzję.");
        document.getElementById("spxIronFistStage").innerHTML=`
            ${scrollMarkup("🐉 OSTATNIA SZANSA NA ODWRÓT",`Po wykradzeniu Smoczej Nagrody turniej trzeba dokończyć.`,"龍","賞")}
            <div class="spx-if-prize-confirm">
                <article class="spx-if-prize-card" data-card-name="${escapeText(publicCard?.name||"Iluzja")}">
                    <img src="${EMBLEM}" alt=""><strong>${escapeText(publicCard?.name||"Iluzja")}</strong>
                    <span>${escapeText(publicCard?.cost??"?")} KOSZT • ${escapeText(publicCard?.power??"?")} SIŁA</span>${identityBadges}
                </article>
                <div class="spx-if-prize-explain"><b>${engine.preflight(state.playerName)?.opponentCount===1?"Shou-Lao przyzwie jedynego rywala.":"Shou-Lao wylosuje dwóch kwalifikujących się rywali."}</b><br>Iron Fist wybierze zakład z całego dostępnego decku; każdy przeciwnik wskaże jedną z dwóch kart. Pierwszy wojownik z dwoma punktami zdobędzie nagrodę. Po wszystkim draft wróci dokładnie do przerwanego wyboru.</div>
            </div>`;
        setActions({
            primaryText:"POZWÓL SHOU-LAO WYKRAŚĆ KARTĘ",secondaryText:flowText("WRÓĆ DO PACZKI","WRÓĆ DO NURTU"),
            onPrimary:confirmPrize,onSecondary:cancelPrizeConfirm,
            status:"To ostatni moment na wycofanie się bez zużycia Supermocy."
        });
    }

    function cancelPrizeConfirm(){
        if(state.phase!=="prize_confirm") return;
        state.phase="prize";state.selectedPrize=null;hideOverlay();
        const hud=document.getElementById("spxIronFistHud");if(hud) hud.hidden=false;
    }

    function confirmPrize(){
        const result=engine?.prepareChallenge?.({playerName:state.playerName,prizeCard:state.selectedPrize});
        if(!result?.ok){
            notify("SHOU-LAO COFNĄŁ WYZWANIE",result?.reason||"Nie udało się przygotować areny.");
            if(result?.rolledBack) resetState(true);
            return;
        }
        state.phase="stakes";state.stakeCursor=0;state.selectedStakeId="";
        showPack?.(false);showDecks?.();
        showScroll("Karta została wykradziona",flowText(`${state.selectedPrize.name} zniknęła z paczki i czeka w zapieczętowanym depozycie K’un-Lun.`,`${state.selectedPrize.name} została wyrwana z nurtu i czeka w zapieczętowanym depozycie K’un-Lun. Nowa karta już napłynęła na jej miejsce.`),"龍");
        renderStakeSelection();
    }

    function renderStakeSelection(){
        const tournament=engine.getSession();
        const participant=tournament?.participants?.[state.stakeCursor];if(!participant) return;
        state.phase="stakes";setArenaMode(false);
        setHeader("K’UN-LUN • CEREMONIA ZAKŁADÓW","ZŁÓŻ KARTĘ NA SZALI",`Etap ${state.stakeCursor+1} z ${tournament.participants.length} • ${participant.playerName}`);
        const hostCopy=participant.isHost
            ?"Iron Fist sam wybiera dostępną kartę z całego decku. W razie zwycięstwa zakład wróci."
            :"Shou-Lao wylosował dwie dostępne karty. Wskaż jedną, którą stawiasz na szali. Odblokowany Brzuch Dino może wystawić zdobycz bez zmiany rozmiaru decku.";
        document.getElementById("spxIronFistStage").innerHTML=`
            ${scrollMarkup(`${participant.playerName}, wybierz swój zakład`,hostCopy,"契","武")}
            <div class="spx-if-stake-meta">
                <span class="spx-if-chip"><img src="${EMBLEM}" alt=""> NAGRODA: ${escapeText(tournament.prizeCard?.name||"")}</span>
                ${prizeBadges(tournament.prizeCard)}
                <span class="spx-if-chip">UCZESTNIK ${state.stakeCursor+1}/${tournament.participants.length}</span>
                ${participant.isHost?'<span class="spx-if-chip is-host-chip">GOSPODARZ • PEŁNY WYBÓR</span>':''}
                ${participant.protectedStakeCount>0?'<span class="spx-if-chip">AKTYWNE TARCZE CAPA NIE TRAFIAJĄ NA SZALĘ</span>':''}
                ${participant.dinoBellyStakeIds?.length?'<span class="spx-if-chip">🦖 BRZUCH DINO • UŻYCIE DODA +3 DO KOLEJKI</span>':''}
            </div>
            <div class="spx-if-choice-grid${participant.isHost?" is-host-deck":""}">${participant.stakeOptions.map(card=>cardChoiceMarkup(card,{
                selected:String(card.instanceId)===state.selectedStakeId,
                label:participant.dinoBellyStakeIds?.includes(String(card.instanceId||""))
                    ?"BRZUCH DINO • STAWKA +3"
                    :participant.isHost?"ZAKŁAD IRON FISTA":"JEDNA Z DWÓCH STAWEK"
            })).join("")}</div>`;
        const stage=document.getElementById("spxIronFistStage");
        stage.querySelectorAll(".spx-if-choice-card").forEach(button=>button.addEventListener("click",()=>{
            state.selectedStakeId=button.dataset.instanceId;renderStakeSelection();
        }));
        setActions({
            primaryText:state.stakeCursor===tournament.participants.length-1?"ZAMKNIJ WSZYSTKIE ZAKŁADY":"ZŁÓŻ ZAKŁAD",
            primaryDisabled:!state.selectedStakeId,onPrimary:confirmStake,
            status:"Zakład opuści deck dopiero po zatwierdzeniu zwoju."
        });
        showOverlay();
    }

    function confirmStake(){
        const tournament=engine.getSession();
        const participant=tournament?.participants?.[state.stakeCursor];
        const result=engine.chooseStake(participant.playerIndex,state.selectedStakeId);
        if(!result?.ok){notify("ZAKŁAD ODRZUCONY",result?.reason||"Wybierz inną kartę.");return;}
        state.stakeCursor+=1;state.selectedStakeId="";
        if(state.stakeCursor<tournament.participants.length){
            showScroll("Zwój przechodzi dalej",`${tournament.participants[state.stakeCursor].playerName} wybiera teraz własny zakład.`,"契");
            renderStakeSelection();return;
        }
        const locked=engine.lockStakes();
        if(!locked?.ok){notify("ARENA ZOSTAŁA COFNIĘTA",locked?.reason||"Nie udało się zamknąć zakładów.");resetState(true);return;}
        state.phase="countdown";state.lastRound=null;state.awaitingAdvance=false;showDecks?.();
        showScroll("Zakłady zapieczętowane","Ceremonia dobiegła końca. Wojownicy wchodzą na prawdziwą arenę K’un-Lun.","武");
        runArenaCountdown();
    }

    function runArenaCountdown(){
        setArenaMode(true);showOverlay();
        setHeader("K’UN-LUN • BRAMY ARENY","WOJOWNICY, GOTOWI?","Atrament Shou-Lao odlicza wejście na arenę.");
        const values=["3","2","1","WALCZ!"];
        let cursor=0;
        const tick=()=>{
            document.getElementById("spxIronFistStage").innerHTML=`<section class="spx-if-countdown"><span>武</span><strong>${values[cursor]}</strong><em>龍</em></section>`;
            setActions({status:"Smocza Nagroda pozostaje zapieczętowana nad areną."});
            cursor+=1;
            if(cursor<values.length){state.countdownTimer=setTimeout(tick,620);return;}
            state.countdownTimer=setTimeout(()=>{state.phase="arena";renderArena();},520);
        };
        tick();
    }

    function scoreMarkup(score){
        return `<span class="spx-if-point${score>=1?" is-earned":""}"></span><span class="spx-if-point${score>=2?" is-earned":""}"></span>`;
    }

    function participantIconMarkup(participant){
        return participant.powerIcon
            ?`<img src="${escapeText(participant.powerIcon)}" alt="">`
            :`<span>${escapeText(participant.powerEmoji||"⚡")}</span>`;
    }

    function renderArena(){
        const tournament=engine.getSession();
        const round=state.lastRound;
        setArenaMode(true);
        setHeader(`SHOU-LAO • ARENA ${tournament.participants.length===2?"DWÓCH":"TRZECH"} WOJOWNIKÓW`,"WALKA O SMOCZĄ NAGRODĘ","Każda runda odsłania inną kartę i porównuje bazową Siłę. Tylko gospodarz otrzymuje +1 Chi.");
        const fighters=tournament.participants.map(participant=>{
            const reveal=round?.reveals?.find(entry=>entry.playerIndex===participant.playerIndex);
            const winner=round?.winnerPlayerIndex===participant.playerIndex;
            return `<article class="spx-if-fighter seat-${participant.seatIndex}${participant.isHost?" is-host":""}${winner?" is-round-winner":""}" style="--spx-player:${escapeText(participant.playerColor)}">
                <div class="spx-if-fighter-head">
                    <span class="spx-if-player-power">${participantIconMarkup(participant)}</span>
                    <div><strong class="spx-if-fighter-name">${escapeText(participant.playerName)}</strong>
                    <span class="spx-if-fighter-role">${participant.isHost?"GOSPODARZ K’UN-LUN • +1 CHI":escapeText(participant.powerName||"WOJOWNIK K’UN-LUN")}</span></div>
                    <div class="spx-if-points">${scoreMarkup(participant.score)}</div>
                </div>
                ${reveal?`<div class="spx-if-warrior-card" data-card-name="${escapeText(reveal.card?.name||"")}">
                    <em>WOJOWNIK RUNDY ${round.roundNumber}</em><strong>${escapeText(reveal.card?.name||"")}</strong>
                    <span class="spx-if-warrior-power">${reveal.basePower} SIŁY ${reveal.chiBonus?`<b class="spx-if-chi">+ ${reveal.chiBonus} CHI = ${reveal.totalPower}</b>`:""}</span>
                </div>`:'<div class="spx-if-warrior-card is-sealed"><em>ZWÓJ ZAPIECZĘTOWANY</em><strong>?</strong><span class="spx-if-warrior-power">CZEKA NA RUNDĘ</span></div>'}
                <div class="spx-if-stake-slot">NA SZALI: <b>${escapeText(participant.stakeCard?.name||"ukryty")}</b></div>
            </article>`;
        }).join("");
        const banner=round
            ?`<div class="spx-if-round-banner"><strong>${escapeText(round.winnerName)} ZDOBYWA PUNKT</strong><span>${round.shouLaoTieBreak?"Najwyższy remis Shou-Lao rozstrzygnął uczciwym losowaniem.":`Najwyższy wynik rundy: ${round.highestPower}.`}</span></div>`
            :`<div class="spx-if-round-banner"><strong>RUNDA ${tournament.rounds.length+1}</strong><span>Odsłoń jednocześnie wszystkich wojowników tej rundy.</span></div>`;
        document.getElementById("spxIronFistStage").innerHTML=`<section class="spx-if-arena seats-${tournament.participants.length}">
            <img class="spx-if-arena-dragon" src="draft-assets/ironfist_shoulao_dragon.png" alt="" aria-hidden="true">
            <article class="spx-if-arena-prize"><img src="${EMBLEM}" alt=""><div><span>SMOCZA NAGRODA</span><strong>${escapeText(tournament.prizeCard?.name||"")}</strong>${prizeBadges(tournament.prizeCard)}</div></article>
            <div class="spx-if-round-counter">RUNDA ${Math.max(1,tournament.rounds.length+(state.awaitingAdvance?0:1))} • PIERWSZY DO 2</div>
            <div class="spx-if-arena-stations">${fighters}</div>${banner}
        </section>`;
        if(state.awaitingAdvance){
            setActions({
                primaryText:tournament.winnerIndex!==null?"OGŁOŚ ZWYCIĘZCĘ":"PRZYGOTUJ NASTĘPNĄ RUNDĘ",
                onPrimary:()=>{
                    if(tournament.winnerIndex!==null){beginWinnerResolution();return;}
                    state.lastRound=null;state.awaitingAdvance=false;renderArena();
                },
                status:tournament.winnerIndex!==null?`${tournament.participants.find(entry=>entry.playerIndex===tournament.winnerIndex)?.playerName} zdobył dwa punkty.`:"Wynik zostaje na ekranie, dopóki ręcznie nie przejdziesz dalej."
            });
        }else{
            setActions({
                primaryText:`ROZPOCZNIJ RUNDĘ ${tournament.rounds.length+1}`,onPrimary:playRound,
                status:"Przy najwyższym remisie każdy związany wojownik ma dokładnie taką samą szansę w losowaniu Shou-Lao."
            });
        }
        showOverlay();
    }

    function playRound(){
        const result=engine.playRound();
        if(!result?.ok){notify("RUNDA ZATRZYMANA",result?.reason||"Nie udało się odsłonić wojowników.");return;}
        state.lastRound=result.round;state.awaitingAdvance=true;
        showScroll(`Punkt dla ${result.round.winnerName}`,result.round.shouLaoTieBreak?"Najwyższy remis rozstrzygnęło równe losowanie Shou-Lao.":`Wynik ${result.round.highestPower} zwycięża w tej rundzie.`,"武");
        renderArena();
    }

    function beginWinnerResolution(){
        const tournament=engine.getSession();
        const winner=tournament.participants.find(entry=>entry.playerIndex===tournament.winnerIndex);
        state.phase="winner_resolution";state.lastRound=null;state.awaitingAdvance=false;setArenaMode(false);
        setHeader("K’UN-LUN • WERDYKT SHOU-LAO","ZWYCIĘZCA ZOSTAŁ WYBRANY",`${winner.playerName} zdobywa prawo do Smoczej Nagrody.`);
        document.getElementById("spxIronFistStage").innerHTML=`
            ${scrollMarkup(`${winner.playerName} zwycięża`,`${tournament.prizeCard.name} opuści depozyt i zastąpi jedną kartę w decku zwycięzcy.`,"勝","龍")}
            <div class="spx-if-result-hero"><img src="${EMBLEM}" alt=""><h3>${escapeText(winner.playerName)}</h3>
            <p>${tournament.prizeCard?.joker?"Smocza Nagroda jest zapieczętowanym Jokerem. Dopiero teraz może odsłonić prawdziwą postać.":"Wskaż kartę, która ustąpi miejsca nagrodzie."}</p>${prizeBadges(tournament.prizeCard)}</div>`;
        if(tournament.prizeCard?.joker){
            setActions({primaryText:"OTWÓRZ ZAPIECZĘTOWANEGO JOKERA",onPrimary:resolvePrizeJoker,status:"Joker pozostał zamknięty przez cały turniej."});
        }else{
            state.resolvedPrizeCard=tournament.prizeCard;
            setActions({primaryText:"WYBIERZ KARTĘ DO WYMIANY",onPrimary:renderWinnerSwap,status:"Zakład zwycięzcy wróci przed wymianą."});
        }
    }

    function resolvePrizeJoker(){
        const tournament=engine.getSession();hideOverlay();
        const opened=window.JokerV2UI?.resolveForEffect?.(tournament.prizeCard,{
            playerIndex:tournament.winnerIndex,sourceZone:"tournamentEscrow",sourcePowerId:"iron_fist",sourceEvent:"dragon_prize_joker_resolution",
            onResolve:card=>{state.resolvedPrizeCard={...card};showOverlay();showScroll("Joker odsłonił nagrodę",`${card.name} jest prawdziwą postacią Smoczej Nagrody.`,"龍");renderWinnerSwap();},
            onCancel:()=>{showOverlay();showScroll("Pieczęć pozostaje zamknięta","Turniej musi zostać rozstrzygnięty. Otwórz Jokera ponownie.","封");beginWinnerResolution();}
        });
        if(!opened){showOverlay();notify("JOKER NIE MA DOSTĘPNEJ POSTACI","Shou-Lao nie znalazł karty dla zwycięzcy.");beginWinnerResolution();}
    }

    function renderWinnerSwap(){
        const prepared=engine.preparePrizeResolution(state.resolvedPrizeCard);
        if(!prepared?.ok){notify("NAGRODA ZABLOKOWANA",prepared?.reason||"Nie udało się przygotować wymiany.");return;}
        state.phase="winner_swap";setArenaMode(false);
        setHeader("SMOCZA NAGRODA • WYMIANA","ZWYCIĘZCA WYBIERA CENĘ",`${prepared.winner.playerName}: wybierz jedną kartę własnego decku lub odzyskany zakład.`);
        document.getElementById("spxIronFistStage").innerHTML=`
            ${scrollMarkup("Karta za kartę",prepared.forcedDuplicateReplacement?`${prepared.resolvedPrizeCard.name} jest już w Twoim decku — musi ustąpić nowej Nagrodzie.`:`${prepared.resolvedPrizeCard.name} zastąpi dokładnie jedną kartę zwycięzcy.`,"賞","換")}
            <div class="spx-if-stake-meta"><span class="spx-if-chip"><img src="${EMBLEM}" alt=""> NAGRODA: ${escapeText(prepared.resolvedPrizeCard.name)}</span>${prizeBadges(prepared.prizeCard)}<span class="spx-if-chip">ZWYCIĘZCA: ${escapeText(prepared.winner.playerName)}</span></div>
            <div class="spx-if-swap-grid">${prepared.candidates.map(card=>cardChoiceMarkup(card,{
                selected:String(card.instanceId)===state.selectedSwapId,isStake:card===prepared.winner.stakeCard,
                label:card===prepared.winner.stakeCard?"ODZYSKANY ZAKŁAD":"KARTA ZWYCIĘZCY"
            })).join("")}</div>`;
        const stage=document.getElementById("spxIronFistStage");
        stage.querySelectorAll(".spx-if-choice-card").forEach(button=>button.addEventListener("click",()=>{state.selectedSwapId=button.dataset.instanceId;renderWinnerSwap();}));
        setActions({
            primaryText:"ZAPŁAĆ I ODBIERZ NAGRODĘ",primaryDisabled:!state.selectedSwapId,onPrimary:confirmWinnerSwap,
            status:prepared.forcedDuplicateReplacement?"Ta karta jest już w Twoim decku — musi ustąpić nowej Nagrodzie.":"Deck zachowa swój rozmiar."
        });
        showOverlay();
    }

    function confirmWinnerSwap(){
        const chosen=engine.chooseWinnerSwap(state.selectedSwapId);
        if(!chosen?.ok){notify("WYMIANA ODRZUCONA",chosen?.reason||"Wybierz inną kartę.");return;}
        const tournament=engine.getSession();
        if(tournament.winnerIndex!==tournament.ownerIndex){
            const consolation=engine.getConsolationOptions();
            if(!consolation?.ok){notify("BRAK ŁASKI SHOU-LAO",consolation?.reason||"Nie udało się przygotować kart.");return;}
            renderConsolation(consolation.options);return;
        }
        commitPrimaryPrize();
    }

    function renderConsolation(options){
        const tournament=engine.getSession();
        const owner=tournament.participants.find(entry=>entry.playerIndex===tournament.ownerIndex);
        state.phase="consolation";setArenaMode(false);
        setHeader("SHOU-LAO • ŁASKA DLA GOSPODARZA","IRON FIST WYBIERA JEDNĄ Z TRZECH DRÓG","Przegrany zakład nie wróci, ale Nieśmiertelny Smok pozwala wybrać jego następcę.");
        document.getElementById("spxIronFistStage").innerHTML=`
            ${scrollMarkup("Łaska Shou-Lao",`${owner.stakeCard.name} zostanie przelosowany. Iron Fist jako jedyny sam wybierze zamiennik z trzech kart.`,"敗","道")}
            <div class="spx-if-choice-grid">${options.map(card=>cardChoiceMarkup(card,{selected:card.name===state.selectedConsolationName,label:"ŁASKA SHOU-LAO"})).join("")}</div>`;
        const stage=document.getElementById("spxIronFistStage");
        stage.querySelectorAll(".spx-if-choice-card").forEach(button=>button.addEventListener("click",()=>{state.selectedConsolationName=button.dataset.cardName;renderConsolation(options);}));
        setActions({
            primaryText:"PRZYJMIJ TEN LOS",primaryDisabled:!state.selectedConsolationName,
            onPrimary:()=>{const result=engine.chooseConsolation(state.selectedConsolationName);if(!result?.ok){notify("LOS ODRZUCONY",result?.reason||"Wybierz inną kartę.");return;}commitPrimaryPrize();},
            status:"Pozostali przegrani otrzymają zwykłe losowe zamienniki."
        });
    }

    function commitPrimaryPrize(){
        setActions({primaryText:"SHOU-LAO PRZEKAZUJE NAGRODĘ...",primaryDisabled:true,status:"Smocza Nagroda trafia do zwycięzcy."});
        const primary=engine.commitPrimaryPrize();
        if(!primary?.ok){notify("WYZWANIE COFNIĘTE",primary?.reason||"Nagroda została cofnięta.");resetState(true);return;}
        state.primaryResult=primary;state.phase="prize_interactions";
        hideOverlay();showDecks?.();showPack?.(false);updateRoundQueueDisplay?.();
        const afterRocket=()=>afterPrimaryInteractions(primary);
        if(primary.rocketResult?.triggered && window.SuperpowerUI?.resolveRocketBomb){
            window.SuperpowerUI.resolveRocketBomb(primary.rocketResult,afterRocket);
        }else{
            afterRocket();
        }
    }

    function afterPrimaryInteractions(primary){
        if(primary.ironFistWon){
            const capture=engine.getCaptureOptions();
            if(!capture?.ok){notify("DODATKOWA NAGRODA ZABLOKOWANA",capture?.reason||"Nie udało się odczytać stawek.");engine.declineCapturedStake?.();finalizeOutcome();return;}
            if(capture.options.length){renderCaptureDecision(capture.options);return;}
        }
        finalizeOutcome();
    }

    function renderCaptureDecision(options){
        state.phase="capture_decision";setArenaMode(false);showOverlay();
        setHeader("IRON FIST • ŁUP Z ARENY","CZY PRZEJMUJESZ PRZEGRANĄ STAWKĘ?","To dobrowolna nagroda gospodarza. Smocza Nagroda jest bezpieczna, lecz Shou-Lao losowo zabierze inną kartę Iron Fista.");
        document.getElementById("spxIronFistStage").innerHTML=`
            ${scrollMarkup("Zwycięzca może sięgnąć po więcej","Wybierz jedną przegraną stawkę. Jej właściciel otrzyma losowy zamiennik, a wybrana karta zastąpi losową inną kartę w decku Iron Fista.","勝","奪")}
            <div class="spx-if-choice-grid spx-if-capture-grid">${options.map(option=>cardChoiceMarkup(option.stakeCard,{
                selected:option.instanceId===state.selectedCaptureId,label:`STAWKA GRACZA ${option.playerName}`
            })).join("")}</div>
            <div class="spx-if-risk-note"><b>OCHRONA:</b> zdobyta Smocza Nagroda nie może zostać kosztem. Odzyskany zakład Iron Fista i każda inna karta mogą zostać wylosowane.</div>`;
        const stage=document.getElementById("spxIronFistStage");
        stage.querySelectorAll(".spx-if-choice-card").forEach(button=>button.addEventListener("click",()=>{state.selectedCaptureId=button.dataset.instanceId;renderCaptureDecision(options);}));
        setActions({
            primaryText:"PRZEJMIJ STAWKĘ",primaryDisabled:!state.selectedCaptureId,
            secondaryText:"ZREZYGNUJ",onPrimary:()=>{
                const selected=engine.chooseCapturedStake(state.selectedCaptureId);
                if(!selected?.ok){notify("STAWKA ODRZUCONA",selected?.reason||"Wybierz inną stawkę.");return;}
                finalizeOutcome();
            },
            onSecondary:()=>{engine.declineCapturedStake();finalizeOutcome();},
            status:"Decyzja jest dobrowolna. Losowy koszt zostanie obliczony z aktualnego decku po rozstrzygnięciu bomby Rocketa."
        });
    }

    function playCaptainCounters(counters,done){
        if(counters?.length && window.SuperpowerUI?.playCaptainAmericaCounters) window.SuperpowerUI.playCaptainAmericaCounters(counters,done);
        else done?.();
    }

    function finalizeOutcome(){
        setActions({primaryText:"SHOU-LAO ZAMYKA TURNIEJ...",primaryDisabled:true,status:"Pozostałe stawki i kontrataki zostaną rozstrzygnięte dopiero teraz."});
        const result=engine.finalizeOutcome();
        if(!result?.ok){notify("SHOU-LAO ZAMKNĄŁ ARENĘ","Nic nie zostało zmienione.");resetState(true);return;}
        state.result=result;state.phase="counterattacks";hideOverlay();
        showDecks?.();showPack?.(false);updateRoundQueueDisplay?.();
        playCaptainCounters(result.counterattacks,()=>showFinalSummary(result));
    }

    function showFinalSummary(result){
        state.active=true;state.phase="summary";setArenaMode(false);
        setHeader("K’UN-LUN • OSTATECZNY WERDYKT","ZWÓJ WYNIKÓW",`${result.winnerName} opuszcza arenę ze Smoczą Nagrodą.`);
        const rows=[
            `<div class="spx-if-ledger-row"><b>ZWYCIĘZCA</b><span>${escapeText(result.winnerName)}</span><em>2 PUNKTY</em></div>`,
            `<div class="spx-if-ledger-row"><b>SMOCZA NAGRODA</b><span>${escapeText(result.winnerRemovedCard?.name||"")} → ${escapeText(result.prizeCard?.name||"")}</span><em>ZDOBYTA</em></div>`,
            ...(result.captureResult?[`<div class="spx-if-ledger-row is-capture"><b>DODATKOWA STAWKA</b><span>${escapeText(result.captureResult.hostCostCard?.name||"")} → ${escapeText(result.captureResult.capturedCard?.name||"")}</span><em>PRZEJĘTA</em></div>`]:[]),
            ...result.losses.map(loss=>`<div class="spx-if-ledger-row"><b>${escapeText(loss.participant.playerName)}</b><span>${escapeText(loss.removedCard.name)} → ${escapeText(loss.replacementCard.name)}</span><em>${loss.captured?"STAWKA PRZEJĘTA":"ZAKŁAD PRZEGRANY"}</em></div>`)
        ];
        document.getElementById("spxIronFistStage").innerHTML=`
            <img class="spx-if-payout-dragon" src="draft-assets/ironfist_shoulao_dragon.png" alt="" aria-hidden="true">
            ${scrollMarkup(`${result.winnerName} zwycięża w K’un-Lun`,result.ironFistWon?(result.captureResult?"Iron Fist zdobył Smoczą Nagrodę i odważył się przejąć dodatkową stawkę.":"Iron Fist zdobył Smoczą Nagrodę i pozwolił pozostałym stawkom odejść."):"Smocza Nagroda trafiła do rywala, a Shou-Lao obdarzył Iron Fista jedną z trzech dróg.","勝","龍")}
            <div class="spx-if-ledger">${rows.join("")}</div>
            `;
        setActions({primaryText:"ZWIŃ ZWÓJ I WRÓĆ DO DRAFTU",onPrimary:finish,status:"Po zamknięciu zwoju draft ruszy dalej."});
        showOverlay();showScroll("Wyzwanie zakończone",`${result.winnerName} zdobywa ${result.prizeCard?.name||"Smoczą Nagrodę"}.`,"勝",5600);
        showDecks?.();showPack?.(false);
    }

    function finish(){
        engine.finish();resetState(true);showDecks?.();showPack?.(false);updateRoundQueueDisplay?.();window.GraveyardUI?.refreshButton?.();
    }

    function cancel(options={}){
        if(!state.active) return true;
        if(!["prize","prize_confirm"].includes(state.phase) && !options.force){
            showScroll("Brama pozostaje zamknięta","Po wykradzeniu Smoczej Nagrody Wyzwanie musi zostać doprowadzone do końca.","封");
            return false;
        }
        if(options.force && engine.isBusy()) engine.rollback("forced_ui_cancel");
        resetState(true);showPack?.(false);showDecks?.();window.GraveyardUI?.refreshButton?.();return true;
    }

    function resetState(hide=true){
        clearTimeout(state.scrollTimer);clearTimeout(state.countdownTimer);
        Object.assign(state,{
            active:false,phase:"idle",playerName:"",playerIndex:-1,eligiblePrizeCards:new Set(),selectedPrize:null,
            selectedStakeId:"",stakeCursor:0,selectedSwapId:"",selectedConsolationName:"",selectedCaptureId:"",
            resolvedPrizeCard:null,lastRound:null,awaitingAdvance:false,primaryResult:null,result:null,
            primaryAction:null,secondaryAction:null,scrollTimer:null,countdownTimer:null
        });
        document.querySelectorAll(".spx-if-prize-marker,.spx-if-prize-marker-label").forEach(element=>element.remove());
        document.querySelectorAll(".spx-if-prize-candidate").forEach(element=>element.classList.remove("spx-if-prize-candidate"));
        setArenaMode(false);
        if(hide){
            hideOverlay();
            const hud=document.getElementById("spxIronFistHud");const scroll=document.getElementById("spxIronFistScrollToast");
            if(hud) hud.hidden=true;if(scroll) scroll.hidden=true;
        }
    }

    function getLockReason(){
        if(!state.active && !engine.isBusy()) return "";
        if(["prize","prize_confirm"].includes(state.phase)) return "Najpierw wybierz Smoczą Nagrodę albo zwiń zwój Iron Fista.";
        if(state.phase==="summary") return "Zwiń końcowy zwój Wyzwania K’un-Lun.";
        return "Dokończ niepodzielne Wyzwanie K’un-Lun.";
    }

    return {
        start,cancel,afterPackRendered,handlePackCardClick,
        handleDeckCardClick:()=>Boolean(state.active||engine.isBusy()),
        isBusy:()=>Boolean(state.active||engine.isBusy()),getLockReason
    };
})();

window.IronFistUI=IronFistUI;
