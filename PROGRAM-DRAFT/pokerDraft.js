// ===============================
// 🃏 POKER DRAFT V15 CLEAN FIX
// ===============================

let pokerPlayers = [];
let pokerCurrentCard = null;
let pokerTimer = 20;
let pokerInterval = null;
let highestBid = 0;
let highestBidder = null;
let phase = "auction";
let timerPaused = false;

const STARTING_JEFFS = 5000;


// ===============================
// START
// ===============================

function startPokerDraft(){

    pokerPlayers = players.map((name,i)=>({
        name:name,
        color:playerColors[i % playerColors.length],
        deck:[],
        cosmicJeffs:STARTING_JEFFS,
        bansUsed:0,
        mood:"normal"
    }));

    decks = pokerPlayers.map(p=>p.deck);

    startAuctionRound();
}


// ===============================
// ROUND START
// ===============================

function startAuctionRound(){

    if(pokerPlayers.every(p=>p.deck.length>=12)){
        alert("Poker Draft zakończony!");
        return;
    }

    phase="auction";
    highestBid=0;
    highestBidder=null;
    pokerTimer=20;
    timerPaused=false;

    pokerPlayers.forEach(p=>p.mood="normal");

    const jokerChance=Math.random()<0.10;

    if(jokerChance){
        const j=jokers[Math.floor(Math.random()*jokers.length)];
        pokerCurrentCard={joker:true,desc:j.desc};
    } else {
        pokerCurrentCard=cardDatabase[
            Math.floor(Math.random()*cardDatabase.length)
        ];
    }

    renderAuctionUI();
    startTimer();
}


// ===============================
// TIMER
// ===============================

function startTimer(){
    clearInterval(pokerInterval);

    pokerInterval=setInterval(()=>{
        if(timerPaused||phase!=="auction")return;

        pokerTimer--;
        if(pokerTimer<0)pokerTimer=0;

        updateTimerDisplay();

        if(pokerTimer===0){
            clearInterval(pokerInterval);
            endAuctionRound();
        }

    },1000);
}

function toggleTimer(){
    timerPaused=!timerPaused;
    updateTimerDisplay();
}

function updateTimerDisplay(){
    const t=document.getElementById("timerDisplay");
    const b=document.getElementById("timerBtn");
    if(t)t.innerText=pokerTimer+"s";
    if(b)b.innerText=timerPaused?"▶":"⏸";
}


// ===============================
// BID
// ===============================

function placeBid(i,add){

    if(phase!=="auction")return;

    const p=pokerPlayers[i];
    if(p.deck.length>=12)return;
    if(add<=0)return;

    const newTotal=highestBid+add;
    if(p.cosmicJeffs<newTotal)return;

    highestBid=newTotal;
    highestBidder=i;

    if(pokerTimer<=5)pokerTimer+=6;

    updateAuctionDisplay();
    updateBidButtons();
}


// ===============================
// BAN
// ===============================

function banCard(i){

    if(phase!=="auction")return;

    const p=pokerPlayers[i];
    if(p.deck.length>=12)return;

    let cost=p.bansUsed>=1?1000:0;
    if(p.cosmicJeffs<cost)return;

    p.cosmicJeffs-=cost;
    p.bansUsed++;

    startAuctionRound();
}


// ===============================
// FORCE END
// ===============================

function forceEndAuction(){
    if(phase!=="auction")return;
    clearInterval(pokerInterval);
    endAuctionRound();
}


// ===============================
// END ROUND
// ===============================

function endAuctionRound(){

    phase="celebration";
    clearInterval(pokerInterval);

    if(highestBidder!==null){

        const winner=pokerPlayers[highestBidder];

        winner.cosmicJeffs-=highestBid;
        winner.mood="love";

        pokerPlayers.forEach((p,i)=>{
            if(i!==highestBidder)p.mood="angry";
        });

        if(pokerCurrentCard.joker){
            const chosen=prompt("JOKER! Wpisz nazwę karty:");
            if(chosen){
                const found=cardDatabase.find(c=>
                    c.name.toLowerCase()===chosen.trim().toLowerCase()
                );
                if(found)winner.deck.push(found);
            }
        } else {
            winner.deck.push(pokerCurrentCard);
        }

        animateWinner();
        triggerConfetti();
    }

    pokerPlayers.forEach((p,i)=>{
        if(i!==highestBidder)p.cosmicJeffs+=200;
    });

    showDecks();

    setTimeout(()=>{
        startAuctionRound();
    },3000);
}


