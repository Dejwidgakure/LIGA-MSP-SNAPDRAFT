// =============================
// JEFF ENGINE 5.1 – CALM REACTIVE
// =============================

document.addEventListener("DOMContentLoaded", () => {

    const JEFF_SIZE = 130;
    const BASE_SPEED = 2.4;
    const MAX_SPEED = 3;
    // HOTFIX: transient visual FX must never run for the whole draft.
    const TRAIL_INTERVAL = 140;
    const TRAIL_LIFETIME_MS = 2800;
    const MAX_TRANSIENT_FX = 24;
    const BURST_COOLDOWN_MS = 900;

    const jeffImages = [
        "draft-assets/jeff_love.png",
        "draft-assets/jeff_normal.png",
        "draft-assets/jeff_shocked.png",
        "draft-assets/jeff_angry.png",
        "draft-assets/jeff_thinking.png",
        "draft-assets/jeff_sleepy.png"
    ];

    // Preload every face once so a state change cannot briefly flash / collapse
    // while the next PNG is being decoded.
    if(typeof Image!=="undefined"){
        jeffImages.forEach(src=>{
            const image=new Image();
            image.decoding="async";
            image.src=src;
        });
    }

    const jeffLayer = document.createElement("div");
    jeffLayer.id = "jeffLayer";
    document.body.appendChild(jeffLayer);

    const style = document.createElement("style");
    style.innerHTML = `
        #jeffLayer {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 2;
        }

        .jeff {
            position: absolute;
            width: ${JEFF_SIZE}px;
            will-change: transform;
            transform-origin: 50% 58%;
            image-rendering: auto;
            backface-visibility: hidden;
        }

        .jeffTrail, .jeffBurst {
            position: absolute;
            border-radius: 50%;
            pointer-events: none;
        }

        .jeffZ {
            position: absolute;
            color: #9fd3ff;
            font-family: 'Orbitron', sans-serif;
            font-size: 14px;
            pointer-events: none;
            opacity: 0.8;
        }
    `;
    document.head.appendChild(style);

    const jeff = document.createElement("img");
    jeff.className = "jeff";
    jeff.src = jeffImages[1];
    jeffLayer.appendChild(jeff);

    let x = 300;
    let y = 200;
    let vx = BASE_SPEED;
    let vy = BASE_SPEED * 0.9;
    let rotation = 0;
    let targetRotation = 0;

    let lastFaceIndex = 1;
    let lastTrailTime = 0;
    let lastBurstTime = 0;
    let fxStartedAt = performance.now();
    let trailFinished = false;
    let lastUserAction = Date.now();

    window.setJeffState = function(state){

        const states = {
            love: 0,
            normal: 1,
            shocked: 2,
            angry: 3,
            thinking: 4,
            sleepy: 5
        };

        if(states[state] !== undefined){
            setFace(states[state]);
            lastUserAction = Date.now();
        }
    };

    function setFace(index){
        if(index === lastFaceIndex) return;
        lastFaceIndex = index;
        jeff.src = jeffImages[index];
    }

    function randomBounceFace(){

        let newIndex;

        do {
            newIndex = Math.floor(Math.random() * jeffImages.length);
        } while (newIndex === lastFaceIndex);

        setFace(newIndex);
    }

    // =============================
    // 💤 IDLE SYSTEM (FIXED)
    // =============================
    function resetIdle(){
        lastUserAction = Date.now();
    }

    // ❗ USUNIĘTY mousemove
    ["click","keydown","touchstart"].forEach(e=>{
        document.addEventListener(e, resetIdle);
    });

    function checkIdle(){

        const idleTime = Date.now() - lastUserAction;

        if(idleTime > 50000){
            if(lastFaceIndex !== 5){
                setFace(5);
            }
            return;
        }

        if(idleTime > 10000){
            if(lastFaceIndex !== 4){
                setFace(4);
            }
        }
    }

    function currentTrailColors() {
        if (lastFaceIndex === 3) {
            return ["#ff3b3b", "#ff6b6b", "#ff0000"];
        }
        return ["white", "#9fd3ff", "#caa6ff", "#fff3a1"];
    }

    function trimTransientFx(){
        const nodes = jeffLayer.querySelectorAll(".jeffTrail, .jeffBurst, .jeffZ");
        if(nodes.length <= MAX_TRANSIENT_FX) return;
        const overflow = nodes.length - MAX_TRANSIENT_FX;
        for(let i=0;i<overflow;i++) nodes[i]?.remove();
    }

    function stopTrailFx(){
        if(trailFinished) return;
        trailFinished = true;
        jeffLayer.querySelectorAll(".jeffTrail").forEach(node=>node.remove());
    }

    function spawnTrail(timestamp){

        if(trailFinished) return;
        if(timestamp - fxStartedAt >= TRAIL_LIFETIME_MS){
            stopTrailFx();
            return;
        }
        if(timestamp - lastTrailTime < TRAIL_INTERVAL) return;
        lastTrailTime = timestamp;

        const colors = currentTrailColors();
        const star = document.createElement("div");
        star.className = "jeffTrail";

        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 2.2 + 1.8;

        star.style.width = size+"px";
        star.style.height = size+"px";
        star.style.background = color;
        star.style.boxShadow = `0 0 ${size*5}px ${color}`;
        star.style.left = (x + JEFF_SIZE*0.4 + (Math.random()*18-9))+"px";
        star.style.top = (y + JEFF_SIZE*0.7 + (Math.random()*18-9))+"px";

        jeffLayer.appendChild(star);
        trimTransientFx();

        star.animate(
            [
                {opacity:.9, transform:"scale(.9)"},
                {opacity:0, transform:"scale(.25)"}
            ],
            {duration:420, easing:"ease-out"}
        );

        setTimeout(()=>star.remove(),450);
    }

    function spawnBurst(){

        const now = performance.now();
        if(now - lastBurstTime < BURST_COOLDOWN_MS) return;
        lastBurstTime = now;

        const colors = currentTrailColors();

        for(let i=0;i<6;i++){

            const particle = document.createElement("div");
            particle.className = "jeffBurst";

            const color = colors[Math.floor(Math.random()*colors.length)];
            const size = Math.random()*6+4;

            particle.style.width=size+"px";
            particle.style.height=size+"px";
            particle.style.background=color;

            particle.style.boxShadow = `
                0 0 ${size*8}px ${color},
                0 0 ${size*14}px ${color}
            `;

            const centerX = x + JEFF_SIZE/2;
            const centerY = y + JEFF_SIZE/2;

            particle.style.left=centerX+"px";
            particle.style.top=centerY+"px";

            const angle = Math.random()*Math.PI*2;
            const distance = Math.random()*80+40;

            const dx = Math.cos(angle)*distance;
            const dy = Math.sin(angle)*distance;

            jeffLayer.appendChild(particle);

            particle.animate(
                [
                    {transform:"translate(0,0)", opacity:1},
                    {transform:`translate(${dx}px,${dy}px)`, opacity:0}
                ],
                {duration:700, easing:"ease-out"}
            );

            setTimeout(()=>particle.remove(),700);
        }
        trimTransientFx();
    }

    function spawnZ(){

        const z = document.createElement("div");
        z.className = "jeffZ";
        z.innerText = "Z";

        z.style.left = (x + JEFF_SIZE*0.6)+"px";
        z.style.top = (y + 10)+"px";

        jeffLayer.appendChild(z);

        z.animate(
            [
                {transform:"translateY(0)", opacity:0},
                {transform:"translateY(-40px)", opacity:1},
                {transform:"translateY(-80px)", opacity:0}
            ],
            {duration:2000, easing:"ease-out"}
        );

        setTimeout(()=>z.remove(),2000);
    }

    function clampSpeed(){
        vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, vx));
        vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, vy));
    }

    function bounce(){

        const w = Math.max(JEFF_SIZE, window.innerWidth);
        const h = Math.max(JEFF_SIZE, window.innerHeight);
        const maxX = Math.max(0, w - JEFF_SIZE);
        const maxY = Math.max(0, h - JEFF_SIZE);
        let bounced = false;

        // Clamp first, then reflect only when Jeff is actually moving into the wall.
        // Without the clamp the old engine could invert velocity every RAF while still
        // a few pixels outside the viewport, producing the visible "trzęsienie".
        if(x < 0){
            x = 0;
            if(vx < 0) vx = Math.abs(vx);
            bounced = true;
        }else if(x > maxX){
            x = maxX;
            if(vx > 0) vx = -Math.abs(vx);
            bounced = true;
        }

        if(y < 0){
            y = 0;
            if(vy < 0) vy = Math.abs(vy);
            bounced = true;
        }else if(y > maxY){
            y = maxY;
            if(vy > 0) vy = -Math.abs(vy);
            bounced = true;
        }

        if(bounced){
            randomBounceFace();
            spawnBurst();

            // Keep a tiny organic variation, but never enough to make Jeff chatter.
            vx += (Math.random()-0.5)*0.08;
            vy += (Math.random()-0.5)*0.08;
            clampSpeed();

            // Calm directional lean; the rendered angle eases toward this target.
            targetRotation = Math.max(-7, Math.min(7, vx * 2.1));

            // ❗ USUNIĘTE:
            // lastUserAction = Date.now();
        }
    }

    function animate(timestamp){

        x += vx;
        y += vy;

        bounce();
        checkIdle();

        // No endless spin. Jeff gently eases to a small directional lean and a
        // sub-degree idle sway, so state changes remain smooth and visually calm.
        const idleSway = Math.sin(timestamp / 1250) * 0.9;
        const desiredRotation = targetRotation + idleSway;
        rotation += (desiredRotation - rotation) * 0.055;

        if(lastFaceIndex === 5 && Math.random() < 0.03){
            spawnZ();
        }

        jeff.style.transform = `
            translate3d(${x}px, ${y}px, 0)
            rotate(${rotation}deg)
        `;

        spawnTrail(timestamp);

        requestAnimationFrame(animate);
    }

    document.addEventListener("visibilitychange",()=>{
        if(document.hidden){
            jeffLayer.querySelectorAll(".jeffTrail, .jeffBurst, .jeffZ").forEach(node=>node.remove());
            stopTrailFx();
        }
    });

    // Hard stop even if RAF timing is throttled or the tab hiccups.
    setTimeout(stopTrailFx, TRAIL_LIFETIME_MS + 250);

    requestAnimationFrame(animate);
});
