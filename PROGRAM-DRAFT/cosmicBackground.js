// =============================
// PATCH 9.0 – COSMIC RICHNESS
// =============================

document.addEventListener("DOMContentLoaded", () => {

    const cosmicLayer = document.createElement("div");
    cosmicLayer.id = "cosmicBackgroundLayer";
    document.body.insertBefore(cosmicLayer, document.body.firstChild);

    const fxLayer = document.createElement("div");
    fxLayer.id = "cosmicFxLayer";
    document.body.insertBefore(fxLayer, cosmicLayer.nextSibling);

    const style = document.createElement("style");
    style.innerHTML = `
        #cosmicBackgroundLayer {
            position: fixed;
            top: 50%;
            left: 50%;
            width: 85vw;
            max-width: 1800px;
            aspect-ratio: 16/9;
            transform: translate(-50%, -50%) scale(1.05);
            background: url("draft-assets/cosmic_tlo.png") center/contain no-repeat;
            pointer-events: none;
            z-index: 0;
            opacity: 0.65;
            animation: cosmicFloat 12s ease-in-out infinite alternate;
        }

        #cosmicFxLayer {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 1;
            overflow: hidden;
        }

        /* ===== ARISHEM EYES ===== */

        .arishemEye {
            position: absolute;
            width: 1.9%;
            aspect-ratio: 1/1;
            border-radius: 50%;
            background: radial-gradient(circle,
                rgba(255,255,240,1) 0%,
                rgba(255,255,200,0.95) 30%,
                rgba(255,245,160,0.6) 55%,
                transparent 75%);
            filter: blur(3px);
            animation: eyePulse 3.8s ease-in-out infinite;
        }

        @keyframes eyePulse {
            0%   { opacity: 0.85; transform: scale(0.95); }
            50%  { opacity: 1;    transform: scale(1.15); }
            100% { opacity: 0.85; transform: scale(0.95); }
        }

        /* ===== STARS ===== */

        .star {
    position: absolute;
    border-radius: 50%;
    animation: starTwinkle 3.5s infinite ease-in-out;
    filter: blur(0.8px); /* delikatne rozmycie żeby nie wyglądały jak konfetti */
}

@keyframes starTwinkle {
    0%   { opacity: 0.35; transform: scale(0.9); }
    50%  { opacity: 1;    transform: scale(1.6); }
    100% { opacity: 0.35; transform: scale(0.9); }
        }

        /* ===== COMETS ===== */

        .cosmicComet {
            position: absolute;
            width: 160px;
            height: 3px;
            background: linear-gradient(to right, transparent, white);
            filter: blur(2px);
            animation: cometFly 2.5s linear forwards;
        }

        .goldComet {
            background: linear-gradient(to right, transparent, gold);
            height: 4px;
            filter: blur(3px);
        }

        .bigComet {
            width: 400px;
            height: 6px;
            background: linear-gradient(to right, transparent, white);
            filter: blur(5px);
            animation: cometFlyBig 4s linear forwards;
        }

        @keyframes cometFly {
            0% { transform: translateX(-200px) translateY(-60px) rotate(25deg); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateX(110vw) translateY(75vh) rotate(25deg); opacity: 0; }
        }

        @keyframes cometFlyBig {
            0% { transform: translateX(-300px) translateY(-100px) rotate(25deg); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateX(120vw) translateY(85vh) rotate(25deg); opacity: 0; }
        }

        /* ===== JEFF REFLECTION ===== */

        .jeffGlow {
            position: absolute;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: radial-gradient(circle,
                rgba(255,255,255,0.9) 0%,
                rgba(255,255,255,0.3) 40%,
                transparent 70%);
            filter: blur(8px);
            animation: jeffFlash 6s infinite;
        }

        @keyframes jeffFlash {
            0%, 90%, 100% { opacity: 0; }
            92% { opacity: 1; }
            95% { opacity: 0; }
        }

        @keyframes cosmicFloat {
            0% { transform: translate(-50%, -50%) scale(1.05) rotate(-0.1deg); }
            100% { transform: translate(-50%, -52%) scale(1.09) rotate(0.1deg); }
        }
    `;
    document.head.appendChild(style);

    /* ===== EYES (Twoje ustawienia zostawiam bez zmian) ===== */

    const eyePositions = [
        { left: "62.6%", top: "10.6%" },
        { left: "67.5%", top: "9.0%" }, 
        { left: "63.2%", top: "14.8%" },
        { left: "67.4%", top: "13.4%" },
        { left: "64.0%", top: "18.5%" },
        { left: "67.6%", top: "18.0%" }
    ];

    eyePositions.forEach(pos => {
        const eye = document.createElement("div");
        eye.className = "arishemEye";
        eye.style.left = pos.left;
        eye.style.top = pos.top;
        cosmicLayer.appendChild(eye);
    });

    /* ===== STAR GENERATOR ===== */

    function spawnStars(count = 180) {
        const colors = [
            "white", "white", "white", "white",
            "#9fd3ff",
            "#caa6ff",
            "#fff3a1"
        ];

        for (let i = 0; i < count; i++) {
            const star = document.createElement("div");
            star.className = "star";
            const size = Math.random() * 2 + 1;
            star.style.width = size + "px";
            star.style.height = size + "px";
            star.style.left = Math.random() * 100 + "%";
            star.style.top = Math.random() * 100 + "%";
            star.style.background = colors[Math.floor(Math.random() * colors.length)];
            star.style.boxShadow = `0 0 ${size * 4}px ${star.style.background}`;
            fxLayer.appendChild(star);
        }
    }

    spawnStars(220);

    /* ===== COMETS ===== */

    function spawnComet(type = "normal") {
        const comet = document.createElement("div");
        comet.className = "cosmicComet";

        if (type === "gold") comet.classList.add("goldComet");
        if (type === "big") comet.classList.add("bigComet");

        comet.style.top = Math.random() * 30 + "%";
        fxLayer.appendChild(comet);
        setTimeout(() => comet.remove(), 4000);
    }

    setInterval(() => spawnComet("normal"), 8000);
    setInterval(() => spawnComet("gold"), 25000);
    setInterval(() => spawnComet("big"), 180000);

    /* ===== JEFF BLINK ===== */

    const jeffFlash = document.createElement("div");
    jeffFlash.className = "jeffGlow";
    jeffFlash.style.left = "23%";
    jeffFlash.style.top = "48%";
    fxLayer.appendChild(jeffFlash);

});