// ===============================
// CONFETTI
// ===============================

function triggerConfetti(){

    const island=document.getElementById("cardIsland");
    if(!island)return;

    for(let i=0;i<60;i++){

        const piece=document.createElement("div");
        const size=4+Math.random()*6;

        piece.style.position="absolute";
        piece.style.width=size+"px";
        piece.style.height=size*2+"px";
        piece.style.background="linear-gradient(gold,#ffcc00)";
        piece.style.left=Math.random()*100+"%";
        piece.style.top="-20px";
        piece.style.opacity="1";
        piece.style.pointerEvents="none";
        piece.style.animation=`confettiFall ${1.5+Math.random()}s ease-out forwards`;

        island.appendChild(piece);
        setTimeout(()=>piece.remove(),2500);
    }
}


// ===============================
// WINNER ANIM
// ===============================

function animateWinner(){
    const el=document.getElementById("winnerDisplay");
    if(!el)return;

    el.style.transition="0.4s";
    el.style.transform="scale(1.25)";
    el.style.textShadow="0 0 40px gold";
}


// ===============================
// GLIMMERS FIXED (NO CLIPPING)
// ===============================

function createGlimmers(container){

    container.style.position="relative";
    container.style.overflow="visible";

    const layer=document.createElement("div");
    layer.style.position="absolute";
    layer.style.inset="0";
    layer.style.pointerEvents="none";
    layer.style.borderRadius="inherit";
    layer.style.overflow="hidden";

    container.appendChild(layer);

    for(let i=0;i<10;i++){

        const g=document.createElement("div");
        const size=3+Math.random()*6;

        g.style.position="absolute";
        g.style.width=size+"px";
        g.style.height=size+"px";
        g.style.borderRadius="50%";
        g.style.background="radial-gradient(gold,transparent)";
        g.style.left=Math.random()*100+"%";
        g.style.top=Math.random()*100+"%";
        g.style.opacity="0.3";
        g.style.animation=`glimmerPulse ${2+Math.random()*3}s infinite alternate`;

        layer.appendChild(g);
    }
}


// ===============================
// UI
// ===============================

function renderAuctionUI(){

    const pack=document.getElementById("pack");
    pack.innerHTML="";
    pack.style.display="grid";
    pack.style.gridTemplateColumns="1fr 2fr 1fr";
    pack.style.gap="25px";

    const left=document.createElement("div");
    const center=document.createElement("div");
    const right=document.createElement("div");

    left.style.display=right.style.display="flex";
    left.style.flexDirection=right.style.flexDirection="column";
    left.style.gap=right.style.gap="20px";

    center.id="cardIsland";
    center.style.textAlign="center";
    center.style.position="relative";

    createGlimmers(center);

    // CARD

    const cardBox=document.createElement("div");

    if(pokerCurrentCard.joker){
        cardBox.innerHTML=`
            <div class="joker-card-btn">
                <div class="joker-border">
                    <div class="joker-card">
                        <div class="joker-title">JOKER</div>
                        <div class="joker-desc">${pokerCurrentCard.desc}</div>
                    </div>
                </div>
            </div>`;
    } else {
        cardBox.innerHTML=`
            <button class="pack-card-btn">
                <div class="pack-icon pack-planet">${pokerCurrentCard.cost}</div>
                <div class="pack-card-name">${pokerCurrentCard.name}</div>
                <div class="pack-icon pack-star">${pokerCurrentCard.power}</div>
            </button>`;
    }

    center.appendChild(cardBox);

    // INFO BOX

    const island=document.createElement("div");
    island.style.marginTop="20px";
    island.style.padding="18px";
    island.style.border="2px solid gold";
    island.style.borderRadius="16px";
    island.style.background="rgba(120,0,0,0.85)";
    island.style.boxShadow="0 0 25px gold";

    createGlimmers(island);

    island.innerHTML+=`
        <div id="winnerDisplay" style="
            font-size:26px;
            font-weight:bold;
            color:gold;
            text-shadow:0 0 15px gold;
        "></div>

        <div id="bidDisplay" style="
            margin-top:10px;
            color:gold;
            font-weight:bold;
            animation:bidGlow 1.5s infinite alternate;
        "></div>

        <div style="margin-top:10px;">
            <button id="timerBtn" onclick="toggleTimer()">⏸</button>
            <span id="timerDisplay">${pokerTimer}s</span>
        </div>

        <div onclick="forceEndAuction()"
             style="margin-top:12px;cursor:pointer;color:gold;font-weight:bold;text-shadow:0 0 10px gold;">
             ZAKOŃCZ AUKCJĘ
        </div>
    `;

    center.appendChild(island);

    // PLAYERS

    pokerPlayers.forEach((p,i)=>{

        const box=document.createElement("div");
        box.style.padding="14px";
        box.style.border="2px solid gold";
        box.style.borderRadius="14px";
        box.style.background="rgba(120,0,0,0.85)";
        box.style.boxShadow="0 0 20px gold";

        createGlimmers(box);

        let jeff="draft-assets/jeff_normal.png";
        if(p.mood==="angry")jeff="draft-assets/jeff_angry.png";
        if(p.mood==="love")jeff="draft-assets/jeff_love.png";

        box.innerHTML+=`
            <div style="color:${p.color};font-weight:bold;">
                ${p.name}
            </div>

            <div style="
                font-size:20px;
                font-weight:bold;
                background:linear-gradient(#fff4a3,#d4af37,#fff4a3);
                -webkit-background-clip:text;
                -webkit-text-fill-color:transparent;
            ">
                <img src="${jeff}" style="
                    height:40px;
                    vertical-align:middle;
                    position:relative;
                    top:4px;
                    margin-right:6px;
                ">
                <span style="vertical-align:middle;">
                    ${p.cosmicJeffs} Cosmic Jeffs
                </span>
            </div>

            <div id="controls${i}"></div>
            <button onclick="banCard(${i})">BAN</button>
        `;

        if(i%2===0)left.appendChild(box);
        else right.appendChild(box);
    });

    pack.appendChild(left);
    pack.appendChild(center);
    pack.appendChild(right);

    updateAuctionDisplay();
    updateBidButtons();
}


// ===============================
// DISPLAY UPDATES
// ===============================

function updateAuctionDisplay(){
    const bid=document.getElementById("bidDisplay");
    const winner=document.getElementById("winnerDisplay");

    if(highestBidder!==null){
        winner.innerHTML=`WYGRYWA: 
        <span style="color:${pokerPlayers[highestBidder].color}">
        ${pokerPlayers[highestBidder].name}</span>`;
        bid.innerText=`Najwyższy bid: ${highestBid} Cosmic Jeffs`;
    } else {
        winner.innerText="";
        bid.innerText="Brak ofert";
    }
}

function updateBidButtons(){
    pokerPlayers.forEach((p,i)=>{
        const c=document.getElementById("controls"+i);
        if(!c)return;

        if(highestBid===0){
            c.innerHTML=`<button onclick="placeBid(${i},100)">RZUĆ 100</button>`;
        } else {
            c.innerHTML=`
                <button onclick="placeBid(${i},50)">+50</button>
                <button onclick="placeBid(${i},100)">+100</button>
                <button onclick="placeBid(${i},200)">+200</button>
                <button onclick="placeBid(${i},500)">+500</button>
                <input type="number" id="customBid${i}" placeholder="kwota">
                <button onclick="placeBid(${i}, parseInt(document.getElementById('customBid${i}').value)||0)">
                DORZUĆ</button>
            `;
        }
    });
}